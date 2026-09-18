revoke execute on function public.is_household_member(uuid) from anon;
revoke execute on function public.is_household_owner(uuid) from anon;
revoke execute on function public.create_household(text, text) from anon;
revoke execute on function public.join_household(text, text) from anon;
