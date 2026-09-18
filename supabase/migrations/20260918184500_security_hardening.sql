alter function public.touch_updated_at() set search_path = public;

revoke all on function public.is_household_member(uuid) from public;
grant execute on function public.is_household_member(uuid) to authenticated;

revoke all on function public.is_household_owner(uuid) from public;
grant execute on function public.is_household_owner(uuid) to authenticated;

revoke all on function public.create_household(text, text) from public;
grant execute on function public.create_household(text, text) to authenticated;

revoke all on function public.join_household(text, text) from public;
grant execute on function public.join_household(text, text) to authenticated;
