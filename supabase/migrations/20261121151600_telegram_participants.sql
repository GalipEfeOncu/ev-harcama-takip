create function public.telegram_participant_names(expense uuid, household uuid)
returns jsonb language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(m.name order by m.name, m.id), '[]'::jsonb)
  from public.expense_participants p
  join public.members m on m.id = p.member_id and m.household_id = household
  join public.expenses e on e.id = p.expense_id and e.household_id = household
  where p.expense_id = expense;
$$;
revoke all on function public.telegram_participant_names(uuid, uuid) from public, anon, authenticated;

create or replace function public.telegram_expense_details(expense uuid, household uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'creator', coalesce(author.name, 'Ev üyesi'), 'amount', e.amount_cents,
    'description', e.description, 'category', e.category,
    'payer', case when payer.user_id <> e.created_by_user_id then payer.name end,
    'participants', public.telegram_participant_names(e.id, e.household_id)
  )
  from public.expenses e
  left join public.members author on author.household_id = e.household_id and author.user_id = e.created_by_user_id
  left join public.members payer on payer.household_id = e.household_id and payer.id = e.payer_member_id
  where e.id = expense and e.household_id = household;
$$;

-- The expense RPC inserts shares after the expense itself, within the same transaction.
drop trigger telegram_new_expense on public.expenses;
create constraint trigger telegram_new_expense after insert on public.expenses
deferrable initially deferred for each row execute function public.queue_telegram_event();

update public.telegram_outbox o set expense_details = o.expense_details ||
  jsonb_build_object('participants', public.telegram_participant_names(o.event_id, g.household_id))
from public.telegram_groups g where g.id = o.group_id and o.event_kind = 'expenses';
