import { GoogleApiClient } from '../google-auth.ts';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuditJob, CheckResult, Finding } from './index.ts';
import { CHECK_DEFINITIONS } from '../check-definitions.ts';

export const handleDriveSharing = async (job: AuditJob, googleApi: GoogleApiClient, supabase: SupabaseClient): Promise<CheckResult> => {
  const response = await googleApi.fetchPaginated(
    'https://admin.googleapis.com/admin/reports/v1/activity/all/applications/drive',
    { maxResults: '100' },
    job.cursor || undefined
  );
  
  let gws007Fail = false;
  let gws008Fail = false;

  const items = response.items || [];
  for (const item of items) {
    const events = item.events || [];
    for (const event of events) {
      if (event.name === 'change_document_access_scope') gws007Fail = true;
      if (event.name === 'change_document_visibility') gws008Fail = true;
    }
  }

  const findings: Finding[] = [];
  if (!response.nextPageToken) {
    const getDef = (id: string) => CHECK_DEFINITIONS.find(d => d.checkId === id)!;
    findings.push({ ...getDef('GWS-007'), status: gws007Fail ? 'fail' : 'pass', evidence: {} } as Finding);
    findings.push({ ...getDef('GWS-008'), status: gws008Fail ? 'fail' : 'pass', evidence: {} } as Finding);
  }

  return { findings, nextPageToken: response.nextPageToken };
};
