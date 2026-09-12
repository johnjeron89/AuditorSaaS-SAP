-- Auditer SaaS v1 — Core Schema
create extension if not exists pgcrypto;

-- Organizations
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Users (linked to Supabase Auth)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  organization_id uuid references public.organizations(id),
  created_at timestamptz not null default now()
);

-- Tenants (the customer GWS domains being audited)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  platform text not null default 'google_workspace'
    check (platform in ('google_workspace', 'microsoft_365')),
  created_at timestamptz not null default now()
);

-- Encrypted credentials (service account JSON)
create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  platform text not null default 'google_workspace',
  admin_email text not null,  -- impersonation target for domain-wide delegation
  encrypted_credentials bytea not null,
  created_at timestamptz not null default now()
);

-- Audit runs
create table public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  framework text not null,  -- 'cis', 'gdpr', 'soc2', 'all'
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  score numeric,
  report_url text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Individual findings
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  check_id text not null,
  title text not null,
  description text,
  severity text check (severity in ('critical', 'high', 'medium', 'low')),
  status text check (status in ('pass', 'fail', 'n/a')),
  regulation_section text,
  fix_instructions text,
  evidence jsonb,
  created_at timestamptz not null default now()
);

-- Job queue for chunked scanning
create table public.audit_jobs (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid not null references public.audit_runs(id) on delete cascade,
  job_type text not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  cursor text,
  attempts int not null default 0,
  payload jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index idx_audit_jobs_status_created on public.audit_jobs (status, created_at);
create index idx_audit_jobs_run_status on public.audit_jobs (audit_run_id, status);
create index idx_findings_run on public.findings (audit_run_id);
create index idx_audit_runs_tenant on public.audit_runs (tenant_id);
create index idx_tenants_org on public.tenants (organization_id);

-- Auto-update updated_at on audit_jobs
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger audit_jobs_updated_at
  before update on public.audit_jobs
  for each row execute function public.update_updated_at();

-- Row Level Security
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.tenants enable row level security;
alter table public.credentials enable row level security;
alter table public.audit_runs enable row level security;
alter table public.findings enable row level security;
alter table public.audit_jobs enable row level security;

-- RLS Policies: users can only see data belonging to their organization
create policy "Users can view own org" on public.organizations
  for select using (
    id in (select organization_id from public.users where id = auth.uid())
  );

create policy "Users can view own profile" on public.users
  for select using (id = auth.uid());

create policy "Users can view own org tenants" on public.tenants
  for select using (
    organization_id in (select organization_id from public.users where id = auth.uid())
  );

create policy "Users can insert tenants in own org" on public.tenants
  for insert with check (
    organization_id in (select organization_id from public.users where id = auth.uid())
  );

create policy "Users can view own org credentials" on public.credentials
  for select using (
    tenant_id in (
      select id from public.tenants
      where organization_id in (select organization_id from public.users where id = auth.uid())
    )
  );

create policy "Users can view own org audit runs" on public.audit_runs
  for select using (
    tenant_id in (
      select id from public.tenants
      where organization_id in (select organization_id from public.users where id = auth.uid())
    )
  );

create policy "Users can view own org findings" on public.findings
  for select using (
    audit_run_id in (
      select ar.id from public.audit_runs ar
      join public.tenants t on t.id = ar.tenant_id
      where t.organization_id in (select organization_id from public.users where id = auth.uid())
    )
  );

-- audit_jobs: users can read (for progress tracking), but only service role can write
create policy "Users can view own org audit jobs" on public.audit_jobs
  for select using (
    audit_run_id in (
      select ar.id from public.audit_runs ar
      join public.tenants t on t.id = ar.tenant_id
      where t.organization_id in (select organization_id from public.users where id = auth.uid())
    )
  );

create policy "No direct writes to audit_jobs" on public.audit_jobs
  for insert with check (false);

create policy "No direct updates to audit_jobs" on public.audit_jobs
  for update using (false);

create policy "No direct deletes from audit_jobs" on public.audit_jobs
  for delete using (false);
