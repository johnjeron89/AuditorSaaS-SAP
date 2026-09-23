import { JWT } from "npm:google-auth-library@9";

export class GoogleApiClient {
  private client: JWT;

  constructor(serviceAccountJson: any, adminEmail: string) {
    this.client = new JWT({
      email: serviceAccountJson.client_email,
      key: serviceAccountJson.private_key,
      subject: adminEmail,
      scopes: [
        "https://www.googleapis.com/auth/admin.directory.user.readonly",
        "https://www.googleapis.com/auth/admin.directory.user.security",
        "https://www.googleapis.com/auth/admin.directory.rolemanagement.readonly",
        "https://www.googleapis.com/auth/admin.directory.group.readonly",
        "https://www.googleapis.com/auth/apps.groups.settings",
        "https://www.googleapis.com/auth/admin.directory.device.mobile.readonly",
        "https://www.googleapis.com/auth/admin.directory.domain.readonly",
        "https://www.googleapis.com/auth/admin.reports.audit.readonly",
        "https://www.googleapis.com/auth/admin.reports.usage.readonly",
        "https://www.googleapis.com/auth/apps.alerts",
      ],
    });
  }

  async fetch(url: string, params?: Record<string, string>): Promise<any> {
    try {
      const urlObj = new URL(url);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          urlObj.searchParams.append(key, value);
        });
      }
      
      const res = await this.client.request({
        url: urlObj.toString(),
        method: "GET",
      });
      return res.data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  }

  async fetchPaginated(url: string, params: Record<string, string>, pageToken?: string): Promise<any> {
    const fetchParams = { ...params };
    if (pageToken) {
      fetchParams.pageToken = pageToken;
    }
    return this.fetch(url, fetchParams);
  }
}

// OAuth-based client that uses a Bearer access token directly
export class GoogleOAuthApiClient extends GoogleApiClient {
  private accessToken: string;

  constructor(accessToken: string) {
    // We don't call super with real values since we override fetch
    super({ client_email: '', private_key: '' }, '');
    this.accessToken = accessToken;
  }

  async fetch(url: string, params?: Record<string, string>): Promise<any> {
    const urlObj = new URL(url);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        urlObj.searchParams.append(key, value);
      });
    }
    const res = await globalThis.fetch(urlObj.toString(), {
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google API ${res.status}: ${text}`);
    }
    return res.json();
  }
}

// Resolver: returns a GoogleApiClient regardless of auth method
export async function getGoogleAccessToken(
  tenantId: string,
  supabase: any,
): Promise<GoogleApiClient> {
  // Get credential for this tenant
  const { data: cred, error } = await supabase
    .from('credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('platform', 'google_workspace')
    .order('auth_method', { ascending: true }) // 'oauth' before 'service_account'
    .limit(1)
    .single();

  if (error || !cred) {
    throw new Error('Google credentials not found for tenant');
  }

  if (cred.auth_method === 'service_account') {
    // Existing flow: decrypt JSON, create JWT-based client
    const { data: decrypted, error: decErr } = await supabase.rpc('decrypt_credentials', {
      p_tenant_id: tenantId,
    });
    if (decErr || !decrypted || !decrypted.length) {
      throw new Error('Failed to decrypt service account credentials');
    }
    const saJson = JSON.parse(decrypted[0].credentials_json);
    const adminEmail = decrypted[0].admin_email;
    return new GoogleApiClient(saJson, adminEmail);

  } else if (cred.auth_method === 'oauth') {
    // OAuth flow: decrypt refresh token, exchange for access token
    if (!cred.encrypted_refresh_token) {
      throw new Error('Missing refresh token for OAuth credential');
    }

    const { data: refreshToken, error: decErr } = await supabase.rpc('decrypt_secret', {
      p_encrypted: cred.encrypted_refresh_token,
    });
    if (decErr || !refreshToken) {
      throw new Error('Failed to decrypt refresh token');
    }

    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(`Google token refresh failed: ${tokenData.error_description || tokenData.error}`);
    }

    return new GoogleOAuthApiClient(tokenData.access_token);
  }

  throw new Error(`Unsupported auth_method: ${cred.auth_method}`);
}
