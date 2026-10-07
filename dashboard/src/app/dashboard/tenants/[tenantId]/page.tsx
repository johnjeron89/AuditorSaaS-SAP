import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { RunAuditButton } from '@/components/run-audit-button'
import { AuditRunCard } from '@/components/audit-run-card'
import { ConnectTenant } from '@/components/connect-tenant'
import { ConnectDatabase } from '@/components/connect-database'
import { ConnectToast } from '@/components/connect-toast'

export default async function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  const supabase = await createClient()

  const [tenantResult, runsResult, credsResult] = await Promise.all([
    supabase.from('tenants').select('*').eq('id', tenantId).single(),
    supabase.from('audit_runs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }),
    supabase.from('credentials').select('id, auth_method, platform, admin_email, metadata, created_at').eq('tenant_id', tenantId).limit(1),
  ])
  const tenant = tenantResult.data
  const runs = runsResult.data
  const credentials = credsResult.data
  const hasCredentials = credentials !== null && credentials.length > 0

  if (!tenant) return <div className="text-white/50">Tenant not found</div>

  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <ConnectToast />
      </Suspense>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white flex flex-wrap items-center gap-3">
            {tenant.name}
            <Badge variant="secondary" className="rounded-full bg-white/[0.05] text-white hover:bg-white/[0.1] border-white/10">{tenant.platform}</Badge>
          </h1>
          <p className="text-white/50 mt-1">Tenant Details & Audits</p>
        </div>
        {hasCredentials && (
          <div className="w-full sm:w-auto">
            <RunAuditButton tenantId={tenant.id} />
          </div>
        )}
      </div>

      {/* Connection Status */}
      {tenant.platform === 'database' ? (
        <ConnectDatabase
          tenantId={tenant.id}
          hasCredentials={hasCredentials}
          lastAgentSeenAt={(credentials?.[0]?.metadata as Record<string, unknown>)?.last_agent_seen_at as string | null}
          dbEngine={(credentials?.[0]?.metadata as Record<string, unknown>)?.db_engine as string | null}
        />
      ) : (
        <ConnectTenant
          tenantId={tenant.id}
          platform={tenant.platform}
          hasCredentials={hasCredentials}
          credentialMethod={credentials?.[0]?.auth_method}
        />
      )}

      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white mb-4">Audit Runs</h2>
        <div className="space-y-3">
          {runs?.map((run) => (
            <AuditRunCard key={run.id} run={run} />
          ))}
          {(!runs || runs.length === 0) && (
            <p className="text-white/50 text-sm">
              {hasCredentials
                ? 'No audit runs yet. Click "Run Audit" to start.'
                : 'Connect credentials above to start auditing.'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
