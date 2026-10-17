import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Camera,
  Check,
  ClipboardList,
  Dumbbell,
  Utensils,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { dateLabel, type HomeAction } from "@/lib/dashboard/overview";
import type { HomeDashboardData } from "@/lib/server/home-dashboard";

const quietLink =
  "inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-orange-300 transition hover:text-orange-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-400";
const pill =
  "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold";
const phaseNames: Record<string, string> = {
  CUTTING: "Cutting",
  MAINTAINING: "Maintenance",
  GAINING: "Gaining",
};
function Status({
  children,
  due = false,
}: {
  children: React.ReactNode;
  due?: boolean;
}) {
  return (
    <span
      className={`${pill} ${due ? "border-amber-400/20 bg-amber-400/10 text-amber-200" : "border-slate-700 bg-slate-800/50 text-slate-300"}`}
    >
      {children}
    </span>
  );
}
function ReviewRow({ item }: { item: HomeAction }) {
  return (
    <li className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
      <div className="min-w-0">
        <p className="flex items-start gap-2 text-sm font-semibold text-slate-100">
          <span
            aria-hidden="true"
            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.tone === "due" ? "bg-amber-300" : "bg-slate-500"}`}
          />
          {item.title}
        </p>
        <p className="mt-1 pl-3.5 text-xs leading-5 text-slate-400">
          {item.detail}
        </p>
      </div>
      <Link
        prefetch={false}
        href={item.href}
        className={`${quietLink} shrink-0 pl-3.5 sm:pl-0`}
      >
        {item.label}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </li>
  );
}
function Metric({
  label,
  value,
  unit,
  decimals,
}: {
  label: string;
  value: HomeDashboardData["metrics"]["bodyweight"];
  unit: string;
  decimals: number;
}) {
  const number = (n: number) => n.toFixed(decimals).replace(/\.0$/, "");
  const shown = value.average ?? value.latest;
  const roundedChange =
    value.change === null ? null : Number(value.change.toFixed(decimals));
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-100">
        {shown === null ? "—" : number(shown)}
        {shown !== null && (
          <span className="ml-1.5 text-sm font-normal text-slate-500">
            {unit}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        {value.average !== null
          ? `7-day average · ${value.days} ${value.days === 1 ? "day" : "days"} logged`
          : value.latestOn
            ? `Last logged ${dateLabel(value.latestOn)}`
            : "No saved measurements"}
      </p>
      {roundedChange !== null ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">
          {roundedChange > 0 ? "+" : ""}
          {number(roundedChange)} {unit} vs previous 7 days ·{" "}
          {value.previousDays} days logged
        </p>
      ) : value.average !== null ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">
          More logged days needed for a comparison
        </p>
      ) : null}
      {value.average !== null && value.latestOn && (
        <p className="mt-1 text-xs text-slate-500">
          Latest entry {dateLabel(value.latestOn)}
        </p>
      )}
    </div>
  );
}
export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  const { hero, block, weekly, nutrition, physique } = data;
  const actions = [...data.actions].sort(
    (a, b) => Number(b.tone === "due") - Number(a.tone === "due"),
  );
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${data.today}T12:00:00Z`));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Home" description={date} />
        <Link
          prefetch={false}
          href="/plan/nutrition"
          className="group flex min-h-11 flex-col items-start gap-1 sm:items-end"
        >
          <Status>
            {data.phase ? phaseNames[data.phase.phase] : "Set your phase"}
          </Status>
          {data.phase && (
            <span className="text-[11px] text-slate-500 group-hover:text-slate-300">
              Since {dateLabel(data.phase.startDate)}
              {data.phase.transitionCaution ? " · recent transition" : ""}
            </span>
          )}
        </Link>
      </div>

      <div className={`grid gap-4 ${block ? "xl:grid-cols-[1.35fr_1fr]" : ""}`}>
        <Card className="relative flex flex-col justify-between overflow-hidden border-orange-400/15 bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/20">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-500/[0.07] blur-3xl"
            aria-hidden="true"
          />
          <div className="relative">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-300">
              <Dumbbell size={15} aria-hidden="true" />
              {hero.eyebrow}
            </p>
            <h2 className="mt-3 break-words text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
              {hero.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {hero.detail}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link
                prefetch={false}
                href={hero.href}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-300"
              >
                {hero.action}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              {data.program && hero.kind !== "REVIEW" && (
                <Link prefetch={false} href={weekly.href} className={quietLink}>
                  Weekly plan
                </Link>
              )}
              {!data.program && (
                <Link prefetch={false} href="/programs" className={quietLink}>
                  Existing programs
                </Link>
              )}
            </div>
          </div>
          {data.program && (
            <div className="relative mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.07] pt-3 text-xs text-slate-400">
              <CalendarDays size={14} aria-hidden="true" />
              {weekly.approved && !weekly.needsReview ? (
                <>
                  <span>
                    {weekly.completed}/{weekly.planned} planned sessions
                    complete
                  </span>
                  {weekly.missed > 0 && (
                    <span>· {weekly.missed} marked missed</span>
                  )}
                  {weekly.unallocated > 0 && (
                    <span>· Some work remains unallocated</span>
                  )}
                </>
              ) : (
                <>
                  <span>
                    {weekly.completedSessions} workouts completed this week
                  </span>
                  <span className="text-slate-500">
                    ·{" "}
                    {weekly.draft
                      ? "Weekly proposal saved"
                      : weekly.needsReview
                        ? "Saved week needs review"
                        : "Using program structure"}
                  </span>
                </>
              )}
            </div>
          )}
        </Card>
        {block && (
          <Card className="flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  {block.status === "Current"
                    ? "Current mesocycle"
                    : `${block.status} mesocycle`}
                </p>
                <Status>
                  {block.status === "Current"
                    ? `Week ${block.currentWeek} of ${block.lengthWeeks}`
                    : block.status}
                </Status>
              </div>
              <h2 className="mt-3 break-words text-lg font-semibold text-slate-100">
                {block.name}
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                {dateLabel(block.start)}–{dateLabel(block.end)} ·{" "}
                {block.phaseLabel}
              </p>
              <div
                role="progressbar"
                aria-label="Mesocycle progress"
                aria-valuenow={block.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800"
              >
                <div
                  className="h-full rounded-full bg-orange-400/80"
                  style={{ width: `${block.progress}%` }}
                />
              </div>
              {block.priorities.length > 0 ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs text-slate-500">
                    {block.status === "Current" ? "Current" : "Saved"} muscle
                    priorities
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...block.priorities]
                      .sort(
                        (a, b) =>
                          Number(b.priority === "SPECIALIZE") -
                          Number(a.priority === "SPECIALIZE"),
                      )
                      .slice(0, 4)
                      .map((p) => (
                        <span
                          className={`${pill} ${p.priority === "SPECIALIZE" ? "border-orange-400/20 bg-orange-500/[0.08] text-orange-200" : "border-slate-700 text-slate-300"}`}
                          key={p.name}
                        >
                          {p.name}
                          {p.priority === "SPECIALIZE" ? " · High" : " · Grow"}
                        </span>
                      ))}
                    {block.priorities.length > 4 && (
                      <span className="px-2 py-1 text-xs text-slate-500">
                        +{block.priorities.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Set muscle priorities in the mesocycle planner.
                </p>
              )}
            </div>
            <Link
              prefetch={false}
              href={`/plan/blocks?tab=${block.status === "Completed" ? "history" : "current"}`}
              className={`${quietLink} mt-3`}
            >
              Open mesocycle
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </Card>
        )}
      </div>

      {actions.length > 0 ? (
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList
              size={16}
              className="text-slate-400"
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold text-slate-100">For review</h2>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
              {actions.length}
            </span>
          </div>
          <ul className="divide-y divide-slate-800">
            {actions.slice(0, 3).map((item) => (
              <ReviewRow key={item.id} item={item} />
            ))}
          </ul>
          {actions.length > 3 && (
            <details className="mt-4 border-t border-slate-800 pt-3">
              <summary className="cursor-pointer py-2 text-sm font-medium text-slate-400">
                {actions.length - 3} more saved{" "}
                {actions.length - 3 === 1 ? "follow-up" : "follow-ups"}
              </summary>
              <ul className="mt-3 divide-y divide-slate-800">
                {actions.slice(3).map((item) => (
                  <ReviewRow key={item.id} item={item} />
                ))}
              </ul>
            </details>
          )}
        </Card>
      ) : (
        <p className="flex items-center gap-2 px-1 text-xs text-slate-500">
          <Check size={14} aria-hidden="true" />
          No saved proposals or scheduled reviews waiting.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Utensils
                  size={16}
                  className="text-orange-300"
                  aria-hidden="true"
                />
                Nutrition & phase
              </h2>
              <Status
                due={Boolean(
                  !nutrition.hasDraft &&
                  nutrition.dueOn &&
                  nutrition.dueOn <= data.today,
                )}
              >
                {nutrition.busy
                  ? "Review in progress"
                  : nutrition.hasDraft
                    ? "Saved proposal"
                    : (nutrition.dueLabel ??
                      (nutrition.configured
                        ? "Baseline saved"
                        : "Set up baseline"))}
              </Status>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {nutrition.summary ??
                (nutrition.configured
                  ? "Your diet baseline is saved. Review outcomes with the coach when you are ready."
                  : "Save your usual meals and optional macro estimates, then agree on practical changes with the coach.")}
            </p>
            {nutrition.acceptedOn && (
              <p className="mt-2 text-xs text-slate-500">
                Accepted {dateLabel(nutrition.acceptedOn)}
                {nutrition.hasDraft && nutrition.dueLabel
                  ? ` · ${nutrition.dueLabel}`
                  : ""}
              </p>
            )}
            {nutrition.criteria && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-400">
                  What to assess at review
                </summary>
                <p className="mt-2 text-xs leading-5 text-slate-400">
                  {nutrition.criteria}
                </p>
              </details>
            )}
          </div>
          <Link
            prefetch={false}
            href="/plan/nutrition"
            className={`${quietLink} mt-3`}
          >
            {nutrition.configured ? "Open nutrition coach" : "Set up nutrition"}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </Card>
        <Card className="flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Camera
                  size={16}
                  className="text-orange-300"
                  aria-hidden="true"
                />
                Physique check-ins
              </h2>
              <Status
                due={Boolean(physique.dueOn && physique.dueOn <= data.today)}
              >
                {physique.hasDraft
                  ? "Assessment saved"
                  : (physique.dueLabel ??
                    (physique.takenOn
                      ? "Schedule not set"
                      : "Add baseline photos"))}
              </Status>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {physique.takenOn
                ? `Latest photos: ${dateLabel(physique.takenOn)} · ${physique.photoCount} ${physique.photoCount === 1 ? "view" : "views"}.`
                : "Build a dated visual record alongside your bodyweight and circumference measurements."}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {physique.intervalDays
                ? `Current check-in interval: every ${physique.intervalDays / 7} weeks. Based on your phase${data.phase?.phase === "GAINING" ? " and training level" : ""}.`
                : "Set your phase and photo check-in preferences to establish the schedule."}
            </p>
            {physique.hasDraft && physique.dueLabel && (
              <p className="mt-2 text-xs text-slate-400">
                Photo schedule: {physique.dueLabel.toLowerCase()}
              </p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5">
            <Link prefetch={false} href="/physique" className={quietLink}>
              {physique.takenOn ? "Open photo check-in" : "Add photos"}
              <ArrowRight size={14} aria-hidden="true" />
            </Link>
            {physique.takenOn && (
              <Link
                prefetch={false}
                href={physique.href}
                className="inline-flex min-h-11 items-center text-xs font-medium text-slate-400 hover:text-slate-200"
              >
                Latest check-in
              </Link>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-100">Body trends</h2>
          <Link
            prefetch={false}
            href="/metrics"
            className="inline-flex min-h-11 items-center text-xs font-semibold text-orange-300 hover:text-orange-200"
          >
            Log measurements
            <ArrowRight size={13} className="ml-2" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-5 min-[360px]:grid-cols-2">
          <Metric
            label="Bodyweight"
            value={data.metrics.bodyweight}
            unit="kg"
            decimals={1}
          />
          <Metric
            label="Waist"
            value={data.metrics.waist}
            unit="mm"
            decimals={0}
          />
        </div>
        <p className="mt-4 border-t border-slate-800 pt-3 text-xs leading-5 text-slate-500">
          Read these alongside your visual check-ins and training response.
        </p>
      </Card>
      {block?.volumeSummary && (
        <details className="rounded-2xl border border-slate-800 px-4 py-3">
          <summary className="cursor-pointer py-1 text-sm font-medium text-slate-400">
            Latest saved volume-coach note
            {block.volumeReviewedOn
              ? ` · ${dateLabel(block.volumeReviewedOn)}`
              : ""}
          </summary>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {block.volumeSummary}
          </p>
          <Link
            prefetch={false}
            href="/ai-analysis/volume"
            className={`${quietLink} mt-2`}
          >
            Read full assessment
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </details>
      )}
      <nav
        aria-label="Training tools"
        className="flex flex-wrap gap-x-6 gap-y-1 px-1 text-sm"
      >
        <Link
          prefetch={false}
          href="/exercises"
          className="inline-flex min-h-11 items-center text-slate-400 hover:text-slate-200"
        >
          Exercise library & coach
        </Link>
        <Link
          prefetch={false}
          href="/progress"
          className="inline-flex min-h-11 items-center text-slate-400 hover:text-slate-200"
        >
          Progress history
        </Link>
        <Link
          prefetch={false}
          href="/log/history"
          className="inline-flex min-h-11 items-center text-slate-400 hover:text-slate-200"
        >
          Workout history
        </Link>
      </nav>
    </div>
  );
}
