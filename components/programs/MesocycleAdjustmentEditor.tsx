"use client";

import { useMemo, useState } from "react";
import { ChevronDown, RotateCcw, Save } from "lucide-react";

import {
  resetMesocycleSlotAdjustment,
  saveMesocycleSlotAdjustment,
} from "@/lib/server/mesocycle-adjustments";

type MovementGroup = {
  id: string;
  name: string;
  sortOrder: number;
};

type Slot = {
  id: string;
  templateId: string;
  baseMovementGroupId: string;
  baseMovementGroupName: string;
  currentMovementGroupId: string;
  currentMovementGroupName: string;
  baseSets: number;
  currentSets: number;
  minSets: number;
  maxSets: number;
  prescribedMinReps: number | null;
  prescribedMaxReps: number | null;
  manualOverride: boolean;
  hidden: boolean;
  relatedMovementGroupIds: string[];
};

type Template = {
  id: string;
  name: string;
  sequenceIndex: number;
  slots: Slot[];
};

function repLabel(slot: Slot) {
  if (
    slot.prescribedMinReps === null ||
    slot.prescribedMinReps === undefined ||
    slot.prescribedMaxReps === null ||
    slot.prescribedMaxReps === undefined
  ) {
    return "Rep range follows current prescription";
  }
  return `${slot.prescribedMinReps}–${slot.prescribedMaxReps} reps`;
}

function SlotEditor({
  mesocycleId,
  slot,
  movementGroups,
}: {
  mesocycleId: string;
  slot: Slot;
  movementGroups: MovementGroup[];
}) {
  const [sets, setSets] = useState(slot.currentSets);
  const [movementGroupId, setMovementGroupId] = useState(
    slot.currentMovementGroupId,
  );

  const relatedIds = useMemo(
    () => new Set(slot.relatedMovementGroupIds),
    [slot.relatedMovementGroupIds],
  );
  const related = movementGroups.filter(
    (group) =>
      relatedIds.has(group.id) || group.id === slot.currentMovementGroupId,
  );
  const other = movementGroups.filter(
    (group) =>
      !relatedIds.has(group.id) && group.id !== slot.currentMovementGroupId,
  );

  const movementChanged =
    movementGroupId !== slot.currentMovementGroupId;
  const setsChanged = sets !== slot.currentSets;
  const dirty = movementChanged || setsChanged;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-slate-950/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-slate-100">
              {slot.currentMovementGroupName}
            </p>
            {slot.manualOverride ? (
              <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-300">
                Manual
              </span>
            ) : slot.currentSets !== slot.baseSets ? (
              <span className="rounded-full border border-sky-400/15 bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-300">
                Planner
              </span>
            ) : null}
            {slot.hidden ? (
              <span className="rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Hidden
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Base: {slot.baseMovementGroupName} · {slot.baseSets} set
            {slot.baseSets === 1 ? "" : "s"} · {repLabel(slot)}
          </p>
        </div>
        <p className="shrink-0 text-xs tabular-nums text-slate-500">
          max {slot.maxSets}
        </p>
      </div>

      <form
        action={saveMesocycleSlotAdjustment}
        className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
      >
        <input type="hidden" name="mesocycleId" value={mesocycleId} />
        <input
          type="hidden"
          name="templateExerciseId"
          value={slot.id}
        />
        <input type="hidden" name="plannedSets" value={sets} />

        <label className="min-w-0">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
            Movement pattern
          </span>
          <select
            name="movementGroupId"
            value={movementGroupId}
            onChange={(event) => setMovementGroupId(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus:border-orange-400/50"
          >
            {related.length > 0 ? (
              <optgroup label="Related patterns">
                {related.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {other.length > 0 ? (
              <optgroup label="Other patterns">
                {other.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
            Sets
          </span>
          <div className="flex min-h-11 items-center overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
            <button
              type="button"
              aria-label="Decrease sets"
              onClick={() =>
                setSets((value) => Math.max(slot.minSets, value - 1))
              }
              className="grid h-11 w-10 place-items-center text-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            >
              −
            </button>
            <span className="min-w-9 text-center text-sm font-bold tabular-nums text-slate-100">
              {sets}
            </span>
            <button
              type="button"
              aria-label="Increase sets"
              onClick={() =>
                setSets((value) => Math.min(slot.maxSets, value + 1))
              }
              className="grid h-11 w-10 place-items-center text-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={!dirty}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 text-sm font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600 sm:w-auto"
          >
            <Save size={15} />
            Apply
          </button>
        </div>
      </form>

      {slot.manualOverride ? (
        <form action={resetMesocycleSlotAdjustment} className="mt-2">
          <input type="hidden" name="mesocycleId" value={mesocycleId} />
          <input type="hidden" name="templateId" value={slot.templateId} />
          <input
            type="hidden"
            name="templateExerciseId"
            value={slot.id}
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-slate-300"
          >
            <RotateCcw size={13} />
            Return this slot to planner control
          </button>
        </form>
      ) : null}

      {sets === 0 ? (
        <p className="mt-2 text-xs text-amber-300/80">
          Applying 0 sets hides this slot for the rest of the current
          mesocycle. The base template is unchanged.
        </p>
      ) : null}
    </div>
  );
}

function TemplateEditor({
  mesocycleId,
  template,
  movementGroups,
  initiallyOpen,
}: {
  mesocycleId: string;
  template: Template;
  movementGroups: MovementGroup[];
  initiallyOpen: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const manualCount = template.slots.filter(
    (slot) => slot.manualOverride,
  ).length;
  const visibleCount = template.slots.filter((slot) => !slot.hidden).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/[0.48]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-900"
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-600">
            Workout
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-slate-100">
              {template.name}
            </h2>
            {manualCount > 0 ? (
              <span className="rounded-full border border-orange-400/20 bg-orange-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-300">
                {manualCount} manual
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {visibleCount} active slot{visibleCount === 1 ? "" : "s"}
            {template.slots.length !== visibleCount
              ? ` · ${template.slots.length - visibleCount} hidden`
              : ""}
          </p>
        </div>

        <ChevronDown
          size={19}
          className={`shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="space-y-2 border-t border-white/[0.06] p-3">
          {template.slots.length > 0 ? (
            template.slots.map((slot) => (
              <SlotEditor
                key={slot.id}
                mesocycleId={mesocycleId}
                slot={slot}
                movementGroups={movementGroups}
              />
            ))
          ) : (
            <p className="p-2 text-sm text-slate-500">
              No movement slots in this template.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}

export function MesocycleAdjustmentEditor({
  mesocycleId,
  templates,
  movementGroups,
  initialOpenTemplateId,
}: {
  mesocycleId: string;
  templates: Template[];
  movementGroups: MovementGroup[];
  initialOpenTemplateId?: string | null;
}) {
  return (
    <div className="space-y-3">
      {templates.map((template) => (
        <TemplateEditor
          key={template.id}
          mesocycleId={mesocycleId}
          template={template}
          movementGroups={movementGroups}
          initiallyOpen={initialOpenTemplateId === template.id}
        />
      ))}
    </div>
  );
}
