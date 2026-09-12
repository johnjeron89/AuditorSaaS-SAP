import { createServiceClient } from '../_shared/supabase-client.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { tenant_id, framework } = await req.json();
    if (!tenant_id) return new Response('Missing tenant_id', { status: 400 });

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) return new Response('Tenant not found', { status: 404 });

    // Verify credentials exist for this tenant
    const { data: creds } = await supabase
      .from('credentials')
      .select('id')
      .eq('tenant_id', tenant_id)
      .limit(1);

    if (!creds || creds.length === 0) {
      return new Response(JSON.stringify({ error: 'No credentials found. Upload a service account key first.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { data: auditRun, error: runError } = await supabase
      .from('audit_runs')
      .insert({
        tenant_id,
        framework: framework || 'Google Workspace CIS',
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (runError) throw runError;

    const jobTypes = [
      'fetch_users_page', 'check_admin_activity', 'check_drive_sharing',
      'fetch_oauth_tokens', 'check_email_dns', 'fetch_mobile_devices',
      'fetch_groups_settings', 'check_calendar_sharing', 'check_login_activity',
      'check_admin_roles', 'check_dlp_rules'
    ];

    const jobs = jobTypes.map(job_type => ({
      audit_run_id: auditRun.id,
      job_type,
      status: 'pending'
    }));

    const { error: jobsError } = await supabase.from('audit_jobs').insert(jobs);
    if (jobsError) throw jobsError;

    return new Response(JSON.stringify({ audit_run_id: auditRun.id }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error starting audit:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
