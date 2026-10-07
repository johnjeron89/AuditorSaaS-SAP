import { createServiceClient } from '../_shared/supabase-client.ts';
import { getCorsHeaders, jsonResponse } from '../_shared/oauth-helpers.ts';

// Generate a cryptographically random API key for database audit agents.
// Returns the raw key ONCE — only the SHA-256 hash is stored.

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405, req);
  }

  // Auth: require a valid Supabase user session
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'Unauthorized: missing Authorization header' }, 401, req);
  }

  try {
    const supabase = createServiceClient();
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: `Unauthorized: ${authError?.message || 'invalid token'}` }, 401, req);
    }

    const body = await req.json();
    const { tenant_id, db_engine } = body;

    if (!tenant_id) {
      return jsonResponse({ error: 'Missing tenant_id' }, 400, req);
    }
    if (!db_engine || !['postgres', 'mysql'].includes(db_engine)) {
      return jsonResponse({ error: "db_engine must be 'postgres' or 'mysql'" }, 400, req);
    }

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, platform, organization_id')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      return jsonResponse({ error: 'Tenant not found' }, 404, req);
    }
    if (tenant.platform !== 'database') {
      return jsonResponse({ error: 'Tenant platform must be "database"' }, 400, req);
    }

    // Verify user belongs to tenant's organization
    const { data: userProfile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();

    if (userProfile && userProfile.organization_id !== tenant.organization_id) {
      return jsonResponse({ error: 'Forbidden: tenant belongs to another organization' }, 403, req);
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
      return jsonResponse({ error: `Failed to store agent key: ${insertError.message}` }, 500, req);
    }

    // Return the raw key ONCE — it cannot be retrieved again
    return jsonResponse({
      api_key: rawKey,
      db_engine,
      tenant_id,
      message: 'Save this API key — it will not be shown again.',
    }, 200, req);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('generate-agent-key error:', msg);
    return jsonResponse({ error: msg }, 500, req);
  }
});
