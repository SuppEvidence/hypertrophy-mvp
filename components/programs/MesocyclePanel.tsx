import Link from "next/link";
import {
  archiveMesocycle,
  createMesocycle,
  endMesocycle,
  updateMesocycle,
  updateMesocycleMovementRepPolicies,
  updateMesocycleMovementVolumeTargets,
  updateMesocycleVolumeTargets,
} from "@/lib/server/mesocycles";
import { phaseOptions } from "@/lib/programs/options";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";

type MesocycleStatus = "ACTIVE" | "UPCOMING" | "COMPLETED";

type Mesocycle = {
  id: string;
  name: string;
  phase: string;
  status: MesocycleStatus;
  startDate: string;
  endDate: string;
  plannedEndDate: string;
  actualEndDate: string | null;
  endedEarly: boolean;
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
  plannedEndDate: string;
  endedEarly: boolean;
  durationDays: number;
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

const selectClass = "min-h-12 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-orange-400/80";
const textareaClass = "min-h-24 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-base text-slate-100 outline-none focus:border-orange-400/80";

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function earliestDate(first: string, second: string) {
  return first < second ? first : second;
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
      <div>
        <h3 className="font-semibold text-slate-100">{mesocycle ? "Block settings" : "Create a mesocycle block"}</h3>
        <p className="mt-1 text-xs text-slate-500">
          {mesocycle
            ? "Dates and phase define this temporary block. Program structure remains unchanged."
            : "Create the date range first. Program defaults are inherited automatically."}
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Mesocycle name" name="name" defaultValue={mesocycle?.name ?? "New mesocycle"} required />
        <PhaseSelect defaultValue={mesocycle?.phase ?? activePhase} />
        <Field label="Start date" name="startDate" type="date" defaultValue={mesocycle?.startDate ?? todayInputValue()} required />
        <Field label="Planned length (weeks)" name="lengthWeeks" type="number" min="1" max="52" defaultValue={mesocycle?.lengthWeeks ?? 4} required />
      </div>
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Block notes</span>
        <textarea name="notes" defaultValue={mesocycle?.notes ?? ""} className={textareaClass} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary">{mesocycle ? "Save block settings" : "Create mesocycle"}</Button>
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

function EndMesocycleForm({ mesocycle }: { mesocycle: Mesocycle }) {
  const today = todayInputValue();
  const latestAllowedDate = earliestDate(today, mesocycle.plannedEndDate);

  return (
    <details className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-amber-200">End active mesocycle early</summary>
      <form action={endMesocycle.bind(null, mesocycle.id)} className="mt-3 space-y-3">
        <p className="text-xs leading-5 text-amber-100/70">
          This stops the mesocycle overlay after the selected date. The original planned end date stays stored, and the review is scaled to the actual active duration.
        </p>
        <Field
          label="Actual end date"
          name="actualEndDate"
          type="date"
          min={mesocycle.startDate}
          max={latestAllowedDate}
          defaultValue={latestAllowedDate}
          required
        />
        <Button type="submit" variant="danger" pendingText="Ending…" className="w-full">End mesocycle</Button>
      </form>
    </details>
  );
}

function MesocycleTargetsForm({ mesocycle, muscles, programTargets }: { mesocycle: Mesocycle; muscles: Array<{ id: string; name: string }>; programTargets: Array<{ muscleId: string; weeklyTargetSets: number }> }) {
  const targetMap = new Map(mesocycle.volumeTargets.map((target) => [target.muscleId, target]));
  const fallbackMap = new Map(programTargets.map((target) => [target.muscleId, target.weeklyTargetSets]));

  return (
    <form action={updateMesocycleVolumeTargets.bind(null, mesocycle.id)} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div>
        <h4 className="font-semibold text-slate-100">Muscle-target exceptions</h4>
        <p className="mt-1 text-xs text-slate-500">Optional weekly overrides. Leave a target blank to inherit the program baseline shown below it.</p>
      </div>
      <div className="space-y-2">
        {muscles.map((muscle) => {
          const target = targetMap.get(muscle.id);
          return (
            <div key={muscle.id} className="grid grid-cols-[1fr_90px_auto] items-end gap-2 rounded-xl border border-slate-800 p-2">
              <div>
                <p className="text-sm font-semibold text-slate-200">{muscle.name}</p>
                <p className="text-xs text-slate-500">Inherited: {fallbackMap.get(muscle.id) ?? 0} sets/wk</p>
              </div>
              <Field label="Override / wk" name={`target:${muscle.id}`} type="number" min="0" max="40" step="0.5" defaultValue={target?.targetSets ?? ""} />
              <input type="hidden" name={`min:${muscle.id}`} value={target?.minimumSets ?? ""} />
              <input type="hidden" name={`max:${muscle.id}`} value={target?.maximumSets ?? ""} />
              <label className="flex min-h-12 flex-col justify-end gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Block priority
                <span className="flex min-h-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-3">
                  <input name={`priority:${muscle.id}`} type="checkbox" defaultChecked={(target?.priorityLevel ?? 0) > 0} className="h-5 w-5" />
                </span>
              </label>
            </div>
          );
        })}
      </div>
      <Button type="submit" variant="secondary" className="w-full">Save muscle exceptions</Button>
    </form>
  );
}

function MesocycleMovementRepPolicyForm({ mesocycle, movementGroups }: { mesocycle: Mesocycle; movementGroups: Array<{ id: string; name: string }> }) {
  const policyMap = new Map(mesocycle.movementRepPolicies.map((policy) => [policy.movementGroupId, policy]));

  return (
    <form action={updateMesocycleMovementRepPolicies.bind(null, mesocycle.id)} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div>
        <h4 className="font-semibold text-slate-100">Movement-pattern rep-range exceptions</h4>
        <p className="mt-1 text-xs text-slate-500">Optional block-specific ranges. Blank rows continue using template and exercise ranges.</p>
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
      <Button type="submit" variant="secondary" className="w-full">Save rep-range exceptions</Button>
    </form>
  );
}

function MesocycleMovementVolumeTargetsForm({ mesocycle, movementGroups }: { mesocycle: Mesocycle; movementGroups: Array<{ id: string; name: string }> }) {
  const targetMap = new Map(mesocycle.movementVolumeTargets.map((target) => [target.movementGroupId, target]));

  return (
    <form action={updateMesocycleMovementVolumeTargets.bind(null, mesocycle.id)} className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <div>
        <h4 className="font-semibold text-slate-100">Movement-pattern review targets</h4>
        <p className="mt-1 text-xs text-slate-500">Optional weekly targets for this block’s movement-pattern review. These do not replace the program’s muscle baselines.</p>
      </div>
      {movementGroups.map((movementGroup) => {
        const target = targetMap.get(movementGroup.id);
        return (
          <div key={movementGroup.id} className="grid grid-cols-[1fr_90px] items-end gap-2 rounded-xl border border-slate-800 p-2">
            <p className="text-sm font-semibold text-slate-200">{movementGroup.name}</p>
            <Field label="Target / wk" name={`target:${movementGroup.id}`} type="number" min="0" max="60" step="0.5" defaultValue={target?.targetSets ?? ""} />
          </div>
        );
      })}
      <Button type="submit" variant="secondary" className="w-full">Save movement targets</Button>
    </form>
  );
}

function StatusBadge({ status }: { status: MesocycleStatus }) {
  const style = status === "ACTIVE"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
    : status === "UPCOMING"
      ? "border-sky-500/30 bg-sky-500/10 text-sky-200"
      : "border-slate-700 bg-slate-900 text-slate-400";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${style}`}>{status.toLowerCase()}</span>;
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
          <p className="mt-1 text-sm text-slate-500">{review.startDate} to {review.endDate} · {review.durationDays} days · {review.sessionCount} sessions</p>
          {review.endedEarly ? <p className="mt-1 text-xs text-amber-300">Ended early · original planned end {review.plannedEndDate}</p> : null}
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
            <span key={row.field}>{row.field.charAt(0).toUpperCase() + row.field.slice(1)}: {row.start ?? "—"} → {row.end ?? "—"}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MesocycleItem({ mesocycle, data }: { mesocycle: Mesocycle; data: Props["data"] }) {
  const summaryEnd = mesocycle.endedEarly
    ? `${mesocycle.endDate} (planned ${mesocycle.plannedEndDate})`
    : mesocycle.endDate;

  return (
    <details open={mesocycle.status === "ACTIVE"} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
      <summary className="cursor-pointer list-none">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-100">{mesocycle.name}</p>
            <p className="mt-1 text-xs text-slate-500">{mesocycle.startDate} to {summaryEnd}</p>
          </div>
          <StatusBadge status={mesocycle.status} />
        </div>
      </summary>

      <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
        <MesocycleForm programId={data.programId} mesocycle={mesocycle} activePhase={data.activePhase} />

        {mesocycle.status === "ACTIVE" ? <EndMesocycleForm mesocycle={mesocycle} /> : null}

        {mesocycle.status === "COMPLETED" ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-slate-300">
            <p className="font-semibold text-emerald-200">Completed block</p>
            <p className="mt-1 text-xs text-slate-500">
              {mesocycle.endedEarly ? `Actual end ${mesocycle.endDate}; planned end ${mesocycle.plannedEndDate}.` : `Completed on ${mesocycle.endDate}.`}
              {" "}The review below uses the effective duration.
            </p>
            <Link
              href={`/metrics?logType=MESOCYCLE_END&date=${mesocycle.endDate}`}
              className="mt-2 inline-flex text-xs font-semibold text-orange-300 hover:text-orange-200"
            >
              Open Metrics for end check-in
            </Link>
          </div>
        ) : null}

        <details className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-200">Optional mesocycle overrides</summary>
          <p className="mt-2 text-xs leading-5 text-slate-500">Use these only for differences from the reusable program foundation. Blank fields inherit program or template values.</p>
          <div className="mt-3 space-y-3">
            <MesocycleTargetsForm mesocycle={mesocycle} muscles={data.muscles} programTargets={data.programTargets} />
            <MesocycleMovementVolumeTargetsForm mesocycle={mesocycle} movementGroups={data.movementGroups} />
            <MesocycleMovementRepPolicyForm mesocycle={mesocycle} movementGroups={data.movementGroups} />
          </div>
        </details>
      </div>
    </details>
  );
}

export function MesocyclePanel({ data }: Props) {
  const active = data.mesocycles.filter((mesocycle) => mesocycle.status === "ACTIVE");
  const upcoming = data.mesocycles.filter((mesocycle) => mesocycle.status === "UPCOMING");
  const completed = data.mesocycles.filter((mesocycle) => mesocycle.status === "COMPLETED");

  return (
    <Card className="space-y-5 border-orange-500/20">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-300">Mesocycle layer</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-100">Temporary training block</h2>
        <p className="mt-1 text-sm text-slate-400">A mesocycle adds dates, phase, review boundaries, and optional exceptions. It does not duplicate or replace the reusable program and templates.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Inherited from program</p>
          <p className="mt-2 text-sm text-slate-300">Templates, rotation, exercise pools, contribution rules, and baseline weekly muscle targets.</p>
        </div>
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-300">Set per mesocycle</p>
          <p className="mt-2 text-sm text-slate-300">Start, planned length, phase, optional target/range exceptions, and actual end date.</p>
        </div>
      </div>

      <MesocycleForm programId={data.programId} activePhase={data.activePhase} />

      {active.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Active mesocycle</h3>
          {active.map((mesocycle) => <MesocycleItem key={mesocycle.id} mesocycle={mesocycle} data={data} />)}
        </div>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-sky-300">Upcoming</h3>
          {upcoming.map((mesocycle) => <MesocycleItem key={mesocycle.id} mesocycle={mesocycle} data={data} />)}
        </div>
      ) : null}

      {completed.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Completed</h3>
          {completed.map((mesocycle) => <MesocycleItem key={mesocycle.id} mesocycle={mesocycle} data={data} />)}
        </div>
      ) : null}

      <div className="space-y-3 border-t border-slate-800 pt-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Mesocycle review</h3>
        {data.reviews.length > 0 ? data.reviews.map((review) => <ReviewCard key={review.id} review={review} />) : (
          <p className="text-sm text-slate-500">Create a mesocycle to unlock actual vs target volume and performance review.</p>
        )}
      </div>
    </Card>
  );
}
