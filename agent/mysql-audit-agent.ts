#!/usr/bin/env npx tsx
// MySQL Audit Agent
// Runs read-only introspection queries and POSTs results to the audit endpoint.
//
// Usage:
//   export AGENT_API_KEY="<your-api-key>"
//   export TENANT_ID="<your-tenant-id>"
//   export MYSQL_HOST="localhost"
//   export MYSQL_PORT="3306"
//   export MYSQL_USER="auditor"
//   export MYSQL_PASSWORD="<password>"
//   export MYSQL_DATABASE="mysql"
//   export AUDIT_API_URL="https://sbpjtynofivcddmctjnh.supabase.co/functions/v1/agent-submit-database-audit"
//   npx tsx mysql-audit-agent.ts

import mysql from 'mysql2/promise';

const AGENT_API_KEY = process.env.AGENT_API_KEY;
const TENANT_ID = process.env.TENANT_ID;
const AUDIT_API_URL =
  process.env.AUDIT_API_URL ||
  'https://sbpjtynofivcddmctjnh.supabase.co/functions/v1/agent-submit-database-audit';

const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = parseInt(process.env.MYSQL_PORT || '3306', 10);
const MYSQL_USER = process.env.MYSQL_USER || 'auditor';
const MYSQL_PASSWORD = process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'mysql';

if (!AGENT_API_KEY || !TENANT_ID) {
  console.error('Missing required env vars: AGENT_API_KEY, TENANT_ID');
  process.exit(1);
}

async function runQueries(): Promise<Record<string, unknown>> {
  const conn = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
  });

  const data: Record<string, unknown> = {};

  try {
    // MY-001: root hosts
    const [rootRows] = await conn.query(
      "SELECT Host FROM mysql.user WHERE User = 'root';"
    ) as [Array<{ Host: string }>, unknown];
    data.root_hosts = rootRows.map((r) => r.Host);

    // MY-002: anonymous users
    const [anonRows] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM mysql.user WHERE User = '';"
    ) as [Array<{ cnt: number }>, unknown];
    data.anonymous_user_count = anonRows[0]?.cnt ?? 0;

    // MY-003: test database
    const [testDbRows] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = 'test';"
    ) as [Array<{ cnt: number }>, unknown];
    data.test_db_exists = (testDbRows[0]?.cnt ?? 0) > 0;

    // MY-004: validate_password
    try {
      const [vpRows] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM information_schema.PLUGINS WHERE PLUGIN_NAME LIKE 'validate_password%' AND PLUGIN_STATUS = 'ACTIVE';"
      ) as [Array<{ cnt: number }>, unknown];
      const pluginActive = (vpRows[0]?.cnt ?? 0) > 0;
      
      // Also check component
      if (!pluginActive) {
        try {
          const [compRows] = await conn.query(
            "SELECT COUNT(*) AS cnt FROM mysql.component WHERE component_urn LIKE '%validate_password%';"
          ) as [Array<{ cnt: number }>, unknown];
          data.validate_password_active = (compRows[0]?.cnt ?? 0) > 0;
        } catch {
          data.validate_password_active = false;
        }
      } else {
        data.validate_password_active = true;
      }
    } catch {
      data.validate_password_active = false;
    }

    // MY-005: local_infile
    const [liRows] = await conn.query(
      "SHOW GLOBAL VARIABLES LIKE 'local_infile';"
    ) as [Array<{ Variable_name: string; Value: string }>, unknown];
    data.local_infile = liRows[0]?.Value ?? 'ON';

    // MY-006: require_secure_transport
    const [rstRows] = await conn.query(
      "SHOW GLOBAL VARIABLES LIKE 'require_secure_transport';"
    ) as [Array<{ Variable_name: string; Value: string }>, unknown];
    data.require_secure_transport = rstRows[0]?.Value ?? 'OFF';

    // MY-007: general_log + audit plugin
    const [glRows] = await conn.query(
      "SHOW GLOBAL VARIABLES LIKE 'general_log';"
    ) as [Array<{ Variable_name: string; Value: string }>, unknown];
    data.general_log = glRows[0]?.Value ?? 'OFF';

    try {
      const [auditRows] = await conn.query(
        "SELECT COUNT(*) AS cnt FROM information_schema.PLUGINS WHERE PLUGIN_NAME LIKE '%audit%' AND PLUGIN_STATUS = 'ACTIVE';"
      ) as [Array<{ cnt: number }>, unknown];
      data.audit_plugin_active = (auditRows[0]?.cnt ?? 0) > 0;
    } catch {
      data.audit_plugin_active = false;
    }

    // MY-008: secure_file_priv
    const [sfpRows] = await conn.query(
      "SHOW GLOBAL VARIABLES LIKE 'secure_file_priv';"
    ) as [Array<{ Variable_name: string; Value: string }>, unknown];
    data.secure_file_priv = sfpRows[0]?.Value ?? null;

    // MY-009: non-admin users with GRANT ALL (all privileges on *.*)
    const [gaRows] = await conn.query(`
      SELECT DISTINCT grantee 
      FROM information_schema.USER_PRIVILEGES 
      WHERE PRIVILEGE_TYPE = 'USAGE' 
        AND IS_GRANTABLE = 'YES'
        AND grantee NOT LIKE "'root'%"
        AND grantee NOT LIKE "'mysql.%'%"
      UNION
      SELECT DISTINCT CONCAT("'", User, "'@'", Host, "'") AS grantee
      FROM mysql.user 
      WHERE Super_priv = 'Y' 
        AND User NOT IN ('root', 'mysql.sys', 'mysql.session', 'mysql.infoschema')
    `) as [Array<{ grantee: string }>, unknown];
    data.grant_all_users = gaRows.map((r) => r.grantee);

    // MY-010: users with mysql_native_password
    const [npRows] = await conn.query(`
      SELECT User, Host, plugin 
      FROM mysql.user 
      WHERE plugin = 'mysql_native_password'
        AND User NOT IN ('mysql.sys', 'mysql.session', 'mysql.infoschema')
      ORDER BY User;
    `) as [Array<{ User: string; Host: string; plugin: string }>, unknown];
    data.native_password_users = npRows.map((r) => `${r.User}@${r.Host}`);
  } finally {
    await conn.end();
  }

  return data;
}

async function submit(data: Record<string, unknown>): Promise<void> {
  console.log('🔍 Submitting MySQL audit data...');

  const res = await fetch(AUDIT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-agent-api-key': AGENT_API_KEY!,
      'x-tenant-id': TENANT_ID!,
    },
    body: JSON.stringify({ db_engine: 'mysql', data }),
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
    console.log('🐬 MySQL Audit Agent');
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
