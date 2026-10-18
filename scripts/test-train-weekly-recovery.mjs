import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Module from 'node:module';
import path from 'node:path';
const modules = {
  '@/lib/server/workout-exercise-guidance': ['getWorkoutExerciseGuidance'],
  '@/lib/server/effective-exercise-data': ['getUserExercisePrisma'],
  '@/lib/server/exercise-catalog-policy': ['activeExerciseWhere'],
  'next/cache': ['revalidatePath'], 'next/navigation': ['redirect'], 'next/server': ['after'],
  '@/lib/auth/user': ['requireUserId'], '@/lib/server/templates': ['ensureProgramTemplates'],
  '@/lib/server/prescriptions': ['getTemplatePrescription'],
  '@/lib/server/pre-workout-coach': ['resolvePreWorkoutCoachProposalForUser'],
  '@/lib/server/exercise-choice-memory': ['rememberedTemplateExerciseChoices'],
  '@/lib/server/weekly-coach-read': ['readApprovedWeek'],
  '@/lib/coaching/weekly-coach-calendar': ['helsinkiDate'],
  '@/lib/server/automatic-coaching': ['runAutomaticPostWorkoutCoaching'],
  '@/lib/templates/rotationSequence': ['getNextTemplateFromRotation'],
  '@/lib/templates/weeklyPlan': ['parseStoredWeeklyPlan'],
  '@/lib/validations/workout': ['finishWorkoutSchema', 'startWorkoutSchema', 'stimulusSessionExerciseSchema', 'workoutSetSchema'],
};
// A virtual entry exports both modules from the same bundle on every platform.
// Avoid injecting an export through an onLoad path regex: Windows paths use backslashes.
const result = await build({ stdin: {
  contents: `export * from './lib/server/workouts';
export { WeeklyWorkoutUnavailableError as __weeklyError } from './lib/coaching/weekly-workout-error';`,
  resolveDir: process.cwd(), sourcefile: 'train-recovery-entry.ts', loader: 'ts',
}, bundle: true, write: false,
  platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'mock-boundaries', setup(b) {
    b.onResolve({ filter: /.*/ }, ({path: p}) => modules[p] ? {path:p, namespace:'mock'} : undefined);
    b.onLoad({ filter: /.*/, namespace:'mock' }, ({path:p}) => ({contents: modules[p].map(name => { const fn = `(...args) => { const fn = globalThis.__trainMocks[${JSON.stringify(name)}]; if (!fn) throw new Error('Unexpected dependency: ${name}'); return fn(...args); }`; return `export const ${name} = ${name.endsWith('Schema') ? `{parse: ${fn}}` : fn};`; }).join('\n'), loader:'js'}));
  }}] });
const filename = path.resolve('scripts/train-recovery-test.cjs');
const mod = new Module(filename); mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename));
mod._compile(result.outputFiles[0].text,filename);
const program={id:'program',userId:'user',isActive:true,rotationStyle:'WEEKDAY_BASED'};
const template={id:'template',name:'Upper',sequenceIndex:0,weekday:5};
const occurrence={id:'weekly',date:'2026-10-16',templateId:template.id,durationMinutes:60};
let failure='';let previewCalls=0;let writes=0;const seen=[];
const db={program:{findMany:async()=>[program]},exercise:{findMany:async()=>[]},setType:{findMany:async()=>[]},workoutSession:{findMany:async()=>[]},$transaction:async()=>{writes++;throw new Error('Unexpected write')}};
globalThis.__trainMocks={getWorkoutExerciseGuidance:async()=>({}),getUserExercisePrisma:()=>db,requireUserId:async()=>program.userId,
 activeExerciseWhere:()=>({}),ensureProgramTemplates:async()=>[template],
 readApprovedWeek:async()=>({distribution:{workouts:[occurrence]},missedIds:[],startedIds:[]}),
 helsinkiDate:()=>occurrence.date,rememberedTemplateExerciseChoices:async()=>new Map(),
 parseStoredWeeklyPlan:()=>({missedTemplateIds:[]}),
 getTemplatePrescription:async(...args)=>{previewCalls++;seen.push(args);if(failure==='weekly'){
   // Throw the exact class used by the bundled prescription boundary.
   const ErrorClass=mod.exports.__weeklyError;
   throw new ErrorClass();
 }if(failure==='database')throw new Error('Database unavailable');
 return {activeMesocycle:null,generated:{weeklyPlan:{weekStart:'2026-10-12'}},templateItems:[]};},
};

assert.equal(typeof mod.exports.__weeklyError, 'function', 'The test bundle must export the application error constructor');
const load=mod.exports.getWorkoutLoggerData;
let data=await load();
assert.equal(data.weeklyWorkoutUnavailable,false);
assert.equal(data.selectedOccurrence.id,occurrence.id);
assert.equal(seen.at(-1)[3],occurrence.id);
failure='weekly';
data=await load();
assert.equal(data.weeklyWorkoutUnavailable,true);
assert.equal(data.selectedTemplatePrescription,null);
assert.equal(data.selectedOccurrence.id,occurrence.id,'Keep weekly selection; never silently substitute program');
const callsBefore=previewCalls;
data=await load({occurrenceId:'removed'});
assert.equal(data.weeklyWorkoutUnavailable,true);
assert.equal(previewCalls,callsBefore,'Do not preview a different workout for an explicit stale link');
failure='';
data=await load({planSource:'program',occurrenceId:'removed'});
assert.equal(data.weeklyWorkoutUnavailable,false);
assert.equal(data.useProgramPrescription,true);
assert.equal(data.selectedOccurrence,null);
assert.equal(seen.at(-1)[3],undefined,'Explicit recovery uses the program prescription');
failure='database';
await assert.rejects(load(),/Database unavailable/);
failure='weekly';
globalThis.__trainMocks.startWorkoutSchema=(value)=>value;
globalThis.__trainMocks.redirect=(url)=>{throw new Error(`REDIRECT:${url}`)};
const form=new FormData();form.set('programId',program.id);form.set('templateId',template.id);form.set('occurrenceId',occurrence.id);
await assert.rejects(mod.exports.startWorkout(form),/REDIRECT:\/log\?programId=program&templateId=template&occurrenceId=weekly/);
assert.equal(writes,0,'A workout invalidated after preview must not be created');
console.log('PASS: Train renders valid weekly previews, recovers rejected or removed occurrences, requires explicit program fallback, preserves unrelated errors and performs no workout writes.');
