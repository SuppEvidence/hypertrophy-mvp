"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { readMechanics, type MechanicsEnvelope } from "@/lib/coaching/exercise-mechanics";
import { sampleExecutionVideo } from "@/lib/coaching/execution-video";

function ProfileView({ envelope, muscles }: { envelope: MechanicsEnvelope; muscles: Array<{ id: string; name: string }> }) {
  const p = envelope.profile;
  const fields = [["Movement", p.movement], ["Resistance profile", p.resistanceProfile],
    ["Muscle-length exposure", p.muscleLengthExposure], ["Stability and fatigue", p.stabilityAndFatigue], ["Set formats", p.setTypeSuitability]] as const;
  return <div className="space-y-3 text-sm text-slate-300">
    <p>{p.summary}</p>
    <p className="text-xs text-slate-500">{envelope.source === "VIDEO_FRAMES" ? "Video frames + exercise details" : "Exercise description"} · {envelope.assessedAt.slice(0, 10)}</p>
    <ul className="space-y-2">{p.targets.map((t, i) => <li key={i}><strong>{muscles.find(m => m.id === t.muscleId)?.name ?? "Unknown muscle"}</strong>{t.region ? ` (${t.region})` : ""} · {t.role.toLowerCase()} · {t.confidence.toLowerCase()} confidence<p className="text-xs text-slate-400">{t.rationale}</p></li>)}</ul>
    <p className="text-xs text-slate-400">Estimated demand peak: {p.resistanceProfile.peak === "UNKNOWN" ? "not established" : p.resistanceProfile.peak.toLowerCase().replaceAll("_", " ")}</p>
    <dl className="space-y-2">{fields.map(([label, field]) => <div key={label}><dt className="font-semibold">{label} · {field.confidence.toLowerCase()} confidence</dt><dd>{field.description}</dd></div>)}</dl>
    {p.observedExecution.length > 0 && <div><h4 className="font-semibold">Observed execution</h4><ul className="list-disc pl-5">{p.observedExecution.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    {p.techniqueAdvice.length > 0 && <div><h4 className="font-semibold">Technique suggestions</h4><ul className="list-disc pl-5">{p.techniqueAdvice.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    {p.questions.length > 0 && <div><h4 className="font-semibold">Details worth clarifying</h4><ul className="list-disc pl-5">{p.questions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
    <div className="text-xs text-slate-400"><h4 className="font-semibold">Limitations</h4><ul className="list-disc pl-5">{p.limitations.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
  </div>;
}

export function ExerciseMechanicsCoach({ exerciseId, profile, currentBasis, muscles, archived }: {
  exerciseId: string; profile: { mechanicsProfile: unknown; mechanicsDraft: unknown; mechanicsRevision: number; executionSetup: string | null } | null;
  currentBasis: string; muscles: Array<{ id: string; name: string }>; archived: boolean;
}) {
  const router = useRouter(); const [setup, setSetup] = useState(profile?.executionSetup ?? "");
  const [clip, setClip] = useState<File | null>(null); const [busy, setBusy] = useState(""); const [message, setMessage] = useState("");
  const lock = useRef(false); const videoInput = useRef<HTMLInputElement>(null);
  const accepted = readMechanics(profile?.mechanicsProfile); const draft = readMechanics(profile?.mechanicsDraft);
  const stale = accepted && accepted.basis !== currentBasis; const staleDraft = draft && draft.basis !== currentBasis;
  async function run(operation: "ANALYZE" | "ACCEPT" | "DISCARD" | "CLEAR") {
    if (lock.current) return; lock.current = true; setMessage("");
    try {
      setBusy(operation === "ANALYZE" ? (clip ? "Reading clip…" : "Analyzing…") : "Saving…");
      const frames = operation === "ANALYZE" && clip ? await sampleExecutionVideo(clip) : [];
      if (frames.length) setBusy("Analyzing execution…");
      const response = await fetch(`/api/exercises/${exerciseId}/coach`, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, revision: profile?.mechanicsRevision ?? 0, ...(operation === "ANALYZE" ? { setup, frames } : {}) }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Analysis failed.");
      setMessage(operation === "ANALYZE" ? "Proposal ready. Review it before accepting." : operation === "ACCEPT" ? "Accepted. Future coaching can use this profile." : "Profile updated.");
      setClip(null); if (videoInput.current) videoInput.current.value = ""; router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Exercise coaching failed."); }
    finally { setBusy(""); lock.current = false; }
  }
  const inputClass = "w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100";
  return <Card><div className="space-y-4">
    <h2 className="font-semibold text-slate-100">Exercise Coach</h2>
    <p className="text-sm text-slate-400">Build a profile for your actual setup and execution. Describe it, or add a short working-set clip with your body and equipment visible. Include a few complete reps and any intentional partials or body English.</p>
    <label className="block space-y-2 text-sm text-slate-300">Your setup and corrections<textarea className={inputClass} rows={4} maxLength={1600} value={setup} onChange={e => setSetup(e.target.value)} placeholder="Machine model, bench angle, pulley height, grip, ROM, intended execution…" disabled={!!busy} /></label>
    <label className="block space-y-2 text-sm text-slate-300">Optional execution video<input ref={videoInput} className={inputClass} type="file" accept="video/*" disabled={!!busy || archived} onChange={e => setClip(e.target.files?.[0] ?? null)} /></label>
    <p className="text-xs text-slate-500">The clip is sampled into 12 frames. Only those frames are sent for analysis; the original video is not uploaded or retained by the app. Each analysis uses AI; saved profiles are reused by the other coaches.</p>
    <Button type="button" disabled={!!busy || archived} onClick={() => run("ANALYZE")}>{busy || (clip ? "Analyze my execution" : "Propose exercise profile")}</Button>
    {archived && <p className="text-xs text-slate-400">Restore the exercise to request a new analysis. Existing profiles remain readable.</p>}
    {message && <p role="status" className="text-sm text-orange-300">{message}</p>}
    {draft && <div className="space-y-3 rounded-xl border border-orange-700/50 p-3"><h3 className="font-semibold text-orange-300">Proposed profile{staleDraft ? " — outdated" : ""}</h3><ProfileView envelope={draft} muscles={muscles} /><div className="flex flex-wrap gap-2"><Button type="button" disabled={!!busy || !!staleDraft || archived || setup !== (profile?.executionSetup ?? "")} onClick={() => run("ACCEPT")}>Accept profile</Button><Button type="button" variant="secondary" disabled={!!busy} onClick={() => run("DISCARD")}>Discard proposal</Button></div><p className="text-xs text-slate-400">To correct it, update the setup notes above and request another analysis. Catalog muscle links and movement classification stay unchanged; review the exercise form if the profile flags a mismatch.</p></div>}
    {accepted && <details open={!!stale} className="space-y-3 rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-100">Accepted profile{stale ? " — needs reassessment" : ""}</summary>{stale && <p className="text-sm text-orange-300">Exercise details or setup changed. Coaching will treat the old mechanics as outdated.</p>}<ProfileView envelope={accepted} muscles={muscles} /><Button type="button" variant="secondary" disabled={!!busy} onClick={() => run("CLEAR")}>Clear mechanics profile</Button></details>}
  </div></Card>;
}
