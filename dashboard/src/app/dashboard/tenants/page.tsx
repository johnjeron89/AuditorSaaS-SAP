import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { TenantCard } from '@/components/tenant-card'
import Link from 'next/link'

export default async function TenantsPage() {
  const supabase = await createClient()

  const { data: tenants } = await supabase
    .from('tenants')
    .select('*, audit_runs(count)')
    .order('created_at', { ascending: false })

  const mappedTenants = tenants?.map(t => ({
    ...t,
    runsCount: t.audit_runs[0]?.count || 0
  })) || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Tenants</h1>
        <Link href="/dashboard/tenants/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto bg-white text-black hover:bg-white/90 rounded-none">Add Tenant</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mappedTenants.map((tenant: any) => (
          <TenantCard key={tenant.id} tenant={tenant} />
        ))}
        {mappedTenants.length === 0 && (
          <p className="col-span-full text-white/50">No tenants found. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}
