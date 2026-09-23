import { createServiceClient } from '../_shared/supabase-client.ts';
import { corsHeaders, redirectResponse, jsonResponse, verifyState, getFrontendUrl } from '../_shared/oauth-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const frontendUrl = getFrontendUrl();

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const errorParam = url.searchParams.get('error');

    // Handle denial
    if (errorParam) {
      const stateData = stateParam ? await verifyState(stateParam) : null;
      const tid = stateData?.tenant_id || '';
      const status = errorParam === 'access_denied' ? 'denied' : 'error';
      return redirectResponse(`${frontendUrl}/dashboard/tenants/${tid}?connect=${status}`);
    }

    if (!code || !stateParam) {
      return jsonResponse({ error: 'Missing code or state' }, 400);
    }

    // Verify HMAC state
    const stateData = await verifyState(stateParam);
    if (!stateData || !stateData.tenant_id) {
      return jsonResponse({ error: 'Invalid or expired state' }, 400);
    }
    const tenantId = stateData.tenant_id as string;

    // Exchange code for tokens
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;
    const redirectUri = Deno.env.get('GOOGLE_OAUTH_REDIRECT_URI')!;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      console.error('Token exchange failed:', tokenData.error || 'no refresh_token returned');
      return redirectResponse(`${frontendUrl}/dashboard/tenants/${tenantId}?connect=retry`);
    }

    // Fetch admin's email
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    const adminEmail = userInfo.email || 'unknown';

    // Encrypt and store
    const supabase = createServiceClient();

    const { data: encryptedToken } = await supabase.rpc('encrypt_secret', {
      p_plaintext: tokenData.refresh_token,
    });

    // Upsert: delete existing OAuth credential for this tenant+platform, then insert
    await supabase
      .from('credentials')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('platform', 'google_workspace')
      .eq('auth_method', 'oauth');

    const { error: insertError } = await supabase
      .from('credentials')
      .insert({
        tenant_id: tenantId,
        platform: 'google_workspace',
        auth_method: 'oauth',
        admin_email: adminEmail,
        encrypted_refresh_token: encryptedToken,
        metadata: { admin_email: adminEmail, scopes: tokenData.scope },
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return redirectResponse(`${frontendUrl}/dashboard/tenants/${tenantId}?connect=error`);
    }

    return redirectResponse(`${frontendUrl}/dashboard/tenants/${tenantId}?connect=success`);
  } catch (error: any) {
    console.error('google-oauth-callback error:', error);
    return redirectResponse(`${frontendUrl}/dashboard/tenants?connect=error`);
  }
});
