create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_member_id uuid not null references public.members(id) on delete restrict,
  to_member_id uuid not null references public.members(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  paid_at date not null default current_date,
  description text not null default '',
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  settlement_run_id uuid references public.settlement_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_member_id <> to_member_id),
  check (char_length(trim(description)) <= 160)
);

create index if not exists debt_payments_household_date_idx
  on public.debt_payments(household_id, paid_at desc);
create index if not exists debt_payments_open_idx
  on public.debt_payments(household_id)
  where settlement_run_id is null;

alter table public.debt_payments enable row level security;

drop policy if exists debt_payments_member_select on public.debt_payments;
create policy debt_payments_member_select on public.debt_payments
for select to authenticated
using (public.is_household_member(household_id));

revoke all on table public.debt_payments from public, anon, authenticated;
grant select on table public.debt_payments to authenticated;

create or replace function public.lock_household_for_ledger_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household_id uuid;
  target_expense_id uuid;
begin
  if tg_table_name = 'expense_participants' then
    if tg_op = 'DELETE' then
      target_expense_id := old.expense_id;
    else
      target_expense_id := new.expense_id;
    end if;

    select expense.household_id
    into target_household_id
    from public.expenses expense
    where expense.id = target_expense_id;
  elsif tg_op = 'DELETE' then
    target_household_id := old.household_id;
  else
    target_household_id := new.household_id;
  end if;

  if target_household_id is not null then
    perform household.id
    from public.households household
    where household.id = target_household_id
    for update;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.lock_household_for_ledger_write() from public, anon, authenticated;

drop trigger if exists members_lock_household_for_ledger_write on public.members;
create trigger members_lock_household_for_ledger_write
before insert or update or delete on public.members
for each row execute function public.lock_household_for_ledger_write();

drop trigger if exists expenses_lock_household_for_ledger_write on public.expenses;
create trigger expenses_lock_household_for_ledger_write
before insert or update or delete on public.expenses
for each row execute function public.lock_household_for_ledger_write();

drop trigger if exists expense_participants_lock_household_for_ledger_write on public.expense_participants;
create trigger expense_participants_lock_household_for_ledger_write
before insert or update or delete on public.expense_participants
for each row execute function public.lock_household_for_ledger_write();

create or replace function public.require_google_for_debt_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from auth.users user_account
    where user_account.id = auth.uid()
      and coalesce(user_account.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  ) then
    raise exception 'A Google account is required to change household data';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.require_google_for_debt_payment() from public, anon, authenticated;

drop trigger if exists debt_payments_require_google_identity on public.debt_payments;
create trigger debt_payments_require_google_identity
before insert or update or delete on public.debt_payments
for each row execute function public.require_google_for_debt_payment();

drop trigger if exists debt_payments_lock_household_for_ledger_write on public.debt_payments;
create trigger debt_payments_lock_household_for_ledger_write
before insert or update or delete on public.debt_payments
for each row execute function public.lock_household_for_ledger_write();

create or replace function public.record_debt_payment_atomic(
  p_household_id uuid,
  p_from_member_id uuid,
  p_to_member_id uuid,
  p_amount_cents bigint,
  p_paid_at date,
  p_description text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  payment_id uuid;
  from_balance numeric;
  to_balance numeric;
begin
  if auth.uid() is null or not exists (
    select 1
    from auth.users user_account
    where user_account.id = auth.uid()
      and coalesce(user_account.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  ) then
    raise exception 'A Google account is required to change household data';
  end if;

  perform household.id
  from public.households household
  where household.id = p_household_id
  for update;
  if not found then
    raise exception 'Household not found';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership is required';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Payment amount must be greater than zero';
  end if;
  if p_paid_at is null then
    raise exception 'Payment date is required';
  end if;
  if char_length(trim(coalesce(p_description, ''))) > 160 then
    raise exception 'Payment note cannot exceed 160 characters';
  end if;
  if p_from_member_id is null or p_to_member_id is null or p_from_member_id = p_to_member_id then
    raise exception 'Payment sender and recipient must be different household members';
  end if;
  if not exists (
    select 1 from public.members member
    where member.id = p_from_member_id
      and member.household_id = p_household_id
      and member.active = true
  ) or not exists (
    select 1 from public.members member
    where member.id = p_to_member_id
      and member.household_id = p_household_id
      and member.active = true
  ) then
    raise exception 'Payment sender and recipient must be active household members';
  end if;

  with ledger_deltas as (
    select expense.payer_member_id as member_id, expense.amount_cents::numeric as delta_cents
    from public.expenses expense
    where expense.household_id = p_household_id
      and expense.settlement_run_id is null
    union all
    select participant.member_id, -participant.share_cents::numeric
    from public.expense_participants participant
    join public.expenses expense on expense.id = participant.expense_id
    where expense.household_id = p_household_id
      and expense.settlement_run_id is null
    union all
    select payment.from_member_id, payment.amount_cents::numeric
    from public.debt_payments payment
    where payment.household_id = p_household_id
      and payment.settlement_run_id is null
    union all
    select payment.to_member_id, -payment.amount_cents::numeric
    from public.debt_payments payment
    where payment.household_id = p_household_id
      and payment.settlement_run_id is null
  ), balances as (
    select member_id, sum(delta_cents) as amount_cents
    from ledger_deltas
    group by member_id
  )
  select
    coalesce(sum(balance.amount_cents) filter (where balance.member_id = p_from_member_id), 0),
    coalesce(sum(balance.amount_cents) filter (where balance.member_id = p_to_member_id), 0)
  into from_balance, to_balance
  from balances balance;

  if from_balance >= 0 then
    raise exception 'The selected sender does not currently owe money';
  end if;
  if to_balance <= 0 then
    raise exception 'The selected recipient is not currently owed money';
  end if;
  if p_amount_cents::numeric > least(abs(from_balance), to_balance) then
    raise exception 'Payment exceeds the open debt between these balances';
  end if;

  insert into public.debt_payments (
    household_id,
    from_member_id,
    to_member_id,
    amount_cents,
    paid_at,
    description,
    created_by_user_id
  )
  values (
    p_household_id,
    p_from_member_id,
    p_to_member_id,
    p_amount_cents,
    p_paid_at,
    trim(coalesce(p_description, '')),
    auth.uid()
  )
  returning id into payment_id;

  return payment_id;
end;
$$;

revoke all on function public.record_debt_payment_atomic(uuid, uuid, uuid, bigint, date, text) from public, anon, authenticated;
grant execute on function public.record_debt_payment_atomic(uuid, uuid, uuid, bigint, date, text) to authenticated;

create or replace function public.close_settlement_atomic(
  p_household_id uuid,
  p_expense_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  run_id uuid;
  requested_expense_ids uuid[] := coalesce(p_expense_ids, array[]::uuid[]);
  open_expense_count integer;
  open_payment_count integer;
  selected_expense_count integer;
  unique_expense_count integer;
  updated_expense_count integer;
  updated_payment_count integer;
  net_delta numeric;
begin
  if auth.uid() is null or not exists (
    select 1
    from auth.users user_account
    where user_account.id = auth.uid()
      and coalesce(user_account.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  ) then
    raise exception 'A Google account is required to change household data';
  end if;

  perform household.id
  from public.households household
  where household.id = p_household_id
  for update;
  if not found then
    raise exception 'Household not found';
  end if;
  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership is required';
  end if;

  if exists (
    select 1 from unnest(requested_expense_ids) as requested(expense_id)
    where requested.expense_id is null
  ) then
    raise exception 'Expense list is invalid';
  end if;

  select count(distinct requested.expense_id)::integer
  into unique_expense_count
  from unnest(requested_expense_ids) as requested(expense_id);
  if unique_expense_count <> cardinality(requested_expense_ids) then
    raise exception 'Expense list cannot contain duplicates';
  end if;

  select count(*)::integer into open_expense_count
  from public.expenses expense
  where expense.household_id = p_household_id
    and expense.settlement_run_id is null;
  select count(*)::integer into open_payment_count
  from public.debt_payments payment
  where payment.household_id = p_household_id
    and payment.settlement_run_id is null;

  if open_expense_count + open_payment_count = 0 then
    raise exception 'There are no open expenses or direct payments to settle';
  end if;
  if cardinality(requested_expense_ids) <> open_expense_count then
    raise exception 'The settlement must include every open expense';
  end if;

  perform expense.id
  from public.expenses expense
  where expense.household_id = p_household_id
    and expense.id = any(requested_expense_ids)
    and expense.settlement_run_id is null
  order by expense.id
  for update;
  get diagnostics selected_expense_count = row_count;
  if selected_expense_count <> open_expense_count then
    raise exception 'Some expenses are missing or already settled';
  end if;

  if exists (
    select 1
    from public.expenses expense
    where expense.household_id = p_household_id
      and expense.settlement_run_id is null
      and (
        not exists (
          select 1 from public.members payer
          where payer.id = expense.payer_member_id
            and payer.household_id = p_household_id
            and payer.active = true
        )
        or (
          select coalesce(sum(participant.share_cents), 0)
          from public.expense_participants participant
          where participant.expense_id = expense.id
        ) <> expense.amount_cents
        or exists (
          select 1
          from public.expense_participants participant
          left join public.members member on member.id = participant.member_id
          where participant.expense_id = expense.id
            and (member.id is null or member.household_id <> p_household_id or member.active = false)
        )
      )
  ) then
    raise exception 'Open expenses contain invalid participant data';
  end if;

  if exists (
    select 1
    from public.debt_payments payment
    left join public.members sender on sender.id = payment.from_member_id
    left join public.members recipient on recipient.id = payment.to_member_id
    where payment.household_id = p_household_id
      and payment.settlement_run_id is null
      and (
        payment.amount_cents <= 0
        or sender.id is null or sender.household_id <> p_household_id or sender.active = false
        or recipient.id is null or recipient.household_id <> p_household_id or recipient.active = false
        or payment.from_member_id = payment.to_member_id
      )
  ) then
    raise exception 'Open direct payments contain invalid member data';
  end if;

  with ledger_deltas as (
    select expense.payer_member_id as member_id, expense.amount_cents::numeric as delta_cents
    from public.expenses expense
    where expense.household_id = p_household_id and expense.settlement_run_id is null
    union all
    select participant.member_id, -participant.share_cents::numeric
    from public.expense_participants participant
    join public.expenses expense on expense.id = participant.expense_id
    where expense.household_id = p_household_id and expense.settlement_run_id is null
    union all
    select payment.from_member_id, payment.amount_cents::numeric
    from public.debt_payments payment
    where payment.household_id = p_household_id and payment.settlement_run_id is null
    union all
    select payment.to_member_id, -payment.amount_cents::numeric
    from public.debt_payments payment
    where payment.household_id = p_household_id and payment.settlement_run_id is null
  ), balances as (
    select member_id, sum(delta_cents) as amount_cents
    from ledger_deltas
    group by member_id
  )
  select coalesce(sum(balance.amount_cents), 0)
  into net_delta
  from balances balance;
  if net_delta <> 0 then
    raise exception 'Open ledger does not balance; check expense shares and direct payments';
  end if;

  insert into public.settlement_runs (household_id, created_by_user_id)
  values (p_household_id, auth.uid())
  returning id into run_id;

  with ledger_deltas as (
    select expense.payer_member_id as member_id, expense.amount_cents::numeric as delta_cents
    from public.expenses expense
    where expense.household_id = p_household_id and expense.settlement_run_id is null
    union all
    select participant.member_id, -participant.share_cents::numeric
    from public.expense_participants participant
    join public.expenses expense on expense.id = participant.expense_id
    where expense.household_id = p_household_id and expense.settlement_run_id is null
    union all
    select payment.from_member_id, payment.amount_cents::numeric
    from public.debt_payments payment
    where payment.household_id = p_household_id and payment.settlement_run_id is null
    union all
    select payment.to_member_id, -payment.amount_cents::numeric
    from public.debt_payments payment
    where payment.household_id = p_household_id and payment.settlement_run_id is null
  ), net_balances as (
    select member_id, sum(delta_cents) as balance_cents
    from ledger_deltas
    group by member_id
    having sum(delta_cents) <> 0
  ), creditor_amounts as (
    select member_id, balance_cents as amount_cents
    from net_balances where balance_cents > 0
  ), creditors as (
    select member_id, amount_cents,
      sum(amount_cents) over (order by amount_cents desc, member_id) - amount_cents as start_cents,
      sum(amount_cents) over (order by amount_cents desc, member_id) as end_cents
    from creditor_amounts
  ), debtor_amounts as (
    select member_id, -balance_cents as amount_cents
    from net_balances where balance_cents < 0
  ), debtors as (
    select member_id, amount_cents,
      sum(amount_cents) over (order by amount_cents desc, member_id) - amount_cents as start_cents,
      sum(amount_cents) over (order by amount_cents desc, member_id) as end_cents
    from debtor_amounts
  )
  insert into public.settlements (
    settlement_run_id,
    household_id,
    from_member_id,
    to_member_id,
    amount_cents
  )
  select
    run_id,
    p_household_id,
    debtor.member_id,
    creditor.member_id,
    (least(debtor.end_cents, creditor.end_cents) - greatest(debtor.start_cents, creditor.start_cents))::bigint
  from debtors debtor
  cross join creditors creditor
  where least(debtor.end_cents, creditor.end_cents) > greatest(debtor.start_cents, creditor.start_cents);

  update public.expenses
  set settlement_run_id = run_id
  where household_id = p_household_id
    and settlement_run_id is null;
  get diagnostics updated_expense_count = row_count;
  if updated_expense_count <> open_expense_count then
    raise exception 'Not all expenses could be settled';
  end if;

  update public.debt_payments
  set settlement_run_id = run_id
  where household_id = p_household_id
    and settlement_run_id is null;
  get diagnostics updated_payment_count = row_count;
  if updated_payment_count <> open_payment_count then
    raise exception 'Not all direct payments could be settled';
  end if;

  return run_id;
end;
$$;

revoke all on function public.close_settlement_atomic(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.close_settlement_atomic(uuid, uuid[]) to authenticated;
