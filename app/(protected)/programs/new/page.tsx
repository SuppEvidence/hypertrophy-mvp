import { createProgram, createProgramFromPreset, getProgramFormReferenceData } from "@/lib/server/programs";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgramForm } from "@/components/programs/ProgramForm";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { programTypeOptions } from "@/lib/programs/options";

export default async function NewProgramPage() {
  const { muscles, defaultSecondaryContribution } = await getProgramFormReferenceData();

  return (
    <div className="space-y-5">
      <PageHeader title="New program" description="Create a persisted program configuration. Workout templates come in the next slice." />
      <Card>
        <h2 className="font-semibold text-slate-100">Quick presets</h2>
        <p className="mt-1 text-sm text-slate-400">Creates sensible defaults for structure, volume window, rotation, and secondary contribution.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {programTypeOptions.map((option) => (
            <form key={option.value} action={createProgramFromPreset}>
              <input type="hidden" name="programType" value={option.value} />
              <Button variant="secondary" className="w-full justify-start">Create {option.label}</Button>
            </form>
          ))}
        </div>
      </Card>
      <ProgramForm muscles={muscles} action={createProgram} defaultSecondaryContribution={defaultSecondaryContribution} />
    </div>
  );
}
