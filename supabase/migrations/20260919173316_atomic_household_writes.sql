drop policy if exists members_update_self_or_owner on public.members;
drop policy if exists members_update_owner_only on public.members;
create policy members_update_owner_only on public.members
for update to authenticated
using (public.is_household_owner(household_id))
with check (public.is_household_owner(household_id));

drop policy if exists expenses_update_member on public.expenses;
create policy expenses_update_member on public.expenses
for update to authenticated
using (public.is_household_member(household_id))
with check (
  public.is_household_member(household_id)
  and exists (
    select 1
    from public.members member
    where member.id = payer_member_id
      and member.household_id = expenses.household_id
      and member.active = true
  )
  and (
    settlement_run_id is null
    or exists (
      select 1
      from public.settlement_runs run
      where run.id = settlement_run_id
        and run.household_id = expenses.household_id
    )
  )
);

drop policy if exists participants_write_member on public.expense_participants;
create policy participants_write_member on public.expense_participants
for all to authenticated
using (
  exists (
    select 1
    from public.expenses expense
    where expense.id = expense_id
      and public.is_household_member(expense.household_id)
  )
)
with check (
  exists (
    select 1
    from public.expenses expense
    join public.members member on member.id = member_id
    where expense.id = expense_id
      and public.is_household_member(expense.household_id)
      and member.household_id = expense.household_id
      and member.active = true
  )
);

drop policy if exists settlements_member on public.settlements;
create policy settlements_member on public.settlements
for all to authenticated
using (public.is_household_member(household_id))
with check (
  public.is_household_member(household_id)
  and exists (
    select 1
    from public.settlement_runs run
    where run.id = settlement_run_id
      and run.household_id = settlements.household_id
  )
  and exists (
    select 1
    from public.members member
    where member.id = from_member_id
      and member.household_id = settlements.household_id
      and member.active = true
  )
  and exists (
    select 1
    from public.members member
    where member.id = to_member_id
      and member.household_id = settlements.household_id
      and member.active = true
  )
);

create or replace function public.create_expense_atomic(
  p_household_id uuid,
  p_payer_member_id uuid,
  p_amount_cents bigint,
  p_description text,
  p_category text,
  p_expense_date date,
  p_participant_member_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_participant_count integer;
  v_unique_count integer;
  v_participant record;
  v_share_cents bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership is required';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if p_description is null or char_length(trim(p_description)) not between 2 and 160 then
    raise exception 'Expense description must contain between 2 and 160 characters';
  end if;

  if p_category is null or char_length(trim(p_category)) > 80 then
    raise exception 'Expense category is invalid';
  end if;

  if p_expense_date is null then
    raise exception 'Expense date is required';
  end if;

  if not exists (
    select 1
    from public.members member
    where member.id = p_payer_member_id
      and member.household_id = p_household_id
      and member.active = true
  ) then
    raise exception 'Payer must be an active member of this household';
  end if;

  if p_participant_member_ids is null or cardinality(p_participant_member_ids) = 0 then
    raise exception 'An expense needs at least one participant';
  end if;

  if exists (
    select 1
    from unnest(p_participant_member_ids) as requested(member_id)
    where requested.member_id is null
  ) then
    raise exception 'Expense participants are invalid';
  end if;

  select count(distinct requested.member_id)::integer
  into v_unique_count
  from unnest(p_participant_member_ids) as requested(member_id);

  v_participant_count := cardinality(p_participant_member_ids);
  if v_unique_count <> v_participant_count then
    raise exception 'Expense participants cannot contain duplicates';
  end if;

  if exists (
    select 1
    from unnest(p_participant_member_ids) as requested(member_id)
    where not exists (
      select 1
      from public.members member
      where member.id = requested.member_id
        and member.household_id = p_household_id
        and member.active = true
    )
  ) then
    raise exception 'Every participant must be an active member of this household';
  end if;

  insert into public.expenses (
    household_id,
    payer_member_id,
    amount_cents,
    description,
    category,
    expense_date,
    created_by_user_id
  )
  values (
    p_household_id,
    p_payer_member_id,
    p_amount_cents,
    trim(p_description),
    coalesce(nullif(trim(p_category), ''), 'Genel'),
    p_expense_date,
    auth.uid()
  )
  returning id into v_expense_id;

  for v_participant in
    select requested.member_id, requested.ordinality
    from unnest(p_participant_member_ids) with ordinality as requested(member_id, ordinality)
    order by requested.ordinality
  loop
    v_share_cents :=
      (p_amount_cents / v_participant_count)
      + case
          when v_participant.ordinality <= p_amount_cents % v_participant_count then 1
          else 0
        end;

    insert into public.expense_participants (expense_id, member_id, share_cents)
    values (v_expense_id, v_participant.member_id, v_share_cents);
  end loop;

  return v_expense_id;
end;
$$;

create or replace function public.update_expense_atomic(
  p_household_id uuid,
  p_expense_id uuid,
  p_payer_member_id uuid,
  p_amount_cents bigint,
  p_description text,
  p_category text,
  p_expense_date date,
  p_participant_member_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense_id uuid;
  v_participant_count integer;
  v_unique_count integer;
  v_participant record;
  v_share_cents bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership is required';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if p_description is null or char_length(trim(p_description)) not between 2 and 160 then
    raise exception 'Expense description must contain between 2 and 160 characters';
  end if;

  if p_category is null or char_length(trim(p_category)) > 80 then
    raise exception 'Expense category is invalid';
  end if;

  if p_expense_date is null then
    raise exception 'Expense date is required';
  end if;

  if not exists (
    select 1
    from public.members member
    where member.id = p_payer_member_id
      and member.household_id = p_household_id
      and member.active = true
  ) then
    raise exception 'Payer must be an active member of this household';
  end if;

  if p_participant_member_ids is null or cardinality(p_participant_member_ids) = 0 then
    raise exception 'An expense needs at least one participant';
  end if;

  if exists (
    select 1
    from unnest(p_participant_member_ids) as requested(member_id)
    where requested.member_id is null
  ) then
    raise exception 'Expense participants are invalid';
  end if;

  select count(distinct requested.member_id)::integer
  into v_unique_count
  from unnest(p_participant_member_ids) as requested(member_id);

  v_participant_count := cardinality(p_participant_member_ids);
  if v_unique_count <> v_participant_count then
    raise exception 'Expense participants cannot contain duplicates';
  end if;

  if exists (
    select 1
    from unnest(p_participant_member_ids) as requested(member_id)
    where not exists (
      select 1
      from public.members member
      where member.id = requested.member_id
        and member.household_id = p_household_id
        and member.active = true
    )
  ) then
    raise exception 'Every participant must be an active member of this household';
  end if;

  update public.expenses
  set payer_member_id = p_payer_member_id,
      amount_cents = p_amount_cents,
      description = trim(p_description),
      category = coalesce(nullif(trim(p_category), ''), 'Genel'),
      expense_date = p_expense_date
  where id = p_expense_id
    and household_id = p_household_id
  returning id into v_expense_id;

  if not found then
    raise exception 'Expense not found';
  end if;

  delete from public.expense_participants
  where expense_id = v_expense_id;

  for v_participant in
    select requested.member_id, requested.ordinality
    from unnest(p_participant_member_ids) with ordinality as requested(member_id, ordinality)
    order by requested.ordinality
  loop
    v_share_cents :=
      (p_amount_cents / v_participant_count)
      + case
          when v_participant.ordinality <= p_amount_cents % v_participant_count then 1
          else 0
        end;

    insert into public.expense_participants (expense_id, member_id, share_cents)
    values (v_expense_id, v_participant.member_id, v_share_cents);
  end loop;

  return v_expense_id;
end;
$$;

create or replace function public.close_settlement_atomic(
  p_household_id uuid,
  p_expense_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_matching_count integer;
  v_unique_count integer;
  v_updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership is required';
  end if;

  if p_expense_ids is null or cardinality(p_expense_ids) = 0 then
    raise exception 'At least one open expense is required';
  end if;

  if exists (
    select 1
    from unnest(p_expense_ids) as requested(expense_id)
    where requested.expense_id is null
  ) then
    raise exception 'Expense list is invalid';
  end if;

  select count(distinct requested.expense_id)::integer
  into v_unique_count
  from unnest(p_expense_ids) as requested(expense_id);

  if v_unique_count <> cardinality(p_expense_ids) then
    raise exception 'Expense list cannot contain duplicates';
  end if;

  perform expense.id
  from public.expenses expense
  where expense.household_id = p_household_id
    and expense.id = any(p_expense_ids)
    and expense.settlement_run_id is null
  order by expense.id
  for update;

  get diagnostics v_matching_count = row_count;
  if v_matching_count <> cardinality(p_expense_ids) then
    raise exception 'Some expenses are missing or already settled';
  end if;

  if exists (
    select 1
    from public.expenses expense
    where expense.id = any(p_expense_ids)
      and (
        not exists (
          select 1
          from public.members payer
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
            and (
              member.id is null
              or member.household_id <> p_household_id
              or member.active = false
            )
        )
      )
  ) then
    raise exception 'Expenses contain invalid participant data';
  end if;

  insert into public.settlement_runs (household_id, created_by_user_id)
  values (p_household_id, auth.uid())
  returning id into v_run_id;

  with target_expenses as (
    select expense.id, expense.payer_member_id, expense.amount_cents
    from public.expenses expense
    where expense.household_id = p_household_id
      and expense.id = any(p_expense_ids)
      and expense.settlement_run_id is null
  ),
  raw_balances as (
    select expense.payer_member_id as member_id, expense.amount_cents::numeric as delta_cents
    from target_expenses expense
    union all
    select participant.member_id, -participant.share_cents::numeric
    from public.expense_participants participant
    join target_expenses expense on expense.id = participant.expense_id
  ),
  net_balances as (
    select member_id, sum(delta_cents) as balance_cents
    from raw_balances
    group by member_id
    having sum(delta_cents) <> 0
  ),
  creditor_amounts as (
    select member_id, balance_cents as amount_cents
    from net_balances
    where balance_cents > 0
  ),
  creditors as (
    select
      member_id,
      amount_cents,
      sum(amount_cents) over (order by amount_cents desc, member_id) - amount_cents as start_cents,
      sum(amount_cents) over (order by amount_cents desc, member_id) as end_cents
    from creditor_amounts
  ),
  debtor_amounts as (
    select member_id, -balance_cents as amount_cents
    from net_balances
    where balance_cents < 0
  ),
  debtors as (
    select
      member_id,
      amount_cents,
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
    v_run_id,
    p_household_id,
    debtor.member_id,
    creditor.member_id,
    (least(debtor.end_cents, creditor.end_cents) - greatest(debtor.start_cents, creditor.start_cents))::bigint
  from debtors debtor
  cross join creditors creditor
  where least(debtor.end_cents, creditor.end_cents) > greatest(debtor.start_cents, creditor.start_cents);

  update public.expenses
  set settlement_run_id = v_run_id
  where household_id = p_household_id
    and id = any(p_expense_ids)
    and settlement_run_id is null;

  get diagnostics v_updated_count = row_count;
  if v_updated_count <> v_matching_count then
    raise exception 'Not all expenses could be settled';
  end if;

  return v_run_id;
end;
$$;

revoke all on function public.create_expense_atomic(uuid, uuid, bigint, text, text, date, uuid[]) from public, anon, authenticated;
revoke all on function public.update_expense_atomic(uuid, uuid, uuid, bigint, text, text, date, uuid[]) from public, anon, authenticated;
revoke all on function public.close_settlement_atomic(uuid, uuid[]) from public, anon, authenticated;

grant execute on function public.create_expense_atomic(uuid, uuid, bigint, text, text, date, uuid[]) to authenticated;
grant execute on function public.update_expense_atomic(uuid, uuid, uuid, bigint, text, text, date, uuid[]) to authenticated;
grant execute on function public.close_settlement_atomic(uuid, uuid[]) to authenticated;
