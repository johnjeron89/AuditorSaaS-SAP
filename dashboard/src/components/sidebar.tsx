'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Shield, LayoutDashboard, Users, LogOut, Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

const links = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/tenants', label: 'Tenants', icon: Users },
]

function SidebarContent({
  pathname,
  setIsOpen,
  handleSignOut,
  email
}: {
  pathname: string;
  setIsOpen: (open: boolean) => void;
  handleSignOut: () => void;
  email: string | null;
}) {
  return (
    <>
      <div className="flex h-16 items-center justify-between px-6 text-white font-semibold tracking-tight text-xl gap-2 border-b border-white/5">
        <span>SAPVYRA<span className="text-white/40">.</span></span>
        <button className="md:hidden text-white/60 hover:text-white" onClick={() => setIsOpen(false)}>
          <X className="h-5 w-5" />
        </button>
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
          className="flex w-full items-center gap-2 rounded-none px-2 py-2 text-[15px] font-medium hover:bg-white/[0.02] hover:text-white transition-colors duration-300 min-h-[44px]"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </>
  )
}

export function Sidebar({ userEmail }: { userEmail: string | null }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)

  // Close sidebar on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button 
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 bg-[#050505] border border-white/10 rounded-md text-white/80 hover:text-white"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar - Desktop (fixed) & Mobile (slide-in) */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#050505] text-white/60 border-r border-white/10 font-geist transition-transform duration-300 md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <SidebarContent 
          pathname={pathname}
          setIsOpen={setIsOpen}
          handleSignOut={handleSignOut}
          email={userEmail}
        />
      </div>
    </>
  )
}
