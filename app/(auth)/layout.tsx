import { CheckCircle2 } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-transparent text-slate-100 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden border-r border-white/[0.06] px-10 py-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(249,115,22,0.16),transparent_42%),linear-gradient(145deg,rgba(15,23,42,0.82),rgba(2,6,23,0.9))]" />
        <div className="relative">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-base font-black tracking-[-0.04em] text-white shadow-[0_18px_42px_-16px_rgba(249,115,22,0.95)]">
              RFD
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-400">Ripped Fat Dude</p>
              <p className="mt-1 text-xl font-bold tracking-[-0.02em] text-white">Hypertrophy Tracker</p>
            </div>
          </div>

          <div className="mt-20 max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-300">Built around the work that matters</p>
            <h1 className="mt-4 text-5xl font-black leading-[1.04] tracking-[-0.045em] text-white">
              Plan the stimulus.
              <br />
              Log the effort.
              <br />
              Review the result.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
              A focused hypertrophy system for movement-pattern planning, productive volume, mesocycle decisions, and physique metrics.
            </p>
          </div>
        </div>

        <div className="relative grid max-w-xl gap-3 text-sm text-slate-300 sm:grid-cols-2">
          {["Movement-pattern templates", "Set-level stimulus logging", "Mesocycle targets and review", "Bodyweight and circumference trends"].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle2 size={17} className="shrink-0 text-orange-400" />
              {item}
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-slate-900/[0.72] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.95)] ring-1 ring-white/[0.025] backdrop-blur-xl sm:p-7">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 text-sm font-black text-white">RFD</div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-400">Ripped Fat Dude</p>
              <p className="font-bold text-slate-50">Hypertrophy Tracker</p>
            </div>
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
