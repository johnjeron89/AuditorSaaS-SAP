'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function NewTenantPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [platform, setPlatform] = useState('google_workspace')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data: userProfile } = await supabase
        .from('users')
        .select('organization_id')
        .eq('id', user.id)
        .single()
      if (!userProfile) throw new Error('User profile not found')

      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
          organization_id: userProfile.organization_id,
          name,
          platform,
        })
        .select()
        .single()

      if (tenantError) throw tenantError

      router.push(`/dashboard/tenants/${tenant.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Add New Tenant</h1>
      <Card className="border border-white/10 bg-white/[0.02] rounded-none">
        <CardHeader>
          <CardTitle className="text-xl tracking-tight text-white">Tenant Details</CardTitle>
          <CardDescription className="text-white/50">
            Create a tenant first, then connect credentials on the next step.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60">Tenant Name</label>
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Corp Workspace"
                className="bg-transparent border-white/10 rounded-none text-white focus-visible:ring-blue-400 focus-visible:ring-offset-0 focus-visible:border-blue-400"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60">Platform</label>
              <Select value={platform} onChange={(e) => setPlatform(e.target.value)} required>
                <option value="google_workspace">Google Workspace</option>
                <option value="microsoft_365">Microsoft 365</option>
              </Select>
            </div>

            {error && (
              <div className="text-red-400 text-sm p-2 bg-red-500/10 border border-red-500/20 rounded-none">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black hover:bg-white/90 rounded-none"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating...</>
              ) : (
                'Create Tenant →'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
