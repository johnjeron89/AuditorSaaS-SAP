import { Sidebar } from '@/components/sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#050505]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 font-geist scroll-smooth w-full">
        {children}
      </main>
    </div>
  )
}
