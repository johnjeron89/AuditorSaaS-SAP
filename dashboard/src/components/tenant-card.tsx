import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tenant } from '@/lib/types'

interface TenantCardProps {
  tenant: Tenant & { runsCount: number }
}

export function TenantCard({ tenant }: TenantCardProps) {
  return (
    <Link href={`/dashboard/tenants/${tenant.id}`}>
      <Card className="h-full border border-white/10 bg-white/[0.02] rounded-none hover:bg-white/[0.04] transition-colors duration-300">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="truncate font-medium tracking-tight text-white">{tenant.name}</span>
            <Badge variant="secondary" className="rounded-full bg-white/[0.05] text-white hover:bg-white/[0.1] border-white/10 eyebrow">{tenant.platform}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-white/40">
            Created on {new Date(tenant.created_at).toLocaleDateString()}
          </div>
          <div className="text-sm mt-2 font-medium text-white/50">
            {tenant.runsCount} Audit Runs
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
