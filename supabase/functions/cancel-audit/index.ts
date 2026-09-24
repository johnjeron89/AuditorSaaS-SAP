import { createServiceClient } from '../_shared/supabase-client.ts';

const FRONTEND_ORIGIN = Deno.env.get('FRONTEND_URL') || 'https://dashboard-eight-mu-41.vercel.app';
const corsHeaders = {
  'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createServiceClient();
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { audit_run_id } = await req.json();
    if (!audit_run_id) {
      return new Response(JSON.stringify({ error: 'Missing audit_run_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the audit run exists and is running
    const { data: run, error: runError } = await supabase
      .from('audit_runs')
      .select('id, status, tenant_id')
      .eq('id', audit_run_id)
      .single();

    if (runError || !run) {
      return new Response(JSON.stringify({ error: 'Audit run not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (run.status !== 'running') {
      return new Response(JSON.stringify({ error: 'Audit is not running', status: run.status }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cancel all pending/running jobs
    await supabase
      .from('audit_jobs')
      .update({ status: 'failed', error: 'Cancelled by user' })
      .eq('audit_run_id', audit_run_id)
      .in('status', ['pending', 'running']);

    // Mark the audit run as failed
    await supabase
      .from('audit_runs')
      .update({ status: 'failed', completed_at: new Date().toISOString() })
      .eq('id', audit_run_id);

    return new Response(JSON.stringify({ success: true, message: 'Audit cancelled' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Cancel audit error:', error.message);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
