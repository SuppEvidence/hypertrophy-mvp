import { z } from "zod";
import {
  designSchema,
  designSchemaForCatalogue,
  type DesignReferences,
  type MesocycleDesign,
} from "./schema";

const metadata = designSchema.omit({
  version: true,
  sessions: true,
  summary: true,
  changes: true,
});
// Explicit null means retain the current value; [] deliberately clears an array.
const nullableFields = Object.fromEntries(
  Object.entries(metadata.shape).map(([key, value]) => [key, value.nullable()]),
) as {
  [K in keyof typeof metadata.shape]: z.ZodNullable<(typeof metadata.shape)[K]>;
};
export const designRevisionSchema = z.object({
  summary: designSchema.shape.summary,
  changes: designSchema.shape.changes,
  fields: z.object(nullableFields),
  changedSessions: z.array(designSchema.shape.sessions.element).max(7),
  removedSessionKeys: z.array(z.string().min(1).max(60)).max(7),
});
export function revisionSchemaForCatalogue(refs: DesignReferences) {
  const full = designSchemaForCatalogue(refs);
  return designRevisionSchema.extend({
    fields: designRevisionSchema.shape.fields.extend({
      priorities: full.shape.priorities.nullable(),
      spacing: full.shape.spacing.nullable(),
      libraryGaps: full.shape.libraryGaps.nullable(),
    }),
    changedSessions: z.array(full.shape.sessions.element).max(7),
  });
}
export function applyDesignRevision(
  previous: MesocycleDesign,
  raw: unknown,
): MesocycleDesign {
  const patch = designRevisionSchema.parse(raw);
  const keys = patch.changedSessions.map((s) => s.key);
  if (
    new Set(keys).size !== keys.length ||
    new Set(patch.removedSessionKeys).size !== patch.removedSessionKeys.length
  )
    throw new Error(
      "Coach returned duplicate session changes. Previous draft retained.",
    );
  if (
    patch.removedSessionKeys.some(
      (key) =>
        keys.includes(key) || !previous.sessions.some((s) => s.key === key),
    )
  )
    throw new Error(
      "Coach returned an invalid session removal. Previous draft retained.",
    );
  const changes = new Map(patch.changedSessions.map((s) => [s.key, s]));
  const sessions = previous.sessions
    .filter((s) => !patch.removedSessionKeys.includes(s.key))
    .map((s) => changes.get(s.key) ?? s);
  sessions.push(
    ...patch.changedSessions.filter(
      (s) => !previous.sessions.some((old) => old.key === s.key),
    ),
  );
  return designSchema.parse({
    ...previous,
    ...Object.fromEntries(
      Object.entries(patch.fields).filter(([, value]) => value !== null),
    ),
    summary: patch.summary,
    changes: patch.changes,
    sessions,
  });
}

/** Keep all choices discoverable; expand mechanics only for the current plan/focus. */
export function revisionCatalogue(
  refs: DesignReferences,
  previous: MesocycleDesign,
  focusIds: string[],
) {
  const selected = new Set(
    previous.sessions.flatMap((s) => s.items.map((i) => i.exerciseId)),
  );
  const focus = new Set([
    ...focusIds,
    ...previous.priorities
      .filter((p) => p.priority === "SPECIALIZE" || p.priority === "GROW")
      .map((p) => p.muscleId),
  ]);
  return {
    ...refs,
    exercises: refs.exercises.map((e) =>
      selected.has(e.id) || e.primaryMuscleIds.some((id) => focus.has(id))
        ? e
        : { ...e, mechanics: null, mechanicsOmitted: true },
    ),
    limits:
      "All available exercises and preferences are listed. Detailed mechanics are expanded for current exercises and focus muscles only. Omitted mechanics are unknown: do not assert regional emphasis or resistance profile from names alone; retain uncertainty or request exercise-coach assessment.",
  };
}

export const DESIGN_REVISION_POLICY = `REVISION MODE overrides the full-draft output instruction: return only a patch. fields uses null to retain each existing value; an empty array clears it. changedSessions contains complete replacements ONLY for changed sessions (or new sessions), using stable keys; removedSessionKeys explicitly removes existing sessions. Unchanged sessions are preserved by the server. For a discussion answer with no agreed changes return empty session changes and null fields. Keep summary as the answer, changes as a concise change log. Start from the supplied current draft including manual edits, preserve locked items and their weekday. Check the whole schedule for consequences, but do not restate unchanged prescriptions or reconsider established reasoning without new evidence, changed brief, or the user's request. Evidence is freshly summarized, not a promise that omitted raw history is unchanged. Earlier discussion is represented by the current draft; recentDiscussion is only recent context. Never assume access to omitted messages.`;
