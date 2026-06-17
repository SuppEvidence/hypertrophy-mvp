import Link from "next/link";
import { Archive, CheckCircle2, Copy, Pencil, Plus, Search } from "lucide-react";
import { archiveExercise, getExerciseReferenceData, listExercises, restoreExercise } from "@/lib/server/exercises";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    movementGroupId?: string;
    muscleId?: string;
    source?: string;
    status?: string;
  }>;
};

type ReferenceMovementGroup = { id: string; name: string };
type ReferenceMuscle = { id: string; name: string };

const inputClass =
  "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-400";

export default async function ExercisesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [{ muscles, movementGroups }, exercises] = await Promise.all([getExerciseReferenceData(), listExercises(params)]);

  const typedMovementGroups: ReferenceMovementGroup[] = movementGroups.map((movement: any) => ({
    id: movement.id,
    name: movement.name,
  }));

  const typedMuscles: ReferenceMuscle[] = muscles.map((muscle: any) => ({
    id: muscle.id,
    name: muscle.name,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Exercise Database"
          description="Classification-focused exercise catalog. Seed exercises are global; edited seed items are saved as user-owned copies."
        />
        <Link href="/exercises/new" className="shrink-0">
          <Button className="gap-2 px-3">
            <Plus size={18} />
            <span className="hidden sm:inline">New</span>
          </Button>
        </Link>
      </div>

      <Card>
        <form className="space-y-3">
          <label className="block space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Search</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 text-slate-500" size={18} />
              <input name="q" defaultValue={params.q ?? ""} placeholder="Exercise, tag, movement group" className={`${inputClass} pl-10`} />
            </div>
          </label>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Movement</span>
              <select name="movementGroupId" defaultValue={params.movementGroupId ?? ""} className={inputClass}>
                <option value="">All movements</option>
                {typedMovementGroups.map((movement: any) => (
                  <option key={movement.id} value={movement.id}>
                    {movement.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Muscle</span>
              <select name="muscleId" defaultValue={params.muscleId ?? ""} className={inputClass}>
                <option value="">All muscles</option>
                {typedMuscles.map((muscle: any) => (
                  <option key={muscle.id} value={muscle.id}>
                    {muscle.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Source</span>
              <select name="source" defaultValue={params.source ?? "all"} className={inputClass}>
                <option value="all">Seed + custom</option>
                <option value="seed">Seed only</option>
                <option value="custom">Custom only</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</span>
              <select name="status" defaultValue={params.status ?? "active"} className={inputClass}>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="submit" variant="secondary">
              Apply filters
            </Button>
            <Link
              href="/exercises"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700"
            >
              Reset
            </Link>
          </div>
        </form>
      </Card>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{exercises.length} exercises</span>
        <span>Seed edits create custom copies</span>
      </div>

      <div className="space-y-3">
        {exercises.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-400">No exercises match the selected filters.</p>
          </Card>
        ) : null}

        {exercises.map((exercise: any) => {
          const primary = exercise.primaryMuscles.map((link: any) => link.muscle.name).join(", ") || "—";
          const secondary = exercise.secondaryMuscles.map((link: any) => link.muscle.name).join(", ") || "—";
          const canArchive = !exercise.isSeed;

          return (
            <Card key={exercise.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-100">{exercise.name}</h2>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-400">
                      {exercise.isSeed ? <Copy size={12} /> : <CheckCircle2 size={12} />}
                      {exercise.isSeed ? "Seed" : "Custom"}
                    </span>
                    {exercise.isArchived ? (
                      <span className="rounded-full border border-amber-800 px-2 py-1 text-xs text-amber-200">Archived</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{exercise.movementGroup.name}</p>
                </div>
                <Link href={`/exercises/${exercise.id}`} className="rounded-xl border border-slate-700 p-2 text-slate-300 hover:bg-slate-800">
                  <Pencil size={17} />
                </Link>
              </div>

              <div className="mt-3 grid gap-2 text-sm text-slate-400">
                <p>
                  <span className="text-slate-500">Primary:</span> {primary}
                </p>
                <p>
                  <span className="text-slate-500">Secondary:</span> {secondary}
                </p>
                {exercise.tags.length ? (
                  <p>
                    <span className="text-slate-500">Tags:</span> {exercise.tags.join(", ")}
                  </p>
                ) : null}
              </div>

              {canArchive ? (
                <form action={exercise.isArchived ? restoreExercise : archiveExercise} className="mt-4">
                  <input type="hidden" name="exerciseId" value={exercise.id} />
                  <Button variant="ghost" className="w-full gap-2">
                    <Archive size={16} /> {exercise.isArchived ? "Restore" : "Archive"}
                  </Button>
                </form>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
