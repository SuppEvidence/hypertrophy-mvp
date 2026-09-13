import Link from "next/link";
import { ChevronLeft, RotateCcw } from "lucide-react";

import { MesocycleAdjustmentEditor } from "@/components/programs/MesocycleAdjustmentEditor";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  getCurrentMesocycleAdjustmentData,
  resetAllMesocycleSlotAdjustments,
} from "@/lib/server/mesocycle-adjustments";

export default async function MesocycleAdjustmentPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const [{ open }, data] = await Promise.all([
    searchParams,
    getCurrentMesocycleAdjustmentData(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/plan"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-300"
        >
          <ChevronLeft size={14} />
          Plan
        </Link>
      </div>

      <PageHeader
        title="Adjust mesocycle"
        description="Make practical changes to the current block without rewriting the base templates."
      />

      {!data.program ? (
        <Card>
          <p className="font-semibold text-slate-100">
            No active program
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Activate a program before creating mesocycle-only adjustments.
          </p>
          <Link
            href="/programs"
            className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Open programs
          </Link>
        </Card>
      ) : !data.mesocycle ? (
        <Card>
          <p className="font-semibold text-slate-100">
            No active mesocycle
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-400">
            {data.program.name} is active, but there is no current mesocycle
            to adjust.
          </p>
          <Link
            href={`/programs/${data.program.id}`}
            className="mt-4 inline-flex rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Open program
          </Link>
        </Card>
      ) : (
        <>
          <Card className="border-orange-400/10 bg-gradient-to-br from-slate-900 to-orange-950/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-orange-300/80">
                  Current block
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-100">
                  {data.mesocycle.name}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {data.program.name} · Week {data.mesocycle.currentWeek}/
                  {data.mesocycle.lengthWeeks}
                </p>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-950/40 px-3 py-1 text-xs font-semibold text-slate-400">
                {data.mesocycle.phase}
              </span>
            </div>

            <div className="mt-4 border-t border-white/[0.06] pt-4">
              <p className="text-sm leading-6 text-slate-400">
                Changes apply only to workouts started after the adjustment.
                Completed sessions are never rewritten, and the base
                templates remain intact for future mesocycles.
              </p>
            </div>
          </Card>

          <div className="rounded-2xl border border-sky-400/10 bg-sky-500/[0.05] px-4 py-3">
            <p className="text-sm font-semibold text-slate-200">
              Simple controls, planner underneath
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Change the movement pattern, adjust physical sets, or set a slot
              to 0 to hide it for this block. Related movement patterns are
              listed first. Applying a manual set count holds that slot at the
              chosen value while other eligible slots can still adapt around
              it.
            </p>
          </div>

          <MesocycleAdjustmentEditor
            mesocycleId={data.mesocycle.id}
            templates={data.templates}
            movementGroups={data.movementGroups}
            initialOpenTemplateId={open ?? null}
          />

          <Card className="border-dashed bg-slate-950/25">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-200">
                  Advanced setup
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Base slot limits, set plans, rep buckets, roles and other
                  structural variables remain in Base templates.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/templates"
                  className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-600 hover:text-slate-100"
                >
                  Base templates
                </Link>
                <form action={resetAllMesocycleSlotAdjustments}>
                  <input
                    type="hidden"
                    name="mesocycleId"
                    value={data.mesocycle.id}
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-600 hover:text-slate-200"
                  >
                    <RotateCcw size={13} />
                    Reset manual changes
                  </button>
                </form>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
