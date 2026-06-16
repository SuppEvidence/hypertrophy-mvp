import Link from "next/link";
import { archiveProgram, createProgramFromPreset, listUserPrograms, switchActiveProgram } from "@/lib/server/programs";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  phaseLabels,
  programTypeLabels,
  rotationStyleLabels,
  volumeWindowDays,
  volumeWindowLabels,
  programTypeOptions,
} from "@/lib/programs/options";

function percent(value: unknown) {
  return `${Math.round(Number(value) * 100)}%`;
}

export default async function ProgramsPage() {
  const programs = await listUserPrograms();

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Programs"
          description="Persisted program setup. Templates, sessions, and dashboard analytics are intentionally deferred."
        />
        <Link href="/programs/new" className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-white">
          New
        </Link>
      </div>

      {programs.length === 0 ? (
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold text-slate-100">No programs yet</h2>
            <p className="mt-1 text-sm text-slate-400">Create a persisted program from a hypertrophy structure preset.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {programTypeOptions.map((option) => (
              <form key={option.value} action={createProgramFromPreset}>
                <input type="hidden" name="programType" value={option.value} />
                <Button variant="secondary" className="w-full justify-start">Create {option.label}</Button>
              </form>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="space-y-3">
        {programs.map((program) => {
          const priorityMuscles = program.priorityMuscles.map((link) => link.muscle.name).join(", ") || "—";
          const targetCount = program.volumeTargets.filter((target) => Number(target.weeklyTargetSets) > 0).length;
          return (
            <Card key={program.id} className={program.isActive ? "border-emerald-800 bg-emerald-950/20" : undefined}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-100">{program.name}</h2>
                    {program.isActive ? <span className="rounded-full border border-emerald-800 px-2 py-1 text-xs text-emerald-300">Active</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{programTypeLabels[program.programType]}</p>
                </div>
                <Link href={`/programs/${program.id}`} className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">
                  Edit
                </Link>
              </div>

              <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                <p><span className="text-slate-500">Templates:</span> {program.templateCount}</p>
                <p><span className="text-slate-500">Rotation:</span> {rotationStyleLabels[program.rotationStyle]}</p>
                <p><span className="text-slate-500">Window:</span> {volumeWindowLabels[program.volumeWindowType]} ({volumeWindowDays(program.volumeWindowType, program.customWindowDays)}d)</p>
                <p><span className="text-slate-500">Secondary:</span> {percent(program.secondaryContribution)}</p>
                <p><span className="text-slate-500">Phase:</span> {phaseLabels[program.activePhase]}</p>
                <p><span className="text-slate-500">Targets:</span> {targetCount} muscles</p>
              </div>
              <p className="mt-3 text-sm text-slate-400"><span className="text-slate-500">Priority:</span> {priorityMuscles}</p>

              <div className="mt-4 flex gap-2">
                {!program.isActive ? (
                  <form action={switchActiveProgram}>
                    <input type="hidden" name="programId" value={program.id} />
                    <Button variant="secondary">Set active</Button>
                  </form>
                ) : null}
                <form action={archiveProgram}>
                  <input type="hidden" name="programId" value={program.id} />
                  <Button variant="ghost">Archive</Button>
                </form>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
