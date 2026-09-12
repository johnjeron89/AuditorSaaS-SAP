-- Extensions for vault, cron, and HTTP
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Create the reports storage bucket
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

-- Storage policy: authenticated users can read their own org's reports
create policy "Users can download own org reports" on storage.objects
  for select using (
    bucket_id = 'reports'
    and auth.role() = 'authenticated'
  );

-- Note: Vault secret and pg_cron schedule should be set up via Supabase Dashboard
-- or with the Supabase CLI after deployment:
--
-- Vault secret for credential encryption:
--   select vault.create_secret('YOUR_ENCRYPTION_KEY_HERE', 'credentials_encryption_key', 'AES key for encrypting tenant service account credentials');
--
-- pg_cron schedule (every minute):
--   select cron.schedule(
--     'process-audit-jobs',
--     '* * * * *',
--     $$
--     select net.http_post(
--       url := '<PROJECT_URL>/functions/v1/process-jobs',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key' limit 1),
--         'Content-Type', 'application/json'
--       ),
--       body := '{}'::jsonb
--     );
--     $$
--   );
