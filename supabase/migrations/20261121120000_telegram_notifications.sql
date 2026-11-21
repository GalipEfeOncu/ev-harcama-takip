create table public.telegram_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null unique references public.households on delete cascade,
  owner_id uuid not null references auth.users on delete cascade,
  chat_id text unique,
  title text,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  active boolean not null default false,
  check (not active or chat_id is not null)
);

create table public.telegram_outbox (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.telegram_groups on delete cascade,
  event_kind text not null check (event_kind in ('expenses','debt_payments','settlement_runs')),
  event_id uuid not null,
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease uuid,
  failed boolean not null default false,
  unique(group_id, event_kind, event_id)
);
create index telegram_outbox_due on public.telegram_outbox(available_at, id) where not failed;

alter table public.telegram_groups enable row level security;
alter table public.telegram_outbox enable row level security;
revoke all on public.telegram_groups, public.telegram_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.telegram_groups, public.telegram_outbox to service_role;

create function public.queue_telegram_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.telegram_outbox(group_id, event_kind, event_id)
    select id, tg_table_name, new.id from public.telegram_groups
    where household_id = new.household_id and active
    for key share;
  return new;
end;
$$;
revoke all on function public.queue_telegram_event() from public, anon, authenticated;

create trigger telegram_new_expense after insert on public.expenses
for each row execute function public.queue_telegram_event();
create trigger telegram_new_payment after insert on public.debt_payments
for each row execute function public.queue_telegram_event();
create trigger telegram_closed_period after insert on public.settlement_runs
for each row execute function public.queue_telegram_event();

create function public.claim_telegram_job()
returns table(job_id bigint, lease_id uuid, attempt integer, group_id uuid, chat_id text, household_id uuid, kind text)
language sql set search_path = '' as $$
  with candidate as (
    select o.id from public.telegram_outbox o
    where not o.failed and o.available_at <= now()
    order by o.available_at, o.id limit 1 for update skip locked
  ), claimed as (
    update public.telegram_outbox o set attempts = attempts + 1, lease = gen_random_uuid(),
      available_at = now() + interval '2 minutes'
    from candidate c where c.id = o.id returning o.*
  )
  select c.id, c.lease, c.attempts, g.id, g.chat_id, g.household_id, c.event_kind
  from claimed c join public.telegram_groups g on g.id = c.group_id and g.active;
$$;
revoke all on function public.claim_telegram_job() from public, anon, authenticated;
grant execute on function public.claim_telegram_job() to service_role;
