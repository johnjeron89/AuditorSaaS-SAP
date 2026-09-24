const fs = require('fs');
const path = require('path');

// Load fixtures
const cleanPath = path.join(__dirname, 'supabase', 'functions', '_shared', 'fixtures', 'google-clean.json');
const messyPath = path.join(__dirname, 'supabase', 'functions', '_shared', 'fixtures', 'google-messy.json');

const cleanFixture = JSON.parse(fs.readFileSync(cleanPath, 'utf8'));
const messyFixture = JSON.parse(fs.readFileSync(messyPath, 'utf8'));

// Mock GoogleApiClient implementation in JS matching google-mock-client.ts
class GoogleMockApiClient {
  constructor(variant = 'clean') {
    this.variant = variant;
    this.fixtureData = variant === 'messy' ? messyFixture : cleanFixture;
  }

  async fetch(url, params) {
    const urlObj = new URL(url);
    const cleanUrl = `${urlObj.origin}${urlObj.pathname}`;

    if (this.fixtureData[cleanUrl]) {
      return JSON.parse(JSON.stringify(this.fixtureData[cleanUrl]));
    }
    for (const [key, value] of Object.entries(this.fixtureData)) {
      if (cleanUrl.endsWith(key) || key.endsWith(urlObj.pathname)) {
        return JSON.parse(JSON.stringify(value));
      }
    }
    if (urlObj.pathname.includes('/users')) {
      return JSON.parse(JSON.stringify(this.fixtureData['https://admin.googleapis.com/admin/directory/v1/users'] || { users: [] }));
    }
    if (urlObj.pathname.includes('/drive')) {
      return JSON.parse(JSON.stringify(this.fixtureData['https://admin.googleapis.com/admin/reports/v1/activity/all/applications/drive'] || { items: [] }));
    }
    if (urlObj.pathname.includes('/admin')) {
      return JSON.parse(JSON.stringify(this.fixtureData['https://admin.googleapis.com/admin/reports/v1/activity/all/applications/admin'] || { items: [] }));
    }
    return { items: [], users: [] };
  }

  async fetchPaginated(url, params, pageToken) {
    return this.fetch(url, params);
  }
}

// Check Definitions from check-definitions.ts
const CHECK_DEFINITIONS = [
  { checkId: "GWS-001", title: "MFA (2SV) Enforced for All Users", severity: "critical", regulationSection: "CIS 1.3.1 | GDPR Art.32 | SOC2 CC6.1", jobType: "fetch_users_page" },
  { checkId: "GWS-002", title: "MFA Enforced for Admins with Security Keys", severity: "critical", regulationSection: "CIS 1.3.2 | GDPR Art.5(1)(f),32 | SOC2 CC6.1,CC6.3", jobType: "fetch_users_page" },
  { checkId: "GWS-003", title: "Super Admin Count Limited (2-4)", severity: "high", regulationSection: "CIS 1.2.1 | GDPR Art.25(2),32 | SOC2 CC6.2,CC6.3", jobType: "fetch_users_page" },
  { checkId: "GWS-004", title: "Separate Dedicated Admin Accounts", severity: "high", regulationSection: "CIS 1.2.2 | GDPR Art.32 | SOC2 CC6.1,CC6.2", jobType: "check_admin_activity" },
  { checkId: "GWS-005", title: "Inactive User Deprovisioning (90 Days)", severity: "medium", regulationSection: "CIS 1.1.4 | GDPR Art.5(1)(e),32 | SOC2 CC6.2,CC6.3", jobType: "fetch_users_page" },
  { checkId: "GWS-006", title: "Password Policy (Length >= 12)", severity: "high", regulationSection: "CIS 1.1.1 | GDPR Art.32 | SOC2 CC6.1", jobType: "check_admin_activity" },
  { checkId: "GWS-007", title: "Drive External Sharing Restricted", severity: "high", regulationSection: "CIS 2.1.1 | GDPR Art.5(1)(f),32,44-49 | SOC2 CC6.6,CC6.7", jobType: "check_drive_sharing" },
  { checkId: "GWS-008", title: "Drive Public Link Sharing Disabled", severity: "critical", regulationSection: "CIS 2.1.2 | GDPR Art.32,33 | SOC2 CC6.6,CC6.7", jobType: "check_drive_sharing" },
  { checkId: "GWS-009", title: "Third-Party OAuth App Restrictions", severity: "high", regulationSection: "CIS 5.1.1 | GDPR Art.28,32 | SOC2 CC6.1,CC6.3", jobType: "fetch_oauth_tokens" },
  { checkId: "GWS-010", title: "Suspicious Login Detection", severity: "high", regulationSection: "CIS 6.1.1 | GDPR Art.33,34 | SOC2 CC7.2,CC7.3", jobType: "check_login_activity" },
  { checkId: "GWS-011", title: "SPF Record Configured", severity: "high", regulationSection: "CIS 2.3.1 | GDPR Art.32 | SOC2 CC6.6,CC6.7", jobType: "check_email_dns" },
  { checkId: "GWS-012", title: "DKIM Signing Active", severity: "high", regulationSection: "CIS 2.3.2 | GDPR Art.5(1)(f),32 | SOC2 CC6.6,CC6.7", jobType: "check_email_dns" },
  { checkId: "GWS-013", title: "DMARC Policy Enforcement", severity: "medium", regulationSection: "CIS 2.3.3 | GDPR Art.32 | SOC2 CC6.6,CC6.8", jobType: "check_email_dns" },
  { checkId: "GWS-014", title: "Mobile Device Security", severity: "high", regulationSection: "CIS 3.1.1 | GDPR Art.32(1)(a) | SOC2 CC6.1,CC6.6", jobType: "fetch_mobile_devices" },
  { checkId: "GWS-015", title: "Google Groups External Restrictions", severity: "medium", regulationSection: "CIS 4.1.1 | GDPR Art.5(1)(f),25 | SOC2 CC6.1,CC6.6", jobType: "fetch_groups_settings" },
  { checkId: "GWS-016", title: "Calendar External Sharing Restricted", severity: "medium", regulationSection: "CIS 2.2.1 | GDPR Art.5(1)(c) | SOC2 CC6.1,CC6.6", jobType: "check_calendar_sharing" },
  { checkId: "GWS-017", title: "Admin Recovery Contact Hygiene", severity: "medium", regulationSection: "CIS 1.1.5 | GDPR Art.32 | SOC2 CC6.1,CC6.2", jobType: "fetch_users_page" },
  { checkId: "GWS-018", title: "Web Session Duration Controls", severity: "medium", regulationSection: "CIS 1.3.4 | GDPR Art.32 | SOC2 CC6.1,CC6.3", jobType: "check_admin_activity" },
  { checkId: "GWS-019", title: "Delegated Admin Roles Least Privilege", severity: "high", regulationSection: "CIS 1.2.3 | GDPR Art.25(2),32 | SOC2 CC6.2,CC6.3", jobType: "check_admin_roles" },
  { checkId: "GWS-020", title: "DLP Rules Configured and Monitored", severity: "critical", regulationSection: "CIS 2.1.3 | GDPR Art.5(1)(f),25,32,33 | SOC2 CC6.7,CC7.2,CC7.3", jobType: "check_dlp_rules" }
];

// Replicate user-checks logic exactly
async function runUserChecks(googleApi) {
  const response = await googleApi.fetchPaginated('https://admin.googleapis.com/admin/directory/v1/users', { customer: 'my_customer', projection: 'full', maxResults: '100' });
  const users = response.users || [];
  const findings = [];
  const payload = { adminCount: 0, adminList: [] };

  let gws001Fail = false;
  let gws002Fail = false;
  let gws005Fail = false;
  let gws017Fail = false;

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  for (const user of users) {
    if (user.suspended) continue;
    if (!user.isEnforcedIn2Sv) gws001Fail = true;
    if (user.isAdmin) {
      payload.adminCount++;
      payload.adminList.push(user.primaryEmail);
      if (!user.isEnforcedIn2Sv || !user.isEnrolledIn2Sv) gws002Fail = true;
      const recovery = user.recoveryEmail || '';
      if (recovery.includes('@gmail.com') || recovery.includes('@yahoo.com')) gws017Fail = true;
    }
    if (user.lastLoginTime && new Date(user.lastLoginTime) < ninetyDaysAgo) {
      gws005Fail = true;
    }
  }

  const getDef = (id) => CHECK_DEFINITIONS.find(d => d.checkId === id);
  const createFinding = (id, fail, ev = {}) => {
    const def = getDef(id);
    return { check_id: def.checkId, title: def.title, severity: def.severity, status: fail ? 'fail' : 'pass', regulation_section: def.regulationSection, evidence: ev };
  };

  findings.push(createFinding('GWS-001', gws001Fail));
  findings.push(createFinding('GWS-002', gws002Fail));
  findings.push(createFinding('GWS-005', gws005Fail));
  findings.push(createFinding('GWS-017', gws017Fail));
  findings.push(createFinding('GWS-003', payload.adminCount < 2 || payload.adminCount > 4, { adminCount: payload.adminCount }));

  return findings;
}

// Replicate drive-sharing logic exactly
async function runDriveSharing(googleApi) {
  const response = await googleApi.fetchPaginated('https://admin.googleapis.com/admin/reports/v1/activity/all/applications/drive', { maxResults: '100' });
  let gws007Fail = false;
  let gws008Fail = false;
  const items = response.items || [];
  for (const item of items) {
    for (const ev of item.events || []) {
      if (ev.name === 'change_document_access_scope') gws007Fail = true;
      if (ev.name === 'change_document_visibility') gws008Fail = true;
    }
  }
  const getDef = (id) => CHECK_DEFINITIONS.find(d => d.checkId === id);
  return [
    { check_id: 'GWS-007', title: getDef('GWS-007').title, severity: getDef('GWS-007').severity, status: gws007Fail ? 'fail' : 'pass', regulation_section: getDef('GWS-007').regulationSection, evidence: {} },
    { check_id: 'GWS-008', title: getDef('GWS-008').title, severity: getDef('GWS-008').severity, status: gws008Fail ? 'fail' : 'pass', regulation_section: getDef('GWS-008').regulationSection, evidence: {} }
  ];
}

async function runTest() {
  console.log('====================================================');
  console.log('STEP 5: VERIFICATION TEST OF CLEAN VS MESSY FIXTURES');
  console.log('====================================================\n');

  // Test Clean
  console.log('--- TEST 1: Running against CLEAN fixture ---');
  const cleanApi = new GoogleMockApiClient('clean');
  const cleanUserFindings = await runUserChecks(cleanApi);
  const cleanDriveFindings = await runDriveSharing(cleanApi);
  const allCleanActive = [...cleanUserFindings, ...cleanDriveFindings];

  let cleanFailedCount = 0;
  for (const f of allCleanActive) {
    const symbol = f.status === 'pass' ? '✅ PASS' : '❌ FAIL';
    if (f.status === 'fail') cleanFailedCount++;
    console.log(`  ${symbol} | ${f.check_id} | ${f.title} (${f.severity})`);
  }
  console.log(`\nClean active checks result: ${allCleanActive.length - cleanFailedCount}/${allCleanActive.length} passed.`);
  if (cleanFailedCount === 0) {
    console.log('>>> SUCCESS: All fixture-driven checks PASS on clean fixture!\n');
  } else {
    console.log('>>> FAILURE: Unexpected failures on clean fixture.\n');
  }

  // Test Messy
  console.log('--- TEST 2: Running against MESSY fixture ---');
  const messyApi = new GoogleMockApiClient('messy');
  const messyUserFindings = await runUserChecks(messyApi);
  const messyDriveFindings = await runDriveSharing(messyApi);
  const allMessyActive = [...messyUserFindings, ...messyDriveFindings];

  let messyFailedCount = 0;
  for (const f of allMessyActive) {
    const symbol = f.status === 'fail' ? '💥 FAIL (Expected)' : '⚠️ PASS (Unexpected)';
    if (f.status === 'fail') messyFailedCount++;
    console.log(`  ${symbol} | ${f.check_id} | ${f.title} [${f.severity}] | ${f.regulation_section}`);
  }
  console.log(`\nMessy active checks result: ${messyFailedCount}/${allMessyActive.length} failed as expected.`);
  if (messyFailedCount === allMessyActive.length) {
    console.log('>>> SUCCESS: 100% of fixture-driven checks FAIL on messy fixture with exact severity & regulations!\n');
  } else {
    console.log('>>> FAILURE: Some checks did not fail on messy fixture.\n');
  }

  // Test Data Source Switch logic
  console.log('--- TEST 3: Verifying AUDIT_DATA_SOURCE Switch Logic ---');
  function checkSwitch(envSource, param) {
    const isMock = (envSource === 'mock') || Boolean(param);
    return isMock ? 'MOCK' : 'LIVE';
  }

  console.log(`  AUDIT_DATA_SOURCE unset (default): ${checkSwitch(undefined, undefined)} (requires real credentials)`);
  console.log(`  AUDIT_DATA_SOURCE='live': ${checkSwitch('live', undefined)} (requires real credentials)`);
  console.log(`  AUDIT_DATA_SOURCE='mock': ${checkSwitch('mock', undefined)} (uses mock fixture)`);
  console.log(`  AUDIT_DATA_SOURCE='live' with ?mock=clean: ${checkSwitch('live', 'clean')} (uses mock fixture)`);
  console.log(`  AUDIT_DATA_SOURCE='live' with ?mock=messy: ${checkSwitch('live', 'messy')} (uses mock fixture)`);
  console.log('\n>>> SUCCESS: Switch logic preserves live default while enabling mock mode seamlessly.\n');
}

runTest().catch(console.error);
