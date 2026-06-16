"use client";

import { Button } from "@/components/ui/Button";

export default function ProtectedError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-2xl border border-red-900 bg-red-950/30 p-4">
      <p className="font-semibold text-red-100">Unable to load this view.</p>
      <p className="mt-2 text-sm text-red-200/80">{error.message || "Unexpected application error."}</p>
      <Button type="button" variant="secondary" className="mt-4" onClick={() => reset()}>
        Retry
      </Button>
    </div>
  );
}
