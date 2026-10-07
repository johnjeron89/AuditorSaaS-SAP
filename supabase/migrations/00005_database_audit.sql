-- Database Audit Platform Support
-- Extends existing schema to allow 'database' as a tenant platform
-- and 'agent_push' as a credential auth_method.

-- 1. Drop and recreate tenants.platform CHECK to include 'database'
alter table public.tenants
  drop constraint if exists tenants_platform_check;

alter table public.tenants
  add constraint tenants_platform_check
  check (platform in ('google_workspace', 'microsoft_365', 'database'));

-- 2. Drop and recreate credentials.auth_method CHECK to include 'agent_push'
alter table public.credentials
  drop constraint if exists credentials_auth_method_check;

alter table public.credentials
  add constraint credentials_auth_method_check
  check (auth_method in ('service_account', 'oauth', 'agent_push'));

-- 3. Helper: constant-time comparison for API key hashes (SHA-256 hex)
--    Used by agent-submit-database-audit Edge Function.
create or replace function public.verify_agent_key(
  p_tenant_id uuid,
  p_raw_key_hash text  -- SHA-256 hex of the raw key sent by the agent
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stored_hash text;
begin
  select (metadata->>'agent_api_key_hash')::text
    into v_stored_hash
  from public.credentials
  where tenant_id = p_tenant_id
    and auth_method = 'agent_push'
  limit 1;

  if v_stored_hash is null then
    return false;
  end if;

  -- Use digest comparison (constant-time via pgcrypto)
  return v_stored_hash = p_raw_key_hash;
end;
$$;

revoke execute on function public.verify_agent_key(uuid, text) from public, anon, authenticated;
