export default function ProtectedLoading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-slate-800" />
      <div className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
      <div className="h-40 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/80" />
    </div>
  );
}
