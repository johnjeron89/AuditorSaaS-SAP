'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, Square } from 'lucide-react'

export function CancelAuditButton({ auditRunId }: { auditRunId: string }) {
  const [loading, setLoading] = useState(false)
  const [cancelled, setCancelled] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this audit?')) return

    setLoading(true)
    try {
      const { data, error } = await supabase.functions.invoke('cancel-audit', {
        body: { audit_run_id: auditRunId }
      })
      if (error) throw error
      setCancelled(true)
      router.refresh()
    } catch (error) {
      console.error('Error cancelling audit:', error)
      alert('Failed to cancel audit')
    } finally {
      setLoading(false)
    }
  }

  if (cancelled) {
    return (
      <span className="text-xs text-white/40">Cancelled</span>
    )
  }

  return (
    <Button
      onClick={handleCancel}
      disabled={loading}
      variant="outline"
      className="min-h-[36px] bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-none border-red-500/20 text-xs gap-1.5"
    >
      {loading ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Cancelling...</>
      ) : (
        <><Square className="h-3 w-3 fill-current" /> Cancel Audit</>
      )}
    </Button>
  )
}
