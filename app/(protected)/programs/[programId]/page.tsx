import { notFound } from "next/navigation";
import { updateProgram, getProgramForEdit, getProgramFormReferenceData } from "@/lib/server/programs";
import { ProgramForm } from "@/components/programs/ProgramForm";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function EditProgramPage({ params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params;
  const [program, referenceData] = await Promise.all([
    getProgramForEdit(programId),
    getProgramFormReferenceData(),
  ]);

  if (!program) notFound();

  const action = updateProgram.bind(null, program.id);

  return (
    <div className="space-y-5">
      <PageHeader title="Edit program" description="Program-level hypertrophy settings. Templates and logging are intentionally deferred." />
      <ProgramForm muscles={referenceData.muscles} program={program} action={action} />
    </div>
  );
}
