export type RotationTemplateRef = {
  id: string;
  name: string;
  sequenceIndex: number;
};

function orderedTemplates<T extends RotationTemplateRef>(templates: T[]) {
  return [...templates].sort((a, b) => a.sequenceIndex - b.sequenceIndex || a.name.localeCompare(b.name));
}

export function templateSequenceLabel(template: RotationTemplateRef) {
  const index = Math.max(0, Number(template.sequenceIndex) || 0);
  if (index < 26) return String.fromCharCode(65 + index);
  return String(index + 1);
}

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function templateAliases(template: RotationTemplateRef) {
  const name = normalizeToken(template.name);
  const strippedTemplateName = normalizeToken(template.name.replace(/^template\s+/i, ""));
  return new Set([template.id.toLowerCase(), name, strippedTemplateName, templateSequenceLabel(template).toLowerCase()]);
}

export function parseRotationSequenceInput(input: string, templates: RotationTemplateRef[]) {
  const byAlias = new Map<string, RotationTemplateRef>();
  for (const template of orderedTemplates(templates)) {
    for (const alias of templateAliases(template)) {
      if (alias && !byAlias.has(alias)) byAlias.set(alias, template);
    }
  }

  const tokens = input
    .split(/[\n,>→]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { templateIds: [] as string[], invalidTokens: [] as string[] };
  }

  const templateIds: string[] = [];
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const template = byAlias.get(normalizeToken(token));
    if (template) {
      templateIds.push(template.id);
    } else {
      invalidTokens.push(token);
    }
  }

  return { templateIds, invalidTokens };
}

export function normalizeRotationSequence<T extends RotationTemplateRef>(rotationSequence: unknown, templates: T[]) {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const fallback = orderedTemplates(templates).map((template) => template.id);

  if (!Array.isArray(rotationSequence)) return fallback;

  const sanitized = rotationSequence
    .map((value) => (typeof value === "string" ? value : null))
    .filter((value): value is string => Boolean(value && byId.has(value)));

  return sanitized.length > 0 ? sanitized : fallback;
}

export function formatRotationSequenceText(rotationSequence: unknown, templates: RotationTemplateRef[]) {
  const byId = new Map(templates.map((template) => [template.id, template]));
  return normalizeRotationSequence(rotationSequence, templates)
    .map((templateId) => {
      const template = byId.get(templateId);
      return template ? templateSequenceLabel(template) : null;
    })
    .filter(Boolean)
    .join(", ");
}

function matchSuffixLength(history: string[], sequence: string[], sequencePosition: number) {
  let matches = 0;
  for (let historyIndex = history.length - 1; historyIndex >= 0; historyIndex -= 1) {
    const offset = history.length - 1 - historyIndex;
    const sequenceIndex = (sequencePosition - offset + sequence.length) % sequence.length;
    if (history[historyIndex] !== sequence[sequenceIndex]) break;
    matches += 1;
  }
  return matches;
}

export function getNextTemplateFromRotation<T extends RotationTemplateRef>(params: {
  templates: T[];
  rotationSequence: unknown;
  completedTemplateHistory: string[];
}) {
  if (params.templates.length === 0) return null;

  const sequence = normalizeRotationSequence(params.rotationSequence, params.templates);
  const byId = new Map(params.templates.map((template) => [template.id, template]));
  const history = params.completedTemplateHistory.filter((templateId) => byId.has(templateId));

  if (sequence.length === 0 || history.length === 0) {
    return byId.get(sequence[0] ?? "") ?? orderedTemplates(params.templates)[0] ?? null;
  }

  const lastTemplateId = history[history.length - 1];
  let bestPosition = sequence.findIndex((templateId) => templateId === lastTemplateId);
  let bestMatchLength = bestPosition >= 0 ? matchSuffixLength(history, sequence, bestPosition) : 0;

  for (let index = 0; index < sequence.length; index += 1) {
    if (sequence[index] !== lastTemplateId) continue;
    const matchLength = matchSuffixLength(history, sequence, index);
    if (matchLength > bestMatchLength) {
      bestPosition = index;
      bestMatchLength = matchLength;
    }
  }

  if (bestPosition < 0) return byId.get(sequence[0] ?? "") ?? orderedTemplates(params.templates)[0] ?? null;
  const nextId = sequence[(bestPosition + 1) % sequence.length];
  return byId.get(nextId) ?? orderedTemplates(params.templates)[0] ?? null;
}
