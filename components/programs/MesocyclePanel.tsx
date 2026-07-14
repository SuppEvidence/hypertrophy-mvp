import {
  archiveMesocycle,
  createMesocycle,
  updateMesocycle,
  updateMesocycleMovementRepPolicies,
  updateMesocycleMovementVolumeTargets,
  updateMesocycleRepPolicies,
  updateMesocycleVolumeTargets,
} from "@/lib/server/mesocycles";
import { phaseOptions } from "@/lib/programs/options";
import { repBuckets } from "@/lib/planning/mesocycleGenerator";
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
  volumeTargets: Array<{
    muscleId: string;
    targetSets: number;
    minimumSets: number | null;
    maximumSets: number | null;
    priorityLevel: number;
  }>;
  repPolicies: Array<{ repBucket: string; minReps: number; maxReps: number }>;
  movementRepPolicies: Array<{ movementGroupId: string; minReps: number; maxReps: number }>;
  movementVolumeTargets: Array<{ movementGroupId: string; targetSets: number }>;
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
    planned: number;
    target: number;
    completed: number;
    productive: number;
    adherence: number | null;
    status: string;
    isPriority: boolean;
  }>;
  movementVolume: Array<{
    movementGroupId: string;
    movementGroupName: string;
    target: number;
    planned: number;
    completed: number;
    productive: number;
    adherence: number | null;
    status: string;
  }>;
  effort: { tooEasy: number; productive: number; veryHard: number; failure: number; notSure: number };
  repRange: { inRange: number; tooLow: number; tooHigh: number; mixed: number; notLogged: number };
  metrics: {
    startBodyweight7d: number | null;
    endBodyweight7d: number | null;
    startWaist7d: number | null;
    endWaist7d: number | null;
    circumferences: Array<{ field: string; start: number | null; end: number | null }>;
  };
  performance: { up: number; flat: number; down: number };
  recommendation: string;
};

type Props = {
  data: {
    programId: string;
    activePhase: string;
    muscles: Array<{ id: string; name: string }>;
    movementGroups: Array<{ id: string; name: string }>;
    programTargets: Array<{ muscleId: string; weeklyTargetSets: number }>;
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
          <Button
            type="submit"
            formAction={archiveMesocycle}
            name="mesocycleId"
            value={mesocycle.id}
            variant="ghost"
            pendingText="Archiving…"
          >
            Archive
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function MesocycleTargetsForm({ mesocycle, muscles, programTargets }: { mesocycle: Mesocycle; muscles: Array<{ id: string; name: string }>; programTargets: Array<{ muscleId: string; weeklyTargetSets: number }> }) {
  const targetMap = new Map(mesocycle.volumeTargets.map((target) => [target.muscleId, target]));
  const fallbackMap = new Map(programTargets.map((target) => [target.muscleId, target.weeklyTargetSets]));

  return (
    <form action={updateMesocycleVolumeTargets.bind(null, mesocycle.id)} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div>
        <h4 className="font-semibold text-slate-100">Mesocycle volume targets</h4>
        <p className="mt-1 text-xs text-slate-500">Weekly targets. Blank rows fall back to program-level targets.</p>
      </div>
      <div className="space-y-2">
        {muscles.map((muscle) => {
          const target = targetMap.get(muscle.id);
          return (
            <div key={muscle.id} className="grid grid-cols-[1fr_70px_70px_70px_auto] items-end gap-2 rounded-xl border border-slate-800 p-2">
              <div>
                <p className="text-sm font-semibold text-slate-200">{muscle.name}</p>
                <p className="text-xs text-slate-500">Program {fallbackMap.get(muscle.id) ?? 0}/wk</p>
              </div>
              <Field label="Target" name={`target:${muscle.id}`} type="number" min="0" max="40" step="0.5" defaultValue={target?.targetSets ?? ""} />
              <Field label="Min" name={`min:${muscle.id}`} type="number" min="0" max="40" step="0.5" defaultValue={target?.minimumSets ?? ""} />
              <Field label="Max" name={`max:${muscle.id}`} type="number" min="0" max="50" step="0.5" defaultValue={target?.maximumSets ?? ""} />
              <label className="flex min-h-12 flex-col justify-end gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Priority
                <span className="flex min-h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-3">
                  <input name={`priority:${muscle.id}`} type="checkbox" defaultChecked={(target?.priorityLevel ?? 0) > 0} className="h-5 w-5" />
                </span>
              </label>
            </div>
          );
        })}
      </div>
      <Button type="submit" variant="secondary" className="w-full">Save volume targets</Button>
    </form>
  );
}

function MesocycleRepPolicyForm({ mesocycle }: { mesocycle: Mesocycle }) {
  const policyMap = new Map(mesocycle.repPolicies.map((policy) => [policy.repBucket, policy]));

  return (
    <form action={updateMesocycleRepPolicies.bind(null, mesocycle.id)} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div>
        <h4 className="font-semibold text-slate-100">Rep bucket policy</h4>
        <p className="mt-1 text-xs text-slate-500">Blank rows fall back to template exercise rep ranges.</p>
      </div>
      {repBuckets.map((bucket) => {
        const policy = policyMap.get(bucket.value);
        return (
          <div key={bucket.value} className="grid grid-cols-[1fr_80px_80px] items-end gap-2 rounded-xl border border-slate-800 p-2">
            <div>
              <p className="text-sm font-semibold text-slate-200">{bucket.label}</p>
              <p className="text-xs text-slate-500">Default {bucket.defaultMin}-{bucket.defaultMax}</p>
            </div>
            <Field label="Min" name={`min:${bucket.value}`} type="number" min="1" max="100" defaultValue={policy?.minReps ?? ""} />
            <Field label="Max" name={`max:${bucket.value}`} type="number" min="1" max="100" defaultValue={policy?.maxReps ?? ""} />
          </div>
        );
      })}
      <Button type="submit" variant="secondary" className="w-full">Save rep policy</Button>
    </form>
  );
}

function MesocycleMovementRepPolicyForm({ mesocycle, movementGroups }: { mesocycle: Mesocycle; movementGroups: Array<{ id: string; name: string }> }) {
  const policyMap = new Map(mesocycle.movementRepPolicies.map((policy) => [policy.movementGroupId, policy]));

  return (
    <form action={updateMesocycleMovementRepPolicies.bind(null, mesocycle.id)} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div>
        <h4 className="font-semibold text-slate-100">Movement-pattern rep policy</h4>
        <p className="mt-1 text-xs text-slate-500">Overrides rep buckets for the selected movement pattern. Blank rows fall back to bucket/template/exercise defaults.</p>
      </div>
      {movementGroups.map((movementGroup) => {
        const policy = policyMap.get(movementGroup.id);
        return (
          <div key={movementGroup.id} className="grid grid-cols-[1fr_80px_80px] items-end gap-2 rounded-xl border border-slate-800 p-2">
            <p className="text-sm font-semibold text-slate-200">{movementGroup.name}</p>
            <Field label="Min" name={`min:${movementGroup.id}`} type="number" min="1" max="100" defaultValue={policy?.minReps ?? ""} />
            <Field label="Max" name={`max:${movementGroup.id}`} type="number" min="1" max="100" defaultValue={policy?.maxReps ?? ""} />
          </div>
        );
      })}
      <Button type="submit" variant="secondary" className="w-full">Save movement rep policy</Button>
    </form>
  );
}

function MesocycleMovementVolumeTargetsForm({ mesocycle, movementGroups }: { mesocycle: Mesocycle; movementGroups: Array<{ id: string; name: string }> }) {
  const targetMap = new Map(mesocycle.movementVolumeTargets.map((target) => [target.movementGroupId, target]));

  return (
    <form action={updateMesocycleMovementVolumeTargets.bind(null, mesocycle.id)} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div>
        <h4 className="font-semibold text-slate-100">Movement-pattern volume targets</h4>
        <p className="mt-1 text-xs text-slate-500">Weekly target sets by movement pattern. Used for review now and set adjustment later.</p>
      </div>
      {movementGroups.map((movementGroup) => {
        const target = targetMap.get(movementGroup.id);
        return (
          <div key={movementGroup.id} className="grid grid-cols-[1fr_90px] items-end gap-2 rounded-xl border border-slate-800 p-2">
            <p className="text-sm font-semibold text-slate-200">{movementGroup.name}</p>
            <Field label="Target" name={`target:${movementGroup.id}`} type="number" min="0" max="60" step="0.5" defaultValue={target?.targetSets ?? ""} />
          </div>
        );
      })}
      <Button type="submit" variant="secondary" className="w-full">Save movement targets</Button>
    </form>
  );
}

function StatusTone({ status }: { status: string }) {
  return <span className={status === "below" ? "text-amber-300" : status === "above" ? "text-sky-300" : "text-slate-300"}>{status}</span>;
}

function ReviewCard({ review }: { review: Review }) {
  const muscleRows = review.volume.slice(0, 8);
  const movementRows = review.movementVolume.slice(0, 8);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-100">{review.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{review.startDate} to {review.endDate} · {review.sessionCount} sessions</p>
        </div>
        <div className="rounded-xl border border-slate-800 px-3 py-2 text-sm text-slate-300">
          Performance detail: {review.performance.up} up / {review.performance.flat} flat / {review.performance.down} down
        </div>
      </div>

      <p className="mt-3 rounded-xl bg-slate-900 p-3 text-sm text-slate-300">{review.recommendation}</p>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Volume by muscle</h4>
          {muscleRows.length > 0 ? muscleRows.map((row) => (
            <div key={row.muscleId} className="rounded-xl border border-slate-800 p-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className={row.isPriority ? "font-semibold text-slate-100" : "text-slate-300"}>{row.muscleName}{row.isPriority ? " · priority" : ""}</span>
                <StatusTone status={row.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">target {row.target} · planned {row.planned} · completed {row.completed} · productive equiv. {row.productive}{row.adherence !== null ? ` · ${row.adherence}%` : ""}</p>
            </div>
          )) : <p className="text-sm text-slate-500">No muscle volume yet.</p>}
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Volume by movement pattern</h4>
          {movementRows.length > 0 ? movementRows.map((row) => (
            <div key={row.movementGroupId} className="rounded-xl border border-slate-800 p-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-300">{row.movementGroupName}</span>
                <StatusTone status={row.status} />
              </div>
              <p className="mt-1 text-xs text-slate-500">target {row.target} · planned {row.planned} · completed {row.completed} · productive equiv. {row.productive}{row.adherence !== null ? ` · ${row.adherence}%` : ""}</p>
            </div>
          )) : <p className="text-sm text-slate-500">No movement-pattern volume yet.</p>}
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 p-3 text-sm text-slate-300">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Effort distribution</h4>
          <p className="mt-2">Too easy {review.effort.tooEasy} · Productive {review.effort.productive} · Very hard {review.effort.veryHard} · Failure {review.effort.failure} · Not sure {review.effort.notSure}</p>
        </div>
        <div className="rounded-xl border border-slate-800 p-3 text-sm text-slate-300">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rep range quality</h4>
          <p className="mt-2">In range {review.repRange.inRange} · Low {review.repRange.tooLow} · High {review.repRange.tooHigh} · Mixed {review.repRange.mixed} · Not logged {review.repRange.notLogged}</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-800 p-3 text-sm text-slate-300">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Metrics</h4>
        <p className="mt-2">BW 7d: {review.metrics.startBodyweight7d ?? "—"} → {review.metrics.endBodyweight7d ?? "—"} kg · Waist 7d: {review.metrics.startWaist7d ?? "—"} → {review.metrics.endWaist7d ?? "—"} mm</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 md:grid-cols-3">
          {review.metrics.circumferences.map((row) => (
            <span key={row.field}>{row.field}: {row.start ?? "—"} → {row.end ?? "—"}</span>
          ))}
        </div>
      </div>
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
                <div className="mt-3 space-y-3">
                  <MesocycleTargetsForm mesocycle={mesocycle} muscles={data.muscles} programTargets={data.programTargets} />
                  <MesocycleMovementVolumeTargetsForm mesocycle={mesocycle} movementGroups={data.movementGroups} />
                  <MesocycleMovementRepPolicyForm mesocycle={mesocycle} movementGroups={data.movementGroups} />
                  <MesocycleRepPolicyForm mesocycle={mesocycle} />
                </div>
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
