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
      <Card className="hover:border-indigo-500 transition-colors h-full">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="truncate">{tenant.name}</span>
            <Badge variant="secondary">{tenant.platform}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Created on {new Date(tenant.created_at).toLocaleDateString()}
          </div>
          <div className="text-sm mt-2 font-medium">
            {tenant.runsCount} Audit Runs
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
