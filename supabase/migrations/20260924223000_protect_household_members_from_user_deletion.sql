-- Membership history must not disappear when an Auth account is deleted.
-- This constraint is the final guard if membership changes after the admin
-- action's preflight check and before Auth performs its delete.
alter table public.members
  drop constraint members_user_id_fkey,
  add constraint members_user_id_fkey
  foreign key (user_id) references auth.users(id) on delete restrict;
