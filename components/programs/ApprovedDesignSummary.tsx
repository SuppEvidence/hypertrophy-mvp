import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { approvedDesignContext } from "@/lib/mesocycle-design/handoff";
export function ApprovedDesignSummary({
  value,
  startDate,
  lengthWeeks,
  now,
}: {
  value: unknown;
  startDate: Date;
  lengthWeeks: number;
  now: number;
}) {
  const intent = approvedDesignContext(value);
  if (!intent || !("reviewAfterWeeks" in intent)) return null;
  const review = new Date(startDate);
  review.setUTCDate(review.getUTCDate() + intent.reviewAfterWeeks * 7);
  const due = review.getTime() <= now;
  return (
    <Card>
      <h2 className="font-semibold">Approved mesocycle intent</h2>
      <p className="mt-2 text-sm">{intent.goals}</p>
      <p className="mt-2 text-sm text-orange-200">
        {due ? "Review checkpoint reached" : "Review checkpoint"}:{" "}
        {review.toISOString().slice(0, 10)} · current block {lengthWeeks} weeks
      </p>
      <p className="mt-2 text-sm text-slate-400">{intent.progression}</p>
      <details className="mt-3 text-sm">
        <summary>Success and adjustment criteria</summary>
        {intent.successCriteria.map((c, i) => (
          <p className="mt-2" key={`s${i}`}>
            {c}
          </p>
        ))}
        {intent.adjustmentCriteria.map((c, i) => (
          <p className="mt-2" key={`a${i}`}>
            {c}
          </p>
        ))}
        <p className="mt-2">
          Restrictions: {intent.restrictions || "None specified"}
        </p>
      </details>
      <p className="mt-3 text-xs text-slate-400">
        Use volume review to discuss dose, or plan the next mesocycle to revisit structure and duration. Date
        changes remain manual; weekly adaptations do not rewrite this baseline.
      </p>
      <Link
        href="/ai-analysis/volume"
        className="mt-3 mr-4 inline-block text-sm text-orange-300"
      >
        Review current dose
      </Link>
      <Link
        href="/plan/blocks?tab=next"
        className="mt-3 inline-block text-sm text-orange-300"
      >
        Open saved designs
      </Link>
    </Card>
  );
}
