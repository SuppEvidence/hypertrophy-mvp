import { NextMesocycleDesign } from "@/components/programs/NextMesocycleDesign";
import { ApprovedDesignSummary } from "@/components/programs/ApprovedDesignSummary";
import { ReviewProgress } from "@/components/coaching/ReviewProgress";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { MesocyclePanel } from "@/components/programs/MesocyclePanel";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { generateAdvisorMesocycleRecommendationAction } from "@/lib/server/ai-advisor-actions";
import { getCurrentMesocycleRecommendationForUser } from "@/lib/server/ai-mesocycle-recommendations";
import { getMesocyclePanelData } from "@/lib/server/mesocycles";

export const maxDuration = 300;

export default async function MesocyclePlanningPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    overlap?: string;
    saved?: string;
    tab?: string;
    id?: string;
    program?: string;
  }>;
}) {
  const [userId, query] = await Promise.all([requireUserId(), searchParams]);
  const program = await prisma.program.findFirst({
    where: { userId, isActive: true, isArchived: false },
    select: { id: true, name: true },
  });
  const tab =
    query.tab === "next" || query.id || query.saved || query.overlap
      ? "next"
      : query.tab === "history"
        ? "history"
        : "current";
  const historyPrograms =
    tab === "history"
      ? await prisma.program.findMany({
          where: {
            userId,
            isArchived: false,
            mesocycles: { some: { isArchived: false } },
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true },
        })
      : [];
  const selectedProgram =
    tab === "history"
      ? (historyPrograms.find((p) => p.id === query.program) ??
        historyPrograms.find((p) => p.id === program?.id) ??
        historyPrograms[0])
      : program;
  const [data, review] = await Promise.all([
    selectedProgram ? getMesocyclePanelData(selectedProgram.id) : null,
    tab === "next" && program
      ? getCurrentMesocycleRecommendationForUser(userId)
      : null,
  ]);
  const activeId =
    tab === "current"
      ? data?.mesocycles.find((m) => m.status === "ACTIVE")?.id
      : null;
  const designedBlock = activeId
    ? await prisma.programMesocycle.findFirst({
        where: { id: activeId, userId },
        select: { approvedDesign: true, startDate: true, lengthWeeks: true },
      })
    : null;
  const ready = Boolean(
    review?.checkinStatus?.comparable && review.completedWorkoutsInBlock,
  );

  return (
    <div className="space-y-5">
      <Link
        href="/plan"
        className="text-sm font-semibold text-orange-300 hover:text-orange-200"
      >
        ← Plan
      </Link>
      <PageHeader
        title="Mesocycle planner"
        description="Manage the current block, design the next one with the coach, and review past mesocycles."
      />
      <nav aria-label="Mesocycle planner" className="flex flex-wrap gap-2">
        {(
          [
            { key: "current", label: "Current mesocycle" },
            { key: "next", label: "Plan next mesocycle" },
            { key: "history", label: "Past mesocycles" },
          ] as const
        ).map((item) => (
          <Link
            key={item.key}
            href={`/plan/blocks?tab=${item.key}`}
            aria-current={tab === item.key ? "page" : undefined}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${tab === item.key ? "border-orange-400/40 bg-orange-500/10 text-orange-200" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      {tab === "current" ? (
        <div className="flex flex-wrap gap-4 text-sm font-semibold text-orange-300">
          <Link href="/plan/week">Plan this week →</Link>
          <Link href="/ai-analysis/volume">Review current dose →</Link>
          <Link href="/plan/mesocycle">Adjust current structure →</Link>
        </div>
      ) : null}
      {query.error ? (
        <Card className="border-rose-500/30 text-sm text-rose-200">
          {query.error}
        </Card>
      ) : null}
      {query.overlap ? (
        <Card className="border-amber-500/30 text-sm text-amber-200">
          These dates overlap an existing block. Choose a start date after its
          end, or adjust the earlier block.
        </Card>
      ) : null}
      {designedBlock && (
        <ApprovedDesignSummary
          value={designedBlock.approvedDesign}
          startDate={designedBlock.startDate}
          lengthWeeks={designedBlock.lengthWeeks}
          now={new Date().getTime()}
        />
      )}
      {query.saved ? (
        <Card className="border-emerald-500/30 text-sm text-emerald-200">
          Next block saved. It starts automatically on its scheduled date.
        </Card>
      ) : null}

      {tab === "next" && (!program || !data) ? (
        <NextMesocycleDesign id={query.id} />
      ) : null}
      {tab === "history" ? (
        <Card>
          <h2 className="font-semibold text-slate-100">Program history</h2>
          <p className="mt-1 text-sm text-slate-400">
            Choose a program to review its completed mesocycles and outcomes.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            {historyPrograms.map((p) => (
              <Link
                key={p.id}
                href={`/plan/blocks?tab=history&program=${p.id}`}
                aria-current={selectedProgram?.id === p.id ? "page" : undefined}
                className={
                  selectedProgram?.id === p.id
                    ? "text-sm font-semibold text-orange-200 underline"
                    : "text-sm text-slate-400 underline"
                }
              >
                {p.name}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
      {tab === "current" && (!program || !data) ? (
        <Card>
          <p className="font-semibold text-slate-100">No active program</p>
          <p className="mt-1 text-sm text-slate-400">
            Design your next mesocycle with the coach, or activate a saved
            program.
          </p>
          <Link
            href="/plan/blocks?tab=next"
            className="mt-3 mr-4 inline-flex text-sm font-semibold text-orange-300"
          >
            Plan next mesocycle
          </Link>
          <Link
            href="/programs"
            className="mt-3 inline-flex text-sm font-semibold text-orange-300"
          >
            Open programs
          </Link>
        </Card>
      ) : null}
      {tab === "next" && program && data ? (
        <>
          <Card className="space-y-3 border-orange-500/20">
            <div>
              <p className="text-xs font-semibold uppercase text-orange-300">
                Next-block coach · {program.name}
              </p>
              <h2 className="mt-1 font-semibold text-slate-100">
                Manual mesocycle review
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                The review suggests priorities and movement changes. Creating
                the next block is always your choice.
              </p>
            </div>
            {review?.aiRecommendation ? (
              <div className="space-y-2 text-sm text-slate-300">
                <p>
                  Review of {review.name}: {review.aiRecommendation.summary}
                </p>
                {review.aiRecommendation.nextPriorities.map((item) => (
                  <p key={item.muscleName} className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">
                      {item.muscleName}:
                    </span>{" "}
                    {item.suggestedPriority.replaceAll("_", " ").toLowerCase()}{" "}
                    · {item.rationale}
                  </p>
                ))}
                <Link
                  href="/ai-analysis/mesocycle"
                  className="inline-flex text-xs font-semibold text-orange-300"
                >
                  Read full coaching review →
                </Link>
              </div>
            ) : review ? (
              <p className="text-sm text-slate-400">
                {ready
                  ? "Check-ins and completed workouts are ready for review."
                  : review.checkinStatus
                    ? "Save comparable start and end circumference check-ins near the block boundaries and complete at least one workout in the block."
                    : "Review becomes available near the end of the block. You can schedule the next mesocycle at any time."}
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Create a first block to begin collecting evidence for a later
                review.
              </p>
            )}
            {ready && !review?.aiRecommendation ? (
              <form action={generateAdvisorMesocycleRecommendationAction}>
                <input
                  type="hidden"
                  name="returnTo"
                  value="/plan/blocks?tab=next"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  pendingText="Reviewing…"
                >
                  Run next-block review
                </Button>
                <ReviewProgress label="Reviewing next block…" />
              </form>
            ) : null}
            {!ready && review ? (
              <Link
                href="/metrics?logType=MESOCYCLE_CHECKIN"
                className="text-xs font-semibold text-orange-300"
              >
                Open metrics check-in
              </Link>
            ) : null}
          </Card>
          <NextMesocycleDesign id={query.id} />
          <MesocyclePanel data={data} view="next" />
        </>
      ) : null}
      {tab === "current" && data ? (
        <MesocyclePanel data={data} view="current" />
      ) : null}
      {tab === "history" && data ? (
        <MesocyclePanel
          data={{
            ...data,
            reviews: data.reviews.filter((r) =>
              data.mesocycles.some(
                (m) => m.id === r.id && m.status === "COMPLETED",
              ),
            ),
          }}
          view="history"
        />
      ) : null}
      {tab === "history" && !data ? (
        <Card>
          <p className="text-sm text-slate-400">
            No mesocycle history yet. Completed blocks will appear here.
          </p>
        </Card>
      ) : null}
    </div>
  );
}
