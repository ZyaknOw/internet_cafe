-- Deprecated for this project.
-- The workspace already contains a legacy public.profiles table without auth_user_id.
-- Run 002_account_profiles.sql instead; it creates the secure account table without
-- altering or indexing the legacy table.
select 'Use 002_account_profiles.sql for the NetCafe approval/auth workflow.' as message;
