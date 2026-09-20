import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AuditRunCard } from '@/components/audit-run-card'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Fetch stats (very basic implementation)
  const [tenantsResult, runsResult, scoresResult, recentRunsResult] = await Promise.all([
    supabase.from('tenants').select('*', { count: 'exact', head: true }),
    supabase.from('audit_runs').select('*', { count: 'exact', head: true }),
    supabase.from('audit_runs').select('score').not('score', 'is', null),
    supabase.from('audit_runs').select('*, tenant:tenants(name)').order('created_at', { ascending: false }).limit(5),
  ])
  const tenantsCount = tenantsResult.count
  const runsCount = runsResult.count
  const runs = scoresResult.data
  
  const avgScore = runs && runs.length > 0 
    ? Math.round(runs.reduce((acc, curr) => acc + (curr.score || 0), 0) / runs.length)
    : 0

  const recentRuns = recentRunsResult.data

  return (
    <div className="space-y-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white animate-fade-in-up">Overview</h1>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/10 bg-white/[0.02] rounded-none animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] uppercase tracking-[0.2em] text-white/40">Total Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-white">{tenantsCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.02] rounded-none animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] uppercase tracking-[0.2em] text-white/40">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-white">{runsCount || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-white/[0.02] rounded-none animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] uppercase tracking-[0.2em] text-white/40">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight text-white">{avgScore}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
        <h2 className="text-xl font-semibold tracking-tight text-white mb-4">Recent Audit Runs</h2>
        <div className="space-y-4">
          {recentRuns?.map((run: any, idx: number) => (
            <div key={run.id} className="animate-fade-in-up" style={{ animationDelay: `${0.5 + idx * 0.1}s` }}>
              <AuditRunCard run={run} tenantName={run.tenant?.name} />
            </div>
          ))}
          {(!recentRuns || recentRuns.length === 0) && (
            <p className="text-white/50 text-sm">No recent runs.</p>
          )}
        </div>
      </div>
    </div>
  )
}
