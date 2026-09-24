const { Client } = require('pg');
const password = encodeURIComponent('Dec@2025#!sam');
const c = new Client({
  connectionString: `postgresql://postgres.sbpjtynofivcddmctjnh:${password}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await c.connect();
  
  const { rows } = await c.query(`
    SELECT ar.id, ar.status, ar.framework, t.name as tenant, ar.created_at,
      (SELECT count(*) FROM audit_jobs aj WHERE aj.audit_run_id = ar.id AND aj.status = 'pending') as pending_jobs,
      (SELECT count(*) FROM audit_jobs aj WHERE aj.audit_run_id = ar.id AND aj.status = 'running') as running_jobs
    FROM audit_runs ar 
    JOIN tenants t ON t.id = ar.tenant_id 
    ORDER BY ar.created_at DESC LIMIT 10
  `);
  
  console.log('Recent audit runs:');
  for (const r of rows) {
    console.log(`  ${r.id}  ${r.status.padEnd(12)} ${r.tenant.padEnd(25)} pending=${r.pending_jobs} running=${r.running_jobs}  ${r.created_at}`);
  }

  // Cancel any running ones
  const running = rows.filter(r => r.status === 'running');
  if (running.length > 0) {
    console.log('\nCancelling ' + running.length + ' running audit(s)...');
    for (const r of running) {
      await c.query(`UPDATE audit_jobs SET status = 'failed', error = 'Cancelled by user' WHERE audit_run_id = $1 AND status IN ('pending', 'running')`, [r.id]);
      await c.query(`UPDATE audit_runs SET status = 'failed', completed_at = NOW() WHERE id = $1`, [r.id]);
      console.log('  Cancelled: ' + r.id + ' (' + r.tenant + ')');
    }
  } else {
    console.log('\nNo running audits found.');
  }

  await c.end();
}

run().catch(e => { console.error(e.message); process.exit(1); });
