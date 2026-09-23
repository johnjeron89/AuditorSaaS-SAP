import { createServiceClient } from '../_shared/supabase-client.ts';
import { corsHeaders, redirectResponse, jsonResponse, signState } from '../_shared/oauth-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tenantId = url.searchParams.get('tenant_id');
    if (!tenantId) {
      return jsonResponse({ error: 'Missing tenant_id' }, 400);
    }

    // Authenticate the calling user
    const supabase = createServiceClient();
    const authHeader = req.headers.get('Authorization');
    const sessionToken = authHeader
      ? authHeader.replace('Bearer ', '')
      : url.searchParams.get('token');

    if (!sessionToken) {
      return jsonResponse({ error: 'Unauthorized: missing auth token' }, 401);
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(sessionToken);
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized: invalid session' }, 401);
    }

    // Verify user owns this tenant via organization
    const { data: userProfile } = await supabase
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single();
    if (!userProfile) {
      return jsonResponse({ error: 'User profile not found' }, 403);
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('id, organization_id')
      .eq('id', tenantId)
      .single();
    if (!tenant) {
      return jsonResponse({ error: 'Tenant not found' }, 404);
    }
    if (tenant.organization_id !== userProfile.organization_id) {
      return jsonResponse({ error: 'Forbidden: tenant does not belong to your organization' }, 403);
    }

    const clientId = Deno.env.get('MS_OAUTH_CLIENT_ID');
    const redirectUri = Deno.env.get('MS_OAUTH_REDIRECT_URI');
    if (!clientId || !redirectUri) {
      return jsonResponse({ error: 'Microsoft OAuth not configured' }, 500);
    }

    const state = await signState({ tenant_id: tenantId });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
    });

    return redirectResponse(`https://login.microsoftonline.com/common/adminconsent?${params}`);
  } catch (error: any) {
    console.error('microsoft-oauth-init error:', error.message);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});
