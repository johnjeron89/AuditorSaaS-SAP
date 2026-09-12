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

    const body = await req.json();
    const { tenant_id, service_account_json, admin_email } = body;

    if (!tenant_id || !service_account_json || !admin_email) {
      return new Response('Missing required fields', { status: 400 });
    }

    const saJson = typeof service_account_json === 'string' ? JSON.parse(service_account_json) : service_account_json;
    if (!saJson.type || !saJson.project_id || !saJson.private_key_id || !saJson.private_key || !saJson.client_email) {
      return new Response('Invalid service account JSON', { status: 400 });
    }

    const { error: rpcError } = await supabase.rpc('encrypt_credentials', {
      p_tenant_id: tenant_id,
      p_service_account_json: JSON.stringify(saJson),
      p_admin_email: admin_email
    });

    if (rpcError) throw rpcError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error uploading credentials:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
