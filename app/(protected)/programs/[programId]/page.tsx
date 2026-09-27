import { notFound } from "next/navigation";
import { updateProgram, getProgramForEdit, getProgramFormReferenceData } from "@/lib/server/programs";
import { getMesocyclePanelData } from "@/lib/server/mesocycles";
import { ProgramForm } from "@/components/programs/ProgramForm";
import { MesocyclePanel } from "@/components/programs/MesocyclePanel";
import { PageHeader } from "@/components/ui/PageHeader";
import Link from "next/link";

export const maxDuration = 180;

export default async function EditProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams?: Promise<{ saved?: string; t3PrioritiesSaved?: string; mesocycleEnded?: string; mesocycleEndError?: string }>;
}) {
  const { programId } = await params;
  const query = await searchParams;
  const [program, referenceData, mesocycleData] = await Promise.all([
    getProgramForEdit(programId),
    getProgramFormReferenceData(),
    getMesocyclePanelData(programId),
  ]);

  if (!program) notFound();

  const action = updateProgram.bind(null, program.id);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Program planning"
        description="The program is the reusable foundation. Mesocycles are temporary date-bounded overlays that inherit the foundation unless you add an exception."
      />
      {program.isActive ? <Link href="/plan/blocks" className="inline-flex rounded-xl border border-orange-500/30 px-4 py-2 text-sm font-semibold text-orange-300">Plan next mesocycle with coach →</Link> : null}
      {query?.saved ? (
        <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-100">Planning changes saved.</div>
      ) : null}
      {query?.t3PrioritiesSaved ? (
        <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-100">T3 priorities saved. The current prescription remains the starting baseline; the automatic assessment appears under AI Advisor → Volume Coaching.</div>
      ) : null}
      {query?.mesocycleEnded ? (
        <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-100">Mesocycle ended. Its overlay is no longer active and the review now uses the actual end date.</div>
      ) : null}
      {query?.mesocycleEndError ? (
        <div className="rounded-2xl border border-red-900 bg-red-950/40 p-3 text-sm text-red-100">The end date must be between the mesocycle start, its planned end, and today.</div>
      ) : null}

      <section className="space-y-3">
        <div className="px-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">1 · Reusable foundation</p>
        </div>
        <ProgramForm muscles={referenceData.muscles} program={program} action={action} />
      </section>

      {mesocycleData ? (
        <section className="space-y-3">
          <div className="px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">2 · Temporary block layer</p>
          </div>
          <MesocyclePanel data={mesocycleData} />
        </section>
      ) : null}
    </div>
  );
}
