-- Personal appearance preferences. Household data and permissions stay independent.
create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  appearance jsonb not null default '{}'::jsonb
    check (jsonb_typeof(appearance) = 'object' and octet_length(appearance::text) <= 16384),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from anon, authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;

create policy "Users read their own preferences" on public.user_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users create their own preferences" on public.user_preferences
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update their own preferences" on public.user_preferences
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete their own preferences" on public.user_preferences
  for delete to authenticated using ((select auth.uid()) = user_id);

create function public.touch_user_preferences_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.touch_user_preferences_updated_at();
