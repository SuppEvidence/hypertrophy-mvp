"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ProtectedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-red-800/70 bg-red-950/40 p-5 shadow-lg shadow-red-950/20">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-red-500/10 p-2 text-red-300">
          <AlertTriangle size={20} />
        </div>
        <div>
          <p className="font-semibold text-red-100">Unable to load this view</p>
          <p className="mt-1 text-sm leading-6 text-red-200/75">{error.message || "Unexpected application error."}</p>
        </div>
      </div>
      <Button type="button" variant="secondary" className="mt-4" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
