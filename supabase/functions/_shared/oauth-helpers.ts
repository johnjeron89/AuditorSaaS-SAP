const FRONTEND_ORIGIN = Deno.env.get('FRONTEND_URL') || 'https://dashboard-eight-mu-41.vercel.app';

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': FRONTEND_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function redirectResponse(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: url },
  });
}

// HMAC-based state signing for CSRF protection
const encoder = new TextEncoder();

async function getHmacKey(): Promise<CryptoKey> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-key';
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function signState(payload: Record<string, unknown>): Promise<string> {
  const data = JSON.stringify({ ...payload, ts: Date.now() });
  const key = await getHmacKey();
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoa(JSON.stringify({ data, sig: toHex(sig) }));
}

export async function verifyState(state: string): Promise<Record<string, unknown> | null> {
  try {
    const { data, sig } = JSON.parse(atob(state));
    const key = await getHmacKey();
    const sigBytes = new Uint8Array(sig.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
    if (!valid) return null;
    const parsed = JSON.parse(data);
    // Reject states older than 10 minutes
    if (Date.now() - parsed.ts > 10 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getFrontendUrl(): string {
  return Deno.env.get('FRONTEND_URL') || 'https://dashboard-eight-mu-41.vercel.app';
}
