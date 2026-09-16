const https = require('https');
const fs = require('fs');

const SUPABASE_URL = 'https://sbpjtynofivcddmctjnh.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicGp0eW5vZml2Y2RkbWN0am5oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA5NjA0NSwiZXhwIjoyMTA0NjcyMDQ1fQ.tIbe1tEY7kmSxFuFaBV_MFKB_zxlTPANhrODM2w_RpQ';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicGp0eW5vZml2Y2RkbWN0am5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTYwNDUsImV4cCI6MjEwNDY3MjA0NX0.Q6z3D-8gRbinVNSUh_lBfwxwaHv05c_KP60t_EV21D8';

const TEST_EMAIL = `test-json-${Date.now()}@sapvyra.com`;
const TEST_PASSWORD = 'TestPass123!';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': ANON_KEY,
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(method === 'POST' && path.includes('/rest/') ? { 'Prefer': 'return=representation' } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b || '{}') }); }
        catch { resolve({ status: res.statusCode, data: b }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function testJsonFlow() {
  console.log('--- TESTING SERVICE ACCOUNT JSON UPLOAD ---');

  // 1. Create test user
  const userRes = await request('POST', '/auth/v1/admin/users', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  }, SERVICE_KEY);
  const userId = userRes.data.id;
  console.log('1. Created user:', userId);

  // 2. Sign in to get user session token
  const signin = await request('POST', '/auth/v1/token?grant_type=password', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  }, ANON_KEY);
  const token = signin.data.access_token;
  console.log('2. Authenticated user session obtained');

  // 3. Ensure organization & user profile
  await new Promise(r => setTimeout(r, 1000));
  let orgRes = await request('GET', `/rest/v1/users?select=organization_id&id=eq.${userId}`, null, SERVICE_KEY);
  let orgId = orgRes.data?.[0]?.organization_id;
  if (!orgId) {
    const org = await request('POST', '/rest/v1/organizations?select=*', { name: 'JSON Test Org' }, SERVICE_KEY);
    orgId = org.data[0].id;
    await request('POST', '/rest/v1/users?select=*', { id: userId, email: TEST_EMAIL, organization_id: orgId }, SERVICE_KEY);
  }
  console.log('3. Organization ID:', orgId);

  // 4. Create Tenant
  const tenantRes = await request('POST', '/rest/v1/tenants?select=*', {
    organization_id: orgId,
    name: 'Acme Test Domain',
    platform: 'google_workspace',
  }, token);
  const tenantId = tenantRes.data[0].id;
  console.log('4. Created Tenant:', tenantId);

  // 5. Test upload-credentials with test-service-account.json
  const saJson = JSON.parse(fs.readFileSync('./test-service-account.json', 'utf8'));
  console.log('5. Uploading JSON key for:', saJson.client_email);

  const uploadRes = await request('POST', '/functions/v1/upload-credentials', {
    tenant_id: tenantId,
    credentials: saJson,
    admin_email: 'admin@acmetest.com',
  }, token);

  console.log('6. Upload function response status:', uploadRes.status);
  console.log('   Response body:', uploadRes.data);

  // 7. Verify encrypted credential in database
  const credsInDb = await request('GET', `/rest/v1/credentials?select=id,tenant_id,admin_email,created_at&tenant_id=eq.${tenantId}`, null, SERVICE_KEY);
  console.log('7. Credentials in DB:', credsInDb.data);

  // 8. Test decrypt_credentials RPC
  const decryptRes = await request('POST', '/rest/v1/rpc/decrypt_credentials', {
    p_tenant_id: tenantId
  }, SERVICE_KEY);
  console.log('8. Decrypt RPC status:', decryptRes.status);
  if (decryptRes.status === 200 && decryptRes.data?.[0]?.credentials_json) {
    const decrypted = JSON.parse(decryptRes.data[0].credentials_json);
    console.log('   Decrypted client_email:', decrypted.client_email);
    console.log('   Decrypted project_id:', decrypted.project_id);
    console.log('   Matches original JSON:', decrypted.client_email === saJson.client_email ? 'YES! ✅' : 'NO ❌');
  } else {
    console.log('   Decrypt output:', decryptRes.data);
  }

  // Cleanup
  await request('DELETE', `/auth/v1/admin/users/${userId}`, null, SERVICE_KEY);
  console.log('--- TEST FINISHED & CLEANED UP ---');
}

testJsonFlow().catch(console.error);
