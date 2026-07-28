"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown } from "lucide-react";

export const WORKOUT_SET_COMPLETION_EVENT = "rfd-workout-set-completion";

type CompletionDetail = {
  setId: string;
  isCompleted: boolean;
};

type Props = {
  exerciseId: string;
  title: string;
  exerciseName: string;
  plannedSets: number;
  initialSets: Array<{ id: string; isCompleted: boolean }>;
  children: ReactNode;
};

export function ExerciseCollapseCard({ exerciseId, title, exerciseName, plannedSets, initialSets, children }: Props) {
  const initialState = useMemo(() => new Map(initialSets.map((set) => [set.id, set.isCompleted])), [initialSets]);
  const completionState = useRef(initialState);
  const initialCompletedCount = Array.from(initialState.values()).filter(Boolean).length;
  const [completedCount, setCompletedCount] = useState(initialCompletedCount);
  const [isOpen, setIsOpen] = useState(!(initialSets.length > 0 && initialCompletedCount === initialSets.length));

  useEffect(() => {
    completionState.current = new Map(initialSets.map((set) => [set.id, set.isCompleted]));
    const nextCompletedCount = initialSets.filter((set) => set.isCompleted).length;
    setCompletedCount(nextCompletedCount);
    setIsOpen(!(initialSets.length > 0 && nextCompletedCount === initialSets.length));
  }, [exerciseId, initialSets]);

  useEffect(() => {
    const handleCompletion = (event: Event) => {
      const detail = (event as CustomEvent<CompletionDetail>).detail;
      if (!detail || !completionState.current.has(detail.setId)) return;

      completionState.current.set(detail.setId, detail.isCompleted);
      const values = Array.from(completionState.current.values());
      const nextCompletedCount = values.filter(Boolean).length;
      setCompletedCount(nextCompletedCount);

      if (values.length > 0 && nextCompletedCount === values.length) {
        setIsOpen(false);
      }
    };

    window.addEventListener(WORKOUT_SET_COMPLETION_EVENT, handleCompletion);
    return () => window.removeEventListener(WORKOUT_SET_COMPLETION_EVENT, handleCompletion);
  }, []);

  const allComplete = initialSets.length > 0 && completedCount === initialSets.length;

  return (
    <section className={`rounded-2xl border bg-slate-950 p-3 transition ${allComplete ? "border-emerald-500/30" : "border-slate-800"}`}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls={`exercise-panel-${exerciseId}`}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {allComplete ? <CheckCircle2 size={17} className="shrink-0 text-emerald-300" /> : null}
            <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{exerciseName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${allComplete ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-slate-800 bg-slate-900 text-slate-400"}`}>
            {completedCount}/{initialSets.length || plannedSets} sets
          </span>
          <ChevronDown size={18} className={`text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </div>
      </button>

      <div id={`exercise-panel-${exerciseId}`} className={isOpen ? "mt-3 block" : "hidden"}>
        {children}
      </div>
    </section>
  );
}
