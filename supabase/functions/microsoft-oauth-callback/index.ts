import { createServiceClient } from '../_shared/supabase-client.ts';
import { corsHeaders, redirectResponse, jsonResponse, verifyState, getFrontendUrl } from '../_shared/oauth-helpers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const frontendUrl = getFrontendUrl();

  try {
    const url = new URL(req.url);
    const stateParam = url.searchParams.get('state');
    const adminConsent = url.searchParams.get('admin_consent');
    const externalTenantId = url.searchParams.get('tenant'); // Microsoft's Entra tenant ID
    const errorParam = url.searchParams.get('error');

    if (errorParam) {
      const stateData = stateParam ? await verifyState(stateParam) : null;
      const tid = stateData?.tenant_id || '';
      return redirectResponse(`${frontendUrl}/dashboard/tenants/${tid}?connect=denied`);
    }

    if (!stateParam || !externalTenantId) {
      return jsonResponse({ error: 'Missing state or tenant parameter' }, 400);
    }

    const stateData = await verifyState(stateParam);
    if (!stateData || !stateData.tenant_id) {
      return jsonResponse({ error: 'Invalid or expired state' }, 400);
    }
    const tenantId = stateData.tenant_id as string;

    if (adminConsent !== 'True') {
      return redirectResponse(`${frontendUrl}/dashboard/tenants/${tenantId}?connect=denied`);
    }

    const supabase = createServiceClient();

    // Upsert credential
    await supabase
      .from('credentials')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('platform', 'microsoft_365')
      .eq('auth_method', 'oauth');

    const { error: insertError } = await supabase
      .from('credentials')
      .insert({
        tenant_id: tenantId,
        platform: 'microsoft_365',
        auth_method: 'oauth',
        metadata: { external_tenant_id: externalTenantId },
      });

    if (insertError) {
      console.error('Insert error:', insertError);
      return redirectResponse(`${frontendUrl}/dashboard/tenants/${tenantId}?connect=error`);
    }

    return redirectResponse(`${frontendUrl}/dashboard/tenants/${tenantId}?connect=success`);
  } catch (error: any) {
    console.error('microsoft-oauth-callback error:', error);
    return redirectResponse(`${frontendUrl}/dashboard/tenants?connect=error`);
  }
});
