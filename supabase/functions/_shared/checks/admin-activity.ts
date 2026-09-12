import { GoogleApiClient } from '../google-auth.ts';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuditJob, CheckResult, Finding } from './index.ts';
import { CHECK_DEFINITIONS } from '../check-definitions.ts';

export const handleAdminActivity = async (job: AuditJob, googleApi: GoogleApiClient, supabase: SupabaseClient): Promise<CheckResult> => {
  const response = await googleApi.fetchPaginated(
    'https://admin.googleapis.com/admin/reports/v1/activity/all/applications/admin',
    { maxResults: '100' },
    job.cursor || undefined
  );
  
  const findings: Finding[] = [];
  let gws004Fail = false;
  let gws006Pass = false;
  let gws018Pass = false;
  
  if (!response.nextPageToken) {
    const getDef = (id: string) => CHECK_DEFINITIONS.find(d => d.checkId === id)!;
    findings.push({ ...getDef('GWS-004'), status: gws004Fail ? 'fail' : 'pass', evidence: {} } as Finding);
    findings.push({ ...getDef('GWS-006'), status: gws006Pass ? 'pass' : 'fail', evidence: {} } as Finding);
    findings.push({ ...getDef('GWS-018'), status: gws018Pass ? 'pass' : 'fail', evidence: {} } as Finding);
  }
  
  return { findings, nextPageToken: response.nextPageToken };
};
