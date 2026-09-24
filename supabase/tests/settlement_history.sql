-- Run only against a disposable Supabase local database after all migrations.
-- Every fixture and assertion is rolled back, including a successful admin delete.
\set ON_ERROR_STOP on
begin;

select set_config('qa.owner_user', gen_random_uuid()::text, true);
select set_config('qa.member_user', gen_random_uuid()::text, true);

insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data)
values
  (current_setting('qa.owner_user')::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'qa-owner@example.invalid', '{"providers":["google"]}'::jsonb),
  (current_setting('qa.member_user')::uuid, '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'qa-member@example.invalid', '{"providers":["google"]}'::jsonb);

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', current_setting('qa.owner_user'), true);

with created as (
  select public.create_household('QA Household', 'QA Owner') as result
)
select result ->> 'household_id' as household_id,
       result ->> 'member_id' as owner_member_id,
       result ->> 'join_code' as join_code
from created \gset
select set_config('qa.household', :'household_id', true);
select set_config('qa.owner_member', :'owner_member_id', true);
select set_config('qa.join_code', :'join_code', true);

select set_config('request.jwt.claim.sub', current_setting('qa.member_user'), true);
select (public.join_household(current_setting('qa.join_code'), 'QA Member') ->> 'member_id')
       as second_member_id \gset
select set_config('qa.second_member', :'second_member_id', true);

select set_config('request.jwt.claim.sub', current_setting('qa.owner_user'), true);
select public.create_expense_with_shares_atomic(
  current_setting('qa.household')::uuid,
  current_setting('qa.owner_member')::uuid,
  1000, 'Shared expense', 'Test', current_date,
  jsonb_build_array(
    jsonb_build_object('member_id', current_setting('qa.owner_member'), 'share_cents', 500),
    jsonb_build_object('member_id', current_setting('qa.second_member'), 'share_cents', 500)
  )
) as expense_id \gset
select set_config('qa.expense', :'expense_id', true);

-- Members cannot create a run outside the closing RPC.
do $$
declare denied boolean := false;
begin
  begin
    insert into public.settlement_runs (household_id, created_by_user_id)
    values (current_setting('qa.household')::uuid, current_setting('qa.owner_user')::uuid);
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'member inserted a settlement run directly';
  end if;
end;
$$;

select public.close_settlement_atomic(
  current_setting('qa.household')::uuid,
  array[current_setting('qa.expense')::uuid]
) as run_id \gset
select set_config('qa.run', :'run_id', true);

do $$
begin
  if not exists (
    select 1 from public.expenses
    where id = current_setting('qa.expense')::uuid
      and settlement_run_id = current_setting('qa.run')::uuid
  ) then
    raise exception 'close RPC did not mark expense settled';
  end if;

  if not exists (
    select 1 from public.settlements
    where settlement_run_id = current_setting('qa.run')::uuid
      and from_member_id = current_setting('qa.second_member')::uuid
      and to_member_id = current_setting('qa.owner_member')::uuid
      and amount_cents = 500
  ) then
    raise exception 'close RPC did not preserve the expected transfer';
  end if;
end;
$$;

-- RLS may reject updates and deletes by returning zero rows. Either that or
-- an explicit permission error is acceptable, but a changed row is not.
do $$
declare affected integer;
        denied boolean := false;
begin
  begin
    perform public.update_expense_with_shares_atomic(
      current_setting('qa.household')::uuid,
      current_setting('qa.expense')::uuid,
      current_setting('qa.owner_member')::uuid,
      1000, 'Changed by RPC', 'Test', current_date,
      jsonb_build_array(
        jsonb_build_object('member_id', current_setting('qa.owner_member'), 'share_cents', 500),
        jsonb_build_object('member_id', current_setting('qa.second_member'), 'share_cents', 500)
      )
    );
  exception when others then
    denied := true;
  end;
  if not denied then
    raise exception 'member updated a settled expense through RPC';
  end if;

  begin
    update public.expenses set description = 'Changed after close'
    where id = current_setting('qa.expense')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'member updated a settled expense';
    end if;
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.expenses where id = current_setting('qa.expense')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'member deleted a settled expense';
    end if;
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.expenses set settlement_run_id = null
    where id = current_setting('qa.expense')::uuid;
    raise exception 'member changed settlement_run_id directly';
  exception when insufficient_privilege then
    null;
  end;

  begin
    delete from public.expense_participants
    where expense_id = current_setting('qa.expense')::uuid;
    get diagnostics affected = row_count;
    if affected <> 0 then
      raise exception 'member deleted settled expense shares';
    end if;
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

-- Settlement tables remain readable but are never directly writable by members.
do $$
declare denied boolean;
begin
  denied := false;
  begin
    insert into public.settlements (
      settlement_run_id, household_id, from_member_id, to_member_id, amount_cents
    ) values (
      current_setting('qa.run')::uuid, current_setting('qa.household')::uuid,
      current_setting('qa.second_member')::uuid, current_setting('qa.owner_member')::uuid, 1
    );
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'member inserted a transfer directly';
  end if;

  denied := false;
  begin
    update public.settlements set amount_cents = 1
    where settlement_run_id = current_setting('qa.run')::uuid;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'member updated a transfer directly';
  end if;

  denied := false;
  begin
    delete from public.settlements
    where settlement_run_id = current_setting('qa.run')::uuid;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'member deleted a transfer directly';
  end if;

  denied := false;
  begin
    update public.settlement_runs set created_at = now()
    where id = current_setting('qa.run')::uuid;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'member updated a settlement run directly';
  end if;

  denied := false;
  begin
    delete from public.settlement_runs
    where id = current_setting('qa.run')::uuid;
  exception when insufficient_privilege then
    denied := true;
  end;
  if not denied then
    raise exception 'member deleted a settlement run directly';
  end if;
end;
$$;

do $$
begin
  if (select count(*) from public.settlements
      where settlement_run_id = current_setting('qa.run')::uuid) <> 1 then
    raise exception 'transfer changed after rejected member writes';
  end if;
  if (select description from public.expenses
      where id = current_setting('qa.expense')::uuid) <> 'Shared expense' then
    raise exception 'settled expense changed after rejected member writes';
  end if;
end;
$$;

-- Open expenses still support normal edits and deletion.
select public.create_expense_with_shares_atomic(
  current_setting('qa.household')::uuid,
  current_setting('qa.owner_member')::uuid,
  100, 'Open expense', 'Test', current_date,
  jsonb_build_array(
    jsonb_build_object('member_id', current_setting('qa.owner_member'), 'share_cents', 100)
  )
) as open_expense_id \gset
select set_config('qa.open_expense', :'open_expense_id', true);

do $$
declare affected integer;
begin
  perform public.update_expense_with_shares_atomic(
    current_setting('qa.household')::uuid,
    current_setting('qa.open_expense')::uuid,
    current_setting('qa.owner_member')::uuid,
    120, 'Edited open expense', 'Test', current_date,
    jsonb_build_array(
      jsonb_build_object('member_id', current_setting('qa.owner_member'), 'share_cents', 120)
    )
  );
  if not exists (
    select 1 from public.expenses
    where id = current_setting('qa.open_expense')::uuid
      and description = 'Edited open expense'
      and amount_cents = 120
  ) then
    raise exception 'member could not edit an open expense through RPC';
  end if;

  update public.expenses set description = 'Edited open expense'
  where id = current_setting('qa.open_expense')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'member could not edit an open expense';
  end if;

  delete from public.expenses where id = current_setting('qa.open_expense')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'member could not delete an open expense';
  end if;
end;
$$;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select public.admin_delete_household(
  current_setting('qa.owner_user')::uuid,
  current_setting('qa.household')::uuid,
  'QA Household'
);

reset role;
do $$
begin
  if exists (select 1 from public.households
             where id = current_setting('qa.household')::uuid) then
    raise exception 'admin deletion did not remove the household';
  end if;
  if exists (select 1 from public.settlements
             where settlement_run_id = current_setting('qa.run')::uuid) then
    raise exception 'admin deletion left a transfer behind';
  end if;
end;
$$;

rollback;
\echo 'PASS: settlement history, member permissions, close RPC, open edits, admin deletion'
