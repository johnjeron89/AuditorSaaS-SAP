export default function RunDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-56 bg-white/[0.05] rounded" />
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-white/10 bg-white/[0.02] p-6 h-24" />
        ))}
      </div>
      <div className="border border-white/10 bg-white/[0.02] p-4 h-64" />
    </div>
  )
}
