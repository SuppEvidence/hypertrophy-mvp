import { clsx } from "clsx";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-white/[0.07] bg-slate-900/[0.65] p-4 shadow-[0_18px_45px_-32px_rgba(0,0,0,0.9)] ring-1 ring-white/[0.025] backdrop-blur-sm sm:p-5",
        className,
      )}
    >
      {children}
    </section>
  );
}
