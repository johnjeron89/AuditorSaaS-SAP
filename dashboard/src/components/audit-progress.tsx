'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AuditJob } from '@/lib/types'

export function AuditProgress({ runId }: { runId: string }) {
  const [jobs, setJobs] = useState<AuditJob[]>([])
  const supabase = createClient()

  useEffect(() => {
    const fetchJobs = async () => {
      const { data } = await supabase.from('audit_jobs').select('*').eq('audit_run_id', runId)
      if (data) setJobs(data)
    }
    fetchJobs()

    const channel = supabase.channel(`jobs-${runId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_jobs', filter: `audit_run_id=eq.${runId}` }, (payload) => {
        fetchJobs()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [runId, supabase])

  const total = jobs.length
  const completed = jobs.filter(j => j.status === 'done' || j.status === 'failed').length
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100)

  if (total === 0) return null
  if (completed === total) return null // Hide when fully done

  return (
    <div className="border border-white/10 bg-white/[0.02] rounded-none p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:justify-between text-sm mb-2 text-white/50 gap-1">
        <span className="font-medium tracking-tight">Audit in progress</span>
        <span>{completed} of {total} jobs completed</span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2.5">
        <div className="bg-blue-400 h-2.5 rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" style={{ width: `${percent}%` }}></div>
      </div>
    </div>
  )
}
