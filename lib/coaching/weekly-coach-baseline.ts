import { createHash } from "node:crypto";
import { helsinkiDate } from "@/lib/coaching/weekly-coach-calendar";

export type CompletedWeekSession = {
  id: string; date: string; templateId: string | null; physicalSets: number; effectiveSets: number;
  muscles: Record<string, number>; movements: Record<string, number>;
};
export type CompletedWeekBaseline = { signature: string; sessions: CompletedWeekSession[] };

type Session = { id: string; performedAt: Date; templateId: string | null;
  exercises: Array<{ id: string; exerciseId: string; painFlag: boolean; exercise: { movementGroupId: string;
    primaryMuscles: Array<{ muscleId: string }>; secondaryMuscles: Array<{ muscleId: string; contributionEstimate: unknown }> };
    sets: Array<{ id: string; isCompleted: boolean; setTypeId: string; weight: unknown; reps: number | null;
      rir: unknown; painFlag: boolean; setType: { multiplier: unknown } }> }> };

export function completedWeekBaseline(sessions: Session[]): CompletedWeekBaseline {
  const completed = [...sessions].sort((a, b) => a.id.localeCompare(b.id));
  const signatureRows: unknown[] = [];
  const rows = completed.map((session) => {
    let physicalSets = 0;
    let effectiveSets = 0;
    const muscles: Record<string, number> = {};
    const movements: Record<string, number> = {};
    for (const entry of [...session.exercises].sort((a, b) => a.id.localeCompare(b.id))) {
      signatureRows.push([session.id, entry.id, entry.exerciseId, entry.painFlag]);
      for (const set of [...entry.sets].sort((a, b) => a.id.localeCompare(b.id))) {
        signatureRows.push([session.id, session.performedAt.toISOString(), session.templateId, entry.exerciseId,
          set.id, set.isCompleted, set.setTypeId, String(set.setType.multiplier),
          String(set.weight), set.reps, String(set.rir), set.painFlag]);
        if (!set.isCompleted) continue;
        const effective = Number(set.setType.multiplier);
        if (!Number.isFinite(effective) || effective <= 0) continue;
        physicalSets += 1;
        effectiveSets += effective;
        movements[entry.exercise.movementGroupId] = (movements[entry.exercise.movementGroupId] ?? 0) + effective;
        for (const link of entry.exercise.primaryMuscles) muscles[link.muscleId] = (muscles[link.muscleId] ?? 0) + effective;
        for (const link of entry.exercise.secondaryMuscles) muscles[link.muscleId] = (muscles[link.muscleId] ?? 0) + effective * Number(link.contributionEstimate ?? 0);
      }
    }
    signatureRows.push([session.id, session.performedAt.toISOString(), session.templateId]);
    return { id: session.id, date: helsinkiDate(session.performedAt), templateId: session.templateId,
      physicalSets, effectiveSets: Math.round(effectiveSets * 100) / 100, muscles, movements };
  });
  return { signature: createHash("sha256").update(JSON.stringify(signatureRows)).digest("hex"), sessions: rows };
}

export function parseCompletedBaseline(input: unknown): CompletedWeekBaseline | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Partial<CompletedWeekBaseline>;
  return typeof value.signature === "string" && Array.isArray(value.sessions) ? value as CompletedWeekBaseline : null;
}
