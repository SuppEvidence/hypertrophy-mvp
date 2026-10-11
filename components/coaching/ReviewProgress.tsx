"use client";

import { useFormStatus } from "react-dom";

/** Must be rendered inside the review form, alongside its submit button. */
export function ReviewProgress({ label = "Analyzing…", detail = "Your current plan stays in place until changes are approved." }: { label?: string; detail?: string }) {
  const { pending } = useFormStatus();
  return <p role="status" aria-live="polite" className="mt-2 text-xs text-sky-200">
    {pending ? `${label} This may take a few minutes. ${detail}` : null}
  </p>;
}
