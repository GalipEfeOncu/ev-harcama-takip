-- Capture the first share snapshot per expense and transaction. The deferred
-- trigger writes the final audit entry after all removals and upserts are done.
create table public.pending_expense_share_audit (
  transaction_id xid8 not null,
  expense_id uuid not null,
  household_id uuid not null,
  actor_user_id uuid,
  actor_name text not null,
  previous_shares jsonb not null,
  primary key (transaction_id, expense_id)
);

alter table public.pending_expense_share_audit enable row level security;
revoke all on public.pending_expense_share_audit from public, anon, authenticated, service_role;

create function public.expense_share_audit_snapshot(p_expense_id uuid, p_household_id uuid)
returns jsonb language sql volatile set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'member_id', share.member_id, 'name', coalesce(member.name, 'Ev üyesi'), 'share_cents', share.share_cents
  ) order by share.member_id), '[]'::jsonb)
  from public.expense_participants share
  left join public.members member on member.id = share.member_id and member.household_id = p_household_id
  where share.expense_id = p_expense_id;
$$;
revoke all on function public.expense_share_audit_snapshot(uuid, uuid) from public, anon, authenticated, service_role;

create function public.prepare_expense_share_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_transaction_id xid8 := pg_current_xact_id();
  v_actor_id uuid := auth.uid();
  v_old_expense uuid := case when tg_op <> 'INSERT' then old.expense_id end;
  v_new_expense uuid := case when tg_op <> 'DELETE' then new.expense_id end;
begin
  if tg_op = 'UPDATE' and new is not distinct from old then return new; end if;

  -- An INSERT attempt for an existing key can end in DO NOTHING or fire
  -- the UPDATE trigger. In either case the INSERT attempt has no after event.
  if tg_op = 'INSERT' and exists (
    select from public.expense_participants
    where expense_id = new.expense_id and member_id = new.member_id
  ) then return new; end if;

  insert into public.pending_expense_share_audit (
    transaction_id, expense_id, household_id, actor_user_id, actor_name, previous_shares
  )
  select v_transaction_id, expense.id, expense.household_id, v_actor_id,
    coalesce(member.name, nullif(trim(account.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(account.raw_user_meta_data ->> 'name'), ''),
      'Kullanıcı ' || left(v_actor_id::text, 8), 'Sistem'),
    public.expense_share_audit_snapshot(expense.id, expense.household_id)
  from public.expenses expense
  left join public.members member on member.household_id = expense.household_id and member.user_id = v_actor_id
  left join auth.users account on account.id = v_actor_id and member.id is null
  where expense.id in (v_old_expense, v_new_expense)
    and not exists (
      select from public.pending_expense_share_audit pending
      where pending.transaction_id = v_transaction_id and pending.expense_id = expense.id
    );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.prepare_expense_share_audit() from public, anon, authenticated, service_role;

create function public.flush_expense_share_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old_expense uuid := case when tg_op <> 'INSERT' then old.expense_id end;
  v_new_expense uuid := case when tg_op <> 'DELETE' then new.expense_id end;
  v_pending public.pending_expense_share_audit;
  v_description text;
  v_current_shares jsonb;
begin
  for v_pending in
    delete from public.pending_expense_share_audit
    where transaction_id = pg_current_xact_id()
      and expense_id in (v_old_expense, v_new_expense)
    returning *
  loop
    select expense.description into v_description from public.expenses expense
    where expense.id = v_pending.expense_id and expense.household_id = v_pending.household_id;
    -- Deleting an expense already records its full share snapshot.
    if not found then continue; end if;

    v_current_shares := public.expense_share_audit_snapshot(v_pending.expense_id, v_pending.household_id);
    if (select jsonb_agg(value - 'name' order by ordinal)
        from jsonb_array_elements(v_pending.previous_shares) with ordinality as previous(value, ordinal))
      is not distinct from
       (select jsonb_agg(value - 'name' order by ordinal)
        from jsonb_array_elements(v_current_shares) with ordinality as current(value, ordinal))
    then continue; end if;

    insert into public.household_audit_log (
      household_id, actor_user_id, actor_name, action, entity, record_id,
      entity_label, before_values, after_values, member_names
    )
    values (
      v_pending.household_id, v_pending.actor_user_id, v_pending.actor_name,
      case when v_pending.previous_shares = '[]'::jsonb then 'insert' else 'update' end,
      'expense_participants', v_pending.expense_id, v_description,
      case when v_pending.previous_shares <> '[]'::jsonb
        then jsonb_build_object('participants', v_pending.previous_shares) end,
      jsonb_build_object('participants', v_current_shares), '{}'::jsonb
    );
  end loop;
  return null;
end;
$$;
revoke all on function public.flush_expense_share_audit() from public, anon, authenticated, service_role;

drop trigger audit_change on public.expense_participants;
drop trigger zz_audit_delete on public.expense_participants;

-- Run after the existing write and household-lock checks.
create trigger zz_prepare_expense_share_audit before insert or update or delete on public.expense_participants
for each row execute function public.prepare_expense_share_audit();

create constraint trigger flush_expense_share_audit after insert or update or delete on public.expense_participants
deferrable initially deferred for each row execute function public.flush_expense_share_audit();
