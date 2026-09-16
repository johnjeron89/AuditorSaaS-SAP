const { Client } = require('pg');

const password = encodeURIComponent('Dec@2025#!sam');
const connectionString = `postgresql://postgres.sbpjtynofivcddmctjnh:${password}@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres`;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function setup() {
  console.log('Connecting to Supabase DB...');
  await client.connect();
  console.log('Connected!');

  // Enable pgcrypto
  await client.query('create extension if not exists pgcrypto with schema public;');
  console.log('✓ pgcrypto extension enabled');

  // Check if credentials_encryption_key already exists in vault
  const existing = await client.query("select id from vault.decrypted_secrets where name = 'credentials_encryption_key'");
  if (existing.rows.length === 0) {
    const key = 'auditer-saas-encryption-key-2026';
    await client.query(`select vault.create_secret('${key}', 'credentials_encryption_key', 'AES key for tenant credentials')`);
    console.log('✓ Created vault secret: credentials_encryption_key');
  } else {
    console.log('✓ Vault secret already exists');
  }

  await client.end();
  console.log('Done!');
}

setup().catch(err => {
  console.error('Setup failed:', err.message);
  process.exit(1);
});
