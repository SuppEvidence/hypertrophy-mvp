"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
export function ExerciseCoachBackfill({ candidates }: { candidates: Array<{ id: string; name: string; revision: number }> }) {
  const router = useRouter(); const lock = useRef(false); const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Array<{ id: string; text: string }>>([]);
  const batch = candidates.slice(0, 3);
  async function enrich() {
    if (lock.current) return; lock.current = true; setBusy(true); setMessages([]);
    try {
      for (const exercise of batch) {
        const response = await fetch(`/api/exercises/${exercise.id}/coach`, { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "ANALYZE", revision: exercise.revision }) });
        const result = await response.json();
        setMessages(old => [...old, { id: exercise.id, text: `${exercise.name}: ${response.ok ? "proposal ready for review" : result.error ?? "analysis failed"}` }]);
        if (!response.ok) break;
      }
    } catch { setMessages(old => [...old, { id: "", text: "Connection interrupted. Reload to see saved proposals." }]); }
    finally { setBusy(false); lock.current = false; router.refresh(); }
  }
  if (!batch.length && !messages.length) return null;
  return <Card><div className="space-y-3"><h2 className="font-semibold text-slate-100">Enrich existing exercises</h2>
    <p className="text-sm text-slate-400">Generate description-based coaching proposals for up to three exercises from this filtered list. Each exercise uses one AI analysis. Review and accept each proposal on its exercise page; setup-dependent details can be clarified there.</p>
    {batch.length > 0 && <p className="text-xs text-slate-400">Next: {batch.map(x => x.name).join(", ")}</p>}
    <Button type="button" disabled={busy || !batch.length} onClick={enrich}>{busy ? "Generating proposals…" : `Propose profiles for ${batch.length} exercises`}</Button>
    <div role="status" className="space-y-2 text-sm text-slate-300">{messages.map((m, i) => m.id ? <p key={i}><Link className="underline" href={`/exercises/${m.id}`}>{m.text}</Link></p> : <p key={i}>{m.text}</p>)}</div>
  </div></Card>;
}
