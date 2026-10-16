"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
export function SyncSavedProfiles({ pending }: { pending: number }) {
  const router = useRouter(); const running = useRef(false);
  const [message,setMessage] = useState("");
  useEffect(() => {
    if (!pending || running.current) return;
    let cancelled = false;
    running.current = true;
    async function sync() {
      let done = 0;
      setMessage("Applying saved accepted profiles to exercise classifications. No AI analysis is running.");
      try {
        for (let batch=0;batch<100 && !cancelled;batch++) {
          const response=await fetch("/api/exercises/sync-profiles",{method:"POST"});
          const result=await response.json();
          if(!response.ok) throw new Error(result.error ?? "Profile conversion paused.");
          done += result.applied + result.review + result.skipped;
          if (cancelled) return;
          setMessage(`${done} saved profiles checked. ${result.remaining} remaining. No AI calls used.`);
          if (!result.remaining) { router.refresh(); return; }
        }
        if (!cancelled) { setMessage("Saved updates are retained. Reload to continue the remaining profiles."); router.refresh(); }
      } catch(error) { if(!cancelled) setMessage(error instanceof Error ? error.message : "Conversion paused. Reload to resume."); }
      finally { running.current=false; }
    }
    // Defer until the effect survives React Strict Mode cleanup.
    const timer = setTimeout(() => { void sync(); }, 0);
    return () => { clearTimeout(timer); cancelled=true; running.current=false; };
  },[pending,router]);
  if (!pending && !message) return null;
  return <p role="status" className="rounded-xl border border-slate-700 p-3 text-sm text-slate-300">{message || `${pending} saved profiles will be updated without reanalysis.`}</p>;
}
