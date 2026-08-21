create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_user_id uuid;
  v_email text := 'fzyad387@gmail.com';
  v_pass text := 'zyadzyad2';
begin
  select id into v_user_id from auth.users where lower(email) = v_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, extensions.crypt(v_pass, extensions.gen_salt('bf')),
      now(),
      jsonb_build_object('provider','email','providers', jsonb_build_array('email')),
      jsonb_build_object('full_name','المالك - زياد'),
      now(), now()
    );

    insert into auth.identities (id, user_id, provider_id, provider, identity_data, created_at, updated_at, last_sign_in_at)
    values (
      gen_random_uuid(), v_user_id, v_user_id::text, 'email',
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      now(), now(), null
    );
  else
    update auth.users
      set encrypted_password = extensions.crypt(v_pass, extensions.gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          banned_until = null,
          deleted_at = null,
          updated_at = now()
    where id = v_user_id;
  end if;

  insert into public.admin_profiles (user_id, email, full_name, role, active)
  values (v_user_id, v_email, 'المالك - زياد', 'super_admin', true)
  on conflict (user_id) do update
    set role = 'super_admin', active = true, email = v_email,
        full_name = coalesce(nullif(public.admin_profiles.full_name, ''), 'المالك - زياد');

  insert into public.audit_logs (actor_user_id, actor_email, action, entity_type, entity_id, metadata)
  values (v_user_id, v_email, 'grant_owner_super_admin', 'admin_profiles', v_user_id::text,
          jsonb_build_object('source','migration','note','owner account provisioned'));
end $$;