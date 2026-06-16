import { clsx } from "clsx";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={clsx("rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-sm", className)}>
      {children}
    </section>
  );
}
