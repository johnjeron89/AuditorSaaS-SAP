'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function RunAuditButton({ tenantId }: { tenantId: string }) {
  const [framework, setFramework] = useState('CIS')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleRun = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('run-audit', {
        body: { tenant_id: tenantId, framework }
      })
      if (error) throw error
      if (data?.audit_run_id) {
        router.push(`/dashboard/tenants/${tenantId}/runs/${data.audit_run_id}`)
      } else {
        router.refresh()
      }
    } catch (error) {
      console.error('Error starting audit:', error)
      alert('Failed to start audit')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={framework} onChange={e => setFramework(e.target.value)} className="w-40 bg-transparent border-white/10 rounded-none text-white focus-visible:ring-blue-400" disabled={loading}>
        <option value="CIS">CIS Google Workspace</option>
        <option value="GDPR">GDPR</option>
        <option value="SOC2">SOC 2</option>
      </Select>
      <Button onClick={handleRun} disabled={loading} className="bg-white text-black hover:bg-white/90 rounded-none border border-transparent">
        {loading ? 'Starting...' : 'Run Audit'}
      </Button>
    </div>
  )
}
