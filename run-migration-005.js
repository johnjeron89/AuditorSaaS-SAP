// Run migration 00005 against Supabase via individual ALTER statements through REST API
const SB_URL = 'https://sbpjtynofivcddmctjnh.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicGp0eW5vZml2Y2RkbWN0am5oIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTA5NjA0NSwiZXhwIjoyMTA0NjcyMDQ1fQ.tIbe1tEY7kmSxFuFaBV_MFKB_zxlTPANhrODM2w_RpQ';

async function testConnection() {
  // Test 1: can we read from tenants?
  const res = await fetch(`${SB_URL}/rest/v1/tenants?select=id,platform&limit=3`, {
    headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
  });
  console.log('Tenants status:', res.status);
  const tenants = await res.json();
  console.log('Tenants:', JSON.stringify(tenants));

  // Test 2: Try to insert a 'database' platform tenant (will fail if constraint not updated)
  const testInsertRes = await fetch(`${SB_URL}/rest/v1/tenants`, {
    method: 'POST',
    headers: {
      'apikey': SB_KEY,
      'Authorization': `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      organization_id: tenants[0]?.organization_id || '00000000-0000-0000-0000-000000000000',
      name: '__test_database_constraint__',
      platform: 'database'
    })
  });
  console.log('Insert database tenant status:', testInsertRes.status);
  if (!testInsertRes.ok) {
    const err = await testInsertRes.text();
    console.log('Insert error:', err.substring(0, 300));
    console.log('\n>>> The CHECK constraint needs to be updated. You need to run the migration SQL in the Supabase SQL Editor.');
  } else {
    console.log('>>> Database platform is already supported! Constraint is updated.');
    // Clean up test row
    await fetch(`${SB_URL}/rest/v1/tenants?name=eq.__test_database_constraint__`, {
      method: 'DELETE',
      headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` }
    });
    console.log('Test row cleaned up.');
  }
}

testConnection().catch(e => console.error('Error:', e.message));
