export default function ProtectedLoading() {
  return (
    <div className="space-y-4" aria-label="Loading view">
      <div className="h-24 animate-pulse rounded-2xl border border-white/[0.05] bg-slate-900/[0.55]" />
      <div className="h-32 animate-pulse rounded-2xl border border-white/[0.05] bg-slate-900/[0.55]" />
      <div className="h-48 animate-pulse rounded-2xl border border-white/[0.05] bg-slate-900/[0.55]" />
    </div>
  );
}
