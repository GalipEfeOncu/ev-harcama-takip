create or replace function public.require_google_identity_for_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required';
  end if;

  if not exists (
    select 1
    from auth.users user_account
    where user_account.id = current_user_id
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

revoke all on function public.require_google_identity_for_write() from public, anon, authenticated;

drop trigger if exists households_require_google_identity on public.households;
create trigger households_require_google_identity
before insert or update or delete on public.households
for each row execute function public.require_google_identity_for_write();

drop trigger if exists members_require_google_identity on public.members;
create trigger members_require_google_identity
before insert or update or delete on public.members
for each row execute function public.require_google_identity_for_write();

drop trigger if exists expenses_require_google_identity on public.expenses;
create trigger expenses_require_google_identity
before insert or update or delete on public.expenses
for each row execute function public.require_google_identity_for_write();

drop trigger if exists participants_require_google_identity on public.expense_participants;
create trigger participants_require_google_identity
before insert or update or delete on public.expense_participants
for each row execute function public.require_google_identity_for_write();

drop trigger if exists settlement_runs_require_google_identity on public.settlement_runs;
create trigger settlement_runs_require_google_identity
before insert or update or delete on public.settlement_runs
for each row execute function public.require_google_identity_for_write();

drop trigger if exists settlements_require_google_identity on public.settlements;
create trigger settlements_require_google_identity
before insert or update or delete on public.settlements
for each row execute function public.require_google_identity_for_write();

create or replace function public.rotate_household_join_code(p_household_id uuid)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  plain_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_household_owner(p_household_id) then
    raise exception 'Only the household owner can rotate its invite code';
  end if;

  plain_code := 'EV-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

  update public.households
  set join_code_hash = encode(extensions.digest(lower(plain_code), 'sha256'), 'hex'),
      join_code_created_at = now()
  where id = p_household_id;

  return plain_code;
end;
$$;

revoke all on function public.rotate_household_join_code(uuid) from public, anon, authenticated;
grant execute on function public.rotate_household_join_code(uuid) to authenticated;

create or replace function public.join_household(join_code text, member_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
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
  where join_code_hash = encode(extensions.digest(lower(trim(join_code)), 'sha256'), 'hex');

  if target_household.id is null then
    raise exception 'Invalid household code';
  end if;

  insert into public.members (household_id, user_id, name, role)
  values (target_household.id, auth.uid(), trim(member_name), 'member')
  on conflict (household_id, user_id)
  do update set name = excluded.name, active = true, joined_at = now()
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
