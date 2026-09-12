export interface Organization { id: string; name: string; created_at: string; }
export interface User { id: string; email: string; organization_id: string; created_at: string; }
export interface Tenant { id: string; organization_id: string; name: string; platform: string; created_at: string; }
export interface AuditRun { id: string; tenant_id: string; framework: string; status: 'queued'|'running'|'completed'|'failed'; score: number|null; report_url: string|null; started_at: string|null; completed_at: string|null; created_at: string; }
export interface Finding { id: string; audit_run_id: string; check_id: string; title: string; description: string|null; severity: 'critical'|'high'|'medium'|'low'; status: 'pass'|'fail'|'n/a'; regulation_section: string|null; fix_instructions: string|null; evidence: Record<string,unknown>|null; created_at: string; }
export interface AuditJob { id: string; audit_run_id: string; job_type: string; status: 'pending'|'processing'|'done'|'failed'; cursor: string|null; attempts: number; payload: Record<string,unknown>|null; error: string|null; created_at: string; updated_at: string; }
