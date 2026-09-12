import { GoogleApiClient } from '../google-auth.ts';
import { SupabaseClient } from '@supabase/supabase-js';
import { AuditJob, CheckResult, Finding } from './index.ts';
import { CHECK_DEFINITIONS } from '../check-definitions.ts';

export const handleUserChecks = async (job: AuditJob, googleApi: GoogleApiClient, supabase: SupabaseClient): Promise<CheckResult> => {
  const params: Record<string, string> = {
    customer: 'my_customer',
    projection: 'full',
    maxResults: '100',
  };

  const response = await googleApi.fetchPaginated(
    'https://admin.googleapis.com/admin/directory/v1/users',
    params,
    job.cursor || undefined
  );

  const users = response.users || [];
  const findings: Finding[] = [];
  
  const payload = job.payload || { adminCount: 0, adminList: [] };
  
  let gws001Fail = false;
  let gws002Fail = false;
  let gws005Fail = false;
  let gws017Fail = false;
  
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  for (const user of users) {
    if (user.suspended) continue;
    
    if (!user.isEnforcedIn2Sv) gws001Fail = true;
    
    if (user.isAdmin) {
      payload.adminCount = (payload.adminCount as number) + 1;
      (payload.adminList as string[]).push(user.primaryEmail);
      
      if (!user.isEnforcedIn2Sv || !user.isEnrolledIn2Sv) gws002Fail = true;
      
      const recoveryEmail = user.recoveryEmail || '';
      if (recoveryEmail.includes('@gmail.com') || recoveryEmail.includes('@yahoo.com')) {
        gws017Fail = true;
      }
    }
    
    if (user.lastLoginTime && new Date(user.lastLoginTime) < ninetyDaysAgo) {
      gws005Fail = true;
    }
  }
  
  if (!response.nextPageToken) {
    const getDef = (id: string) => CHECK_DEFINITIONS.find(d => d.checkId === id)!;
    
    const createFinding = (id: string, fail: boolean, ev: any = {}): Finding => {
      const def = getDef(id);
      return {
        check_id: def.checkId,
        title: def.title,
        description: def.description,
        severity: def.severity,
        status: fail ? 'fail' : 'pass',
        regulation_section: def.regulationSection,
        fix_instructions: def.fixInstructions,
        evidence: ev
      };
    };

    findings.push(createFinding('GWS-001', gws001Fail));
    findings.push(createFinding('GWS-002', gws002Fail));
    findings.push(createFinding('GWS-005', gws005Fail));
    findings.push(createFinding('GWS-017', gws017Fail));
    
    const adminCount = payload.adminCount as number;
    findings.push(createFinding('GWS-003', adminCount < 2 || adminCount > 4, { adminCount }));
  }

  return { findings, nextPageToken: response.nextPageToken, payload };
};
