import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { RunAuditButton } from '@/components/run-audit-button'
import { AuditRunCard } from '@/components/audit-run-card'

export default async function TenantDetailPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params
  const supabase = await createClient()

  const { data: tenant } = await supabase.from('tenants').select('*').eq('id', tenantId).single()
  const { data: runs } = await supabase.from('audit_runs').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false })

  if (!tenant) return <div>Tenant not found</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            {tenant.name}
            <Badge variant="secondary" className="rounded-full bg-white/[0.05] text-white hover:bg-white/[0.1] border-white/10">{tenant.platform}</Badge>
          </h1>
          <p className="text-white/50 mt-1">Tenant Details & Audits</p>
        </div>
        <RunAuditButton tenantId={tenant.id} />
      </div>

      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white mb-4">Audit Runs</h2>
        <div className="space-y-3">
          {runs?.map(run => (
            <AuditRunCard key={run.id} run={run} />
          ))}
          {(!runs || runs.length === 0) && (
            <p className="text-white/50 text-sm">No audit runs yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
