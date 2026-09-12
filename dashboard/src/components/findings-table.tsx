'use client'

import React, { useState } from 'react'
import { Finding } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { ChevronDown, ChevronRight } from 'lucide-react'

export function FindingsTable({ findings }: { findings: Finding[] }) {
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  const filtered = findings.filter(f => {
    if (severityFilter !== 'all' && f.severity !== severityFilter) return false
    if (statusFilter !== 'all' && f.status !== statusFilter) return false
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex gap-4 mb-4">
        <Select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)} className="w-40">
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </Select>
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="w-40">
          <option value="all">All Statuses</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
          <option value="n/a">N/A</option>
        </Select>
      </div>

      <div className="border rounded-md overflow-hidden bg-white dark:bg-slate-950">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-900 text-xs uppercase border-b">
            <tr>
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3">Check ID</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(finding => (
              <React.Fragment key={finding.id}>
                <tr 
                  className="border-b hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === finding.id ? null : finding.id)}
                >
                  <td className="px-4 py-3">
                    {expandedRow === finding.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-500">{finding.check_id}</td>
                  <td className="px-4 py-3">{finding.title}</td>
                  <td className="px-4 py-3"><Badge variant={finding.severity as any}>{finding.severity}</Badge></td>
                  <td className="px-4 py-3"><Badge variant={finding.status as any}>{finding.status}</Badge></td>
                </tr>
                {expandedRow === finding.id && (
                  <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b">
                    <td colSpan={5} className="p-4 px-12 space-y-4">
                      {finding.description && (
                        <div>
                          <strong className="block mb-1">Description:</strong>
                          <p className="text-muted-foreground">{finding.description}</p>
                        </div>
                      )}
                      {finding.fix_instructions && (
                        <div>
                          <strong className="block mb-1 text-orange-600 dark:text-orange-400">Remediation:</strong>
                          <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-md text-sm border border-orange-100 dark:border-orange-900">
                            {finding.fix_instructions}
                          </div>
                        </div>
                      )}
                      {finding.evidence && (
                        <div>
                          <strong className="block mb-1">Evidence:</strong>
                          <pre className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md text-xs overflow-x-auto">
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
                <td colSpan={5} className="text-center py-8 text-muted-foreground">No findings match the filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

