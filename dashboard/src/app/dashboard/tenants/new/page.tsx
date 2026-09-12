'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

export default function NewTenantPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [platform, setPlatform] = useState('google_workspace')
  const [file, setFile] = useState<File | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!file) throw new Error('Please upload a service account JSON file.')

      // 1. Get user org
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userProfile } = await supabase.from('users').select('organization_id').eq('id', user.id).single()
      if (!userProfile) throw new Error('User profile not found')

      // 2. Create tenant
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          organization_id: userProfile.organization_id,
          name,
          platform
        })
        .select()
        .single()

      if (tenantError) throw tenantError

      // 3. Read file and send to edge function
      const fileContent = await file.text()
      const payload = {
        tenant_id: tenant.id,
        credentials: JSON.parse(fileContent),
        admin_email: adminEmail
      }

      // We assume an Edge function `upload-credentials` exists
      const { error: fnError } = await supabase.functions.invoke('upload-credentials', {
        body: payload
      })

      if (fnError) {
        console.error('Failed to upload credentials, but tenant created:', fnError)
        // Optionally delete tenant or notify user
      }

      router.push(`/dashboard/tenants/${tenant.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Add New Tenant</h1>
      <Card>
        <CardHeader>
          <CardTitle>Tenant Details</CardTitle>
          <CardDescription>Connect a new Google Workspace environment.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tenant Name</label>
              <Input required value={name} onChange={e => setName(e.target.value)} placeholder="Acme Corp Workspace" />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Platform</label>
              <Select value={platform} onChange={e => setPlatform(e.target.value)} required>
                <option value="google_workspace">Google Workspace</option>
                <option value="microsoft_365" disabled>Microsoft 365 (Coming soon)</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Email to Impersonate</label>
              <Input type="email" required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} placeholder="admin@example.com" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Service Account Credentials (JSON)</label>
              <Input type="file" accept=".json" required onChange={e => setFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-muted-foreground">Upload the JSON key for a service account with Domain-Wide Delegation enabled.</p>
            </div>

            {error && <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-950/20 rounded">{error}</div>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Creating...' : 'Create Tenant'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
