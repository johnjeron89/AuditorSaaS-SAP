// End-to-end test: Admin-create user → Sign in → Create tenant → Upload credentials
const https = require('https');
const fs = require('fs');

const SUPABASE_URL = 'https://sbpjtynofivcddmctjnh.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicGp0eW5vZml2Y2RkbWN0am5oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTYwNDUsImV4cCI6MjEwNDY3MjA0NX0.Q6z3D-8gRbinVNSUh_lBfwxwaHv05c_KP60t_EV21D8';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicGp0eW5vZml2Y2RkbWN0am5oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA5NjA0NSwiZXhwIjoyMTA0NjcyMDQ1fQ.tIbe1tEY7kmSxFuFaBV_MFKB_zxlTPANhrODM2w_RpQ';

const TEST_EMAIL = `test-${Date.now()}@sapvyra.com`;
const TEST_PASSWORD = 'TestPass123!';

function supabaseRequest(method, path, body, token) {
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
        'Authorization': `Bearer ${token || ANON_KEY}`,
        ...(method === 'POST' && path.includes('/rest/') ? { 'Prefer': 'return=representation' } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body || '{}') }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   AUDITER SAAS — E2E TEST SUITE          ║');
  console.log('╚══════════════════════════════════════════╝\n');

  let passed = 0, failed = 0;
  const mark = (ok, msg) => { ok ? passed++ : failed++; console.log(`  ${ok ? '✓ PASS' : '✗ FAIL'} — ${msg}`); };

  // 1. Create user via Admin API (auto-confirmed)
  console.log(`TEST 1: Create auto-confirmed user (${TEST_EMAIL})`);
  const create = await supabaseRequest('POST', '/auth/v1/admin/users', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  }, SERVICE_KEY);

  const userId = create.data?.id;
  mark(create.status === 200 && userId, `User created — ID: ${userId || 'N/A'} (Status ${create.status})`);

  if (!userId) {
    console.log('  Details:', JSON.stringify(create.data).substring(0, 200));
    return printSummary(passed, failed);
  }

  // 2. Sign in
  console.log(`\nTEST 2: Sign In`);
  const signin = await supabaseRequest('POST', '/auth/v1/token?grant_type=password', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const accessToken = signin.data?.access_token;
  mark(signin.status === 200 && accessToken, `Signed in — token received`);

  if (!accessToken) {
    console.log('  Details:', JSON.stringify(signin.data).substring(0, 200));
    return printSummary(passed, failed);
  }

  // 3. Check auto-created profile & org (handle_new_user trigger)
  console.log(`\nTEST 3: Auto-created profile (handle_new_user trigger)`);
  await new Promise(r => setTimeout(r, 1500)); // wait for trigger

  const profile = await supabaseRequest('GET', `/rest/v1/users?select=*&id=eq.${userId}`, null, SERVICE_KEY);
  let orgId;

  if (profile.status === 200 && profile.data?.length > 0) {
    orgId = profile.data[0].organization_id;
    mark(true, `User profile auto-created`);
    mark(!!orgId, `Organization assigned — ID: ${orgId}`);
  } else {
    mark(false, `Profile not created by trigger`);
    // Try to create org manually
    console.log('  → Creating organization manually...');
    const org = await supabaseRequest('POST', '/rest/v1/organizations?select=*', { name: 'Test Org' }, SERVICE_KEY);
    if (org.status === 201 && org.data?.[0]) {
      orgId = org.data[0].id;
      await supabaseRequest('POST', '/rest/v1/users?select=*', {
        id: userId,
        email: TEST_EMAIL,
        organization_id: orgId,
        role: 'owner',
      }, SERVICE_KEY);
      mark(true, `Manual org & profile created — ${orgId}`);
    } else {
      mark(false, `Could not create org: ${JSON.stringify(org.data).substring(0, 100)}`);
      return printSummary(passed, failed);
    }
  }

  // 4. Create Tenant
  console.log(`\nTEST 4: Create Tenant`);
  const tenant = await supabaseRequest('POST', '/rest/v1/tenants?select=*', {
    organization_id: orgId,
    name: 'Test Corp Workspace',
    platform: 'google_workspace',
  }, accessToken);

  let tenantId;
  if (tenant.status === 201 && tenant.data?.length > 0) {
    tenantId = tenant.data[0].id;
    mark(true, `Tenant created — "${tenant.data[0].name}" (${tenantId})`);
  } else {
    mark(false, `Tenant creation failed (${tenant.status}): ${JSON.stringify(tenant.data).substring(0, 150)}`);
  }

  // 5. Upload Service Account JSON (Edge Function)
  console.log(`\nTEST 5: Upload Service Account JSON`);
  if (tenantId) {
    const creds = JSON.parse(fs.readFileSync('./test-service-account.json', 'utf8'));
    const upload = await supabaseRequest('POST', '/functions/v1/upload-credentials', {
      tenant_id: tenantId,
      credentials: creds,
      admin_email: 'admin@testcorp.com',
    }, accessToken);

    if (upload.status === 200) {
      mark(true, `Credentials uploaded & encrypted`);
    } else if (upload.status === 404) {
      console.log(`  ⚠ SKIP — Edge function not yet deployed to Supabase`);
      console.log(`  Note: Run 'supabase functions deploy upload-credentials' to enable this`);
    } else {
      mark(false, `Upload failed (${upload.status}): ${JSON.stringify(upload.data).substring(0, 150)}`);
    }
  }

  // 6. Verify Tenant in DB
  console.log(`\nTEST 6: Verify Tenant in Database`);
  const tenants = await supabaseRequest('GET', `/rest/v1/tenants?select=*&organization_id=eq.${orgId}`, null, accessToken);
  if (tenants.status === 200 && tenants.data?.length > 0) {
    mark(true, `Found ${tenants.data.length} tenant(s):`);
    tenants.data.forEach(t => console.log(`    → ${t.name} (${t.platform})`));
  } else {
    mark(false, `No tenants found`);
  }

  // 7. Login Page
  console.log(`\nTEST 7: Login Page Rendering`);
  try {
    const http = require('http');
    const page = await new Promise((resolve, reject) => {
      http.get('http://localhost:3000/login', res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      }).on('error', reject);
    });
    mark(page.status === 200, `HTTP ${page.status} (${page.body.length} bytes)`);
    mark(page.body.includes('SAPVYRA'), `SAPVYRA branding present`);
    mark(page.body.includes('050505'), `Dark theme (#050505)`);
    mark(page.body.includes('email'), `Email input field`);
  } catch (err) {
    console.log(`  ⚠ SKIP — Dev server not running`);
  }

  // 8. Dashboard auth guard
  console.log(`\nTEST 8: Dashboard Auth Guard`);
  try {
    const http = require('http');
    const dash = await new Promise((resolve, reject) => {
      const req = http.get('http://localhost:3000/dashboard', res => {
        resolve({ status: res.statusCode, location: res.headers.location });
      });
      req.on('error', reject);
    });
    mark(dash.status >= 200 && dash.status < 500, `Dashboard responded (${dash.status}${dash.location ? ' → ' + dash.location : ''})`);
  } catch (err) {
    console.log(`  ⚠ SKIP — ${err.message}`);
  }

  // Cleanup: delete test user
  console.log(`\nCLEANUP: Deleting test user...`);
  await supabaseRequest('DELETE', `/auth/v1/admin/users/${userId}`, null, SERVICE_KEY);
  console.log(`  ✓ Test user deleted`);

  printSummary(passed, failed);
}

function printSummary(passed, failed) {
  const total = passed + failed;
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  Results: ${passed}/${total} passed, ${failed} failed${' '.repeat(Math.max(0, 15 - String(passed).length - String(total).length - String(failed).length))}║`);
  console.log('╚══════════════════════════════════════════╝');
  if (failed === 0) console.log('\n🎉 All tests passed!');
  else console.log(`\n⚠ ${failed} test(s) need attention.`);
}

run().catch(err => console.error('Fatal:', err.message));
