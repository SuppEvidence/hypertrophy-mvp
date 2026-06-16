import type {
  Exercise,
  ExercisePrimaryMuscle,
  ExerciseSecondaryMuscle,
  MovementGroup,
  Muscle,
} from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

type EditableExercise = Exercise & {
  primaryMuscles: Array<ExercisePrimaryMuscle & { muscle: Muscle }>;
  secondaryMuscles: Array<ExerciseSecondaryMuscle & { muscle: Muscle }>;
};

type Props = {
  exercise?: EditableExercise | null;
  muscles: Muscle[];
  movementGroups: MovementGroup[];
  action: (formData: FormData) => Promise<void>;
};

const selectClass =
  "min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-slate-400";

export function ExerciseForm({ exercise, muscles, movementGroups, action }: Props) {
  const primaryIds = new Set(exercise?.primaryMuscles.map((link) => link.muscleId) ?? []);
  const secondaryIds = new Set(exercise?.secondaryMuscles.map((link) => link.muscleId) ?? []);
  const isSeed = exercise?.isSeed ?? false;

  return (
    <form action={action} className="space-y-4">
      {isSeed ? (
        <Card className="border-amber-900/70 bg-amber-950/20">
          <p className="text-sm font-semibold text-amber-100">Editing a seed exercise creates your own copy.</p>
          <p className="mt-1 text-sm leading-6 text-amber-200/80">
            The global seed catalog stays unchanged. The saved version becomes a user-owned exercise that can be edited or archived later.
          </p>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Exercise name" name="name" defaultValue={exercise?.name ?? ""} required />

          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Movement group</span>
            <select name="movementGroupId" defaultValue={exercise?.movementGroupId ?? movementGroups[0]?.id} className={selectClass} required>
              {movementGroups.map((movement) => (
                <option key={movement.id} value={movement.id}>
                  {movement.name}
                </option>
              ))}
            </select>
          </label>

        </div>

        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tags</span>
          <input
            name="tags"
            defaultValue={exercise?.tags.join(", ") ?? ""}
            placeholder="stable, cable, lengthened"
            className={selectClass}
          />
          <span className="block text-xs text-slate-500">Comma-separated classification tags only.</span>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
            <span>
              <span className="block text-sm font-semibold text-slate-200">Active</span>
              <span className="block text-xs text-slate-500">Available for future template selection.</span>
            </span>
            <input name="isActive" type="checkbox" defaultChecked={exercise?.isActive ?? true} className="h-5 w-5" />
          </label>
          {!isSeed ? (
            <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3">
              <span>
                <span className="block text-sm font-semibold text-slate-200">Archived</span>
                <span className="block text-xs text-slate-500">Hidden from active exercise lists.</span>
              </span>
              <input name="isArchived" type="checkbox" defaultChecked={exercise?.isArchived ?? false} className="h-5 w-5" />
            </label>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-100">Primary muscles</h2>
          <p className="mt-1 text-sm text-slate-400">Direct set exposure. At least one primary muscle is required.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {muscles.map((muscle) => (
            <label key={muscle.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                name="primaryMuscleIds"
                value={muscle.id}
                defaultChecked={primaryIds.has(muscle.id)}
                className="h-5 w-5"
              />
              <span>{muscle.name}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-100">Secondary muscles</h2>
          <p className="mt-1 text-sm text-slate-400">Indirect effective-volume exposure. Primary selections override secondary duplicates.</p>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {muscles.map((muscle) => (
            <label key={muscle.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-200">
              <input
                type="checkbox"
                name="secondaryMuscleIds"
                value={muscle.id}
                defaultChecked={secondaryIds.has(muscle.id)}
                className="h-5 w-5"
              />
              <span>{muscle.name}</span>
            </label>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-20 z-10 md:static">
        <Button className="w-full">{isSeed ? "Save as custom copy" : "Save exercise"}</Button>
      </div>
    </form>
  );
}
