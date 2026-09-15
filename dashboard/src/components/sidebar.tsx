'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, LayoutDashboard, Users, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setEmail(user.email ?? null)
    })
  }, [supabase])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const links = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/tenants', label: 'Tenants', icon: Users },
  ]

  return (
    <div className="flex h-full w-64 flex-col bg-[#050505] text-white/60 border-r border-white/10 font-geist">
      <div className="flex h-16 items-center px-6 text-white font-semibold tracking-tight text-xl gap-2 border-b border-white/5">
        <span>SAPVYRA<span className="text-white/40">.</span></span>
      </div>
      <div className="flex-1 py-6 px-4 space-y-1">
        {links.map((link) => {
          const Icon = link.icon
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`) && link.href !== '/dashboard'
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 rounded-none px-3 py-2 text-[15px] font-medium transition-colors duration-300",
                isActive ? "bg-white/[0.05] text-white border-l-2 border-blue-400" : "hover:text-white hover:bg-white/[0.02]"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          )
        })}
      </div>
      <div className="p-4 border-t border-white/5">
        <div className="text-xs truncate mb-2 px-2 text-white/40 eyebrow">{email}</div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-2 rounded-none px-2 py-2 text-[15px] font-medium hover:bg-white/[0.02] hover:text-white transition-colors duration-300"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
