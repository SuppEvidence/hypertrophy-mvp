import type { ProgrammingOption, ProgrammingRecommendations } from "../ai/programming-decision-schema";
import { nextT3CoachTarget, T3_RANGE_CEILING, type T3MusclePriority } from "./t3-volume-policy";

export type CandidatePattern = {
  movementPatternId: string;
  movementPatternName: string;
  primaryExerciseCount: number;
  secondaryExerciseCount: number;
  availableExerciseTypes: ("COMPOUND" | "ISOLATION")[];
  exampleExercises: string[];
};
export type DecisionValidationContext = {
  validMuscleIds: Set<string>;
  canonicalMuscleNames: Map<string, string>;
  validPatternsByMuscle: Map<string, Map<string, CandidatePattern>>;
  targetByMuscle: Map<string, {
    target: number | null; minimum: number | null; maximum: number | null;
    priority: T3MusclePriority;
  }>;
  currentMovementSets: Map<string, number>;
};

function validateOption(option: ProgrammingOption, muscleId: string,
  assessment: ProgrammingRecommendations["assessments"][number],
  validation: DecisionValidationContext) {
  const target = validation.targetByMuscle.get(muscleId)!;
  if (option.action === "INCREASE_VOLUME" && option.deltaWeeklySets <= 0) throw new Error("Increase has no positive dose change");
  if (option.action === "DECREASE_VOLUME" && option.deltaWeeklySets >= 0) throw new Error("Decrease has no negative dose change");
  if (option.action === "REALLOCATE_VOLUME" && option.deltaWeeklySets !== 0) throw new Error("Reallocation changes the muscle target");
  const protectiveReduction = option.action === "DECREASE_VOLUME" && assessment.status === "RECOVERABILITY_CONCERN";
  if ((assessment.confidence === "LOW" || assessment.status === "INSUFFICIENT_EVIDENCE") && !protectiveReduction) {
    throw new Error("Evidence is too uncertain for this change");
  }
  nextT3CoachTarget({
    current: target.target ?? 0, delta: option.deltaWeeklySets,
    minimum: assessment.recommendedRangeMinimum, maximum: assessment.recommendedRangeMaximum,
    priority: target.priority, confidence: assessment.confidence, status: assessment.status,
  });
  const patterns = validation.validPatternsByMuscle.get(muscleId);
  const seen = new Set<string>();
  let added = 0;
  let removed = 0;
  if (!option.movementChanges.length) throw new Error("No movement allocation supplied");
  for (const movement of option.movementChanges) {
    const canonical = patterns?.get(movement.movementPatternId);
    if (!canonical || seen.has(movement.movementPatternId) || movement.deltaSets === 0) throw new Error("Invalid or duplicate movement allocation");
    seen.add(movement.movementPatternId);
    const current = validation.currentMovementSets.get(movement.movementPatternId) ?? 0;
    if (current + movement.deltaSets < -0.05) throw new Error("Removal exceeds the prescribed movement dose");
    if (movement.deltaSets > 0) {
      if (target.priority === "INDIRECT_ONLY") throw new Error("No direct focus cannot introduce new targeted work");
      if (option.preferredExerciseType !== "EITHER" && !canonical.availableExerciseTypes.includes(option.preferredExerciseType)) {
        throw new Error("Requested exercise type is unavailable for an added movement");
      }
      added += movement.deltaSets;
    } else removed -= movement.deltaSets;
    movement.movementPatternName = canonical.movementPatternName;
  }
  if (added > 4 || removed > 6) throw new Error("Movement redistribution is too large for one staged change");
  if (option.action === "REALLOCATE_VOLUME" && (!added || !removed)) throw new Error("Reallocation needs both a source and a destination");
  // Movement effective sets and muscle effective sets differ for secondary work.
  // Feasibility and the actual muscle effect are checked by the planner preview.
}

/** A bad option must not destroy valid assessments for every other muscle. */
export function validateT3Review(input: ProgrammingRecommendations, validation: DecisionValidationContext) {
  const parsed = structuredClone(input);
  const notes: string[] = [];
  const usable = new Set<string>();
  parsed.assessments = [...validation.validMuscleIds].map((muscleId) => {
    const matches = input.assessments.filter((row) => row.muscleId === muscleId);
    const target = validation.targetByMuscle.get(muscleId)!;
    const row = matches[0];
    if (matches.length === 1 && row.priority === target.priority &&
        Number.isFinite(row.recommendedRangeMinimum) && Number.isFinite(row.recommendedRangeMaximum) &&
        row.recommendedRangeMinimum >= 0 && row.recommendedRangeMaximum >= row.recommendedRangeMinimum &&
        row.recommendedRangeMaximum <= T3_RANGE_CEILING) {
      usable.add(muscleId);
      return { ...row, muscleName: validation.canonicalMuscleNames.get(muscleId) ?? row.muscleName };
    }
    const muscleName = validation.canonicalMuscleNames.get(muscleId) ?? muscleId;
    notes.push(`${muscleName}: the returned assessment was incomplete or inconsistent; the previous range was retained.`);
    return {
      muscleId, muscleName, priority: target.priority, status: "INSUFFICIENT_EVIDENCE" as const,
      confidence: "LOW" as const, recommendedRangeMinimum: target.minimum ?? 0,
      recommendedRangeMaximum: target.maximum ?? target.target ?? 0,
      rationale: "Keep the current prescription. This review did not produce a usable assessment for this muscle.", evidence: [],
    };
  });
  if (usable.size === 0) throw new Error("The review returned no usable muscle assessments. Your previous assessment and prescription were retained; retry the review.");
  const seen = new Set<string>();
  parsed.decisions = parsed.decisions.filter((proposal) => {
    if (!usable.has(proposal.targetMuscleId) || seen.has(proposal.targetMuscleId)) {
      notes.push("An unknown, duplicate, or unsupported decision was withheld.");
      return false;
    }
    seen.add(proposal.targetMuscleId);
    proposal.targetMuscleName = validation.canonicalMuscleNames.get(proposal.targetMuscleId)!;
    const assessment = parsed.assessments.find((row) => row.muscleId === proposal.targetMuscleId)!;
    const keys = new Set<string>();
    proposal.options = proposal.options.filter((option) => {
      try {
        if (keys.has(option.optionKey)) throw new Error("Duplicate option");
        keys.add(option.optionKey);
        validateOption(option, proposal.targetMuscleId, assessment, validation);
        return true;
      } catch {
        notes.push(`${proposal.targetMuscleName}: an option did not pass dose/allocation checks and was withheld; keep the current setup.`);
        return false;
      }
    });
    if (!proposal.options.some((option) => option.optionKey === proposal.recommendedOptionKey)) proposal.recommendedOptionKey = "KEEP_AS_IS";
    return proposal.options.length > 0;
  });
  return { parsed, notes: [...new Set(notes)] };
}
