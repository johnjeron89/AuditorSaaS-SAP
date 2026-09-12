import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AuditProgress } from '@/components/audit-progress'
import { FindingsTable } from '@/components/findings-table'
import { Download } from 'lucide-react'

export default async function AuditRunDetailPage({ params }: { params: Promise<{ tenantId: string; runId: string }> }) {
  const { runId } = await params
  const supabase = await createClient()

  const { data: run } = await supabase.from('audit_runs').select('*, tenant:tenants(name)').eq('id', runId).single()
  const { data: findings } = await supabase.from('findings').select('*').eq('audit_run_id', runId)

  if (!run) return <div>Run not found</div>

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'pass'
      case 'failed': return 'fail'
      case 'running': return 'default'
      default: return 'secondary'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="text-sm text-muted-foreground mb-1">{run.tenant?.name}</div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            {run.framework} Audit
            <Badge variant={getStatusColor(run.status) as any}>{run.status}</Badge>
          </h1>
          <div className="text-sm text-muted-foreground mt-2">
            Started: {run.started_at ? new Date(run.started_at).toLocaleString() : 'Pending'}
            {run.completed_at && ` • Completed: ${new Date(run.completed_at).toLocaleString()}`}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {run.score !== null && (
            <div className="text-center p-4 bg-white dark:bg-slate-900 border rounded-lg shadow-sm">
              <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">{run.score}%</div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">Overall Score</div>
            </div>
          )}
          {run.report_url && (
            <Button variant="outline" asChild>
              <a href={run.report_url} target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      <AuditProgress runId={run.id} />

      <div>
        <h2 className="text-xl font-semibold mb-4">Findings</h2>
        <FindingsTable findings={findings || []} />
      </div>
    </div>
  )
}
