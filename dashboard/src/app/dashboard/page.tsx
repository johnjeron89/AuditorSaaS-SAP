import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AuditRunCard } from '@/components/audit-run-card'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch stats (very basic implementation)
  const { count: tenantsCount } = await supabase.from('tenants').select('*', { count: 'exact', head: true })
  const { count: runsCount } = await supabase.from('audit_runs').select('*', { count: 'exact', head: true })
  const { data: runs } = await supabase.from('audit_runs').select('score').not('score', 'is', null)
  
  const avgScore = runs && runs.length > 0 
    ? Math.round(runs.reduce((acc, curr) => acc + (curr.score || 0), 0) / runs.length)
    : 0

  const { data: recentRuns } = await supabase
    .from('audit_runs')
    .select('*, tenant:tenants(name)')
    .order('created_at', { ascending: false })
    .limit(5)

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Overview</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenantsCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runsCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgScore}%</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Audit Runs</h2>
        <div className="space-y-4">
          {recentRuns?.map((run: any) => (
            <AuditRunCard key={run.id} run={run} tenantName={run.tenant?.name} />
          ))}
          {(!recentRuns || recentRuns.length === 0) && (
            <p className="text-muted-foreground text-sm">No recent runs.</p>
          )}
        </div>
      </div>
    </div>
  )
}
