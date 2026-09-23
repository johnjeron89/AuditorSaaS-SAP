const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const password = encodeURIComponent('Dec@2025#!sam');
const connectionString = `postgresql://postgres.sbpjtynofivcddmctjnh:${password}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  console.log('Connecting to Supabase database...');
  await client.connect();
  console.log('Connected!\n');

  const filePath = path.join(__dirname, 'supabase', 'migrations', '00004_oauth_credentials.sql');
  const sql = fs.readFileSync(filePath, 'utf8');
  
  console.log('Running 00004_oauth_credentials.sql as single transaction...');
  try {
    await client.query(sql);
    console.log('✓ Migration completed successfully!');
  } catch (err) {
    console.error('✗ Migration failed:', err.message);
    // Try individual parts
    console.log('\nRetrying individual statements...');
    
    const parts = [
      // 1. Add columns
      `alter table public.credentials 
        add column if not exists auth_method text not null default 'service_account',
        add column if not exists encrypted_refresh_token bytea,
        add column if not exists metadata jsonb not null default '{}'::jsonb`,
      // 2. Check constraint
      `alter table public.credentials
        add constraint credentials_auth_method_check 
        check (auth_method in ('service_account', 'oauth'))`,
      // 3. nullable admin_email
      `alter table public.credentials alter column admin_email drop not null`,
      // 4. nullable encrypted_credentials
      `alter table public.credentials alter column encrypted_credentials drop not null`,
      // 5. Unique index
      `create unique index if not exists idx_credentials_tenant_platform_method 
        on public.credentials (tenant_id, platform, auth_method)`,
    ];
    
    for (const stmt of parts) {
      try {
        await client.query(stmt);
        console.log('  ✓', stmt.substring(0, 70).replace(/\n/g, ' '));
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log('  ⚠ Already applied:', e.message.substring(0, 60));
        } else {
          console.error('  ✗', e.message.substring(0, 80));
        }
      }
    }
    
    // Functions as whole blocks
    const functionBlocks = sql.match(/create or replace function[\s\S]*?\$\$;/g) || [];
    for (const fn of functionBlocks) {
      const fnName = fn.match(/function\s+(\S+)/)?.[1] || 'unknown';
      try {
        await client.query(fn);
        console.log('  ✓ Function:', fnName);
      } catch (e) {
        console.error('  ✗ Function', fnName, ':', e.message.substring(0, 80));
      }
    }
    
    // Revoke statements
    const revokeStatements = sql.match(/revoke[^;]+;/gi) || [];
    for (const stmt of revokeStatements) {
      try {
        await client.query(stmt);
        console.log('  ✓', stmt.substring(0, 70));
      } catch (e) {
        console.log('  ⚠', e.message.substring(0, 60));
      }
    }
  }

  await client.end();
  console.log('\nDone!');
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
