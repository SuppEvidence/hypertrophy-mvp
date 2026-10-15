"use client";
/* eslint-disable @next/next/no-img-element -- authenticated image route; no public or cached image URLs */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PHOTO_VIEWS, type VisualEnvelope, type PhysiqueSettings } from "@/lib/physique/policy";
import { preparePhysiquePhoto } from "@/lib/physique/prepare-photo";
import type { getPhysiquePageData } from "@/lib/server/physique-checkins";
type Data=Awaited<ReturnType<typeof getPhysiquePageData>>;
type Checkin=Data["checkins"][number];
const inputClass="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100";
const pretty=(s:string)=>s.toLowerCase().replaceAll("_"," ");
function Report({report}:{report:VisualEnvelope}){const a=report.result;return <div className="space-y-3 text-sm text-slate-300">
  <p>{a.summary}</p><p className="text-xs text-slate-500">Photos taken {report.takenOn}{report.comparedOn?` · compared with ${report.comparedOn}`:" · baseline assessment"}</p>
  <p className="text-xs text-slate-400">Photo comparison: {a.photoQuality.comparable?"usable":"limited"} · {pretty(a.photoQuality.confidence)} confidence. {a.photoQuality.issues.join(" ")}</p>
  {a.regions.map((r,i)=><div key={i}><strong>{r.area} · {pretty(r.confidence)}</strong><p>{r.observation}</p><p className="text-slate-400">{r.interpretation}</p></div>)}
  {!!a.changes.length&&<div><h4 className="font-semibold">Changes supported by the photos</h4><ul className="list-disc pl-5">{a.changes.map((c,i)=><li key={i}>{c}</li>)}</ul></div>}
  {!!a.priorities.length&&<div><h4 className="font-semibold">Proposed physique priorities</h4><ul className="list-disc pl-5">{a.priorities.map((p,i)=><li key={i}>{p.rationale} ({pretty(p.confidence)})</li>)}</ul></div>}
  <p>{a.phaseConsideration}</p><ul className="list-disc pl-5">{a.practicalNextSteps.map((p,i)=><li key={i}>{p}</li>)}</ul>
  {!!a.questions.length&&<p className="text-orange-300">Worth clarifying: {a.questions.join(" ")}</p>}
  <p className="text-xs text-slate-500">{a.limitations.join(" ")}</p>
</div>;}
function Measurements({row}:{row:Checkin}){return <p className="text-xs text-slate-400">{row.measurements?Object.entries(row.measurements).filter(([k,v])=>v!==null&&!["metricLogId","loggedOn"].includes(k)).map(([k,v])=>`${k}: ${v} ${k==="bodyweight"?"kg":"mm"}`).join(" · "):"No measurements linked. Photos remain a visual record of this date."}</p>;}
export function PhysiqueCheckins({initialDate}:{initialDate:string}){
  const [date,setDate]=useState(initialDate),[data,setData]=useState<Data|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState("");
  const [notes,setNotes]=useState(""),[metricId,setMetricId]=useState(""),[comparison,setComparison]=useState("AUTO");
  const [settings,setSettings]=useState<PhysiqueSettings|null>(null);const lock=useRef(false);
  const current=data?.checkins.find(c=>c.takenOn===date);
  async function load(day:string){const r=await fetch(`/api/physique?date=${encodeURIComponent(day)}`,{cache:"no-store"});const d=await r.json();if(!r.ok)throw new Error(d.error);setData(d);setSettings(d.settings);const selected=d.checkins.find((c:Checkin)=>c.takenOn===day);setNotes(selected?.notes??"");setMetricId(selected?.metricLogId??(d.metrics.length===1?d.metrics[0].id:""));return d as Data;}
  useEffect(()=>{let live=true;setError("");setData(null);setComparison("AUTO");
    fetch(`/api/physique?date=${encodeURIComponent(date)}`,{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error);if(!live)return;setData(d);setSettings(d.settings);const c=d.checkins.find((c:Checkin)=>c.takenOn===date);setNotes(c?.notes??"");setMetricId(c?.metricLogId??(d.metrics.length===1?d.metrics[0].id:""));}).catch(e=>{if(live)setError(String(e.message));});return()=>{live=false;};},[date]);
  async function request(input:unknown){const r=await fetch("/api/physique",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)});const result=await r.json();if(!r.ok)throw new Error(result.error??"Request failed.");return result;}
  async function act(label:string,work:()=>Promise<unknown>){if(lock.current)return;lock.current=true;setBusy(label);setError("");try{await work();await load(date);}catch(e){setError(e instanceof Error?e.message:"Check-in failed.");}finally{lock.current=false;setBusy("");}}
  const base={id:current?.id,revision:current?.revision};
  function stale(report:VisualEnvelope|null){if(!report||!current)return true;const baseline=report.comparisonId?data?.checkins.find(c=>c.id===report.comparisonId):null;return report.signature!==current.signature||(report.comparisonId&&(!baseline||report.comparisonSignature!==baseline.signature));}
  async function upload(view:string,file:File){if(!current)return;const blob=await preparePhysiquePhoto(file);const form=new FormData();form.set("id",current.id);form.set("revision",String(current.revision));form.set("view",view);form.set("photo",blob,"photo.jpg");const r=await fetch("/api/physique",{method:"POST",body:form});const result=await r.json();if(!r.ok)throw new Error(result.error);}
  return <div className="space-y-5">
    <Card><div className="space-y-3"><h2 className="font-semibold text-slate-100">Photo check-ins and history</h2><p className="text-sm text-slate-400">Use the date the photos were taken. Add older photo sets to their existing measurement dates to build a visual history. Uploading does not run AI.</p>
      <label className="block text-sm text-slate-300">Photo date<input type="date" className={inputClass} value={date} disabled={!!busy} onChange={e=>{if(e.target.value)setDate(e.target.value);}} /></label>
      <p className="text-xs text-slate-400">{data?.intervalDays?`Current phase: ${pretty(data.phase??"unknown")}. Photo interval: ${data.intervalDays/7} weeks. ${data.dueOn?`Next photo date: ${data.dueOn}.`:"Add a baseline to start the schedule."}`:"Choose your phase in Metrics and training experience below to set the photo schedule."}</p>
      <p className="text-xs text-slate-500">Cadence uses photo dates, not upload dates. Shorter check-ins for training/recovery do not require new photos. Maintenance uses your adjustable interval.</p>
      <Link href="/metrics" className="text-sm text-orange-300">Open measurements and phase history</Link>
    </div></Card>
    {error&&<p role="alert" className="rounded-xl border border-orange-900 bg-orange-950/30 p-3 text-sm text-orange-200">{error}</p>}
    {busy&&<p role="status" className="text-sm text-orange-300">{busy}</p>}
    {!data&&!error&&<p className="text-sm text-slate-400">Loading check-ins…</p>}
    {data&&<Card><div className="space-y-4"><h2 className="font-semibold text-slate-100">{current?`Check-in · ${date}`:`Add photos for ${date}`}</h2>
      <label className="block text-sm text-slate-300">Measurements from this date<select className={inputClass} disabled={!!busy} value={metricId} onChange={e=>setMetricId(e.target.value)}><option value="">No linked measurements</option>{data.metrics.map(m=><option key={m.id} value={m.id}>{pretty(m.logType)} · {`${(m as unknown as {bodyweight?:number}).bodyweight??"—"} kg`}</option>)}</select></label>
      {!data.metrics.length&&<p className="text-xs text-slate-400">No completed metric log exists on this date. You can save photos now or add measurements in Metrics first; measurements from another date will not be silently substituted.</p>}
      <label className="block text-sm text-slate-300">Photo conditions and context<textarea className={inputClass} rows={3} maxLength={1600} value={notes} disabled={!!busy} onChange={e=>setNotes(e.target.value)} placeholder="Lighting, morning/evening, pump, posing changes, visual goal or relevant context…" /></label>
      <Button type="button" disabled={!!busy} onClick={()=>act("Saving check-in…",()=>request({operation:"SAVE",data:{date,metricLogId:metricId||null,notes,...(current?{id:current.id,revision:current.revision}:{})}}))}>{current?"Save context and metric link":"Create dated photo check-in"}</Button>
      {current&&<><Measurements row={current}/><p className="text-xs text-slate-400">Use consistent lighting, distance, camera height and poses. Each angle can be uploaded/replaced independently. Images are resized and metadata removed; saved images are private.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{PHOTO_VIEWS.map(view=>{const photo=current.photos.find(p=>p.view===view);return <div key={view} className="space-y-2 rounded-xl border border-slate-800 p-2"><h3 className="text-xs font-semibold text-slate-300">{pretty(view)}</h3>{photo&&<><img loading="lazy" src={`/api/physique/${current.id}/photos/${photo.id}?r=${current.revision}`} alt={`${pretty(view)} taken ${date}`} className="aspect-[3/4] w-full rounded-lg object-contain" /><Button type="button" variant="ghost" disabled={!!busy} onClick={()=>act("Deleting photo…",()=>request({operation:"DELETE_PHOTO",...base,photoId:photo.id}))}>Delete photo</Button></>}<label className="block text-xs text-slate-400">{photo?"Replace":"Upload"}<input type="file" accept="image/*" disabled={!!busy} className="mt-1 w-full text-xs" onChange={e=>{const f=e.target.files?.[0];e.target.value="";if(f)void act("Preparing and saving photo…",()=>upload(view,f));}} /></label></div>;})}</div>
        <label className="block text-sm text-slate-300">Comparison photo set<select className={inputClass} disabled={!!busy} value={comparison} onChange={e=>setComparison(e.target.value)}><option value="AUTO">Suggest an earlier set for this phase</option><option value="NONE">Baseline only</option>{data.checkins.filter(c=>c.takenOn<date&&c.photos.length).map(c=><option key={c.id} value={c.id}>{c.takenOn} · {c.photos.length} views</option>)}</select></label>
        <Button type="button" disabled={!!busy||!current.photos.length||notes!==current.notes||metricId!==(current.metricLogId??"")} onClick={()=>act("Analyzing dated photo sets…",()=>request({operation:"ANALYZE",...base,...(comparison==="AUTO"?{}:{comparisonId:comparison==="NONE"?null:comparison})}))}>Analyze photo check-in</Button>
        <p className="text-xs text-slate-500">Save context changes first. Analysis sends this set and at most one earlier set to AI. It does not estimate body fat or prescribe calorie/macro targets. Opening the page and uploading photos do not trigger analysis.</p>
        {current.draft&&<div className="space-y-3 rounded-xl border border-orange-900 p-3"><h3 className="font-semibold text-orange-300">Proposed assessment{stale(current.draft)?" · sources changed, reanalyze":""}</h3><Report report={current.draft}/><div className="flex flex-wrap gap-2"><Button type="button" disabled={!!busy||!!stale(current.draft)} onClick={()=>act("Accepting assessment…",()=>request({operation:"ACCEPT",...base}))}>Accept visual assessment</Button><Button type="button" variant="secondary" disabled={!!busy} onClick={()=>act("Discarding proposal…",()=>request({operation:"DISCARD",...base}))}>Discard proposal</Button></div><p className="text-xs text-slate-400">Acceptance makes this dated evidence available to coaching. It does not automatically change your phase, priorities or workouts.</p></div>}
        {current.accepted&&<details className="space-y-3 rounded-xl border border-slate-700 p-3"><summary className="cursor-pointer text-sm text-slate-200">Accepted visual assessment{stale(current.accepted)?" · sources changed, reanalyze":""}</summary><Report report={current.accepted}/></details>}
      </>}
    </div></Card>}
    {settings&&<Card><details><summary className="cursor-pointer font-semibold text-slate-100">Goals and photo cadence</summary><div className="mt-4 space-y-3">
      <label className="block text-sm text-slate-300">Physique goal<textarea className={inputClass} rows={3} maxLength={1200} value={settings.goal} disabled={!!busy} onChange={e=>setSettings({...settings,goal:e.target.value})} placeholder="The look, proportions and sustainable condition you want…" /></label>
      <label className="block text-sm text-slate-300">Training experience<select className={inputClass} value={settings.trainingLevel} disabled={!!busy} onChange={e=>setSettings({...settings,trainingLevel:e.target.value as PhysiqueSettings["trainingLevel"]})}><option value="UNSPECIFIED">Choose experience</option><option value="BEGINNER_MID_INTERMEDIATE">Beginner to mid-intermediate · 4-week gaining reviews</option><option value="LATE_INTERMEDIATE_ADVANCED">Late-intermediate to advanced · 8–12-week gaining reviews</option></select></label>
      <label className="block text-sm text-slate-300">Advanced gaining interval<select className={inputClass} disabled={!!busy} value={settings.gainWeeks} onChange={e=>setSettings({...settings,gainWeeks:Number(e.target.value) as 8|10|12})}>{[8,10,12].map(w=><option key={w} value={w}>{w} weeks</option>)}</select></label>
      <label className="block text-sm text-slate-300">Maintenance interval (adjustable default: 6 weeks)<input type="number" min={4} max={12} className={inputClass} value={settings.maintenanceWeeks} disabled={!!busy} onChange={e=>setSettings({...settings,maintenanceWeeks:Number(e.target.value)})}/></label>
      <p className="text-xs text-slate-400">Standard fat loss: every 2 weeks. A due date is a reminder to review, not an obligation to change the plan.</p>
      <Button type="button" disabled={!!busy} onClick={()=>act("Saving goals and cadence…",()=>request({operation:"SETTINGS",data:settings}))}>Save goals and cadence</Button>
    </div></details></Card>}
    {!!data?.checkins.length&&<Card><h2 className="mb-3 font-semibold text-slate-100">Photo timeline</h2><div className="space-y-2">{data.checkins.map(c=><button type="button" key={c.id} disabled={!!busy} onClick={()=>setDate(c.takenOn)} className="block w-full rounded-xl border border-slate-800 p-3 text-left text-sm text-slate-300">{c.takenOn} · {c.photos.length} photos · {c.accepted?"assessment saved":c.draft?"proposal ready":"not analyzed"}<Measurements row={c}/></button>)}</div></Card>}
  </div>;
}
