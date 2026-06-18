"use client";

import { useState } from "react";
import { deleteWorkoutSession } from "@/lib/server/workouts";
import { Button } from "@/components/ui/Button";

type DeleteWorkoutButtonProps = {
  sessionId: string;
  label?: string;
};

export function DeleteWorkoutButton({ sessionId, label = "Delete workout" }: DeleteWorkoutButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  return (
    <form
      action={deleteWorkoutSession.bind(null, sessionId)}
      onSubmit={(event) => {
        if (!isConfirming) {
          event.preventDefault();
          setIsConfirming(true);
          return;
        }
      }}
      className="space-y-2"
    >
      {isConfirming ? (
        <p className="rounded-xl border border-red-900 bg-red-950/40 p-3 text-xs text-red-100">
          This permanently deletes the workout and removes it from dashboard and performance calculations.
        </p>
      ) : null}
      <Button type="submit" variant="danger" className="w-full">
        {isConfirming ? "Confirm delete" : label}
      </Button>
      {isConfirming ? (
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          className="w-full rounded-xl border border-slate-800 px-4 py-2 text-sm font-semibold text-slate-300"
        >
          Cancel
        </button>
      ) : null}
    </form>
  );
}
