create or replace function public.assert_expense_shares_valid(
  p_household_id uuid,
  p_amount_cents bigint,
  p_participant_shares jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_member_count integer;
  v_share_count integer;
  v_unique_count integer;
  v_total numeric;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;

  if not public.is_household_member(p_household_id) then
    raise exception 'Household membership is required';
  end if;

  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Expense amount must be greater than zero';
  end if;

  if jsonb_typeof(p_participant_shares) is distinct from 'array' then
    raise exception 'Participant shares must be a JSON array';
  end if;

  if jsonb_array_length(p_participant_shares) = 0 then
    raise exception 'An expense needs at least one participant share';
  end if;

  select
    count(*)::integer,
    count(requested.member_id)::integer,
    count(requested.share_cents)::integer,
    count(distinct requested.member_id)::integer,
    coalesce(sum(requested.share_cents), 0)
  into v_count, v_member_count, v_share_count, v_unique_count, v_total
  from jsonb_to_recordset(p_participant_shares) as requested(member_id uuid, share_cents bigint);

  if v_count <> v_member_count or v_count <> v_share_count then
    raise exception 'Expense participant shares are invalid';
  end if;

  if v_count <> v_unique_count then
    raise exception 'Expense participants cannot contain duplicates';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_participant_shares) as requested(member_id uuid, share_cents bigint)
    where requested.share_cents < 0
  ) then
    raise exception 'Expense shares cannot be negative';
  end if;

  if v_total <> p_amount_cents then
    raise exception 'Participant shares must add up to the expense total';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_participant_shares) as requested(member_id uuid, share_cents bigint)
    left join public.members member on member.id = requested.member_id
    where member.id is null
      or member.household_id <> p_household_id
      or member.active = false
  ) then
    raise exception 'Every participant must be an active member of this household';
  end if;
end;
$$;

create or replace function public.create_expense_with_shares_atomic(
  p_household_id uuid,
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

  insert into public.expenses (
    household_id,
    payer_member_id,
    amount_cents,
    description,
    category,
    expense_date,
    created_by_user_id
  )
  values (
    p_household_id,
    p_payer_member_id,
    p_amount_cents,
    trim(p_description),
    coalesce(nullif(trim(p_category), ''), 'Genel'),
    p_expense_date,
    auth.uid()
  )
  returning id into v_expense_id;

  insert into public.expense_participants (expense_id, member_id, share_cents)
  select v_expense_id, requested.member_id, requested.share_cents
  from jsonb_to_recordset(p_participant_shares) as requested(member_id uuid, share_cents bigint);

  return v_expense_id;
end;
$$;

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

  delete from public.expense_participants
  where expense_id = v_expense_id;

  insert into public.expense_participants (expense_id, member_id, share_cents)
  select v_expense_id, requested.member_id, requested.share_cents
  from jsonb_to_recordset(p_participant_shares) as requested(member_id uuid, share_cents bigint);

  return v_expense_id;
end;
$$;

revoke all on function public.assert_expense_shares_valid(uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.create_expense_with_shares_atomic(uuid, uuid, bigint, text, text, date, jsonb) from public, anon, authenticated;
revoke all on function public.update_expense_with_shares_atomic(uuid, uuid, uuid, bigint, text, text, date, jsonb) from public, anon, authenticated;

grant execute on function public.assert_expense_shares_valid(uuid, bigint, jsonb) to authenticated;
grant execute on function public.create_expense_with_shares_atomic(uuid, uuid, bigint, text, text, date, jsonb) to authenticated;
grant execute on function public.update_expense_with_shares_atomic(uuid, uuid, uuid, bigint, text, text, date, jsonb) to authenticated;
