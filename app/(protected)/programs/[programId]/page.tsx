import { notFound } from "next/navigation";
import { updateProgram, getProgramForEdit, getProgramFormReferenceData } from "@/lib/server/programs";
import { getMesocyclePanelData } from "@/lib/server/mesocycles";
import { ProgramForm } from "@/components/programs/ProgramForm";
import { MesocyclePanel } from "@/components/programs/MesocyclePanel";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function EditProgramPage({ params, searchParams }: { params: Promise<{ programId: string }>; searchParams?: Promise<{ saved?: string }> }) {
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
      <PageHeader title="Edit program" description="Program-level hypertrophy settings. Templates and logging are intentionally deferred." />
      {query?.saved ? (
        <div className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-100">Program planning saved.</div>
      ) : null}
      <ProgramForm muscles={referenceData.muscles} program={program} action={action} />
      {mesocycleData ? <MesocyclePanel data={mesocycleData} /> : null}
    </div>
  );
}
