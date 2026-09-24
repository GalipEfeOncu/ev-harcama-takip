-- Closed ledger rows are immutable to household members. The privileged
-- household-deletion RPC remains able to remove an entire household.
create or replace function public.reject_closed_expense_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.settlement_run_id is not null and auth.role() is distinct from 'service_role' then
    raise exception 'A settled expense cannot be changed or deleted';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.reject_closed_expense_change() from public, anon, authenticated;

drop trigger if exists expenses_reject_closed_change on public.expenses;
create trigger expenses_reject_closed_change
before update or delete on public.expenses
for each row execute function public.reject_closed_expense_change();

-- Only the SECURITY DEFINER close RPC may assign settlement_run_id.
revoke update on table public.expenses from public, anon, authenticated;
grant update (payer_member_id, amount_cents, description, category, expense_date)
  on table public.expenses to authenticated;

drop policy if exists expenses_update_member on public.expenses;
create policy expenses_update_member on public.expenses
for update to authenticated
using (public.is_household_member(household_id) and settlement_run_id is null)
with check (
  public.is_household_member(household_id)
  and exists (
    select 1 from public.members member
    where member.id = payer_member_id
      and member.household_id = expenses.household_id
      and member.active = true
  )
  and (
    settlement_run_id is null
    or exists (
      select 1 from public.settlement_runs run
      where run.id = settlement_run_id and run.household_id = expenses.household_id
    )
  )
);

drop policy if exists expenses_delete_member on public.expenses;
create policy expenses_delete_member on public.expenses
for delete to authenticated
using (public.is_household_member(household_id) and settlement_run_id is null);

drop policy if exists participants_write_member on public.expense_participants;
create policy participants_write_member on public.expense_participants
for all to authenticated
using (
  exists (
    select 1 from public.expenses expense
    where expense.id = expense_id
      and expense.settlement_run_id is null
      and public.is_household_member(expense.household_id)
  )
)
with check (
  exists (
    select 1 from public.expenses expense
    join public.members member on member.id = member_id
    where expense.id = expense_id
      and expense.settlement_run_id is null
      and public.is_household_member(expense.household_id)
      and member.household_id = expense.household_id
      and member.active = true
  )
);

drop policy if exists settlement_runs_member on public.settlement_runs;
create policy settlement_runs_member on public.settlement_runs
for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists settlements_member on public.settlements;
create policy settlements_member on public.settlements
for select to authenticated
using (public.is_household_member(household_id));

revoke insert, update, delete, truncate, references, trigger
  on table public.settlement_runs, public.settlements from public, anon, authenticated;
grant select on table public.settlement_runs, public.settlements to authenticated;
