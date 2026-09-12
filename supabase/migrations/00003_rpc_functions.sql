-- encrypt_credentials: encrypts service account JSON and stores it
create or replace function public.encrypt_credentials(
  p_tenant_id uuid,
  p_creds_json text,
  p_admin_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
  v_id uuid;
begin
  -- Get encryption key from vault
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'credentials_encryption_key'
  limit 1;

  if v_key is null then
    raise exception 'Encryption key not found in vault. Run: select vault.create_secret(''your-key'', ''credentials_encryption_key'')';
  end if;

  -- Delete existing credentials for this tenant (one set per tenant)
  delete from public.credentials where tenant_id = p_tenant_id;

  -- Insert encrypted credentials
  insert into public.credentials (tenant_id, platform, admin_email, encrypted_credentials)
  values (
    p_tenant_id,
    'google_workspace',
    p_admin_email,
    pgp_sym_encrypt(p_creds_json, v_key)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- decrypt_credentials: returns decrypted JSON + admin email for a tenant
create or replace function public.decrypt_credentials(
  p_tenant_id uuid
)
returns table(credentials_json text, admin_email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key
  from vault.decrypted_secrets
  where name = 'credentials_encryption_key'
  limit 1;

  if v_key is null then
    raise exception 'Encryption key not found in vault';
  end if;

  return query
  select
    pgp_sym_decrypt(c.encrypted_credentials, v_key)::text as credentials_json,
    c.admin_email
  from public.credentials c
  where c.tenant_id = p_tenant_id
  limit 1;
end;
$$;

-- claim_pending_jobs: atomically claims a batch of pending jobs
-- Uses FOR UPDATE SKIP LOCKED to prevent double-processing
create or replace function public.claim_pending_jobs(
  p_batch_size int default 5
)
returns setof public.audit_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select aj.id
    from public.audit_jobs aj
    where aj.status = 'pending'
    order by aj.created_at
    limit p_batch_size
    for update skip locked
  )
  update public.audit_jobs
  set status = 'processing', updated_at = now()
  where id in (select id from claimed)
  returning *;
end;
$$;

-- finalize_audit_run: checks if all jobs are complete, computes score
create or replace function public.finalize_audit_run(
  p_audit_run_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending int;
  v_processing int;
  v_failed int;
  v_total_weight numeric;
  v_pass_weight numeric;
  v_score numeric;
begin
  -- Count remaining jobs
  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status = 'processing'),
    count(*) filter (where status = 'failed')
  into v_pending, v_processing, v_failed
  from public.audit_jobs
  where audit_run_id = p_audit_run_id;

  -- If there are still pending or processing jobs, not done yet
  if v_pending > 0 or v_processing > 0 then
    return false;
  end if;

  -- Compute weighted score
  -- critical=3x, high=2x, medium=1x, low=0.5x
  select
    coalesce(sum(
      case severity
        when 'critical' then 3.0
        when 'high' then 2.0
        when 'medium' then 1.0
        when 'low' then 0.5
        else 1.0
      end
    ), 0),
    coalesce(sum(
      case when status = 'pass' then
        case severity
          when 'critical' then 3.0
          when 'high' then 2.0
          when 'medium' then 1.0
          when 'low' then 0.5
          else 1.0
        end
      else 0 end
    ), 0)
  into v_total_weight, v_pass_weight
  from public.findings
  where audit_run_id = p_audit_run_id
    and status != 'n/a';

  -- Calculate score (0-100)
  if v_total_weight > 0 then
    v_score := round((v_pass_weight / v_total_weight) * 100, 1);
  else
    v_score := 100;
  end if;

  -- Update the audit run
  update public.audit_runs
  set
    status = case when v_failed > 0 then 'failed' else 'completed' end,
    score = v_score,
    completed_at = now()
  where id = p_audit_run_id;

  return true;
end;
$$;

-- Helper: create user profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  -- Create a new organization for the user
  insert into public.organizations (name)
  values (split_part(new.email, '@', 1) || '''s Organization')
  returning id into v_org_id;

  -- Create the user profile
  insert into public.users (id, email, organization_id)
  values (new.id, new.email, v_org_id);

  return new;
end;
$$;

-- Trigger to auto-create profile on auth signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
