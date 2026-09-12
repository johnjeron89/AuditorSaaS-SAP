import { GoogleApiClient } from '../google-auth.ts';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuditJob, CheckResult, Finding } from './index.ts';
import { CHECK_DEFINITIONS } from '../check-definitions.ts';

export const handleLoginActivity = async (job: AuditJob, googleApi: GoogleApiClient, supabase: SupabaseClient): Promise<CheckResult> => {
  const response = await googleApi.fetchPaginated(
    'https://admin.googleapis.com/admin/reports/v1/activity/all/applications/login',
    { maxResults: '100' },
    job.cursor || undefined
  );
  
  let gws010Fail = false;
  const findings: Finding[] = [];
  
  if (!response.nextPageToken) {
    const def = CHECK_DEFINITIONS.find(d => d.checkId === 'GWS-010')!;
    findings.push({ ...def, status: gws010Fail ? 'fail' : 'pass', evidence: {} } as Finding);
  }

  return { findings, nextPageToken: response.nextPageToken };
};
