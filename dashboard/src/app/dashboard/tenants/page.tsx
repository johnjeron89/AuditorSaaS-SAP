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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Tenants</h1>
        <Link href="/dashboard/tenants/new">
          <Button>Add Tenant</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {mappedTenants.map((tenant: any) => (
          <TenantCard key={tenant.id} tenant={tenant} />
        ))}
        {mappedTenants.length === 0 && (
          <p className="col-span-full text-muted-foreground">No tenants found. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}
