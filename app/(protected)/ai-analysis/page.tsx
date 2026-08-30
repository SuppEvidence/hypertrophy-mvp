import type { ReactNode } from "react";
import { analyzeWorkoutAction } from "@/lib/server/ai-workout-analysis";
import {
  generateProgrammingRecommendationsAction,
  selectProgrammingDecisionAction,
} from "@/lib/server/ai-programming-decisions";
import { StoredProgrammingOptionsSchema } from "@/lib/ai/programming-decision-schema";
import { TRAINING_POLICY_VERSION } from "@/lib/ai/training-policy";
import {
  WorkoutAnalysisSchema,
  type WorkoutAnalysis,
} from "@/lib/ai/workout-analysis-schema";
import { requireUserId } from "@/lib/auth/user";
import { prisma } from "@/lib/db/prisma";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type EvidenceReadiness = "NEW" | "EMERGING" | "USEFUL" | "STRONG";

type ExerciseEvidence = {
  performanceExposures: number;
  decayComparableExposures: number;
  rirSupportedExposures: number;
  readiness: EvidenceReadiness;
};

type PatternEvidence = {
  performanceExposures: number;
  historicalExercises: number;
  readiness: EvidenceReadiness;
};

function label(value: string) {
  return value.toLowerCase().replaceAll("_", " ");
}

function readinessFor(exposures: number): EvidenceReadiness {
  if (exposures <= 0) return "NEW";
  if (exposures <= 2) return "EMERGING";
  if (exposures <= 5) return "USEFUL";
  return "STRONG";
}

function patternReadinessFor(exposures: number): EvidenceReadiness {
  if (exposures <= 0) return "NEW";
  if (exposures <= 3) return "EMERGING";
  if (exposures <= 9) return "USEFUL";
  return "STRONG";
}

function progressionClass(value: string) {
  if (value === "POSITIVE") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (value === "STABLE") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  if (value === "MIXED") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  if (value === "NEGATIVE") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function consistencyClass(value: string) {
  if (value === "CONSISTENT") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (value === "MIXED") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  if (value === "DIVERGENT") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function implementationClass(value: string) {
  if (value === "PATTERN_PRODUCTIVE") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (value === "EXERCISE_SPECIFIC_LIMITATION") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  if (value === "PATTERN_WIDE_STALL") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  if (value === "MIXED") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function parseStoredAnalysis(value: unknown): WorkoutAnalysis | null {
  const current = WorkoutAnalysisSchema.safeParse(value);
  if (current.success) return current.data;

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const legacy = WorkoutAnalysisSchema.safeParse({
      ...(value as Record<string, unknown>),
      movementPatternAssessments: [],
    });
    if (legacy.success) return legacy.data;
  }

  return null;
}

function readinessClass(value: EvidenceReadiness) {
  if (value === "STRONG") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (value === "USEFUL") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  if (value === "EMERGING") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function stimulusClass(value: string) {
  if (value === "HIGH") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (value === "MODERATE") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  if (value === "LOW") {
    return "border-slate-700 bg-slate-900 text-slate-300";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function fatigueClass(value: string) {
  if (value === "HIGH") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  if (value === "MODERATE") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  if (value === "LOW") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function decayClass(value: string) {
  if (value === "HIGHER_THAN_USUAL") {
    return "border-rose-400/30 bg-rose-400/10 text-rose-200";
  }
  if (value === "LOWER_THAN_USUAL") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  if (value === "NORMAL_FOR_EXERCISE") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function confidenceClass(value: string) {
  if (value === "HIGH") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (value === "MODERATE") {
    return "border-sky-400/30 bg-sky-400/10 text-sky-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function rirClass(value: string) {
  if (value === "CONSISTENT_WITH_REPORTED_RIR") {
    return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  }
  if (
    value === "LIKELY_CLOSER_TO_FAILURE" ||
    value === "LIKELY_FARTHER_FROM_FAILURE"
  ) {
    return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  }
  return "border-slate-700 bg-slate-900 text-slate-400";
}

function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <span className={`rounded-full border px-2 py-1 text-xs ${className}`}>
      {children}
    </span>
  );
}

function Stage({
  title,
  description,
  active,
}: {
  title: string;
  description: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        active
          ? "border-emerald-400/20 bg-emerald-400/5"
          : "border-slate-800 bg-slate-950"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-100">{title}</p>
        <span
          className={`rounded-full border px-2 py-0.5 text-[11px] ${
            active
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
              : "border-slate-700 text-slate-500"
          }`}
        >
          {active ? "Active" : "Not enabled"}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}


type ProgrammingDecisionRow = {
  id: string;
  generationId: string;
  targetMuscleName: string;
  decisionSummary: string;
  confidence: string;
  evidence: unknown;
  options: unknown;
  recommendedOptionKey: string;
  keepAsIsRationale: string;
  selectedOptionKey: string | null;
  status: string;
  context: unknown;
  policyVersion: string;
  model: string;
  createdAt: Date;
};

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function contextGlobalSummary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const summary = (value as Record<string, unknown>).globalSummary;
  return typeof summary === "string" ? summary : null;
}

function signedSets(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function ProgrammingDecisionCard({
  decision,
}: {
  decision: ProgrammingDecisionRow;
}) {
  const parsedOptions = StoredProgrammingOptionsSchema.safeParse(decision.options);
  const options = parsedOptions.success ? parsedOptions.data : [];
  const evidence = stringArray(decision.evidence);
  const isSelected = decision.status === "SELECTED" && Boolean(decision.selectedOptionKey);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            {decision.targetMuscleName}
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-100">
            {decision.decisionSummary}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Pill className={confidenceClass(decision.confidence)}>
            {label(decision.confidence)} confidence
          </Pill>
          <Pill className="border-slate-700 bg-slate-900 text-slate-400">
            Policy {decision.policyVersion}
          </Pill>
        </div>
      </div>

      {evidence.length > 0 ? (
        <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900/40 p-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Decision evidence
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-400">
            {evidence.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {options.map((option) => {
          const preferred = decision.recommendedOptionKey === option.optionKey;
          const selected = decision.selectedOptionKey === option.optionKey;

          return (
            <div
              key={option.optionKey}
              className={`rounded-xl border p-3 ${
                selected
                  ? "border-emerald-400/30 bg-emerald-400/5"
                  : preferred
                    ? "border-orange-400/30 bg-orange-400/5"
                    : "border-slate-800 bg-slate-900/50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-100">
                  {option.title}
                </p>
                {preferred ? (
                  <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-[10px] font-semibold text-orange-200">
                    AI preferred
                  </span>
                ) : null}
                {selected ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                    Selected
                  </span>
                ) : null}
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <Pill className="border-slate-700 bg-slate-950 text-slate-300">
                  {label(option.action)} · {signedSets(option.deltaWeeklySets)} sets/wk
                </Pill>
                <Pill className="border-slate-700 bg-slate-950 text-slate-300">
                  {label(option.preferredExerciseType)}
                </Pill>
                <Pill className="border-slate-700 bg-slate-950 text-slate-300">
                  {label(option.placementPreference)}
                </Pill>
              </div>

              {option.movementChanges.length > 0 ? (
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  {option.movementChanges.map((movement) => (
                    <p key={`${option.optionKey}-${movement.movementPatternId}`}>
                      {signedSets(movement.deltaSets)} · {movement.movementPatternName}
                    </p>
                  ))}
                </div>
              ) : null}

              <p className="mt-2 text-xs leading-5 text-slate-400">
                {option.rationale}
              </p>
              <p className="mt-2 text-[11px] leading-4 text-slate-500">
                Expected: {option.expectedBenefit}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">
                Main risk: {option.mainRisk}
              </p>

              {!isSelected ? (
                <form action={selectProgrammingDecisionAction} className="mt-3">
                  <input type="hidden" name="decisionId" value={decision.id} />
                  <input type="hidden" name="selectionKey" value={option.optionKey} />
                  <button
                    type="submit"
                    className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200 hover:border-orange-400/40 hover:text-orange-200"
                  >
                    Choose this option
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>

      <div
        className={`mt-2 rounded-xl border p-3 ${
          decision.selectedOptionKey === "KEEP_AS_IS"
            ? "border-emerald-400/30 bg-emerald-400/5"
            : decision.recommendedOptionKey === "KEEP_AS_IS"
              ? "border-orange-400/30 bg-orange-400/5"
              : "border-slate-800 bg-slate-900/40"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-slate-100">Keep as is</p>
          {decision.recommendedOptionKey === "KEEP_AS_IS" ? (
            <span className="rounded-full border border-orange-400/30 bg-orange-400/10 px-2 py-0.5 text-[10px] font-semibold text-orange-200">
              AI preferred
            </span>
          ) : null}
          {decision.selectedOptionKey === "KEEP_AS_IS" ? (
            <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
              Selected
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          {decision.keepAsIsRationale}
        </p>
        {!isSelected ? (
          <form action={selectProgrammingDecisionAction} className="mt-3">
            <input type="hidden" name="decisionId" value={decision.id} />
            <input type="hidden" name="selectionKey" value="KEEP_AS_IS" />
            <button
              type="submit"
              className="min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-200 hover:border-emerald-400/40 hover:text-emerald-200"
            >
              Keep current setup
            </button>
          </form>
        ) : null}
      </div>

      {isSelected ? (
        <p className="mt-3 text-xs leading-5 text-emerald-300">
          Selection recorded as AI learning memory. No program/template change has been applied automatically yet.
        </p>
      ) : null}
    </div>
  );
}

function AnalysisView({
  analysis,
  evidenceBySessionExerciseId,
  patternEvidenceById,
}: {
  analysis: WorkoutAnalysis;
  evidenceBySessionExerciseId: Map<string, ExerciseEvidence>;
  patternEvidenceById: Map<string, PatternEvidence>;
}) {
  const usefulOrStrong = analysis.exerciseAssessments.filter((exercise) => {
    const evidence = evidenceBySessionExerciseId.get(exercise.sessionExerciseId);
    return evidence?.readiness === "USEFUL" || evidence?.readiness === "STRONG";
  }).length;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Pill className={fatigueClass(analysis.overallFatigueSignal)}>
            Overall fatigue: {label(analysis.overallFatigueSignal)}
          </Pill>
          <Pill className={confidenceClass(analysis.confidence)}>
            AI confidence: {label(analysis.confidence)}
          </Pill>
          <Pill className="border-slate-700 bg-slate-900 text-slate-300">
            History useful+: {usefulOrStrong}/{analysis.exerciseAssessments.length}
          </Pill>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-200">
          {analysis.workoutSummary}
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            Movement-pattern synthesis
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            AI synthesis across exercise variants. Absolute loads are never
            compared directly between different exercises or machines.
          </p>
        </div>

        {analysis.movementPatternAssessments.length === 0 ? (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-xs leading-5 text-amber-100/80">
            This workout was analyzed before movement-pattern synthesis was
            enabled. Re-analyze it to add this layer.
          </div>
        ) : (
          analysis.movementPatternAssessments.map((pattern) => {
            const evidence = patternEvidenceById.get(pattern.movementPatternId) ?? {
              performanceExposures: 0,
              historicalExercises: 0,
              readiness: "NEW" as const,
            };

            return (
              <div
                key={pattern.movementPatternId}
                className="rounded-xl border border-violet-400/20 bg-violet-400/5 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-100">
                      {pattern.movementPatternName}
                    </h4>
                    <p className="mt-1 text-xs text-slate-500">
                      {evidence.performanceExposures} prior pattern exposures
                      {" · "}
                      {evidence.historicalExercises} historical exercise
                      {evidence.historicalExercises === 1 ? "" : "s"}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Pill className={readinessClass(evidence.readiness)}>
                      History: {label(evidence.readiness)}
                    </Pill>
                    <Pill className={confidenceClass(pattern.confidence)}>
                      Confidence: {label(pattern.confidence)}
                    </Pill>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Stimulus
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-100">
                      {label(pattern.overallStimulus)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Fatigue
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-100">
                      {label(pattern.overallFatigueCost)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Progression
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-100">
                      {label(pattern.progressionSignal)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Exercise agreement
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-100">
                      {label(pattern.exerciseConsistency)}
                    </p>
                  </div>
                  <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-950/70 p-2.5 sm:col-span-1">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">
                      Interpretation
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-100">
                      {label(pattern.implementationInterpretation)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill className={stimulusClass(pattern.overallStimulus)}>
                    Stimulus: {label(pattern.overallStimulus)}
                  </Pill>
                  <Pill className={fatigueClass(pattern.overallFatigueCost)}>
                    Fatigue: {label(pattern.overallFatigueCost)}
                  </Pill>
                  <Pill className={progressionClass(pattern.progressionSignal)}>
                    Progression: {label(pattern.progressionSignal)}
                  </Pill>
                  <Pill className={consistencyClass(pattern.exerciseConsistency)}>
                    Exercises: {label(pattern.exerciseConsistency)}
                  </Pill>
                  <Pill
                    className={implementationClass(
                      pattern.implementationInterpretation,
                    )}
                  >
                    {label(pattern.implementationInterpretation)}
                  </Pill>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-300">
                  {pattern.rationale}
                </p>

                {pattern.notableSignals.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-500">
                    {pattern.notableSignals.map((signal, index) => (
                      <li key={index}>{signal}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="pt-1">
        <h3 className="text-sm font-semibold text-slate-100">
          Exercise analysis
        </h3>
      </div>

      {analysis.exerciseAssessments.map((exercise) => {
        const evidence = evidenceBySessionExerciseId.get(
          exercise.sessionExerciseId,
        ) ?? {
          performanceExposures: 0,
          decayComparableExposures: 0,
          rirSupportedExposures: 0,
          readiness: "NEW" as const,
        };

        return (
          <div
            key={exercise.sessionExerciseId}
            className="rounded-xl border border-slate-800 bg-slate-950 p-3"
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-100">
                    {exercise.exerciseName}
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {evidence.performanceExposures} prior performance{" "}
                    {evidence.performanceExposures === 1 ? "exposure" : "exposures"}
                    {" · "}
                    {evidence.decayComparableExposures} decay-comparable
                    {" · "}
                    {evidence.rirSupportedExposures} with RIR
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Pill className={readinessClass(evidence.readiness)}>
                    History: {label(evidence.readiness)}
                  </Pill>
                  <Pill className={confidenceClass(exercise.confidence)}>
                    Confidence: {label(exercise.confidence)}
                  </Pill>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Stimulus
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {label(exercise.overallStimulus)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Fatigue cost
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {label(exercise.overallFatigueCost)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">
                    Performance decay
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-100">
                    {label(exercise.performanceDecay)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Pill className={stimulusClass(exercise.overallStimulus)}>
                  Stimulus: {label(exercise.overallStimulus)}
                </Pill>
                <Pill className={fatigueClass(exercise.overallFatigueCost)}>
                  Fatigue: {label(exercise.overallFatigueCost)}
                </Pill>
                <Pill className={decayClass(exercise.performanceDecay)}>
                  Decay: {label(exercise.performanceDecay)}
                </Pill>
              </div>

              <p className="text-xs leading-5 text-slate-400">
                {exercise.rationale}
              </p>

              {exercise.notableSignals.length > 0 ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Evidence signals
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5 text-slate-400">
                    {exercise.notableSignals.map((signal, index) => (
                      <li key={index}>{signal}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <details className="group rounded-lg border border-slate-800 bg-slate-900/40">
                <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span>Set-by-set analysis</span>
                    <span className="text-slate-500 group-open:hidden">
                      {exercise.sets.length} sets
                    </span>
                    <span className="hidden text-slate-500 group-open:inline">
                      Hide
                    </span>
                  </div>
                </summary>

                <div className="space-y-2 border-t border-slate-800 p-2.5">
                  {exercise.sets.map((set) => (
                    <div
                      key={set.setNumber}
                      className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-slate-200">
                          Set {set.setNumber}
                        </strong>
                        <Pill className={stimulusClass(set.stimulus)}>
                          Stimulus {label(set.stimulus)}
                        </Pill>
                        <Pill className={fatigueClass(set.fatigueCost)}>
                          Fatigue {label(set.fatigueCost)}
                        </Pill>
                        <Pill className={rirClass(set.rirPlausibility)}>
                          RIR {label(set.rirPlausibility)}
                        </Pill>
                        <Pill className={confidenceClass(set.confidence)}>
                          {label(set.confidence)} confidence
                        </Pill>
                      </div>
                      <p className="mt-2 leading-5 text-slate-400">
                        {set.rationale}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default async function AiAnalysisPage() {
  const userId = await requireUserId();

  const [sessions, recentProgrammingDecisions, selectedDecisionCount] =
    await Promise.all([
      prisma.workoutSession.findMany({
        where: { userId, status: "COMPLETED" },
        orderBy: { performedAt: "desc" },
        take: 8,
        select: {
          id: true,
          name: true,
          performedAt: true,
          aiAnalysis: true,
          aiAnalysisModel: true,
          aiAnalyzedAt: true,
          exercises: {
            select: {
              id: true,
              exerciseId: true,
              exercise: {
                select: {
                  movementGroupId: true,
                },
              },
            },
          },
        },
      }),
      prisma.aiProgrammingDecision.findMany({
        where: {
          userId,
          status: { in: ["PENDING", "SELECTED"] },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          generationId: true,
          targetMuscleName: true,
          decisionSummary: true,
          confidence: true,
          evidence: true,
          options: true,
          recommendedOptionKey: true,
          keepAsIsRationale: true,
          selectedOptionKey: true,
          status: true,
          context: true,
          policyVersion: true,
          model: true,
          createdAt: true,
        },
      }),
      prisma.aiProgrammingDecision.count({
        where: { userId, status: "SELECTED" },
      }),
    ]);

  const latestGenerationId = recentProgrammingDecisions[0]?.generationId ?? null;
  const latestProgrammingDecisions = latestGenerationId
    ? recentProgrammingDecisions.filter(
        (decision) => decision.generationId === latestGenerationId,
      )
    : [];
  const programmingGlobalSummary =
    latestProgrammingDecisions.length > 0
      ? contextGlobalSummary(latestProgrammingDecisions[0]?.context)
      : null;

  const exerciseIds = [
    ...new Set(
      sessions.flatMap((session) =>
        session.exercises.map((exercise) => exercise.exerciseId),
      ),
    ),
  ];

  const movementGroupIds = [
    ...new Set(
      sessions.flatMap((session) =>
        session.exercises.map(
          (exercise) => exercise.exercise.movementGroupId,
        ),
      ),
    ),
  ];

  // One bounded history query supports both exercise- and movement-pattern
  // readiness badges on this page. We only need recent evidence depth here;
  // the actual AI analyzer has its own richer historical context.
  const historicalEvidenceExposures =
    movementGroupIds.length === 0
      ? []
      : await prisma.workoutSessionExercise.findMany({
          where: {
            exercise: {
              movementGroupId: { in: movementGroupIds },
            },
            session: {
              userId,
              status: "COMPLETED",
            },
            sets: {
              some: {
                isCompleted: true,
                weight: { not: null },
                reps: { not: null },
              },
            },
          },
          orderBy: {
            session: {
              performedAt: "desc",
            },
          },
          take: 500,
          select: {
            exerciseId: true,
            exercise: {
              select: {
                movementGroupId: true,
              },
            },
            session: {
              select: {
                performedAt: true,
              },
            },
            sets: {
              where: {
                isCompleted: true,
              },
              select: {
                weight: true,
                reps: true,
                rir: true,
              },
            },
          },
        });

  function evidenceFor(exerciseId: string, performedAt: Date): ExerciseEvidence {
    const prior = historicalEvidenceExposures.filter(
      (exposure) =>
        exposure.exerciseId === exerciseId &&
        exposure.session.performedAt < performedAt,
    );

    const performanceExposures = prior.filter((exposure) =>
      exposure.sets.some(
        (set) => set.weight !== null && set.reps !== null && set.reps > 0,
      ),
    ).length;

    const decayComparableExposures = prior.filter((exposure) => {
      const usableSets = exposure.sets.filter(
        (set) => set.weight !== null && set.reps !== null && set.reps > 0,
      );
      return usableSets.length >= 2;
    }).length;

    const rirSupportedExposures = prior.filter((exposure) =>
      exposure.sets.some(
        (set) =>
          set.weight !== null &&
          set.reps !== null &&
          set.reps > 0 &&
          set.rir !== null,
      ),
    ).length;

    return {
      performanceExposures,
      decayComparableExposures,
      rirSupportedExposures,
      readiness: readinessFor(performanceExposures),
    };
  }

  function patternEvidenceFor(
    movementGroupId: string,
    performedAt: Date,
  ): PatternEvidence {
    const prior = historicalEvidenceExposures.filter(
      (exposure) =>
        exposure.exercise.movementGroupId === movementGroupId &&
        exposure.session.performedAt < performedAt,
    );

    const uniqueExercises = new Set(prior.map((exposure) => exposure.exerciseId));

    return {
      performanceExposures: prior.length,
      historicalExercises: uniqueExercises.size,
      readiness: patternReadinessFor(prior.length),
    };
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">
          Training Advisor
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-400">
          AI interpretation of set, exercise and movement-pattern stimulus,
          fatigue and progression, plus advisory muscle-volume and movement-allocation decisions.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <Stage
          title="Workout understanding"
          description="Set, exercise and movement-pattern stimulus, fatigue and progression reasoning."
          active
        />
        <Stage
          title="Volume decisions"
          description="Muscle-level increase, hold, decrease or reallocation decisions using recovery, priorities, history and learned selections."
          active
        />
        <Stage
          title="Mesocycle priorities"
          description="Priority recommendations using circumference trends, bodyweight, waist and historical training response."
          active={false}
        />
      </div>

      <Card className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-100">
              Programming recommendations
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Policy {TRAINING_POLICY_VERSION} · {selectedDecisionCount} prior selections available as learning memory.
              Recommendations are advisory only; selecting an option does not yet modify the program.
            </p>
          </div>
          <form action={generateProgrammingRecommendationsAction}>
            <Button variant="secondary">
              {latestProgrammingDecisions.length > 0
                ? "Refresh recommendations"
                : "Generate recommendations"}
            </Button>
          </form>
        </div>

        {programmingGlobalSummary ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm leading-6 text-slate-300">
            {programmingGlobalSummary}
          </p>
        ) : null}

        {latestProgrammingDecisions.length > 0 ? (
          <div className="space-y-3">
            {latestProgrammingDecisions.map((decision) => (
              <ProgrammingDecisionCard
                key={decision.id}
                decision={decision as ProgrammingDecisionRow}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm leading-6 text-slate-500">
            No programming decision set has been generated yet. Generate recommendations after you have at least some recent AI-analyzed workouts and recovery data.
          </p>
        )}
      </Card>

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          History readiness
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div>
            <p className="font-medium text-slate-300">New</p>
            <p className="mt-0.5 text-slate-500">0 performance exposures</p>
          </div>
          <div>
            <p className="font-medium text-amber-200">Emerging</p>
            <p className="mt-0.5 text-slate-500">1–2 performance exposures</p>
          </div>
          <div>
            <p className="font-medium text-sky-200">Useful</p>
            <p className="mt-0.5 text-slate-500">3–5 performance exposures</p>
          </div>
          <div>
            <p className="font-medium text-emerald-200">Strong</p>
            <p className="mt-0.5 text-slate-500">6+ performance exposures</p>
          </div>
        </div>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-400">
            No completed workouts available yet.
          </p>
        </Card>
      ) : null}

      {sessions.map((session) => {
        const analysis = parseStoredAnalysis(session.aiAnalysis);

        const evidenceBySessionExerciseId = new Map<string, ExerciseEvidence>(
          session.exercises.map((sessionExercise) => [
            sessionExercise.id,
            evidenceFor(sessionExercise.exerciseId, session.performedAt),
          ]),
        );

        const patternEvidenceById = new Map<string, PatternEvidence>(
          [
            ...new Set(
              session.exercises.map(
                (sessionExercise) =>
                  sessionExercise.exercise.movementGroupId,
              ),
            ),
          ].map((movementGroupId) => [
            movementGroupId,
            patternEvidenceFor(movementGroupId, session.performedAt),
          ]),
        );

        return (
          <Card key={session.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-100">
                  {session.name}
                </h2>
                <p className="text-xs leading-5 text-slate-500">
                  {session.performedAt.toLocaleString()}
                  {session.aiAnalyzedAt
                    ? ` · analyzed ${session.aiAnalyzedAt.toLocaleString()}`
                    : ""}
                  {session.aiAnalysisModel
                    ? ` · ${session.aiAnalysisModel}`
                    : ""}
                </p>
              </div>

              <form action={analyzeWorkoutAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                <Button variant="secondary">
                  {analysis ? "Re-analyze" : "Analyze workout"}
                </Button>
              </form>
            </div>

            {analysis ? (
              <AnalysisView
                analysis={analysis}
                evidenceBySessionExerciseId={evidenceBySessionExerciseId}
                patternEvidenceById={patternEvidenceById}
              />
            ) : (
              <p className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm text-slate-500">
                No AI analysis stored for this workout yet.
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
