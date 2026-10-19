import "server-only";
import { isOneOffAlternative } from "@/lib/workouts/one-off-alternative";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma as raw } from "@/lib/db/prisma";
import { mechanicsBasis, readMechanics } from "@/lib/coaching/exercise-mechanics";
import { readClassification } from "@/lib/coaching/exercise-classification";

// This adapter is explicitly user scoped. It never writes or starts AI work.
// The Prisma result types remain compatible; workload links are resolved centrally.
type Row = Record<string, any>;
const relations = new Map(Prisma.dmmf.datamodel.models.map(m => [m.name,
  new Map(m.fields.filter(f => f.kind === "object").map(f => [f.name, f.type]))]));
export function prepareExerciseRead(model: string, original: Row): Row {
  const args = { ...original };
  const key = args.select ? "select" : "include";
  const fields = { ...(args[key] ?? {}) };
  for (const [name, target] of relations.get(model) ?? []) {
    if (fields[name]) fields[name] = prepareExerciseRead(target, fields[name] === true ? {} : fields[name]);
  }
  if (model === "Exercise") {
    if (args.select) for (const field of ["id", "name", "setupNotes", "movementGroupId"]) fields[field] = true;
    fields.primaryMuscles ||= { include: { muscle: true } };
    fields.secondaryMuscles ||= { include: { muscle: true } };
    for (const relation of ["primaryMuscles", "secondaryMuscles"]) {
      if (fields[relation]?.select) {
        fields[relation] = { ...fields[relation], select: { ...fields[relation].select, muscleId: true,
          ...(relation === "secondaryMuscles" ? { contributionEstimate: true } : {}) } };
      }
    }
  }
  if (model === "WorkoutSessionExercise" && args.select) { fields.muscleSnapshot = true; fields.exerciseChoiceIntent = true; }
  if (Object.keys(fields).length) args[key] = fields;
  return args;
}

export function resolveExerciseRead(model: string, value: any, profiles: Map<string, Row>, muscles: Map<string, Row>, snapshot?: unknown): any {
  if (Array.isArray(value)) return value.map(item => resolveExerciseRead(model,item,profiles,muscles,snapshot));
  if (!value || typeof value !== "object") return value;
  const row = { ...value };
  if (model === "Exercise") {
    const own = profiles.get(row.id);
    const current = own && readClassification(own.appliedClassification);
    const historical = snapshot !== undefined;
    const frozen = historical ? readClassification(snapshot) : null;
    const basis = row.primaryMuscles && row.secondaryMuscles ? mechanicsBasis(row as any, own?.executionSetup ?? null) : null;
    const resolved = historical ? frozen : current && current.basis === basis ? current : null;
    row.classificationSource = resolved?.source ?? "CATALOG";
    row.classificationIssues = resolved?.issues ?? [];
    if (resolved) {
      const make = (links: typeof resolved.primary) => links.map(link => ({ ...link, exerciseId: row.id,
        muscle: muscles.get(link.muscleId), contributionEstimate: link.contributionEstimate ?? null,
        assessmentRationale: resolved.source === "COACH" ? "Accepted Exercise Coach assessment" : null,
        assessedAt: resolved.appliedAt ? new Date(resolved.appliedAt) : null, assessmentModel: "exercise-profile", assessmentVersion: resolved.revision ?? 0 }));
      row.primaryMuscles = make(resolved.primary);
      row.secondaryMuscles = make(resolved.secondary);
      row.mechanicsSourceBasis = resolved.basis ?? basis;
    }
    if (historical && row.coachingProfiles) {
      const saved = readMechanics(frozen?.profile);
      row.coachingProfiles = row.coachingProfiles.map((p: Row) => ({ ...p,
        mechanicsProfile: saved, executionSetup: frozen?.executionSetup ?? null }));
    }
  }
  for (const [name,target] of relations.get(model) ?? []) {
    if (row[name] != null && name !== "primaryMuscles" && name !== "secondaryMuscles") {
      row[name] = resolveExerciseRead(target,row[name],profiles,muscles,
        model === "WorkoutSessionExercise" && name === "exercise" ? row.muscleSnapshot ?? null : undefined);
    }
  }
  if (model === "WorkoutSessionExercise" && isOneOffAlternative(row.exerciseChoiceIntent) && row.exercise) {
    row.exercise = { ...row.exercise,
      name: `One-off equivalent of ${row.exercise.name}`,
      setupNotes: null, minimumWeightIncrement: null, coachingProfiles: [],
    };
  }
  return row;
}


export function needsExerciseResolution(model: string, args: Row): boolean {
  if (model === "Exercise") return true;
  const selected = args.select ?? args.include ?? {};
  return [...(relations.get(model) ?? [])].some(([key,target]) => selected[key] && needsExerciseResolution(target, selected[key] === true ? {} : selected[key]));
}

export function getUserExercisePrisma(userId: string): PrismaClient {
  let reference: Promise<{ profiles: Map<string, Row>; muscles: Map<string, Row> }> | undefined;
  const load = () => reference ??= Promise.all([
    raw.exerciseCoachingProfile.findMany({ where: { userId }, select: { exerciseId: true, appliedClassification: true, executionSetup: true } }),
    raw.muscle.findMany(),
  ]).then(([profiles,muscles]) => ({ profiles: new Map(profiles.map(p => [p.exerciseId,p])), muscles: new Map(muscles.map(m => [m.id,m])) }));
  return raw.$extends({ name: "effective-user-exercise-classification", query: { $allModels: { async $allOperations({ model,operation,args,query }) {
    if (!["findMany","findFirst","findFirstOrThrow","findUnique","findUniqueOrThrow"].includes(operation) || !needsExerciseResolution(model,args)) return query(args);
    const result = await query(prepareExerciseRead(model,args) as typeof args);
    const refs = await load();
    return resolveExerciseRead(model,result,refs.profiles,refs.muscles);
  } } } }) as unknown as PrismaClient;
}
