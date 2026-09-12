import { createServiceClient } from '../_shared/supabase-client.ts';
import { GoogleApiClient } from '../_shared/google-auth.ts';
import { checkRegistry } from '../_shared/checks/index.ts';

Deno.serve(async () => {
  const supabase = createServiceClient();

  try {
    const { data: jobs, error: claimError } = await supabase.rpc('claim_pending_jobs', { batch_size: 5 });
    if (claimError) throw claimError;
    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: 'No jobs' }), { headers: { 'Content-Type': 'application/json' } });
    }

    const processedRunIds = new Set<string>();

    for (const job of jobs) {
      try {
        const { data: runData } = await supabase.from('audit_runs').select('tenant_id').eq('id', job.audit_run_id).single();
        if (!runData) throw new Error('Run not found');

        const { data: creds, error: credError } = await supabase.rpc('decrypt_credentials', { p_tenant_id: runData.tenant_id });
        if (credError || !creds || !creds.length) throw new Error('Credentials not found');
        
        const saJson = JSON.parse(creds[0].credentials_json);
        const adminEmail = creds[0].admin_email;

        const googleApi = new GoogleApiClient(saJson, adminEmail);
        const handler = checkRegistry[job.job_type];
        if (!handler) throw new Error(`Unknown job type: ${job.job_type}`);

        const result = await handler(job, googleApi, supabase);

        if (result.findings && result.findings.length > 0) {
          const formattedFindings = result.findings.map((f: any) => ({
            audit_run_id: job.audit_run_id,
            ...f
          }));
          await supabase.from('findings').insert(formattedFindings);
        }

        if (result.nextPageToken) {
          await supabase.from('audit_jobs').insert({
            audit_run_id: job.audit_run_id,
            job_type: job.job_type,
            status: 'pending',
            cursor: result.nextPageToken,
            payload: result.payload
          });
        }

        await supabase.from('audit_jobs').update({ status: 'done' }).eq('id', job.id);
        processedRunIds.add(job.audit_run_id);

      } catch (err: any) {
        console.error(`Error processing job ${job.id}:`, err);
        const attempts = (job.attempts || 0) + 1;
        const status = attempts >= 3 ? 'failed' : 'pending';
        await supabase.from('audit_jobs').update({ status, attempts, error: err.message }).eq('id', job.id);
        processedRunIds.add(job.audit_run_id);
      }
    }

    for (const runId of processedRunIds) {
      const { data: finalized } = await supabase.rpc('finalize_audit_run', { p_audit_run_id: runId });
      if (finalized) {
        await supabase.from('audit_jobs').insert({
          audit_run_id: runId,
          job_type: 'generate_report',
          status: 'pending'
        });
      }
    }

    return new Response(JSON.stringify({ processed: jobs.length }), { headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Process jobs error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});
