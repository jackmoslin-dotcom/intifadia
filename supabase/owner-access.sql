-- Manual owner provisioning only. Run in the trusted Supabase SQL Editor.
-- Replace the placeholder with your existing Authentication > Users UID.
-- Never put passwords, service keys or MFA codes here.
do $$
declare owner_id uuid := 'REPLACE_WITH_AUTH_USER_UUID';
begin
 if not exists(select 1 from auth.users where id=owner_id) then
  raise exception 'Owner UUID does not exist in Supabase Auth';
 end if;
 insert into public.admin_roles(user_id,role) values(owner_id,'owner')
 on conflict(user_id) do update set role=excluded.role;
end $$;
