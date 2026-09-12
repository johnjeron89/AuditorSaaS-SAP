import { handleUserChecks } from './user-checks.ts';
import { handleAdminActivity } from './admin-activity.ts';
import { handleDriveSharing } from './drive-sharing.ts';
import { handleOAuthTokens } from './oauth-tokens.ts';
import { handleEmailDns } from './email-dns.ts';
import { handleMobileDevices } from './mobile-devices.ts';
import { handleGroupsSettings } from './groups-settings.ts';
import { handleCalendarSharing } from './calendar-sharing.ts';
import { handleLoginActivity } from './login-activity.ts';
import { handleAdminRoles } from './admin-roles.ts';
import { handleDlpRules } from './dlp-rules.ts';
import { GoogleApiClient } from '../google-auth.ts';
import { SupabaseClient } from '@supabase/supabase-js';

export interface Finding {
  check_id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'pass' | 'fail' | 'n/a';
  regulation_section: string;
  fix_instructions: string;
  evidence: Record<string, unknown>;
}

export interface CheckResult {
  findings: Finding[];
  nextPageToken?: string;
  payload?: Record<string, unknown>;
}

export interface AuditJob {
  id: string;
  audit_run_id: string;
  job_type: string;
  status: string;
  cursor: string | null;
  attempts: number;
  payload: Record<string, unknown> | null;
  error: string | null;
}

export type CheckHandler = (
  job: AuditJob,
  googleApi: GoogleApiClient,
  supabase: SupabaseClient
) => Promise<CheckResult>;

export const checkRegistry: Record<string, CheckHandler> = {
  fetch_users_page: handleUserChecks,
  check_admin_activity: handleAdminActivity,
  check_drive_sharing: handleDriveSharing,
  fetch_oauth_tokens: handleOAuthTokens,
  check_email_dns: handleEmailDns,
  fetch_mobile_devices: handleMobileDevices,
  fetch_groups_settings: handleGroupsSettings,
  check_calendar_sharing: handleCalendarSharing,
  check_login_activity: handleLoginActivity,
  check_admin_roles: handleAdminRoles,
  check_dlp_rules: handleDlpRules,
};
