import Link from "next/link";
import { CalendarDays, CheckCircle2, Dumbbell, Pencil, Trash2 } from "lucide-react";
import { DeleteWorkoutButton } from "@/components/workouts/DeleteWorkoutButton";
import { Card } from "@/components/ui/Card";
import { getWorkoutHistory } from "@/lib/server/workouts";

type WorkoutHistoryItem = Awaited<ReturnType<typeof getWorkoutHistory>>[number];

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getCompletedSetCount(session: WorkoutHistoryItem) {
  return session.exercises.reduce((total: number, item: WorkoutHistoryItem["exercises"][number]) => {
    if (item.sets.length > 0) {
      return total + item.sets.filter((set: WorkoutHistoryItem["exercises"][number]["sets"][number]) => set.isCompleted).length;
    }
    return total + Math.max(0, Number(item.completedSets ?? 0));
  }, 0);
}

export async function WorkoutHistory() {
  const sessions = await getWorkoutHistory(40);

  if (sessions.length === 0) {
    return (
      <Card>
        <p className="text-sm text-slate-400">No logged workouts yet.</p>
        <Link href="/log" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-950">
          Start workout
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session: WorkoutHistoryItem) => {
        const completedSetCount = getCompletedSetCount(session);
        const painFlagCount = session.exercises.filter((item: WorkoutHistoryItem["exercises"][number]) =>
          item.painFlag || item.sets.some((set: WorkoutHistoryItem["exercises"][number]["sets"][number]) => set.isCompleted && Boolean(set.painFlag)),
        ).length;
        const substitutionCount = session.exercises.filter((item: WorkoutHistoryItem["exercises"][number]) => item.isSubstitution).length;

        return (
          <Card key={session.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold text-slate-100">{session.name}</h2>
                  <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${session.status === "COMPLETED" ? "border-emerald-400/30 text-emerald-200" : "border-amber-400/30 text-amber-200"}`}>
                    {session.status.toLowerCase()}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                  <CalendarDays size={14} /> {formatDate(session.completedAt ?? session.performedAt ?? session.createdAt)}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {session.program.name} · {session.template?.name ?? "Manual"}
                </p>
              </div>
              {session.status === "COMPLETED" ? <CheckCircle2 className="shrink-0 text-emerald-300" size={20} /> : <Dumbbell className="shrink-0 text-amber-300" size={20} />}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
              <Stat label="Exercises" value={String(session.exercises.length)} />
              <Stat label="Sets" value={String(completedSetCount)} />
              <Stat label="Pain flags" value={String(painFlagCount)} />
              <Stat label="Substitutions" value={String(substitutionCount)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link href={`/log?sessionId=${session.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700">
                <Pencil size={16} /> Open / edit
              </Link>
              <div className="flex items-start gap-2">
                <Trash2 className="mt-3 hidden text-red-300 md:block" size={16} />
                <div className="w-full">
                  <DeleteWorkoutButton sessionId={session.id} />
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  );
}
