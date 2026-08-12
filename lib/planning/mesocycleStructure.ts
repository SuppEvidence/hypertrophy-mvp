export type MesocycleStructureSetPlan = {
  setNumber: number;
  setTypeId: string;
};

export type MesocycleStructureAddAction = {
  id: string;
  type: "ADD_SLOT";
  templateId: string;
  movementGroupId: string;
  sourceTemplateExerciseId: string | null;
  exerciseId: string;
  defaultSetTypeId: string;
  plannedSets: number;
  maxSets: number;
  setPlans: MesocycleStructureSetPlan[];
};

export type MesocycleStructureRemoveAction = {
  id: string;
  type: "REMOVE_SLOT";
  templateId: string;
  movementGroupId: string;
  templateExerciseId: string;
};

export type MesocycleStructureAction = MesocycleStructureAddAction | MesocycleStructureRemoveAction;

export type MesocycleStructureState = {
  version: 1;
  actions: MesocycleStructureAction[];
};

function positiveInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseSetPlans(value: unknown): MesocycleStructureSetPlan[] {
  if (!Array.isArray(value)) return [];
  const plans = value
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const candidate = entry as Record<string, unknown>;
      const setTypeId = nonEmptyString(candidate.setTypeId);
      const setNumber = positiveInteger(candidate.setNumber);
      if (!setTypeId || setNumber < 1) return null;
      return { setNumber, setTypeId };
    })
    .filter((entry): entry is MesocycleStructureSetPlan => Boolean(entry));

  const bySet = new Map<number, MesocycleStructureSetPlan>();
  for (const plan of plans) bySet.set(plan.setNumber, plan);
  return Array.from(bySet.values()).sort((a, b) => a.setNumber - b.setNumber);
}

function parseAction(value: unknown): MesocycleStructureAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const id = nonEmptyString(candidate.id);
  const type = candidate.type;
  const templateId = nonEmptyString(candidate.templateId);
  const movementGroupId = nonEmptyString(candidate.movementGroupId);
  if (!id || !templateId || !movementGroupId) return null;

  if (type === "REMOVE_SLOT") {
    const templateExerciseId = nonEmptyString(candidate.templateExerciseId);
    if (!templateExerciseId) return null;
    return { id, type, templateId, movementGroupId, templateExerciseId };
  }

  if (type === "ADD_SLOT") {
    const exerciseId = nonEmptyString(candidate.exerciseId);
    const defaultSetTypeId = nonEmptyString(candidate.defaultSetTypeId);
    const plannedSets = positiveInteger(candidate.plannedSets, 1);
    const maxSets = Math.max(plannedSets, positiveInteger(candidate.maxSets, Math.max(plannedSets, 3)));
    if (!exerciseId || !defaultSetTypeId || plannedSets < 1) return null;
    return {
      id,
      type,
      templateId,
      movementGroupId,
      sourceTemplateExerciseId: nonEmptyString(candidate.sourceTemplateExerciseId),
      exerciseId,
      defaultSetTypeId,
      plannedSets,
      maxSets,
      setPlans: parseSetPlans(candidate.setPlans),
    };
  }

  return null;
}

export function parseMesocycleStructureOverrides(value: unknown): MesocycleStructureState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { version: 1, actions: [] };
  const candidate = value as Record<string, unknown>;
  const source = Array.isArray(candidate.actions) ? candidate.actions : [];
  const actions = source.map(parseAction).filter((action): action is MesocycleStructureAction => Boolean(action));
  const byId = new Map<string, MesocycleStructureAction>();
  for (const action of actions) byId.set(action.id, action);
  return { version: 1, actions: Array.from(byId.values()) };
}
