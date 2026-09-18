create extension if not exists pgcrypto;

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  join_code_hash text not null unique,
  join_code_created_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 80),
  role text not null default 'member' check (role in ('owner', 'member')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create table if not exists public.settlement_runs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  payer_member_id uuid not null references public.members(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  description text not null check (char_length(trim(description)) between 2 and 160),
  category text not null default 'Genel',
  expense_date date not null default current_date,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  settlement_run_id uuid references public.settlement_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.expense_participants (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete restrict,
  share_cents bigint not null check (share_cents >= 0),
  primary key (expense_id, member_id)
);

create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  settlement_run_id uuid not null references public.settlement_runs(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  from_member_id uuid not null references public.members(id) on delete restrict,
  to_member_id uuid not null references public.members(id) on delete restrict,
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  check (from_member_id <> to_member_id)
);

create index if not exists members_user_id_idx on public.members(user_id);
create index if not exists members_household_id_idx on public.members(household_id);
create index if not exists expenses_household_date_idx on public.expenses(household_id, expense_date desc);
create index if not exists expenses_open_idx on public.expenses(household_id) where settlement_run_id is null;
create index if not exists participants_member_id_idx on public.expense_participants(member_id);

create or replace function public.is_household_member(household_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members
    where household_id = household_uuid
      and user_id = auth.uid()
      and active = true
  );
$$;

create or replace function public.is_household_owner(household_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.households
    where id = household_uuid
      and owner_user_id = auth.uid()
  );
$$;

create or replace function public.create_household(household_name text, member_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_household public.households;
  new_member public.members;
  plain_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  plain_code := 'EV-' || upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

  insert into public.households (name, owner_user_id, join_code_hash)
  values (
    trim(household_name),
    auth.uid(),
    encode(digest(lower(plain_code), 'sha256'), 'hex')
  )
  returning * into new_household;

  insert into public.members (household_id, user_id, name, role)
  values (new_household.id, auth.uid(), trim(member_name), 'owner')
  returning * into new_member;

  return jsonb_build_object(
    'household_id', new_household.id,
    'household_name', new_household.name,
    'member_id', new_member.id,
    'join_code', plain_code,
    'role', new_member.role
  );
end;
$$;

create or replace function public.join_household(join_code text, member_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_household public.households;
  new_member public.members;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  select * into target_household
  from public.households
  where join_code_hash = encode(digest(lower(trim(join_code)), 'sha256'), 'hex');

  if target_household.id is null then
    raise exception 'Invalid household code';
  end if;

  insert into public.members (household_id, user_id, name, role)
  values (target_household.id, auth.uid(), trim(member_name), 'member')
  on conflict (household_id, user_id)
  do update set name = excluded.name, active = true
  returning * into new_member;

  return jsonb_build_object(
    'household_id', target_household.id,
    'household_name', target_household.name,
    'member_id', new_member.id,
    'join_code', trim(join_code),
    'role', new_member.role
  );
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists expenses_touch_updated_at on public.expenses;
create trigger expenses_touch_updated_at
before update on public.expenses
for each row execute function public.touch_updated_at();

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_participants enable row level security;
alter table public.settlement_runs enable row level security;
alter table public.settlements enable row level security;

drop policy if exists households_select_member on public.households;
create policy households_select_member on public.households
for select to authenticated
using (public.is_household_member(id));

drop policy if exists households_update_owner on public.households;
create policy households_update_owner on public.households
for update to authenticated
using (public.is_household_owner(id))
with check (public.is_household_owner(id));

drop policy if exists members_select_member on public.members;
create policy members_select_member on public.members
for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists members_update_self_or_owner on public.members;
create policy members_update_self_or_owner on public.members
for update to authenticated
using (user_id = auth.uid() or public.is_household_owner(household_id))
with check (user_id = auth.uid() or public.is_household_owner(household_id));

drop policy if exists expenses_select_member on public.expenses;
create policy expenses_select_member on public.expenses
for select to authenticated
using (public.is_household_member(household_id));

drop policy if exists expenses_insert_member on public.expenses;
create policy expenses_insert_member on public.expenses
for insert to authenticated
with check (
  public.is_household_member(household_id)
  and created_by_user_id = auth.uid()
  and exists (
    select 1 from public.members
    where id = payer_member_id and household_id = expenses.household_id and active = true
  )
);

drop policy if exists expenses_update_member on public.expenses;
create policy expenses_update_member on public.expenses
for update to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

drop policy if exists expenses_delete_member on public.expenses;
create policy expenses_delete_member on public.expenses
for delete to authenticated
using (public.is_household_member(household_id));

drop policy if exists participants_select_member on public.expense_participants;
create policy participants_select_member on public.expense_participants
for select to authenticated
using (exists (select 1 from public.expenses where id = expense_id and public.is_household_member(household_id)));

drop policy if exists participants_write_member on public.expense_participants;
create policy participants_write_member on public.expense_participants
for all to authenticated
using (exists (select 1 from public.expenses where id = expense_id and public.is_household_member(household_id)))
with check (exists (select 1 from public.expenses where id = expense_id and public.is_household_member(household_id)));

drop policy if exists settlement_runs_member on public.settlement_runs;
create policy settlement_runs_member on public.settlement_runs
for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id) and created_by_user_id = auth.uid());

drop policy if exists settlements_member on public.settlements;
create policy settlements_member on public.settlements
for all to authenticated
using (public.is_household_member(household_id))
with check (public.is_household_member(household_id));

grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
