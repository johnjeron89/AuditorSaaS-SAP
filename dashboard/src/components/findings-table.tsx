'use client'

import React, { useState, useMemo } from 'react'
import { Finding } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const FindingsTable = React.memo(function FindingsTable({ findings }: { findings: Finding[] }) {
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  const filtered = useMemo(() => {
    return findings.filter(f => {
      if (severityFilter !== 'all' && f.severity !== severityFilter) return false
      if (statusFilter !== 'all' && f.status !== statusFilter) return false
      return true
    })
  }, [findings, severityFilter, statusFilter])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  
  const paginatedFindings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [severityFilter, statusFilter])

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4">
        <Select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="w-40 bg-transparent border-white/10 rounded-none text-white focus-visible:ring-blue-400">
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40 bg-transparent border-white/10 rounded-none text-white focus-visible:ring-blue-400">
          <option value="all">All Statuses</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="n/a">N/A</option>
        </Select>
      </div>

      <div className="border border-white/10 overflow-x-auto bg-white/[0.02] rounded-none">
        <table className="w-full min-w-[600px] text-sm text-left divide-y divide-white/5">
          <thead className="bg-white/[0.01] text-xs text-white/40 uppercase tracking-[0.1em] border-b border-white/10 whitespace-nowrap">
            <tr>
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3 font-medium">Check ID</th>
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Severity</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-white/60">
            {paginatedFindings.map(finding => (
              <React.Fragment key={finding.id}>
                <tr 
                  className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setExpandedRow(expandedRow === finding.id ? null : finding.id)}
                >
                  <td className="px-4 py-3">
                    {expandedRow === finding.id ? <ChevronDown className="h-4 w-4 text-white/40" /> : <ChevronRight className="h-4 w-4 text-white/40" />}
                  </td>
                  <td className="px-4 py-3 font-medium text-white/40">{finding.check_id}</td>
                  <td className="px-4 py-3 text-white">{finding.title}</td>
                  <td className="px-4 py-3"><Badge variant={finding.severity as any} className="rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)]">{finding.severity}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={finding.status as any} className="rounded-full">{finding.status}</Badge></td>
                </tr>
                {expandedRow === finding.id && (
                  <tr className="bg-white/[0.01]">
                    <td colSpan={5} className="p-4 px-12 space-y-4">
                      {finding.description && (
                        <div>
                          <strong className="block mb-1 text-white tracking-tight">Description:</strong>
                          <p className="text-white/50">{finding.description}</p>
                        </div>
                      )}
                      {finding.fix_instructions && (
                        <div>
                          <strong className="block mb-1 text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)] tracking-tight">Remediation:</strong>
                          <div className="bg-blue-400/5 p-3 rounded-none text-sm border border-blue-400/20 text-white/80">
                            {finding.fix_instructions}
                          </div>
                        </div>
                      )}
                      {finding.evidence && (
                        <div>
                          <strong className="block mb-1 text-white tracking-tight">Evidence:</strong>
                          <pre className="bg-black/50 p-3 rounded-none text-xs overflow-x-auto border border-white/5 text-white/50 font-mono">
                            {JSON.stringify(finding.evidence, null, 2)}
                          </pre>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-white/40">No findings match the filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-white/50">
            Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length} entries
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="bg-transparent border-white/10 text-white hover:bg-white/[0.05]"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="bg-transparent border-white/10 text-white hover:bg-white/[0.05]"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
})
