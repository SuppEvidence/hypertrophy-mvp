export function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="space-y-1">
      <h1 className="text-2xl font-bold tracking-tight text-slate-50">{title}</h1>
      {description ? <p className="text-sm leading-6 text-slate-400">{description}</p> : null}
    </header>
  );
}
