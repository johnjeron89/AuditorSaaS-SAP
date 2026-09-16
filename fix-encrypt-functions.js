const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.sbpjtynofivcddmctjnh:' + encodeURIComponent('Dec@2025#!sam') + '@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();

  // Find where pgcrypto functions live
  const res = await client.query(`
    select n.nspname as schema_name, p.proname as function_name 
    from pg_proc p 
    join pg_namespace n on p.pronamespace = n.oid 
    where p.proname in ('pgp_sym_encrypt', 'pgp_sym_decrypt')
  `);
  console.log('pgp functions found in:', res.rows);

  // Update encrypt_credentials and decrypt_credentials to include extensions schema in search_path!
  await client.query(`
    create or replace function public.encrypt_credentials(
      p_tenant_id uuid,
      p_creds_json text,
      p_admin_email text
    )
    returns uuid
    language plpgsql
    security definer
    set search_path = public, extensions
    as $$
    declare
      v_key text;
      v_id uuid;
    begin
      select decrypted_secret into v_key
      from vault.decrypted_secrets
      where name = 'credentials_encryption_key'
      limit 1;

      if v_key is null then
        raise exception 'Encryption key not found in vault';
      end if;

      delete from public.credentials where tenant_id = p_tenant_id;

      insert into public.credentials (tenant_id, platform, admin_email, encrypted_credentials)
      values (
        p_tenant_id,
        'google_workspace',
        p_admin_email,
        extensions.pgp_sym_encrypt(p_creds_json, v_key)
      )
      returning id into v_id;

      return v_id;
    end;
    $$;
  `);
  console.log('✓ Updated encrypt_credentials with extensions search_path');

  await client.query(`
    create or replace function public.decrypt_credentials(
      p_tenant_id uuid
    )
    returns table(credentials_json text, admin_email text)
    language plpgsql
    security definer
    set search_path = public, extensions
    as $$
    declare
      v_key text;
    begin
      select decrypted_secret into v_key
      from vault.decrypted_secrets
      where name = 'credentials_encryption_key'
      limit 1;

      if v_key is null then
        raise exception 'Encryption key not found in vault';
      end if;

      return query
      select
        extensions.pgp_sym_decrypt(c.encrypted_credentials, v_key)::text as credentials_json,
        c.admin_email
      from public.credentials c
      where c.tenant_id = p_tenant_id
      limit 1;
    end;
    $$;
  `);
  console.log('✓ Updated decrypt_credentials with extensions search_path');

  await client.end();
}

run().catch(console.error);
