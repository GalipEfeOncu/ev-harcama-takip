-- Run against disposable local Supabase after migrations. Fixtures roll back.
\set ON_ERROR_STOP on
begin;
select set_config('qa.preferences_alice', gen_random_uuid()::text, true);
select set_config('qa.preferences_bob', gen_random_uuid()::text, true);
insert into auth.users (id, instance_id, aud, role, email)
values
  (current_setting('qa.preferences_alice')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-preferences-alice@example.invalid'),
  (current_setting('qa.preferences_bob')::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'qa-preferences-bob@example.invalid');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('qa.preferences_alice'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into public.user_preferences (user_id, appearance)
values (current_setting('qa.preferences_alice')::uuid, '{"themeId":"carbon","fontId":"mada"}'::jsonb);
update public.user_preferences set appearance = '{"themeId":"ink"}'::jsonb
where user_id = current_setting('qa.preferences_alice')::uuid;
do $$
begin
  if (select appearance ->> 'themeId' from public.user_preferences where user_id = auth.uid()) is distinct from 'ink' then
    raise exception 'Own preference insert/update/read failed';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', current_setting('qa.preferences_bob'), true);
do $$
declare affected integer; rejected boolean := false;
begin
  if exists (select 1 from public.user_preferences) then
    raise exception 'Other account preferences were exposed';
  end if;
  update public.user_preferences set appearance = '{}'::jsonb
  where user_id = current_setting('qa.preferences_alice')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other account preferences were updated'; end if;
  delete from public.user_preferences where user_id = current_setting('qa.preferences_alice')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other account preferences were deleted'; end if;
  begin
    insert into public.user_preferences (user_id, appearance)
    values (current_setting('qa.preferences_alice')::uuid, '{}'::jsonb)
    on conflict (user_id) do update set appearance = excluded.appearance;
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Other account preference upsert was permitted'; end if;
end;
$$;

insert into public.user_preferences (user_id, appearance)
values (current_setting('qa.preferences_bob')::uuid, '{"themeId":"sage"}'::jsonb);
do $$
begin
  if (select count(*) from public.user_preferences) <> 1 then
    raise exception 'Own account isolation failed';
  end if;
end;
$$;

-- An authenticated role without an identity must still see no rows.
select set_config('request.jwt.claim.sub', '', true);
do $$
begin
  if exists (select 1 from public.user_preferences) then
    raise exception 'Preferences exposed without auth.uid';
  end if;
end;
$$;

-- Unauthenticated API clients have no table privileges at all.
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
do $$
declare rejected boolean := false;
begin
  begin
    perform 1 from public.user_preferences;
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Unauthenticated client received table access'; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('qa.preferences_alice'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);
delete from public.user_preferences where user_id = auth.uid();
do $$
begin
  if exists (select 1 from public.user_preferences) then raise exception 'Own preference deletion failed'; end if;
end;
$$;
rollback;
