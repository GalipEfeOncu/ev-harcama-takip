-- Run against a disposable local Supabase database after all migrations.
-- Fixtures and successful deletions are rolled back.
\set ON_ERROR_STOP on
begin;

do $$
declare
  owner_id uuid := gen_random_uuid();
  member_id uuid := gen_random_uuid();
  orphan_id uuid := gen_random_uuid();
  home_id uuid := gen_random_uuid();
  blocked boolean := false;
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data)
  values
    (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-delete-owner@example.invalid', '{"providers":["google"]}'::jsonb),
    (member_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-delete-member@example.invalid', '{"providers":["google"]}'::jsonb),
    (orphan_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-delete-orphan@example.invalid', '{"providers":["google"]}'::jsonb);

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  insert into public.households (id, name, owner_user_id, join_code_hash)
  values (home_id, 'QA deletion guard', owner_id, gen_random_uuid()::text);
  insert into public.members (household_id, user_id, name, active)
  values (home_id, member_id, 'QA Member', false);

  begin
    delete from auth.users where id = member_id;
  exception when foreign_key_violation then
    blocked := true;
  end;
  if not blocked or not exists (select 1 from public.members where user_id = member_id) then
    raise exception 'deleting a linked user removed its inactive membership';
  end if;

  delete from auth.users where id = orphan_id;
  if exists (select 1 from auth.users where id = orphan_id) then
    raise exception 'an unlinked account could not be deleted';
  end if;

  delete from public.households where id = home_id;
  delete from auth.users where id in (owner_id, member_id);
  if exists (select 1 from auth.users where id in (owner_id, member_id)) then
    raise exception 'accounts remained after the house and membership were deleted';
  end if;
end;
$$;

rollback;
