import { createServiceClient } from './supabase-client.ts';

export async function getMicrosoftAccessToken(tenantId: string): Promise<string> {
  const supabase = createServiceClient();

  const { data: cred, error } = await supabase
    .from('credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('platform', 'microsoft_365')
    .single();

  if (error || !cred) {
    throw new Error('Microsoft credentials not found for tenant');
  }

  const clientId = Deno.env.get('MS_OAUTH_CLIENT_ID')!;
  const clientSecret = Deno.env.get('MS_OAUTH_CLIENT_SECRET')!;

  if (cred.auth_method === 'oauth') {
    // Admin-consent flow: use client_credentials against the client's Entra tenant ID
    const externalTenantId = (cred.metadata as any)?.external_tenant_id;
    if (!externalTenantId) {
      throw new Error('Missing external_tenant_id in OAuth credential metadata');
    }

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${externalTenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      },
    );

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(`Microsoft token error: ${tokenData.error_description || tokenData.error}`);
    }
    return tokenData.access_token;

  } else if (cred.auth_method === 'service_account') {
    // Service account flow: decrypt the client secret and use client_credentials
    // against the tenant ID stored in the encrypted credentials JSON
    const { data: decrypted } = await supabase.rpc('decrypt_credentials', { p_tenant_id: tenantId });
    if (!decrypted || !decrypted.length) {
      throw new Error('Failed to decrypt Microsoft credentials');
    }
    const credsJson = JSON.parse(decrypted[0].credentials_json);
    const tenantAzureId = credsJson.tenant_id;
    const appClientId = credsJson.client_id;
    const appClientSecret = credsJson.client_secret;

    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantAzureId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: appClientId,
          client_secret: appClientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      },
    );

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(`Microsoft token error: ${tokenData.error_description || tokenData.error}`);
    }
    return tokenData.access_token;
  }

  throw new Error(`Unsupported auth_method: ${cred.auth_method}`);
}
