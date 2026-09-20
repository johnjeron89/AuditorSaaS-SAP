export default function TenantDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-white/[0.05] rounded" />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <div className="border border-white/10 bg-white/[0.02] p-6 h-32" />
        <div className="border border-white/10 bg-white/[0.02] p-6 h-32" />
      </div>
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border border-white/10 bg-white/[0.02] p-4 h-20" />
        ))}
      </div>
    </div>
  )
}
