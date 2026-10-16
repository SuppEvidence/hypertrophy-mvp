// Offline integration: real service, in-memory DB/Storage/AI, real image normalization.
import assert from "node:assert/strict";
import { build } from "esbuild";
import Module from "node:module";
import path from "node:path";
import sharp from "sharp";
const userId="11111111-1111-4111-8111-111111111111",other="22222222-2222-4222-8222-222222222222";
const muscleId="33333333-3333-4333-8333-333333333333";
let seq=0;const uuid=()=>`44444444-4444-4444-8444-${String(++seq).padStart(12,"0")}`;
const rows=new Map(),objects=new Map();let calls=0,lastRequest,failProvider=false,duringAI;
const settings={physiqueTrainingLevel:"LATE_INTERMEDIATE_ADVANCED",physiqueGainWeeks:10,physiqueMaintenanceWeeks:6,physiqueGoal:"Classic proportions"};
const metrics=[{id:uuid(),userId,loggedAt:new Date("2026-08-06T12:00:00Z"),updatedAt:new Date("2026-08-06T12:00:00Z"),isDraft:false,bodyweight:76,waist:760,chest:955,shoulders:1190,arms:390,thighs:580,glutes:null,calves:null},
 {id:uuid(),userId,loggedAt:new Date("2026-10-15T12:00:00Z"),updatedAt:new Date("2026-10-15T12:00:00Z"),isDraft:false,bodyweight:74,waist:720,chest:955,shoulders:1165,arms:390,thighs:580,glutes:null,calves:null}];
const full=r=>r?{...r,photos:[...r.photos].map(p=>({...p})),metricLog:metrics.find(m=>m.id===r.metricLogId)??null}:null;
function valid(r,w){return !!r&&(!w.id||r.id===w.id)&&(!w.userId||r.userId===w.userId)&&(w.revision===undefined||r.revision===w.revision)&&(!w.analysisToken||r.analysisToken===w.analysisToken);}
function apply(r,data){for(const[k,v]of Object.entries(data)){if(k==="revision")r[k]+=v.increment;else if(k==="analysisDraft"&&v&&v.constructor?.name?.includes("DbNull"))r[k]=null;else r[k]=v;}r.updatedAt=new Date();}
const db={
 programMesocycle:{findFirst:async()=>null},
 userSettings:{findUnique:async()=>settings,upsert:async({update})=>Object.assign(settings,update)},
 energyPhase:{findMany:async()=>[{phase:"GAINING",startDate:new Date("2026-07-01")}]},
 muscle:{findMany:async()=>[{id:muscleId,name:"Side delts",slug:"side-delts",accountingSlug:null,visualAssessable:true}]},
 metricLog:{findFirst:async({where})=>metrics.find(m=>m.id===where.id&&m.userId===where.userId&&!m.isDraft)??null,findMany:async({where})=>metrics.filter(m=>m.userId===where.userId&&m.loggedAt>=where.loggedAt.gte&&m.loggedAt<where.loggedAt.lt)},
 physiqueCheckin:{
  findFirst:async({where})=>full([...rows.values()].find(r=>valid(r,where))),
  findUnique:async({where})=>full([...rows.values()].find(r=>r.userId===where.userId_takenOn.userId&&+r.takenOn===+where.userId_takenOn.takenOn)),
  findMany:async({where})=>[...rows.values()].filter(r=>r.userId===where.userId&&(!where.takenOn?.lt||r.takenOn<where.takenOn.lt)&&(!where.takenOn?.lte||r.takenOn<=where.takenOn.lte)&&(!where.photos?.some||r.photos.length)&&(!where.acceptedAnalysis||r.acceptedAnalysis)).sort((a,b)=>b.takenOn-a.takenOn).map(full),
  create:async({data})=>{const r={id:uuid(),photos:[],revision:0,analysisDraft:null,acceptedAnalysis:null,analysisToken:null,...data};rows.set(r.id,r);return full(r);},
  updateMany:async({where,data})=>{const r=rows.get(where.id);if(!valid(r,where))return{count:0};if(where.OR&&r.analysisToken&&!(r.analysisStartedAt<where.OR[1].analysisStartedAt.lt))return{count:0};apply(r,data);return{count:1};},
  update:async({where,data})=>{apply(rows.get(where.id),data);return full(rows.get(where.id));},
 },
 physiquePhoto:{
  findFirst:async({where})=>{const r=rows.get(where.checkinId);return r?.userId===where.userId?r.photos.find(p=>p.id===where.id&&p.userId===where.userId)??null:null;},
  upsert:async({where,create,update})=>{const row=rows.get(where.checkinId_view.checkinId),old=row.photos.find(p=>p.view===where.checkinId_view.view);if(old)Object.assign(old,update);else row.photos.push({id:uuid(),createdAt:new Date(),...create});},
  deleteMany:async({where})=>{for(const r of rows.values())r.photos=r.photos.filter(p=>!(p.id===where.id&&p.userId===where.userId&&p.objectPath===where.objectPath));},
 },
 $transaction:async fn=>fn(db),
};
const storage={storage:{from:bucket=>{assert.equal(bucket,"physique-checkins");return{
 upload:async(p,b)=>{assert.ok(p.startsWith(`${userId}/`));objects.set(p,Buffer.from(b));return{error:null};},
 download:async p=>objects.has(p)?{data:new Blob([objects.get(p)]),error:null}:{data:null,error:new Error("missing")},
 remove:async paths=>{paths.forEach(p=>objects.delete(p));return{error:null};},
};}}};
const output={summary:"Definition differs while similar circumferences need context.",photoQuality:{comparable:true,confidence:"MODERATE",issues:[]},regions:[{muscleId,area:"Shoulders",observation:"Lateral shoulder outline visible.",interpretation:"Possible development priority; photos alone cannot prove growth.",confidence:"LOW"}],changes:["Waist definition is clearer across corresponding views."],priorities:[{muscleId,rationale:"Lateral delts suit the stated proportions goal.",confidence:"MODERATE"}],phaseConsideration:"This describes the photo date only.",practicalNextSteps:["Keep photo conditions consistent."],questions:[],limitations:["Lighting and posing may affect appearance."]};
const ai={responses:{parse:async input=>{calls++;lastRequest=input;if(duringAI)await duringAI();if(failProvider)throw new Error("Provider failed");return{output_parsed:structuredClone(output),status:"completed"};}}};
globalThis.__physiqueTest={db,storage,ai};
const result=await build({stdin:{contents:'export * from "./lib/server/physique-checkins"; export * from "./lib/server/physique-evidence";',resolveDir:process.cwd(),loader:"ts"},bundle:true,write:false,platform:"node",format:"cjs",packages:"external",plugins:[{name:"mock-service",setup(b){
 b.onResolve({filter:/^(server-only|@\/lib\/db\/prisma|@\/lib\/auth\/server|@\/lib\/ai\/openai)$/},a=>({path:a.path,namespace:"mock"}));
 b.onLoad({filter:/.*/,namespace:"mock"},a=>({contents:a.path==="server-only"?"":a.path.includes("db/prisma")?"export const prisma=globalThis.__physiqueTest.db;":a.path.includes("auth/server")?"export async function createClient(){return globalThis.__physiqueTest.storage;}":"export function getOpenAIClient(){return globalThis.__physiqueTest.ai;}",loader:"js"}));
}}]});
const filename=path.resolve("scripts/physique-test.cjs"),mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(result.outputFiles[0].text,filename);const svc=mod.exports;
const jpeg=await sharp({create:{width:240,height:320,channels:3,background:"#999"}}).withMetadata().jpeg().toBuffer();
const add=async(date,metric)=>{const r=await svc.savePhysiqueCheckin(userId,{date,metricLogId:metric,notes:"Morning; consistent lighting"});await svc.uploadPhysiquePhoto(userId,r.id,0,"FRONT",new File([jpeg],"photo.jpg",{type:"image/jpeg"}));return rows.get(r.id);};
const old=await add("2026-08-06",metrics[0].id),now=await add("2026-10-15",metrics[1].id);
assert.equal(calls,0,"Saving and uploading historical photos never calls AI");
const storedMetadata=await sharp([...objects.values()][0]).metadata();assert.equal(storedMetadata.exif,undefined,"Server strips original EXIF");
assert.ok(storedMetadata.width<=960&&storedMetadata.height<=1280);
await assert.rejects(svc.savePhysiqueCheckin(userId,{date:"2026-10-14",metricLogId:metrics[1].id,notes:""}),/photo date/);
await assert.rejects(svc.readPhysiquePhoto(other,now.id,now.photos[0].id),/not found/);
await svc.analyzePhysiqueCheckin(userId,now.id,now.revision);
assert.equal(calls,1);assert.equal(now.acceptedAnalysis,null,"New visual results require acceptance");
assert.equal(now.analysisDraft.comparisonId,old.id,"Advanced gain comparison uses 10-week interval");
assert.equal(now.analysisDraft.takenOn,"2026-10-15");assert.equal(now.analysisDraft.comparedOn,"2026-08-06");
const inputText=JSON.stringify(lastRequest);assert.ok(inputText.includes('"detail":"high"'));assert.equal(lastRequest.store,false);
assert.ok(inputText.includes("76"));assert.ok(inputText.includes("74"));assert.ok(inputText.includes("2026-08-06"));
assert.equal(lastRequest.input[1].content.filter(x=>x.type==="input_image").length,2);
await svc.reviewPhysiqueAnalysis(userId,now.id,now.revision,true);assert.equal(calls,1,"Acceptance makes no additional AI call");
assert.ok(now.acceptedAnalysis.acceptedAt);
const oldAccepted=now.acceptedAnalysis;
assert.equal((await svc.getPhysiqueEvidence(userId,new Date("2026-10-15T20:00:00Z"))).assessments.length,1);
assert.equal((await svc.getPhysiqueEvidence(userId,new Date("2026-08-10T20:00:00Z"))).assessments.length,0,"Future photo sets never leak into historical coaching");
const originalMetricDate=metrics[0].updatedAt;metrics[0].updatedAt=new Date("2026-10-16");
assert.equal((await svc.getPhysiqueEvidence(userId,new Date("2026-10-15T20:00:00Z"))).assessments.length,0,"Editing comparison metrics invalidates derived context");
metrics[0].updatedAt=originalMetricDate;
failProvider=true;await assert.rejects(svc.analyzePhysiqueCheckin(userId,now.id,now.revision),/Provider failed/);failProvider=false;
assert.equal(now.analysisToken,null,"Provider failure releases lock");assert.deepEqual(now.acceptedAnalysis,oldAccepted);
duringAI=()=>{now.notes="Changed during AI";now.revision++;};await assert.rejects(svc.analyzePhysiqueCheckin(userId,now.id,now.revision),/sources changed/);duringAI=undefined;
assert.equal(now.analysisToken,null);
now.notes="Morning; consistent lighting";
await svc.analyzePhysiqueCheckin(userId,now.id,now.revision,null);assert.equal(now.analysisDraft.comparisonId,null);
metrics[1].updatedAt=new Date("2026-10-16");
await assert.rejects(svc.reviewPhysiqueAnalysis(userId,now.id,now.revision,true),/outdated/);
now.analysisToken=uuid();now.analysisStartedAt=new Date();const before=calls;
await assert.rejects(svc.analyzePhysiqueCheckin(userId,now.id,now.revision),/already running/);assert.equal(calls,before,"Duplicate analysis blocked before AI");now.analysisToken=null;
const view=await svc.getPhysiquePageData(userId,"2026-10-15");assert.equal(calls,before,"Browsing history never calls AI");assert.ok(view.dueOn);assert.equal(view.metrics[0].id,metrics[1].id);
console.log("Historical metric linking, private photos, normalization, comparison sources, explicit AI, approval, stale-source and concurrency checks passed.");
