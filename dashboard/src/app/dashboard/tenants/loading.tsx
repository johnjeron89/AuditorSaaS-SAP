export default function TenantsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="h-8 w-32 bg-white/[0.05] rounded" />
        <div className="h-10 w-28 bg-white/[0.08] rounded" />
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border border-white/10 bg-white/[0.02] p-6 space-y-3 h-32" />
        ))}
      </div>
    </div>
  )
}
