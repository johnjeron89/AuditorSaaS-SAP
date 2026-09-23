'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Loader2, ChevronDown, ChevronRight } from 'lucide-react'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

interface ConnectTenantProps {
  tenantId: string
  platform: string
  hasCredentials: boolean
  credentialMethod?: string | null
}

export function ConnectTenant({ tenantId, platform, hasCredentials, credentialMethod }: ConnectTenantProps) {
  const router = useRouter()
  const supabase = createClient()
  const [showManual, setShowManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const handleGoogleOAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''
    window.location.href = `${SUPABASE_URL}/functions/v1/google-oauth-init?tenant_id=${tenantId}&token=${token}`
  }

  const handleMicrosoftOAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''
    window.location.href = `${SUPABASE_URL}/functions/v1/microsoft-oauth-init?tenant_id=${tenantId}&token=${token}`
  }

  const handleManualUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (!file) throw new Error('Please select a JSON file.')
      const fileContent = await file.text()
      const payload = {
        tenant_id: tenantId,
        credentials: JSON.parse(fileContent),
        admin_email: adminEmail,
      }

      const { error: fnError } = await supabase.functions.invoke('upload-credentials', {
        body: payload,
      })

      if (fnError) throw fnError
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (hasCredentials) {
    return (
      <Card className="border border-green-500/20 bg-green-500/[0.03] rounded-none">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-sm font-medium">
            Connected via {credentialMethod === 'oauth' ? 'OAuth' : 'Service Account'}
          </span>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-amber-500/20 bg-amber-500/[0.03] rounded-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg text-white flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          Connect Credentials
        </CardTitle>
        <CardDescription className="text-white/50">
          Connect your {platform === 'google_workspace' ? 'Google Workspace' : 'Microsoft 365'} tenant to start auditing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* OAuth Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {platform === 'google_workspace' && (
            <Button
              onClick={handleGoogleOAuth}
              className="flex-1 bg-white text-black hover:bg-white/90 rounded-none h-11 gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Connect with Google
            </Button>
          )}
          {platform === 'microsoft_365' && (
            <Button
              onClick={handleMicrosoftOAuth}
              className="flex-1 bg-[#0078d4] text-white hover:bg-[#106ebe] rounded-none h-11 gap-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 23 23">
                <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
                <rect x="12" y="1" width="10" height="10" fill="#7fba00"/>
                <rect x="1" y="12" width="10" height="10" fill="#00a4ef"/>
                <rect x="12" y="12" width="10" height="10" fill="#ffb900"/>
              </svg>
              Connect with Microsoft
            </Button>
          )}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 border-t border-white/10" />
          <span className="text-xs text-white/30 uppercase tracking-wider">or connect manually</span>
          <div className="flex-1 border-t border-white/10" />
        </div>

        {/* Manual Upload Toggle */}
        <button
          onClick={() => setShowManual(!showManual)}
          className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors w-full"
        >
          {showManual ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {platform === 'google_workspace'
            ? 'Upload Service Account JSON (Domain-Wide Delegation)'
            : 'Upload Client Secret JSON'}
        </button>

        {showManual && (
          <form onSubmit={handleManualUpload} className="space-y-3 pt-2 pl-6 border-l border-white/10">
            {platform === 'google_workspace' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-white/50">Admin Email to Impersonate</label>
                <Input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="bg-transparent border-white/10 rounded-none text-white text-sm h-9 focus-visible:ring-blue-400 focus-visible:ring-offset-0"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-medium text-white/50">
                {platform === 'google_workspace' ? 'Service Account JSON' : 'Client Secret JSON'}
              </label>
              <Input
                type="file"
                accept=".json"
                required
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="bg-transparent border-white/10 rounded-none text-white/60 text-sm h-9 file:bg-white/[0.05] file:text-white file:border-0 file:text-xs hover:file:bg-white/[0.1] focus-visible:ring-blue-400 focus-visible:ring-offset-0"
              />
            </div>
            {error && (
              <div className="text-red-400 text-xs p-2 bg-red-500/10 border border-red-500/20 rounded-none">
                {error}
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="bg-white/[0.05] text-white hover:bg-white/[0.1] rounded-none text-sm h-9 border border-white/10"
            >
              {loading ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-2" /> Uploading...</>
              ) : (
                'Upload & Connect'
              )}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
