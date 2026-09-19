create or replace function public.create_household(household_name text, member_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_household public.households;
  new_member public.members;
  plain_code text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  plain_code := 'EV-' || upper(substr(encode(extensions.gen_random_bytes(6), 'hex'), 1, 8));

  insert into public.households (name, owner_user_id, join_code_hash)
  values (
    trim(household_name),
    auth.uid(),
    encode(extensions.digest(lower(plain_code), 'sha256'), 'hex')
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
