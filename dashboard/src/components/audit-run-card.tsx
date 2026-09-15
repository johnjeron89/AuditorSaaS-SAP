import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AuditRun } from '@/lib/types'

interface AuditRunCardProps {
  run: any // In reality would be AuditRun + joined tenant
  tenantName?: string
}

export function AuditRunCard({ run, tenantName }: AuditRunCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'pass'
      case 'failed': return 'fail'
      case 'running': return 'default'
      default: return 'secondary'
    }
  }

  return (
    <Link href={`/dashboard/tenants/${run.tenant_id}/runs/${run.id}`}>
      <Card className="border border-white/10 bg-white/[0.02] rounded-none hover:bg-white/[0.04] hover:border-white/20 transition-all duration-300">
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
          <div>
            <div className="font-medium tracking-tight text-white text-sm">
              {tenantName && <span className="mr-2 text-white/40 eyebrow">{tenantName}</span>}
              {run.framework}
            </div>
            <div className="text-xs text-white/40 mt-1">
              {new Date(run.created_at).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {run.score !== null && (
              <div className="text-sm font-medium text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]">Score: {run.score}%</div>
            )}
            <Badge variant={getStatusColor(run.status) as any} className="rounded-full">{run.status}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
