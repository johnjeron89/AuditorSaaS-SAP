import { GoogleApiClient, getGoogleAccessToken } from './google-auth.ts';
import { GoogleMockApiClient, MockVariant } from './google-mock-client.ts';
import { SupabaseClient } from '@supabase/supabase-js';

export function getAuditDataSource(): 'live' | 'mock' {
  const source = Deno.env.get('AUDIT_DATA_SOURCE') || 'live';
  return source.toLowerCase() === 'mock' ? 'mock' : 'live';
}

export function isMockAudit(): boolean {
  return getAuditDataSource() === 'mock';
}

export function resolveMockVariant(
  explicitVariant?: string | null,
  fallbackEnv: string = 'AUDIT_MOCK_VARIANT'
): MockVariant {
  const candidate = explicitVariant || Deno.env.get(fallbackEnv);
  return candidate?.toLowerCase() === 'messy' ? 'messy' : 'clean';
}

/**
 * Resolves the Google API client for audit checks.
 * In live mode: uses credential lookup & OAuth/Service Account.
 * In mock mode: returns GoogleMockApiClient with requested fixture variant ('clean' | 'messy').
 */
export async function getAuditGoogleClient(
  tenantId: string,
  supabase: SupabaseClient | any,
  options?: {
    variant?: MockVariant | string | null;
    forceMock?: boolean;
  }
): Promise<GoogleApiClient> {
  if (options?.forceMock || isMockAudit()) {
    const variant = resolveMockVariant(options?.variant);
    return new GoogleMockApiClient(variant);
  }

  return getGoogleAccessToken(tenantId, supabase);
}
