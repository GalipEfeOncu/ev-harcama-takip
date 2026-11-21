alter table public.telegram_outbox add column expense_details jsonb;

create function public.telegram_expense_details(expense uuid, household uuid)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'creator', coalesce(author.name, 'Ev üyesi'), 'amount', e.amount_cents,
    'description', e.description, 'category', e.category,
    'payer', case when payer.user_id <> e.created_by_user_id then payer.name end
  )
  from public.expenses e
  left join public.members author on author.household_id = e.household_id and author.user_id = e.created_by_user_id
  left join public.members payer on payer.household_id = e.household_id and payer.id = e.payer_member_id
  where e.id = expense and e.household_id = household
$$;
revoke all on function public.telegram_expense_details(uuid, uuid) from public, anon, authenticated;

create or replace function public.queue_telegram_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.telegram_outbox(group_id, event_kind, event_id, expense_details)
    select id, tg_table_name, new.id,
      case when tg_table_name = 'expenses' then public.telegram_expense_details(new.id, new.household_id) end
    from public.telegram_groups where household_id = new.household_id and active for key share;
  return new;
end;
$$;

update public.telegram_outbox o set expense_details = public.telegram_expense_details(o.event_id, g.household_id)
from public.telegram_groups g where g.id = o.group_id and o.event_kind = 'expenses';

create function public.claim_telegram_delivery()
returns table(job_id bigint, lease_id uuid, attempt int, group_id uuid, chat_id text, household_id uuid, kind text, details jsonb)
language sql set search_path = '' as $$
  with candidate as (
    select o.id from public.telegram_outbox o where o.available_at <= now()
    order by o.available_at, o.id limit 1 for update skip locked
  ), claimed as (
    update public.telegram_outbox o set attempts = attempts + 1, lease = gen_random_uuid(),
      available_at = now() + interval '2 minutes'
    from candidate c where c.id = o.id returning o.*
  )
  select c.id, c.lease, c.attempts, g.id, g.chat_id, g.household_id, c.event_kind, c.expense_details
  from claimed c join public.telegram_groups g on g.id = c.group_id and g.active;
$$;
revoke all on function public.claim_telegram_delivery() from public, anon, authenticated;
grant execute on function public.claim_telegram_delivery() to service_role;
