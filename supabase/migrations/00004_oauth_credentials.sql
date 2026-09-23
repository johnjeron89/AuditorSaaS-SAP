-- OAuth credentials support
-- Backward-compatible: all existing rows get auth_method='service_account'

-- 1. Add new columns to credentials
alter table public.credentials 
  add column if not exists auth_method text not null default 'service_account',
  add column if not exists encrypted_refresh_token bytea,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2. Add check constraint for auth_method
alter table public.credentials
  add constraint credentials_auth_method_check 
  check (auth_method in ('service_account', 'oauth'));

-- 3. Make admin_email nullable (Microsoft OAuth doesn't always have it at insert time)
alter table public.credentials 
  alter column admin_email drop not null;

-- 4. Make encrypted_credentials nullable (Microsoft admin-consent stores no secret blob)
alter table public.credentials 
  alter column encrypted_credentials drop not null;

-- 5. Unique index: one credential per tenant+platform+method
create unique index if not exists idx_credentials_tenant_platform_method 
  on public.credentials (tenant_id, platform, auth_method);

-- 6. Generic encrypt/decrypt helpers using the same vault key
create or replace function public.encrypt_secret(p_plaintext text)
returns bytea
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'credentials_encryption_key' limit 1;
  if v_key is null then
    raise exception 'Encryption key not found in vault';
  end if;
  return extensions.pgp_sym_encrypt(p_plaintext, v_key);
end;
$$;

create or replace function public.decrypt_secret(p_encrypted bytea)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'credentials_encryption_key' limit 1;
  if v_key is null then
    raise exception 'Encryption key not found in vault';
  end if;
  return extensions.pgp_sym_decrypt(p_encrypted, v_key);
end;
$$;

-- Restrict to service_role only
revoke execute on function public.encrypt_secret(text) from public, anon, authenticated;
revoke execute on function public.decrypt_secret(bytea) from public, anon, authenticated;

-- 7. Update encrypt_credentials to scope delete by auth_method
create or replace function public.encrypt_credentials(
  p_tenant_id uuid,
  p_creds_json text,
  p_admin_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key text;
  v_id uuid;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'credentials_encryption_key' limit 1;
  if v_key is null then
    raise exception 'Encryption key not found in vault';
  end if;
  -- Only delete service_account rows for this tenant (not OAuth ones)
  delete from public.credentials 
  where tenant_id = p_tenant_id and auth_method = 'service_account';
  insert into public.credentials (tenant_id, platform, admin_email, encrypted_credentials, auth_method)
  values (
    p_tenant_id, 'google_workspace', p_admin_email,
    extensions.pgp_sym_encrypt(p_creds_json, v_key), 'service_account'
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 8. Update decrypt_credentials to prefer service_account but fall back to oauth
create or replace function public.decrypt_credentials(
  p_tenant_id uuid
)
returns table(credentials_json text, admin_email text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'credentials_encryption_key' limit 1;
  if v_key is null then
    raise exception 'Encryption key not found in vault';
  end if;
  return query
  select
    extensions.pgp_sym_decrypt(c.encrypted_credentials, v_key)::text as credentials_json,
    c.admin_email
  from public.credentials c
  where c.tenant_id = p_tenant_id
    and c.encrypted_credentials is not null
  order by case when c.auth_method = 'service_account' then 0 else 1 end
  limit 1;
end;
$$;
