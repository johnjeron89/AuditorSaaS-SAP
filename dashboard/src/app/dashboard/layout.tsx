import { Sidebar } from '@/components/sidebar'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex h-screen overflow-hidden bg-[#050505]">
      <Sidebar userEmail={user?.email ?? null} />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 font-geist scroll-smooth w-full">
        {children}
      </main>
    </div>
  )
}
