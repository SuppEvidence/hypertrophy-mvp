import "server-only";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { readVisualAssessment } from "@/lib/physique/policy";
export const physiqueInclude = { photos: { orderBy: { view: "asc" as const } }, metricLog: true } as const;
export type PhysiqueRecord = Awaited<ReturnType<typeof loadPhysiqueRecord>>;
export async function loadPhysiqueRecord(userId: string, id: string) {
  const row = await prisma.physiqueCheckin.findFirst({ where: { id, userId }, include: physiqueInclude });
  if (!row) throw new Error("Photo check-in not found.");
  return row;
}
export function physiqueSignature(row: { id: string; takenOn: Date; notes: string | null; metricLogId: string | null;
  photos: Array<{ id: string; objectPath: string; view: string }>;
  metricLog: { updatedAt: Date; userId: string; isDraft: boolean } | null }) {
  return createHash("sha256").update(JSON.stringify({ id: row.id, date: row.takenOn.toISOString(), notes: row.notes,
    metricLogId: row.metricLogId, metricUpdatedAt: row.metricLog?.updatedAt.toISOString() ?? null,
    photos: [...row.photos].sort((a,b) => a.view.localeCompare(b.view)).map(p => [p.id,p.view,p.objectPath]) })).digest("hex");
}
export function physiqueMetricSnapshot(metric: PhysiqueRecord["metricLog"]) {
  if (!metric || metric.isDraft) return null;
  const keys = ["bodyweight", "waist", "chest", "shoulders", "arms", "thighs", "glutes", "calves"] as const;
  return { metricLogId: metric.id, loggedOn: metric.loggedAt.toISOString().slice(0,10),
    ...Object.fromEntries(keys.map(k => [k, metric[k] == null ? null : Number(metric[k])])) };
}
export async function getPhysiqueEvidence(userId: string, at = new Date()) {
  // Read-only summaries. Never loads image bytes or starts AI work. No future-photo leakage.
  const rows = await prisma.physiqueCheckin.findMany({ where: { userId, takenOn: { lte: at }, acceptedAnalysis: { not: Prisma.DbNull } },
    include: physiqueInclude, orderBy: { takenOn: "desc" }, take: 30 });
  const cache = new Map(rows.map(r => [r.id,r]));
  const accepted = [];
  for (const row of rows) {
    const a = readVisualAssessment(row.acceptedAnalysis);
    if (!a?.acceptedAt || a.signature !== physiqueSignature(row)) continue;
    if (a.comparisonId) {
      const compare = cache.get(a.comparisonId) ?? await prisma.physiqueCheckin.findFirst({ where: { id: a.comparisonId, userId }, include: physiqueInclude });
      if (!compare || compare.takenOn >= row.takenOn || physiqueSignature(compare) !== a.comparisonSignature) continue;
    }
    accepted.push({ takenOn: a.takenOn, comparedOn: a.comparedOn, assessmentAgeDays: Math.floor((at.getTime()-row.takenOn.getTime())/86400000),
      measurements: physiqueMetricSnapshot(row.metricLog), summary: a.result.summary,
      photoQuality: a.result.photoQuality, regions: a.result.regions, changes: a.result.changes,
      proposedPriorities: a.result.priorities, phaseConsiderationAtThatDate: a.result.phaseConsideration,
      limitations: a.result.limitations });
    if (accepted.length === 4) break;
  }
  return { assessments: accepted, interpretation: "Dated visual context linked to explicit measurements. Historical findings do not establish present condition or causal muscle growth. No accepted visual evidence means unknown." };
}
