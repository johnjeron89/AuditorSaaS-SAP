'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

const messages: Record<string, { text: string; icon: React.ElementType; bg: string; border: string; text_color: string }> = {
  success: {
    text: 'Tenant connected successfully!',
    icon: CheckCircle2,
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    text_color: 'text-green-400',
  },
  denied: {
    text: 'Connection was denied. Please grant admin consent to proceed.',
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text_color: 'text-amber-400',
  },
  error: {
    text: 'Connection failed. Please try again.',
    icon: XCircle,
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text_color: 'text-red-400',
  },
  retry: {
    text: 'Could not get a refresh token. Please try connecting again.',
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text_color: 'text-amber-400',
  },
}

export function ConnectToast() {
  const searchParams = useSearchParams()
  const [visible, setVisible] = useState(false)
  const connectStatus = searchParams.get('connect')

  useEffect(() => {
    if (connectStatus && messages[connectStatus]) {
      setVisible(true)
      // Clean URL
      const url = new URL(window.location.href)
      url.searchParams.delete('connect')
      window.history.replaceState({}, '', url.toString())
      // Auto-dismiss after 5s
      const timer = setTimeout(() => setVisible(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [connectStatus])

  if (!visible || !connectStatus || !messages[connectStatus]) return null

  const { text, icon: Icon, bg, border, text_color } = messages[connectStatus]

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-none border animate-fade-in-up ${bg} ${border} ${text_color}`}
      style={{ minWidth: 280 }}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{text}</span>
      <button onClick={() => setVisible(false)} className="text-white/40 hover:text-white/70">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
