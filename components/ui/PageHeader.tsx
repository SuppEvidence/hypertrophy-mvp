export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-slate-950/[0.35] px-4 py-4 shadow-sm sm:px-5">
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-400 via-orange-500 to-amber-600" aria-hidden="true" />
      <div className="pl-1">
        <h1 className="text-2xl font-bold tracking-[-0.025em] text-slate-50 sm:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>
    </header>
  );
}
