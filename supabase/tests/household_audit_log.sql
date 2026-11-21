-- Run after all migrations on a disposable database.
begin;
do $$
declare
  v_owner uuid := gen_random_uuid();
  v_member uuid := gen_random_uuid();
  v_other_member uuid := gen_random_uuid();
  v_admin uuid := gen_random_uuid();
  v_created jsonb;
  v_household uuid;
  v_owner_member uuid;
  v_second_member uuid;
  v_third_member uuid;
  v_expense uuid;
  v_binding uuid;
  v_shares jsonb;
  v_logs bigint;
begin
  insert into auth.users (id, raw_app_meta_data, raw_user_meta_data)
  values (v_owner, '{"providers":["google"]}', '{"name":"Ev sahibi"}'),
         (v_member, '{"providers":["google"]}', '{}'),
         (v_other_member, '{"providers":["google"]}', '{}'),
         (v_admin, '{"providers":["google"]}', '{"name":"Test yöneticisi"}');

  set local role authenticated;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  v_created := public.create_household('Geçmiş evi', 'Ev sahibi');
  v_household := (v_created ->> 'household_id')::uuid;
  v_owner_member := (v_created ->> 'member_id')::uuid;

  perform set_config('request.jwt.claim.sub', v_member::text, true);
  v_second_member := (public.join_household(v_created ->> 'join_code', 'Ev arkadaşı') ->> 'member_id')::uuid;
  assert exists (select from public.household_audit_log where household_id = v_household and entity = 'members'
    and action = 'insert' and actor_user_id = v_member and actor_name = 'Ev arkadaşı');

  perform set_config('request.jwt.claim.sub', v_other_member::text, true);
  v_third_member := (public.join_household(v_created ->> 'join_code', 'Üçüncü üye') ->> 'member_id')::uuid;
  perform set_config('request.jwt.claim.sub', v_member::text, true);

  v_shares := jsonb_build_array(jsonb_build_object('member_id', v_owner_member, 'share_cents', 400),
    jsonb_build_object('member_id', v_second_member, 'share_cents', 400),
    jsonb_build_object('member_id', v_third_member, 'share_cents', 200));
  v_expense := public.create_expense_with_shares_atomic(
    v_household, v_owner_member, 1000, 'Market alışverişi', 'Market', current_date, v_shares);
  -- Flush as though each RPC call below were its own request.
  set constraints public.flush_expense_share_audit immediate;
  set constraints public.flush_expense_share_audit deferred;

  assert (select count(*) = 1 from public.household_audit_log where record_id = v_expense
    and entity = 'expense_participants' and action = 'insert'
    and jsonb_array_length(after_values -> 'participants') = 3);
  select count(*) into v_logs from public.household_audit_log;
  perform public.update_expense_with_shares_atomic(
    v_household, v_expense, v_owner_member, 1000, 'Market alışverişi', 'Market', current_date, v_shares);
  set constraints public.flush_expense_share_audit immediate;
  set constraints public.flush_expense_share_audit deferred;
  assert (select count(*) = v_logs from public.household_audit_log), 'An unchanged save produced a log';

  perform public.update_expense_with_shares_atomic(
    v_household, v_expense, v_owner_member, 1000, 'Market alışverişi.', 'Market', current_date, v_shares);
  set constraints public.flush_expense_share_audit immediate;
  set constraints public.flush_expense_share_audit deferred;
  assert (select count(*) = v_logs + 1 from public.household_audit_log), 'The description edit recreated the share logs';
  assert exists (select from public.household_audit_log where record_id = v_expense and entity = 'expenses'
    and action = 'update' and actor_user_id = v_member
    and before_values = '{"description":"Market alışverişi"}' and after_values = '{"description":"Market alışverişi."}');

  perform public.update_expense_with_shares_atomic(
    v_household, v_expense, v_owner_member, 1000, 'Market alışverişi.', 'Market', current_date,
    jsonb_build_array(jsonb_build_object('member_id', v_owner_member, 'share_cents', 450),
      jsonb_build_object('member_id', v_second_member, 'share_cents', 350),
      jsonb_build_object('member_id', v_third_member, 'share_cents', 200)));
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  set constraints public.flush_expense_share_audit immediate;
  set constraints public.flush_expense_share_audit deferred;
  perform set_config('request.jwt.claim.sub', v_member::text, true);
  assert (select count(*) = v_logs + 2 from public.household_audit_log), 'The share edit produced more than one log';
  assert exists (select from public.household_audit_log where record_id = v_expense and entity = 'expense_participants'
    and action = 'update' and entity_label = 'Market alışverişi.' and actor_user_id = v_member
    and jsonb_array_length(before_values -> 'participants') = 3
    and jsonb_array_length(after_values -> 'participants') = 3
    and before_values -> 'participants' @> '[{"name":"Ev arkadaşı","share_cents":400},{"name":"Üçüncü üye","share_cents":200}]'
    and after_values -> 'participants' @> '[{"name":"Ev arkadaşı","share_cents":350},{"name":"Üçüncü üye","share_cents":200}]');

  perform public.update_expense_with_shares_atomic(
    v_household, v_expense, v_owner_member, 1000, 'Market alışverişi.', 'Market', current_date,
    jsonb_build_array(jsonb_build_object('member_id', v_owner_member, 'share_cents', 800),
      jsonb_build_object('member_id', v_third_member, 'share_cents', 200)));
  set constraints public.flush_expense_share_audit immediate;
  set constraints public.flush_expense_share_audit deferred;
  assert (select count(*) = v_logs + 3 from public.household_audit_log), 'Removing a member split the share edit';
  assert exists (select from public.household_audit_log where record_id = v_expense and entity = 'expense_participants'
    and action = 'update'
    and before_values -> 'participants' @> '[{"name":"Ev arkadaşı","share_cents":350}]'
    and jsonb_array_length(after_values -> 'participants') = 2
    and after_values -> 'participants' @> '[{"name":"Ev sahibi","share_cents":800}]');
  perform public.update_expense_with_shares_atomic(
    v_household, v_expense, v_owner_member, 1000, 'Market alışverişi.', 'Market', current_date,
    jsonb_build_array(jsonb_build_object('member_id', v_owner_member, 'share_cents', 450),
      jsonb_build_object('member_id', v_second_member, 'share_cents', 350),
      jsonb_build_object('member_id', v_third_member, 'share_cents', 200)));
  set constraints public.flush_expense_share_audit immediate;
  set constraints public.flush_expense_share_audit deferred;
  assert (select count(*) = v_logs + 4 from public.household_audit_log), 'Adding a member split the share edit';

  select count(*) into v_logs from public.household_audit_log;
  begin
    delete from public.expenses where id = v_expense;
    raise exception using errcode = 'P1234', message = 'Undo fixture';
  exception when sqlstate 'P1234' then null;
  end;
  assert (select count(*) = v_logs from public.household_audit_log), 'A rolled-back delete left a log';
  delete from public.expenses where id = v_expense;
  set constraints public.flush_expense_share_audit immediate;
  set constraints public.flush_expense_share_audit deferred;
  assert (select count(*) = v_logs + 1 from public.household_audit_log), 'The delete repeated the nested share snapshot';
  assert exists (select from public.household_audit_log where record_id = v_expense and entity = 'expenses'
    and action = 'delete' and actor_user_id = v_member and after_values is null
    and before_values -> 'participants' @> '[{"name":"Ev arkadaşı","share_cents":350}]');

  v_expense := public.create_expense_with_shares_atomic(
    v_household, v_owner_member, 1000, 'Ortak gider', 'Genel', current_date, v_shares);
  perform public.record_debt_payment_atomic(v_household, v_second_member, v_owner_member, 100, current_date, 'Kısmi ödeme');
  perform public.close_settlement_atomic(v_household, array[v_expense]);
  assert (select count(distinct entity) = 3 from public.household_audit_log
    where entity in ('debt_payments', 'settlement_runs', 'settlements') and action = 'insert');
  assert exists (select from public.household_audit_log where record_id = v_expense
    and action = 'update' and after_values ? 'settlement_run_id');

  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  perform public.rotate_household_join_code(v_household);
  assert exists (select from public.household_audit_log where entity = 'households' and action = 'update'
    and after_values @> '{"join_code_changed":true}');
  assert not exists (select from public.household_audit_log where before_values ? 'join_code_hash'
    or after_values ? 'join_code_hash' or after_values::text like '%' || (v_created ->> 'join_code') || '%');
  assert not has_table_privilege('authenticated', 'public.household_audit_log', 'INSERT, UPDATE, DELETE, TRUNCATE');
  assert not has_table_privilege('anon', 'public.household_audit_log', 'SELECT');
  assert not has_function_privilege('authenticated', 'public.change_telegram_binding_as_owner(uuid,uuid,text,uuid)', 'EXECUTE');

  update public.members set active = false where id = v_second_member;
  assert exists (select from public.household_audit_log where record_id = v_second_member
    and action = 'update' and before_values = '{"active":true}' and after_values = '{"active":false}');
  perform set_config('request.jwt.claim.sub', v_member::text, true);
  assert not exists (select from public.household_audit_log where household_id = v_household), 'An inactive member could read the logs';

  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.create_household('Başka ev', 'Başka ev sahibi');
  assert not exists (select from public.household_audit_log where household_id = v_household), 'A different household could read the logs';

  set local role service_role;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  assert not public.change_telegram_binding_as_owner(v_household, v_member, 'begin', null);
  assert public.change_telegram_binding_as_owner(v_household, v_owner, 'begin', null);
  select id into strict v_binding from public.telegram_groups where household_id = v_household;
  perform set_config('request.jwt.claim.sub', '', true);
  update public.telegram_groups set chat_id = '-100278', title = 'Test grubu' where id = v_binding;
  assert public.change_telegram_binding_as_owner(v_household, v_owner, 'confirm', v_binding);
  assert public.change_telegram_binding_as_owner(v_household, v_owner, 'disconnect', v_binding);
  assert (select count(*) = 3 from public.household_audit_log where entity = 'telegram_groups' and actor_user_id = v_owner);
  assert exists (select from public.household_audit_log where entity = 'telegram_groups' and actor_name = 'Telegram'
    and after_values @> '{"telegram_group_selected":true}');
  assert not exists (select from public.household_audit_log where entity = 'telegram_groups'
    and (record_id is not null or before_values ?| array['id', 'chat_id'] or after_values ?| array['id', 'chat_id']));

  perform public.admin_update_household_name(v_admin, v_household, 'Yeni ev adı');
  assert exists (select from public.household_audit_log where household_id = v_household and entity = 'households'
    and action = 'update' and actor_user_id = v_admin and actor_name = 'Test yöneticisi'
    and before_values = '{"name":"Geçmiş evi"}' and after_values = '{"name":"Yeni ev adı"}');
  perform public.admin_delete_household(v_admin, v_household, 'Yeni ev adı');
  assert exists (select from public.household_audit_log where household_id = v_household and entity = 'households'
    and action = 'delete' and actor_user_id = v_admin and before_values @> '{"name":"Yeni ev adı"}');

  set local role authenticated;
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', v_owner::text, true);
  assert not exists (select from public.household_audit_log where household_id = v_household), 'A deleted household still had member access';
end;
$$;
rollback;
