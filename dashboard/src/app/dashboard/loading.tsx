export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-8 w-40 bg-white/[0.05] rounded" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-white/10 bg-white/[0.02] p-6 space-y-3">
            <div className="h-3 w-24 bg-white/[0.05] rounded" />
            <div className="h-7 w-16 bg-white/[0.08] rounded" />
          </div>
        ))}
      </div>
      <div className="space-y-4">
        <div className="h-6 w-44 bg-white/[0.05] rounded" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-white/10 bg-white/[0.02] p-4 h-20 rounded" />
        ))}
      </div>
    </div>
  )
}
