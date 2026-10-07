import { createServiceClient } from '../_shared/supabase-client.ts';
import { DB_CHECK_DEFINITIONS } from '../_shared/db-check-definitions.ts';
import type { DbCheckDefinition } from '../_shared/db-check-definitions.ts';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-api-key, x-tenant-id',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ── Check evaluators ─────────────────────────────────────────────────

interface CheckResult {
  status: 'pass' | 'fail' | 'n/a';
  evidence: Record<string, unknown>;
}

type Evaluator = (data: Record<string, unknown>) => CheckResult;

// ── PostgreSQL evaluators ────────────────────────────────────────────

const pgEvaluators: Record<string, Evaluator> = {
  // PG-001: password_encryption = scram-sha-256
  password_encryption: (data) => {
    const val = String(data.password_encryption ?? '').toLowerCase();
    return {
      status: val === 'scram-sha-256' ? 'pass' : 'fail',
      evidence: { current_value: val, expected: 'scram-sha-256' },
    };
  },

  // PG-002: No trust auth in pg_hba.conf
  pg_hba_rules: (data) => {
    const rules = Array.isArray(data.pg_hba_rules) ? data.pg_hba_rules : [];
    const trustRules = rules.filter(
      (r: Record<string, unknown>) => String(r.auth_method ?? '').toLowerCase() === 'trust'
    );
    return {
      status: trustRules.length === 0 ? 'pass' : 'fail',
      evidence: { trust_entries: trustRules, total_rules: rules.length },
    };
  },

  // PG-003: SSL on
  ssl_setting: (data) => {
    const val = String(data.ssl_setting ?? '').toLowerCase();
    return {
      status: val === 'on' ? 'pass' : 'fail',
      evidence: { ssl: val },
    };
  },

  // PG-004: log_connections + log_disconnections
  log_connections: (data) => {
    const conn = String(data.log_connections ?? '').toLowerCase();
    const disc = String(data.log_disconnections ?? '').toLowerCase();
    return {
      status: conn === 'on' && disc === 'on' ? 'pass' : 'fail',
      evidence: { log_connections: conn, log_disconnections: disc },
    };
  },

  // PG-005: log_statement >= ddl
  log_statement: (data) => {
    const val = String(data.log_statement ?? '').toLowerCase();
    const acceptable = ['ddl', 'mod', 'all'];
    return {
      status: acceptable.includes(val) ? 'pass' : 'fail',
      evidence: { log_statement: val, acceptable_values: acceptable },
    };
  },

  // PG-006: superuser count <= 2
  superusers: (data) => {
    const list = Array.isArray(data.superusers) ? data.superusers : [];
    return {
      status: list.length <= 2 ? 'pass' : 'fail',
      evidence: { superuser_count: list.length, superusers: list },
    };
  },

  // PG-007: PUBLIC no CREATE on public schema
  public_schema_privs: (data) => {
    const hasCreate = Boolean(data.public_has_create);
    return {
      status: hasCreate ? 'fail' : 'pass',
      evidence: { public_has_create: hasCreate },
    };
  },

  // PG-008: no NULL password roles
  null_password_roles: (data) => {
    const roles = Array.isArray(data.null_password_roles) ? data.null_password_roles : [];
    return {
      status: roles.length === 0 ? 'pass' : 'fail',
      evidence: { roles_without_password: roles },
    };
  },

  // PG-009: CREATEDB/CREATEROLE review
  privileged_roles: (data) => {
    const roles = Array.isArray(data.privileged_roles) ? data.privileged_roles : [];
    // Flag if more than 2 non-postgres roles have these privs
    const nonPg = roles.filter((r: Record<string, unknown>) => r.rolname !== 'postgres');
    return {
      status: nonPg.length <= 2 ? 'pass' : 'fail',
      evidence: { privileged_roles: roles, non_postgres_count: nonPg.length },
    };
  },

  // PG-010: pgaudit extension
  extensions: (data) => {
    const exts = Array.isArray(data.extensions) ? data.extensions : [];
    const hasPgaudit = exts.some(
      (e: Record<string, unknown>) => String(e.extname ?? '').toLowerCase() === 'pgaudit'
    );
    return {
      status: hasPgaudit ? 'pass' : 'fail',
      evidence: { installed_extensions: exts.map((e: Record<string, unknown>) => e.extname), pgaudit_found: hasPgaudit },
    };
  },
};

// ── MySQL evaluators ─────────────────────────────────────────────────

const myEvaluators: Record<string, Evaluator> = {
  // MY-001: root restricted to localhost
  root_hosts: (data) => {
    const hosts = Array.isArray(data.root_hosts) ? data.root_hosts : [];
    const allowed = ['localhost', '127.0.0.1', '::1'];
    const badHosts = hosts.filter((h: string) => !allowed.includes(String(h).toLowerCase()));
    return {
      status: badHosts.length === 0 ? 'pass' : 'fail',
      evidence: { root_hosts: hosts, disallowed: badHosts },
    };
  },

  // MY-002: no anonymous users
  anonymous_users: (data) => {
    const count = Number(data.anonymous_user_count ?? 0);
    return {
      status: count === 0 ? 'pass' : 'fail',
      evidence: { anonymous_user_count: count },
    };
  },

  // MY-003: no test database
  test_database: (data) => {
    const exists = Boolean(data.test_db_exists);
    return {
      status: exists ? 'fail' : 'pass',
      evidence: { test_db_exists: exists },
    };
  },

  // MY-004: validate_password active
  validate_password: (data) => {
    const active = Boolean(data.validate_password_active);
    return {
      status: active ? 'pass' : 'fail',
      evidence: { validate_password_active: active },
    };
  },

  // MY-005: local_infile OFF
  local_infile: (data) => {
    const val = String(data.local_infile ?? '').toUpperCase();
    return {
      status: val === 'OFF' || val === '0' ? 'pass' : 'fail',
      evidence: { local_infile: val },
    };
  },

  // MY-006: require_secure_transport ON
  require_secure_transport: (data) => {
    const val = String(data.require_secure_transport ?? '').toUpperCase();
    return {
      status: val === 'ON' || val === '1' ? 'pass' : 'fail',
      evidence: { require_secure_transport: val },
    };
  },

  // MY-007: general_log or audit plugin
  audit_logging: (data) => {
    const generalLog = String(data.general_log ?? '').toUpperCase();
    const auditPlugin = Boolean(data.audit_plugin_active);
    const ok = generalLog === 'ON' || generalLog === '1' || auditPlugin;
    return {
      status: ok ? 'pass' : 'fail',
      evidence: { general_log: generalLog, audit_plugin_active: auditPlugin },
    };
  },

  // MY-008: secure_file_priv not empty
  secure_file_priv: (data) => {
    const val = data.secure_file_priv;
    // NULL or empty string means unrestricted — fail
    const ok = val !== null && val !== undefined && String(val).trim() !== '';
    return {
      status: ok ? 'pass' : 'fail',
      evidence: { secure_file_priv: val ?? 'NULL' },
    };
  },

  // MY-009: no non-admin GRANT ALL
  grant_all_users: (data) => {
    const users = Array.isArray(data.grant_all_users) ? data.grant_all_users : [];
    return {
      status: users.length === 0 ? 'pass' : 'fail',
      evidence: { users_with_grant_all: users },
    };
  },

  // MY-010: minimize mysql_native_password
  native_password_users: (data) => {
    const users = Array.isArray(data.native_password_users) ? data.native_password_users : [];
    return {
      status: users.length === 0 ? 'pass' : 'fail',
      evidence: { native_password_users: users, count: users.length },
    };
  },
};

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, 405);
  }

  try {
    // Auth: API key in header
    const rawKey = req.headers.get('x-agent-api-key');
    const tenantId = req.headers.get('x-tenant-id');

    if (!rawKey || !tenantId) {
      return jsonResponse({ error: 'Missing x-agent-api-key or x-tenant-id header' }, 401);
    }

    // Hash the incoming key
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
    const incomingHash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const supabase = createServiceClient();

    // Look up the stored credential
    const { data: cred, error: credError } = await supabase
      .from('credentials')
      .select('id, metadata')
      .eq('tenant_id', tenantId)
      .eq('auth_method', 'agent_push')
      .single();

    if (credError || !cred) {
      return jsonResponse({ error: 'Invalid API key or tenant' }, 401);
    }

    const storedHash = (cred.metadata as Record<string, unknown>)?.agent_api_key_hash;
    if (!storedHash || storedHash !== incomingHash) {
      return jsonResponse({ error: 'Invalid API key' }, 401);
    }

    // Parse and validate payload
    const body = await req.json();
    const { db_engine, data: auditData } = body;

    if (!db_engine || !['postgres', 'mysql'].includes(db_engine)) {
      return jsonResponse({ error: "db_engine must be 'postgres' or 'mysql'" }, 400);
    }
    if (!auditData || typeof auditData !== 'object') {
      return jsonResponse({ error: 'Missing or invalid "data" object in payload' }, 400);
    }

    // Verify engine matches what was registered
    const registeredEngine = (cred.metadata as Record<string, unknown>)?.db_engine;
    if (registeredEngine && registeredEngine !== db_engine) {
      return jsonResponse(
        { error: `Engine mismatch: credential registered for '${registeredEngine}', got '${db_engine}'` },
        400
      );
    }

    // Create audit run
    const { data: auditRun, error: runError } = await supabase
      .from('audit_runs')
      .insert({
        tenant_id: tenantId,
        framework: `CIS ${db_engine === 'postgres' ? 'PostgreSQL' : 'MySQL'} Benchmark`,
        status: 'running',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (runError || !auditRun) {
      console.error('Failed to create audit run:', runError);
      return jsonResponse({ error: 'Failed to create audit run' }, 500);
    }

    // Select the right evaluators and check definitions
    const evaluators = db_engine === 'postgres' ? pgEvaluators : myEvaluators;
    const checks = DB_CHECK_DEFINITIONS.filter((c) => c.engine === db_engine);

    // Evaluate all checks
    const findings: Array<{
      audit_run_id: string;
      check_id: string;
      title: string;
      description: string;
      severity: string;
      status: string;
      regulation_section: string;
      fix_instructions: string;
      evidence: Record<string, unknown>;
    }> = [];

    let passCount = 0;
    let totalCount = 0;

    for (const check of checks) {
      totalCount++;
      const evaluator = evaluators[check.queryKey];
      let result: CheckResult;

      if (!evaluator) {
        result = { status: 'n/a', evidence: { reason: 'No evaluator for this check' } };
      } else if (!(check.queryKey in auditData) && !hasRelatedKeys(check.queryKey, auditData)) {
        result = { status: 'n/a', evidence: { reason: `Missing data key: ${check.queryKey}` } };
      } else {
        try {
          result = evaluator(auditData);
        } catch (e) {
          result = {
            status: 'n/a',
            evidence: { error: e instanceof Error ? e.message : 'Evaluation error' },
          };
        }
      }

      if (result.status === 'pass') passCount++;

      findings.push({
        audit_run_id: auditRun.id,
        check_id: check.checkId,
        title: check.title,
        description: check.description,
        severity: check.severity,
        status: result.status,
        regulation_section: check.regulationSection,
        fix_instructions: check.fixInstructions,
        evidence: result.evidence,
      });
    }

    // Insert all findings
    const { error: findingsError } = await supabase.from('findings').insert(findings);
    if (findingsError) {
      console.error('Failed to insert findings:', findingsError);
      // Still mark run as failed rather than leaving it running
      await supabase
        .from('audit_runs')
        .update({ status: 'failed', completed_at: new Date().toISOString() })
        .eq('id', auditRun.id);
      return jsonResponse({ error: 'Failed to store findings' }, 500);
    }

    // Calculate score
    const score = totalCount > 0 ? Math.round((passCount / totalCount) * 100) : 0;

    // Mark run complete
    await supabase
      .from('audit_runs')
      .update({
        status: 'completed',
        score,
        completed_at: new Date().toISOString(),
      })
      .eq('id', auditRun.id);

    // Update last_agent_seen_at
    await supabase
      .from('credentials')
      .update({
        metadata: {
          ...(cred.metadata as Record<string, unknown>),
          last_agent_seen_at: new Date().toISOString(),
        },
      })
      .eq('id', cred.id);

    return jsonResponse({
      audit_run_id: auditRun.id,
      score,
      total_checks: totalCount,
      passed: passCount,
      failed: totalCount - passCount,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('agent-submit-database-audit error:', msg);
    return jsonResponse({ error: msg }, 500);
  }
});

// Helper: check if auditData has the key or related keys for a check
function hasRelatedKeys(queryKey: string, data: Record<string, unknown>): boolean {
  // For log_connections check, we also need log_disconnections
  if (queryKey === 'log_connections') {
    return 'log_connections' in data || 'log_disconnections' in data;
  }
  return queryKey in data;
}
