import { createServiceClient } from '../_shared/supabase-client.ts';
import { corsHeaders, jsonResponse } from '../_shared/oauth-helpers.ts';

// Generate a cryptographically random API key for database audit agents.
// Returns the raw key ONCE — only the SHA-256 hash is stored.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  // Auth: require a valid Supabase user session
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabase = createServiceClient();
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json();
    const { tenant_id, db_engine } = body;

    if (!tenant_id) {
      return jsonResponse({ error: 'Missing tenant_id' }, 400);
    }
    if (!db_engine || !['postgres', 'mysql'].includes(db_engine)) {
      return jsonResponse({ error: "db_engine must be 'postgres' or 'mysql'" }, 400);
    }

    // Verify tenant exists and belongs to user's org
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, platform')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return jsonResponse({ error: 'Tenant not found' }, 404);
    }
    if (tenant.platform !== 'database') {
      return jsonResponse({ error: 'Tenant platform must be "database"' }, 400);
    }

    // Generate a 32-byte random API key
    const rawKeyBytes = new Uint8Array(32);
    crypto.getRandomValues(rawKeyBytes);
    const rawKey = Array.from(rawKeyBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // SHA-256 hash of the raw key (this is what we store)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
    const keyHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Delete any existing agent_push credential for this tenant
    await supabase
      .from('credentials')
      .delete()
      .eq('tenant_id', tenant_id)
      .eq('auth_method', 'agent_push');

    // Insert new credential with hashed key in metadata
    const { error: insertError } = await supabase.from('credentials').insert({
      tenant_id,
      platform: 'database',
      auth_method: 'agent_push',
      admin_email: null,
      encrypted_credentials: null,
      metadata: {
        db_engine,
        agent_api_key_hash: keyHash,
        last_agent_seen_at: null,
      },
    });

    if (insertError) {
      console.error('Insert error:', insertError);
      return jsonResponse({ error: 'Failed to store agent key' }, 500);
    }

    // Return the raw key ONCE — it cannot be retrieved again
    return jsonResponse({
      api_key: rawKey,
      db_engine,
      tenant_id,
      message: 'Save this API key — it will not be shown again.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('generate-agent-key error:', msg);
    return jsonResponse({ error: msg }, 500);
  }
});
