-- Keep the final audit trail available to administrators after household deletion.
-- Household membership, rather than a foreign key, controls access to the log.
create table public.household_audit_log (
  id bigint generated always as identity primary key,
  household_id uuid not null,
  occurred_at timestamptz not null default clock_timestamp(),
  actor_user_id uuid,
  actor_name text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  entity text not null,
  record_id uuid,
  entity_label text,
  before_values jsonb,
  after_values jsonb,
  member_names jsonb not null
);

create index household_audit_log_feed_idx on public.household_audit_log (household_id, id desc);

alter table public.household_audit_log enable row level security;
revoke all on public.household_audit_log from public, anon, authenticated, service_role;
grant select on public.household_audit_log to authenticated, service_role;

create policy household_audit_log_select_member
on public.household_audit_log for select to authenticated
using (public.is_household_member(household_id));

create function public.write_household_audit(
  p_household_id uuid, p_entity text, p_label text, p_before jsonb, p_after jsonb
)
returns void language plpgsql set search_path = '' as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_name text;
  v_member_names jsonb;
  v_record_id uuid := coalesce(p_after ->> 'id', p_before ->> 'id', p_after ->> 'expense_id', p_before ->> 'expense_id')::uuid;
  v_action text := case when p_before is null then 'insert' when p_after is null then 'delete' else 'update' end;
begin
  if p_before is not distinct from p_after then return; end if;

  if v_action = 'update' then
    select jsonb_object_agg(field.key, p_before -> field.key),
           jsonb_object_agg(field.key, p_after -> field.key)
    into p_before, p_after
    from jsonb_object_keys(p_before || p_after) as field(key)
    where (p_before -> field.key) is distinct from (p_after -> field.key);
  end if;

  if v_actor_id is not null then
    select member.name into v_actor_name from public.members member
    where member.household_id = p_household_id and member.user_id = v_actor_id;

    if v_actor_name is null then
      select coalesce(nullif(trim(account.raw_user_meta_data ->> 'full_name'), ''),
                      nullif(trim(account.raw_user_meta_data ->> 'name'), ''))
      into v_actor_name from auth.users account where account.id = v_actor_id;
    end if;
  end if;

  select coalesce(jsonb_object_agg(member.id, member.name), '{}'::jsonb)
  into v_member_names
  from (values ('member_id'), ('payer_member_id'), ('from_member_id'), ('to_member_id')) as field(key)
  cross join lateral (values (p_before ->> field.key), (p_after ->> field.key)) as ref(id)
  join public.members member on member.id = ref.id::uuid
  where member.household_id = p_household_id;

  insert into public.household_audit_log
    (household_id, actor_user_id, actor_name, action, entity, record_id, entity_label, before_values, after_values, member_names)
  values
    (p_household_id, v_actor_id, coalesce(v_actor_name, case
      when v_actor_id is null and p_entity = 'telegram_groups' then 'Telegram'
      when v_actor_id is null then 'Sistem' else 'Kullanıcı ' || left(v_actor_id::text, 8) end),
      v_action, p_entity, v_record_id, p_label, p_before, p_after, v_member_names);
end;
$$;
revoke all on function public.write_household_audit(uuid, text, text, jsonb, jsonb)
  from public, anon, authenticated, service_role;

create function public.capture_household_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_old_household uuid;
  v_new_household uuid;
  v_old_label text;
  v_new_label text;
  v_old_secret text;
  v_new_secret text;
  v_shares jsonb;
begin
  if tg_op <> 'INSERT' then v_before := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_after := to_jsonb(new); end if;

  if tg_table_name = 'expenses' then
    -- updated_at is touched even when the expense values are unchanged.
    v_before := v_before - 'updated_at';
    v_after := v_after - 'updated_at';
    if tg_op = 'DELETE' then
      select coalesce(jsonb_agg(jsonb_build_object('member_id', share.member_id, 'name', coalesce(member.name, 'Ev üyesi'),
          'share_cents', share.share_cents) order by share.member_id), '[]'::jsonb)
      into v_shares
      from public.expense_participants share
      left join public.members member on member.id = share.member_id and member.household_id = old.household_id
      where share.expense_id = old.id;
      v_before := v_before || jsonb_build_object('participants', v_shares);
    end if;
  end if;

  v_old_label := coalesce(v_before ->> 'name', nullif(v_before ->> 'description', ''), v_before ->> 'title');
  v_new_label := coalesce(v_after ->> 'name', nullif(v_after ->> 'description', ''), v_after ->> 'title');
  if tg_table_name = 'households' then
    v_old_household := (v_before ->> 'id')::uuid;
    v_new_household := (v_after ->> 'id')::uuid;
    v_old_secret := v_before ->> 'join_code_hash';
    v_new_secret := v_after ->> 'join_code_hash';
    v_before := v_before - 'join_code_hash';
    v_after := v_after - 'join_code_hash';
    if tg_op = 'UPDATE' and v_old_secret is distinct from v_new_secret then
      v_after := v_after || '{"join_code_changed": true}'::jsonb;
    end if;
  elsif tg_table_name = 'expense_participants' then
    select expense.household_id, concat_ws(' · ', expense.description, member.name) into v_old_household, v_old_label
    from public.expenses expense
    left join public.members member on member.id = (v_before ->> 'member_id')::uuid and member.household_id = expense.household_id
    where expense.id = (v_before ->> 'expense_id')::uuid;
    select expense.household_id, concat_ws(' · ', expense.description, member.name) into v_new_household, v_new_label
    from public.expenses expense
    left join public.members member on member.id = (v_after ->> 'member_id')::uuid and member.household_id = expense.household_id
    where expense.id = (v_after ->> 'expense_id')::uuid;
    -- A cascaded share delete is already included in the deleted expense snapshot.
    if tg_op = 'DELETE' and v_old_household is null then return old; end if;
  else
    v_old_household := (v_before ->> 'household_id')::uuid;
    v_new_household := (v_after ->> 'household_id')::uuid;
  end if;

  if tg_table_name = 'telegram_groups' then
    -- The binding ID is also the setup token. Keep it and the raw chat ID private.
    v_old_secret := v_before ->> 'chat_id';
    v_new_secret := v_after ->> 'chat_id';
    v_before := (v_before - '{id,chat_id}'::text[]) || jsonb_build_object('telegram_group_selected', v_old_secret is not null);
    v_after := (v_after - '{id,chat_id}'::text[]) || jsonb_build_object('telegram_group_selected', v_new_secret is not null);
    if v_old_secret is not null and v_new_secret is not null and v_old_secret <> v_new_secret then
      v_after := v_after || '{"telegram_group_changed": true}'::jsonb;
    end if;
  end if;

  if v_old_household = v_new_household then
    perform public.write_household_audit(v_new_household, tg_table_name, coalesce(v_new_label, v_old_label), v_before, v_after);
  else
    if v_old_household is not null then
      perform public.write_household_audit(v_old_household, tg_table_name, v_old_label, v_before, null);
    end if;
    if v_new_household is not null then
      perform public.write_household_audit(v_new_household, tg_table_name, v_new_label, null, v_after);
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.capture_household_audit() from public, anon, authenticated, service_role;

do $$
declare
  entity text;
begin
  foreach entity in array array['households', 'members', 'expenses', 'expense_participants',
      'debt_payments', 'settlement_runs', 'settlements', 'telegram_groups']
  loop
    execute format('create trigger audit_change after insert or update on public.%I
      for each row execute function public.capture_household_audit()', entity);
    execute format('create trigger zz_audit_delete before delete on public.%I
      for each row execute function public.capture_household_audit()', entity);
  end loop;
end;
$$;

-- Called by the server after it verifies the signed-in owner and the Telegram confirmation code.
create function public.change_telegram_binding_as_owner(
  p_household_id uuid, p_actor_user_id uuid, p_action text, p_binding_id uuid
)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  perform id from public.households where id = p_household_id for update;
  if not found then return false; end if;

  perform id from public.members
  where household_id = p_household_id and user_id = p_actor_user_id and active and role = 'owner';
  if not found then return false; end if;

  perform set_config('request.jwt.claim.sub', p_actor_user_id::text, true);
  case p_action
    when 'begin' then
      delete from public.telegram_groups where household_id = p_household_id and not active
        and (expires_at <= statement_timestamp() or owner_id <> p_actor_user_id);
      insert into public.telegram_groups (household_id, owner_id)
      values (p_household_id, p_actor_user_id) on conflict (household_id) do nothing;
      return true;
    when 'confirm' then
      update public.telegram_groups set active = true
      where household_id = p_household_id and id = p_binding_id and owner_id = p_actor_user_id
        and not active and chat_id is not null and expires_at > statement_timestamp();
    when 'disconnect' then
      delete from public.telegram_groups
      where household_id = p_household_id and id = p_binding_id
        and (active or (owner_id = p_actor_user_id and expires_at > statement_timestamp()));
    else
      return false;
  end case;
  return found;
end;
$$;
revoke all on function public.change_telegram_binding_as_owner(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.change_telegram_binding_as_owner(uuid, uuid, text, uuid) to service_role;

-- Keep unchanged shares in place so a description edit records just that edit.
create or replace function public.update_expense_with_shares_atomic(
  p_household_id uuid,
  p_expense_id uuid,
  p_payer_member_id uuid,
  p_amount_cents bigint,
  p_description text,
  p_category text,
  p_expense_date date,
  p_participant_shares jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership is required';
  end if;

  if p_description is null or char_length(trim(p_description)) not between 2 and 160 then
    raise exception 'Expense description must contain between 2 and 160 characters';
  end if;

  if p_category is null or char_length(trim(p_category)) > 80 then
    raise exception 'Expense category is invalid';
  end if;

  if p_expense_date is null then
    raise exception 'Expense date is required';
  end if;

  if not exists (
    select 1
    from public.members member
    where member.id = p_payer_member_id
      and member.household_id = p_household_id
      and member.active = true
  ) then
    raise exception 'Payer must be an active member of this household';
  end if;

  perform public.assert_expense_shares_valid(p_household_id, p_amount_cents, p_participant_shares);

  update public.expenses
  set payer_member_id = p_payer_member_id,
      amount_cents = p_amount_cents,
      description = trim(p_description),
      category = coalesce(nullif(trim(p_category), ''), 'Genel'),
      expense_date = p_expense_date
  where id = p_expense_id
    and household_id = p_household_id
  returning id into v_expense_id;

  if not found then
    raise exception 'Expense not found';
  end if;

  delete from public.expense_participants as share
  where share.expense_id = v_expense_id and not exists (
    select 1 from jsonb_to_recordset(p_participant_shares) as requested(member_id uuid)
    where requested.member_id = share.member_id
  );

  insert into public.expense_participants as share (expense_id, member_id, share_cents)
  select v_expense_id, requested.member_id, requested.share_cents
  from jsonb_to_recordset(p_participant_shares) as requested(member_id uuid, share_cents bigint)
  on conflict (expense_id, member_id) do update set share_cents = excluded.share_cents
  where share.share_cents is distinct from excluded.share_cents;

  return v_expense_id;
end;
$$;
