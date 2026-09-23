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
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const supabase = createServiceClient();
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { tenant_id, admin_email } = body;
    const saInput = body.service_account_json || body.credentials;

    if (!tenant_id || !saInput || !admin_email) {
      return new Response(JSON.stringify({ error: 'Missing required fields: tenant_id, service_account_json/credentials, admin_email' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const saJson = typeof saInput === 'string' ? JSON.parse(saInput) : saInput;
    if (!saJson.type || !saJson.project_id || !saJson.private_key_id || !saJson.private_key || !saJson.client_email) {
      return new Response(JSON.stringify({ error: 'Invalid service account JSON: missing required fields' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: credId, error: rpcError } = await supabase.rpc('encrypt_credentials', {
      p_tenant_id: tenant_id,
      p_creds_json: JSON.stringify(saJson),
      p_admin_email: admin_email
    });

    if (rpcError) throw rpcError;

    return new Response(JSON.stringify({ success: true, credential_id: credId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error uploading credentials:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
