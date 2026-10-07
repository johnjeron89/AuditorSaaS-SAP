#!/usr/bin/env npx tsx
// PostgreSQL Audit Agent
// Runs read-only introspection queries and POSTs results to the audit endpoint.
//
// Usage:
//   export AGENT_API_KEY="<your-api-key>"
//   export TENANT_ID="<your-tenant-id>"
//   export DATABASE_URL="postgresql://auditor:pass@localhost:5432/mydb"
//   export AUDIT_API_URL="https://sbpjtynofivcddmctjnh.supabase.co/functions/v1/agent-submit-database-audit"
//   npx tsx postgres-audit-agent.ts

import pg from 'pg';

const { Client } = pg;

const AGENT_API_KEY = process.env.AGENT_API_KEY;
const TENANT_ID = process.env.TENANT_ID;
const DATABASE_URL = process.env.DATABASE_URL;
const AUDIT_API_URL =
  process.env.AUDIT_API_URL ||
  'https://sbpjtynofivcddmctjnh.supabase.co/functions/v1/agent-submit-database-audit';

if (!AGENT_API_KEY || !TENANT_ID || !DATABASE_URL) {
  console.error('Missing required env vars: AGENT_API_KEY, TENANT_ID, DATABASE_URL');
  process.exit(1);
}

async function runQueries(): Promise<Record<string, unknown>> {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const data: Record<string, unknown> = {};

  try {
    // PG-001: password_encryption
    const r1 = await client.query("SHOW password_encryption;");
    data.password_encryption = r1.rows[0]?.password_encryption ?? '';

    // PG-002: pg_hba.conf rules (requires pg_hba_file_rules view, PG 10+)
    try {
      const r2 = await client.query(
        "SELECT line_number, type, database, user_name, address, auth_method FROM pg_hba_file_rules ORDER BY line_number;"
      );
      data.pg_hba_rules = r2.rows;
    } catch {
      // View may not be accessible — report as empty
      data.pg_hba_rules = [];
    }

    // PG-003: SSL setting
    const r3 = await client.query("SHOW ssl;");
    data.ssl_setting = r3.rows[0]?.ssl ?? '';

    // PG-004: log_connections + log_disconnections
    const r4a = await client.query("SHOW log_connections;");
    data.log_connections = r4a.rows[0]?.log_connections ?? '';
    const r4b = await client.query("SHOW log_disconnections;");
    data.log_disconnections = r4b.rows[0]?.log_disconnections ?? '';

    // PG-005: log_statement
    const r5 = await client.query("SHOW log_statement;");
    data.log_statement = r5.rows[0]?.log_statement ?? '';

    // PG-006: superusers
    const r6 = await client.query(
      "SELECT rolname FROM pg_roles WHERE rolsuper = true ORDER BY rolname;"
    );
    data.superusers = r6.rows.map((r) => r.rolname);

    // PG-007: PUBLIC CREATE on public schema
    const r7 = await client.query(`
      SELECT has_schema_privilege('public', 'public', 'CREATE') AS has_create;
    `);
    data.public_has_create = r7.rows[0]?.has_create ?? false;

    // PG-008: roles with NULL passwords that can login
    const r8 = await client.query(`
      SELECT rolname FROM pg_roles
      WHERE rolcanlogin = true
        AND rolpassword IS NULL
        AND rolname NOT IN ('pg_signal_backend', 'pg_monitor', 'pg_read_all_settings',
          'pg_read_all_stats', 'pg_stat_scan_tables', 'pg_read_server_files',
          'pg_write_server_files', 'pg_execute_server_program')
      ORDER BY rolname;
    `);
    data.null_password_roles = r8.rows.map((r) => r.rolname);

    // PG-009: roles with CREATEDB or CREATEROLE
    const r9 = await client.query(`
      SELECT rolname, rolcreatedb, rolcreaterole
      FROM pg_roles
      WHERE (rolcreatedb = true OR rolcreaterole = true)
      ORDER BY rolname;
    `);
    data.privileged_roles = r9.rows;

    // PG-010: installed extensions
    const r10 = await client.query("SELECT extname, extversion FROM pg_extension ORDER BY extname;");
    data.extensions = r10.rows;
  } finally {
    await client.end();
  }

  return data;
}

async function submit(data: Record<string, unknown>): Promise<void> {
  console.log('🔍 Submitting PostgreSQL audit data...');

  const res = await fetch(AUDIT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-api-key': AGENT_API_KEY!,
      'x-tenant-id': TENANT_ID!,
    },
    body: JSON.stringify({ db_engine: 'postgres', data }),
  });

  const result = await res.json();

  if (!res.ok) {
    console.error('❌ Submission failed:', result);
    process.exit(1);
  }

  console.log('✅ Audit complete!');
  console.log(`   Score: ${result.score}%`);
  console.log(`   Passed: ${result.passed}/${result.total_checks}`);
  console.log(`   Run ID: ${result.audit_run_id}`);
}

async function main() {
  try {
    console.log('🐘 PostgreSQL Audit Agent');
    console.log('   Connecting to database...');
    const data = await runQueries();
    console.log(`   Collected ${Object.keys(data).length} data points.`);
    await submit(data);
  } catch (err) {
    console.error('❌ Agent error:', err);
    process.exit(1);
  }
}

main();
