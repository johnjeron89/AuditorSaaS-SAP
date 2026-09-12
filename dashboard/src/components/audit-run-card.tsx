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
      <Card className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <div className="font-semibold text-sm">
              {tenantName && <span className="mr-2 text-muted-foreground">{tenantName}</span>}
              {run.framework}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {new Date(run.created_at).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-4">
            {run.score !== null && (
              <div className="text-sm font-medium">Score: {run.score}%</div>
            )}
            <Badge variant={getStatusColor(run.status) as any}>{run.status}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
