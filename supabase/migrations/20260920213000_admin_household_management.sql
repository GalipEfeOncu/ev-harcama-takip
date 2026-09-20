create or replace function public.admin_update_household_name(
  p_admin_user_id uuid,
  p_household_id uuid,
  p_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from auth.users user_account
    where user_account.id = p_admin_user_id
      and coalesce(user_account.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  ) then
    raise exception 'A Google account is required';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 2 and 80 then
    raise exception 'Household name must contain between 2 and 80 characters';
  end if;

  perform set_config('request.jwt.claim.sub', p_admin_user_id::text, true);

  update public.households
  set name = trim(p_name)
  where id = p_household_id;

  if not found then
    raise exception 'Household not found';
  end if;
end;
$$;

revoke all on function public.admin_update_household_name(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_update_household_name(uuid, uuid, text)
  to service_role;

create or replace function public.admin_delete_household(
  p_admin_user_id uuid,
  p_household_id uuid,
  p_confirmation text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_household public.households;
begin
  if not exists (
    select 1
    from auth.users user_account
    where user_account.id = p_admin_user_id
      and coalesce(user_account.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'google'
  ) then
    raise exception 'A Google account is required';
  end if;

  select * into target_household
  from public.households
  where id = p_household_id
  for update;

  if not found then
    raise exception 'Household not found';
  end if;

  if target_household.name is distinct from p_confirmation then
    raise exception using
      errcode = '22023',
      message = 'Household name confirmation does not match';
  end if;

  perform set_config('request.jwt.claim.sub', p_admin_user_id::text, true);

  delete from public.debt_payments where household_id = p_household_id;
  delete from public.settlements where household_id = p_household_id;
  delete from public.expenses where household_id = p_household_id;
  delete from public.settlement_runs where household_id = p_household_id;
  delete from public.members where household_id = p_household_id;
  delete from public.households where id = p_household_id;
end;
$$;

revoke all on function public.admin_delete_household(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_delete_household(uuid, uuid, text)
  to service_role;
