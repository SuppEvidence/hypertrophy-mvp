import { archiveMesocycle, createMesocycle, updateMesocycle } from "@/lib/server/mesocycles";
import { phaseOptions } from "@/lib/programs/options";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

type Mesocycle = {
  id: string;
  name: string;
  phase: string;
  startDate: string;
  endDate: string;
  lengthWeeks: number;
  notes: string;
};

type Review = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  sessionCount: number;
  volume: Array<{
    muscleId: string;
    muscleName: string;
    actual: number;
    target: number;
    status: string;
    isPriority: boolean;
  }>;
  performance: { up: number; flat: number; down: number };
  recommendation: string;
};

type Props = {
  data: {
    programId: string;
    activePhase: string;
    mesocycles: Mesocycle[];
    reviews: Review[];
  };
};

const selectClass = "min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-slate-400";
const textareaClass = "min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-slate-400";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function PhaseSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phase</span>
      <select name="phase" defaultValue={defaultValue} className={selectClass}>
        {phaseOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function MesocycleForm({ programId, mesocycle, activePhase }: { programId: string; mesocycle?: Mesocycle; activePhase: string }) {
  const action = mesocycle ? updateMesocycle.bind(null, mesocycle.id) : createMesocycle.bind(null, programId);

  return (
    <form action={action} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Mesocycle name" name="name" defaultValue={mesocycle?.name ?? "New mesocycle"} required />
        <PhaseSelect defaultValue={mesocycle?.phase ?? activePhase} />
        <Field label="Start date" name="startDate" type="date" defaultValue={mesocycle?.startDate ?? todayInputValue()} required />
        <Field label="Length weeks" name="lengthWeeks" type="number" min="1" max="52" defaultValue={mesocycle?.lengthWeeks ?? 4} required />
      </div>
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</span>
        <textarea name="notes" defaultValue={mesocycle?.notes ?? ""} className={textareaClass} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary">{mesocycle ? "Save mesocycle" : "Create mesocycle"}</Button>
        {mesocycle ? (
          <button
            formAction={archiveMesocycle}
            name="mesocycleId"
            value={mesocycle.id}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-transparent px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-900"
          >
            Archive
          </button>
        ) : null}
      </div>
    </form>
  );
}

function ReviewCard({ review }: { review: Review }) {
  const flaggedVolume = review.volume.filter((row) => row.status !== "on").slice(0, 6);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-100">{review.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{review.startDate} to {review.endDate} · {review.sessionCount} sessions</p>
        </div>
        <div className="rounded-xl border border-slate-800 px-3 py-2 text-sm text-slate-300">
          Performance: {review.performance.up} up / {review.performance.flat} flat / {review.performance.down} down
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-slate-900 p-3 text-sm text-slate-300">{review.recommendation}</p>

      {flaggedVolume.length > 0 ? (
        <div className="mt-3 space-y-2">
          {flaggedVolume.map((row) => (
            <div key={row.muscleId} className="grid grid-cols-[1fr_auto] gap-3 rounded-xl border border-slate-800 p-2 text-sm">
              <span className={row.isPriority ? "font-semibold text-slate-100" : "text-slate-300"}>
                {row.muscleName} {row.isPriority ? "(priority)" : ""}
              </span>
              <span className={row.status === "below" ? "text-amber-300" : "text-sky-300"}>
                {row.actual} / {row.target} effective sets
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No volume target flags for this mesocycle.</p>
      )}
    </div>
  );
}

export function MesocyclePanel({ data }: Props) {
  return (
    <Card className="space-y-4">
      <div>
        <h2 className="font-semibold text-slate-100">Mesocycles</h2>
        <p className="mt-1 text-sm text-slate-400">A light planning layer for date-bounded review. Programs and templates remain reusable.</p>
      </div>

      <MesocycleForm programId={data.programId} activePhase={data.activePhase} />

      {data.mesocycles.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Existing mesocycles</h3>
          {data.mesocycles.map((mesocycle) => (
            <details key={mesocycle.id} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
              <summary className="cursor-pointer font-semibold text-slate-100">
                {mesocycle.name} · {mesocycle.startDate} to {mesocycle.endDate}
              </summary>
              <div className="mt-3">
                <MesocycleForm programId={data.programId} mesocycle={mesocycle} activePhase={data.activePhase} />
              </div>
            </details>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">End-of-mesocycle review</h3>
        {data.reviews.length > 0 ? data.reviews.map((review) => <ReviewCard key={review.id} review={review} />) : (
          <p className="text-sm text-slate-500">Create a mesocycle to unlock actual vs target volume and performance review.</p>
        )}
      </div>
    </Card>
  );
}
