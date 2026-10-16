import { T3_RANGE_CEILING } from "@/lib/coaching/t3-volume-policy";
import {
  type DesignBrief,
  type DesignReferences,
  type MesocycleDesign,
} from "./schema";
export function validateDesign(
  plan: MesocycleDesign,
  brief: DesignBrief,
  refs: DesignReferences,
  previous?: MesocycleDesign | null,
) {
  const errors: string[] = [],
    warnings: string[] = [];
  const groups = new Set(
    refs.muscles
      .filter((m) => !m.accountingSlug && m.slug !== "chest")
      .map((m) => m.id),
  );
  const allMuscles = new Set(refs.muscles.map((m) => m.id));
  const exerciseMap = new Map(refs.exercises.map((e) => [e.id, e]));
  const setMap = new Map(refs.setTypes.map((t) => [t.id, t]));
  const dose: Record<string, number> = {};
  const exposures = new Map<string, Set<number>>();
  const seenKeys = new Set<string>();
  const seenDays = new Set<number>();
  if (plan.sessions.length !== brief.daysPerWeek)
    errors.push("Session count must match training days per week.");
  if (plan.reviewAfterWeeks > plan.lengthWeeks)
    errors.push("The review checkpoint must be within the mesocycle.");
  const priorities = new Map(
    plan.priorities.map((p) => [p.muscleId, p.priority]),
  );
  if (priorities.size !== plan.priorities.length)
    errors.push("Duplicate muscle priorities.");
  for (const p of plan.priorities)
    if (!groups.has(p.muscleId))
      errors.push("Priorities must use a current workload group.");
  for (const p of brief.priorities)
    if (priorities.get(p.muscleId) !== p.priority)
      errors.push(
        "Preserve confirmed priorities, or edit the brief before changing them.",
      );
  if (
    new Set(brief.priorities.map((p) => p.muscleId)).size !==
    brief.priorities.length
  )
    errors.push("Duplicate confirmed priorities.");
  for (const gap of plan.libraryGaps)
    if (!allMuscles.has(gap.muscleId))
      errors.push("Unknown library-gap muscle.");
  for (const c of plan.constraintChecks) {
    if (c.status === "UNRESOLVED")
      errors.push(
        `Restriction needs resolution: ${c.constraint}. ${c.handling}`,
      );
    else if (c.status === "TRADEOFF")
      warnings.push(`Restriction tradeoff: ${c.constraint}. ${c.handling}`);
  }
  const sessions = plan.sessions.map((day) => {
    if (seenKeys.has(day.key)) errors.push("Session keys must be unique.");
    seenKeys.add(day.key);
    if (seenDays.has(day.weekday)) errors.push("Use one session per weekday.");
    seenDays.add(day.weekday);
    if (
      brief.availableWeekdays.length &&
      !brief.availableWeekdays.includes(day.weekday)
    )
      errors.push(`${day.name}: unavailable weekday.`);
    if (!day.items.length)
      errors.push(`${day.name}: add at least one exercise.`);
    const seenExercises = new Set<string>();
    let minutes = 8;
    let physicalSets = 0;
    for (const item of day.items) {
      if (seenKeys.has(item.key)) errors.push("Item keys must be unique.");
      seenKeys.add(item.key);
      if (item.minReps > item.maxReps)
        errors.push(`${day.name}: minimum reps exceed maximum reps.`);
      minutes +=
        2 +
        item.sets *
          (Math.max(0.75, (((item.minReps + item.maxReps) / 2) * 4) / 60) +
            item.restSeconds / 60);
      physicalSets += item.sets;
      const exercise = item.exerciseId
        ? exerciseMap.get(item.exerciseId)
        : undefined;
      const type = item.setTypeId ? setMap.get(item.setTypeId) : undefined;
      if (!exercise) {
        errors.push(
          `${day.name}: choose an active library exercise for ${item.purpose}.`,
        );
        continue;
      }
      if (seenExercises.has(exercise.id))
        errors.push(`${day.name}: duplicate exercise ${exercise.name}.`);
      seenExercises.add(exercise.id);
      if (
        brief.excludedExerciseIds.includes(exercise.id) ||
        exercise.preference === "AVOID"
      )
        errors.push(`${exercise.name}: excluded or marked Avoid.`);
      if (!type || !Number.isFinite(type.multiplier) || type.multiplier <= 0) {
        errors.push(`${exercise.name}: choose an available set type.`);
        continue;
      }
      const extended =
        type.isIntensifier || /edt|density/i.test(type.slug + type.name);
      if (
        extended &&
        (exercise.intensifierPreference === "NONE" ||
          (exercise.intensifierPreference === "ONLY_SELECTED" &&
            !exercise.allowedIntensifierIds.includes(type.id)))
      )
        errors.push(
          `${exercise.name}: set format conflicts with saved preferences.`,
        );
      if (
        /lengthened|partial/i.test(type.name + type.slug) &&
        /squat|deadlift|rdl|romanian/i.test(exercise.name + exercise.movementGroupName) &&
        /barbell|back squat|front squat|deadlift/i.test(exercise.name)
      )
        errors.push(
          `${exercise.name}: lengthened partials are not supported for this high-risk movement.`,
        );
      if (extended)
        warnings.push(
          `${exercise.name}: verify format suitability and allow extra setup/recovery time; duration is an estimate.`,
        );
      const credits = [
        ...exercise.primaryMuscleIds.map((id) => ({
          muscleId: id,
          fraction: 1,
        })),
        ...exercise.secondaryMuscles,
      ];
      for (const c of credits) {
        const amount = item.sets * type.multiplier * c.fraction;
        dose[c.muscleId] = (dose[c.muscleId] ?? 0) + amount;
        if (amount > 0) {
          const days = exposures.get(c.muscleId) ?? new Set<number>();
          days.add(day.weekday);
          exposures.set(c.muscleId, days);
        }
      }
    }
    if (minutes > brief.minutesPerSession)
      warnings.push(
        `${day.name}: estimated ${Math.ceil(minutes)} minutes exceeds your ${brief.minutesPerSession}-minute limit. Revise or explicitly accept the tradeoff.`,
      );
    return {
      name: day.name,
      weekday: day.weekday,
      minutes: Math.ceil(minutes),
      physicalSets,
    };
  });
  for (const [id, n] of Object.entries(dose))
    if (n > T3_RANGE_CEILING)
      errors.push(
        `${refs.muscles.find((m) => m.id === id)?.name}: dose exceeds the ${T3_RANGE_CEILING}-set application limit; reduce the proposed allocation.`,
      );
  for (const p of plan.priorities)
    if (
      (p.priority === "SPECIALIZE" || p.priority === "GROW") &&
      !(dose[p.muscleId] > 0)
    )
      warnings.push(
        `${refs.muscles.find((m) => m.id === p.muscleId)?.name}: growth priority has no credited work. Resolve coverage or explicitly accept the limitation.`,
      );
  for (const rule of plan.spacing) {
    if (!groups.has(rule.muscleId)) {
      errors.push("Spacing must use workload groups.");
      continue;
    }
    const days = [...(exposures.get(rule.muscleId) ?? [])].sort(
      (a, b) => a - b,
    );
    const gaps = days.map(
      (day, i) => (days[(i + 1) % days.length] - day + 7) % 7 || 7,
    );
    if (gaps.some((g) => g < rule.preferredGapDays))
      warnings.push(
        `${refs.muscles.find((m) => m.id === rule.muscleId)?.name}: proposed spacing is not met, including week boundaries. ${rule.reason}`,
      );
  }
  for (const day of previous?.sessions ?? [])
    for (const item of day.items)
      if (item.locked) {
        const nextDay = plan.sessions.find((d) => d.key === day.key);
        const next = nextDay?.items.find((i) => i.key === item.key);
        if (
          !next ||
          nextDay?.weekday !== day.weekday ||
          JSON.stringify(next) !== JSON.stringify(item)
        )
          errors.push(
            `Locked item ${item.purpose} changed. Unlock it explicitly before revising.`,
          );
      }
  return {
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    sessions,
    dose,
  };
}
