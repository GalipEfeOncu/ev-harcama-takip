-- Run on a disposable database after migrations.
begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  house jsonb;
  other jsonb;
  binding uuid;
  first_job record;
  retry record;
begin
  insert into auth.users (id, raw_app_meta_data) values (owner_id, '{"providers":["google"]}');
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  house := public.create_household('Telegram test home', 'Owner');
  other := public.create_household('Other Telegram home', 'Owner');
  insert into public.telegram_groups(household_id, owner_id, chat_id, title, active)
    values ((house->>'household_id')::uuid, owner_id, '-1001', 'First group', true) returning id into binding;
  begin
    insert into public.telegram_groups(household_id, owner_id, chat_id)
      values ((other->>'household_id')::uuid, owner_id, '-1001');
    raise exception 'Group assigned twice';
  exception when unique_violation then null;
  end;
  insert into public.settlement_runs(household_id, created_by_user_id)
    values ((other->>'household_id')::uuid, owner_id), ((house->>'household_id')::uuid, owner_id);
  assert (select count(*) = 1 from public.telegram_outbox where group_id = binding);
  select * into strict first_job from public.claim_telegram_job();
  assert first_job.chat_id = '-1001' and first_job.kind = 'settlement_runs';
  assert not exists (select from public.claim_telegram_job());
  update public.telegram_outbox set available_at = now() where id = first_job.job_id;
  select * into strict retry from public.claim_telegram_job();
  assert retry.job_id = first_job.job_id and retry.lease_id <> first_job.lease_id and retry.attempt = 2;
  assert not has_table_privilege('authenticated', 'public.telegram_groups', 'SELECT');
  assert not has_function_privilege('anon', 'public.claim_telegram_job()', 'EXECUTE');
  insert into public.expenses(household_id, payer_member_id, created_by_user_id, amount_cents, description)
    values ((house->>'household_id')::uuid, (house->>'member_id')::uuid, owner_id, 200, 'Test expense');
  insert into auth.users(id, raw_app_meta_data) values (gen_random_uuid(), '{"providers":["google"]}') returning id into owner_id;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  other := public.join_household(house->>'join_code', 'Second member');
  insert into public.debt_payments(household_id, from_member_id, to_member_id, created_by_user_id, amount_cents)
    values ((house->>'household_id')::uuid, (other->>'member_id')::uuid, (house->>'member_id')::uuid, owner_id, 200);
  assert (select count(distinct event_kind) = 3 from public.telegram_outbox where group_id = binding);
  insert into public.expenses(household_id, payer_member_id, created_by_user_id, amount_cents, description)
    values ((house->>'household_id')::uuid, (house->>'member_id')::uuid, owner_id, 12990, 'Market');
  update public.telegram_outbox set failed = true, attempts = 12, available_at = now() - interval '1 hour'
    where group_id = binding and expense_details->>'description' = 'Market';
  select * into strict retry from public.claim_telegram_delivery();
  assert retry.attempt = 13 and retry.details @> '{"creator":"Second member","payer":"Owner","amount":12990,"description":"Market"}';
  assert not has_function_privilege('authenticated', 'public.claim_telegram_delivery()', 'EXECUTE');
  delete from public.telegram_groups where id = binding;
  assert not exists (select from public.telegram_outbox where group_id = binding);
end;
$$;
rollback;
