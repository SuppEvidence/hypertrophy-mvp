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

export default async function MesocyclePlanningPage({ searchParams }: {
  searchParams: Promise<{ error?: string; overlap?: string; saved?: string }>;
}) {
  const [userId, query] = await Promise.all([requireUserId(), searchParams]);
  const program = await prisma.program.findFirst({
    where: { userId, isActive: true, isArchived: false },
    select: { id: true, name: true },
  });
  const [data, review] = program ? await Promise.all([
    getMesocyclePanelData(program.id), getCurrentMesocycleRecommendationForUser(userId),
  ]) : [null, null];
  const ready = Boolean(review?.checkinStatus?.comparable && review.completedWorkoutsInBlock);

  return (
    <div className="space-y-5">
      <Link href="/plan" className="text-sm font-semibold text-orange-300 hover:text-orange-200">← Plan</Link>
      <PageHeader title="Mesocycle planning" description="Review the closing block and schedule the next one before it starts." />
      {query.error ? <Card className="border-rose-500/30 text-sm text-rose-200">{query.error}</Card> : null}
      {query.overlap ? <Card className="border-amber-500/30 text-sm text-amber-200">These dates overlap an existing block. Choose a start date after its end, or adjust the earlier block.</Card> : null}
      {query.saved ? <Card className="border-emerald-500/30 text-sm text-emerald-200">Next block saved. It starts automatically on its scheduled date.</Card> : null}

      {!program || !data ? (
        <Card>
          <p className="font-semibold text-slate-100">No active program</p>
          <p className="mt-1 text-sm text-slate-400">Activate a program before scheduling a mesocycle.</p>
          <Link href="/programs" className="mt-3 inline-flex text-sm font-semibold text-orange-300">Open programs</Link>
        </Card>
      ) : (
        <>
          <Card className="space-y-3 border-orange-500/20">
            <div>
              <p className="text-xs font-semibold uppercase text-orange-300">Next-block coach · {program.name}</p>
              <h2 className="mt-1 font-semibold text-slate-100">Manual mesocycle review</h2>
              <p className="mt-1 text-sm text-slate-400">The review suggests priorities and movement changes. Creating the next block is always your choice.</p>
            </div>
            {review?.aiRecommendation ? (
              <div className="space-y-2 text-sm text-slate-300">
                <p>Review of {review.name}: {review.aiRecommendation.summary}</p>
                {review.aiRecommendation.nextPriorities.map((item) => (
                  <p key={item.muscleName} className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-200">{item.muscleName}:</span> {item.suggestedPriority.replaceAll("_", " ").toLowerCase()} · {item.rationale}
                  </p>
                ))}
                <Link href="/ai-analysis/mesocycle" className="inline-flex text-xs font-semibold text-orange-300">Read full coaching review →</Link>
              </div>
            ) : review ? (
              <p className="text-sm text-slate-400">
                {ready ? "Check-ins and completed workouts are ready for review." : review.checkinStatus
                  ? "Save comparable start and end circumference check-ins near the block boundaries and complete at least one workout in the block."
                  : "Review becomes available near the end of the block. You can schedule the next mesocycle at any time."}
              </p>
            ) : <p className="text-sm text-slate-400">Create a first block to begin collecting evidence for a later review.</p>}
            {ready && !review?.aiRecommendation ? (
              <form action={generateAdvisorMesocycleRecommendationAction}>
                <input type="hidden" name="returnTo" value="/plan/blocks" />
                <Button type="submit" variant="secondary" pendingText="Reviewing…">Run next-block review</Button>
              </form>
            ) : null}
            {!ready && review ? <Link href="/metrics?logType=MESOCYCLE_CHECKIN" className="text-xs font-semibold text-orange-300">Open metrics check-in</Link> : null}
          </Card>
          <MesocyclePanel data={data} />
        </>
      )}
    </div>
  );
}
