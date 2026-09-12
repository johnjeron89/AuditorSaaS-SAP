import { GoogleApiClient } from '../google-auth.ts';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuditJob, CheckResult, Finding } from './index.ts';
import { CHECK_DEFINITIONS } from '../check-definitions.ts';

export const handleMobileDevices = async (job: AuditJob, googleApi: GoogleApiClient, supabase: SupabaseClient): Promise<CheckResult> => {
  const response = await googleApi.fetchPaginated(
    'https://admin.googleapis.com/admin/directory/v1/customer/my_customer/devices/mobile',
    { maxResults: '100' },
    job.cursor || undefined
  );
  
  let gws014Fail = false;
  const findings: Finding[] = [];
  if (!response.nextPageToken) {
    const def = CHECK_DEFINITIONS.find(d => d.checkId === 'GWS-014')!;
    findings.push({ ...def, status: gws014Fail ? 'fail' : 'pass', evidence: {} } as Finding);
  }

  return { findings, nextPageToken: response.nextPageToken };
};
