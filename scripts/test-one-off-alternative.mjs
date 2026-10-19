// Offline real-action tests; no database, credentials or AI requests.
import assert from 'node:assert/strict';
import Module from 'node:module';
import path from 'node:path';
import { build } from 'esbuild';
let item, sets, writes, locks, evaluations, user = 'owner';
const clone = value => structuredClone(value);
function reset(intent = 'PERSISTENT') {
  item = { id: 'slot', sessionId: 'session', exerciseChoiceIntent: intent, muscleSnapshot: null, exercise: { primaryMuscles: [{ muscleId: 'chest' }] }, userId: 'owner', status: 'DRAFT' };
  sets = [{ id: 'set', sessionExerciseId: 'slot', weight: 40, reps: 10, rir: 2, isCompleted: false, startedAt: null, endedAt: null, setTypeId: 'normal', intensifierDetails: null }];
  writes = []; locks = []; evaluations = 0; user = 'owner';
}
function authorized(where) {
  const scope = where.session ?? where.sessionExercise?.session;
  assert.equal(scope?.userId, user, 'Every read is authenticated');
  return user === item.userId && (typeof scope.status !== 'string' || scope.status === item.status);
}
const db = {
  $transaction: async fn => fn(db),
  $queryRaw: async (strings) => { locks.push(strings.join('?')); return []; },
  workoutSessionExercise: {
    findFirst: async ({where}) => authorized(where) ? {...clone(item), sets: clone(sets)} : null,
    update: async ({data}) => { writes.push(['exercise', data]); Object.assign(item,data); return item; },
  },
  workoutSet: {
    findFirst: async ({where}) => authorized(where) ? {...clone(sets[0]), sessionExercise: clone(item)} : null,
    updateMany: async ({where,data}) => { writes.push(['set',data]); sets.forEach(s => Object.assign(s, data)); return {count:1}; },
    update: async ({data}) => { writes.push(['set',data]); Object.assign(sets[0],data); return sets[0]; },
  },
  setType: {findFirst: async () => ({id:'normal'})},
  workoutCoachAction: {updateMany: async ({where,data}) => { assert.equal(where.userId,user); writes.push(['coach',data]); return {count:0}; }},
};
globalThis.__oneOff = {db, user: () => user, evaluated: () => evaluations++};
const mocks = {
  'server-only': '',
  '@/lib/db/prisma': 'export const prisma=globalThis.__oneOff.db;',
  '@/lib/auth/user': 'export const requireUserId=async()=>globalThis.__oneOff.user();',
  'next/cache': 'export const revalidatePath=()=>{};',
  '@/lib/server/workout-coach-outcomes': 'export const evaluatePendingWorkoutCoachActionsForSet=async()=>globalThis.__oneOff.evaluated();',
};
const built = await build({stdin:{contents:`export * from './lib/server/one-off-alternative'; export * from './lib/server/workout-set-autosave'; export * from './lib/server/set-tracking-server'; export * from './lib/workouts/summary'; export * from './lib/server/effective-exercise-data'; export * from './lib/coaching/exercise-choice-policy';`,resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'mocks',setup(b){
  b.onResolve({filter:/.*/},({path})=>Object.hasOwn(mocks,path)?{path,namespace:'mock'}:undefined);
  b.onLoad({filter:/.*/,namespace:'mock'},({path})=>({contents:mocks[path],loader:'js'}));
}}]});
const filename=path.resolve('scripts/one-off-test.cjs');const mod=new Module(filename);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));mod._compile(built.outputFiles[0].text,filename);
const {setOneOffAlternative, autosaveWorkoutSetCore, saveWorkoutSetIntensifierDetails, buildWorkoutSummary, resolveExerciseRead, prepareExerciseRead, selectRememberedExerciseChoices}=mod.exports;
reset();assert.equal((await setOneOffAlternative('slot',true,false)).ok,false);assert.equal(writes.length,0);
user='other';assert.equal((await setOneOffAlternative('slot',true,true)).ok,false);assert.equal(writes.length,0);
reset();sets[0].isCompleted=true;assert.equal((await setOneOffAlternative('slot',true,true)).ok,false);assert.equal(writes.length,0);
reset();sets[0].startedAt=new Date();assert.equal((await setOneOffAlternative('slot',true,true)).ok,false);assert.equal(writes.length,0);
reset();assert.equal((await setOneOffAlternative('slot',true,true)).ok,true);assert.equal(item.exerciseChoiceIntent,'ONE_OFF_EQUIVALENT');assert.equal(sets[0].weight,null);assert.equal(sets[0].reps,null);assert.equal(sets[0].rir,null);assert(locks.some(x=>x.includes('workout_session_exercises')));
assert.equal((await autosaveWorkoutSetCore('set',{weight:'50',reps:'10',rir:'1',setTypeId:'normal',isCompleted:true})).ok,false,'Stale normal logger cannot submit into changed mode');
assert.equal((await autosaveWorkoutSetCore('set',{oneOffAlternative:true,setTypeId:'normal',isCompleted:true})).ok,false,'Completion requires observed effort');
assert.equal((await autosaveWorkoutSetCore('set',{oneOffAlternative:true,weight:'100',reps:'15',rir:'1.5',setTypeId:'normal',isCompleted:true})).ok,true);
assert.equal(sets[0].weight,null);assert.equal(sets[0].reps,null);assert.equal(sets[0].rir,1.5);assert.equal(evaluations,0);
assert.equal((await setOneOffAlternative('slot',false,true)).ok,false,'Completed alternative cannot be relabeled as normal performance');
const before=writes.length;assert.equal((await saveWorkoutSetIntensifierDetails('set',{dropSets:[{weight:70,reps:8}]})).ok,false);assert.equal(writes.length,before);
const raw={...item,exercise:{name:'Machine press',setupNotes:'Machine setting 3',primaryMuscles:[{muscleId:'chest',muscle:{name:'Chest',sortOrder:0}}],secondaryMuscles:[{muscleId:'triceps',contributionEstimate:.5,muscle:{name:'Triceps',sortOrder:1}}],coachingProfiles:[{mechanicsProfile:{}}]},sets:sets.map(s=>({...s,setType:{multiplier:1,isIntensifier:false}})),painFlag:false,isSubstitution:false};
const resolved=resolveExerciseRead('WorkoutSessionExercise',raw,new Map(),new Map());assert.match(resolved.exercise.name,/One-off equivalent/);assert.equal(resolved.exercise.setupNotes,null);assert.deepEqual(resolved.exercise.coachingProfiles,[]);
const summary=buildWorkoutSummary({sessionExercises:[resolved]});assert.equal(summary.completedSets,1);assert.equal(summary.bestSet,null);assert.equal(summary.volumeRows.find(x=>x.muscleId==='chest').effective,1);assert.equal(summary.volumeRows.find(x=>x.muscleId==='triceps').effective,.5);
assert.equal(prepareExerciseRead('WorkoutSessionExercise',{select:{exercise:{select:{name:true}}}}).select.exerciseChoiceIntent,true);
const choice={templateExerciseId:'slot',exerciseId:'exercise',exerciseName:'press',movementGroupId:'press',active:true,isSubstitution:false,note:null};
assert.equal(selectRememberedExerciseChoices([{coached:false,exercises:[{...choice,intent:'ONE_OFF_EQUIVALENT'}]}]).size,0);
reset();assert.equal((await autosaveWorkoutSetCore('set',{weight:'50',reps:'10',rir:'2',setTypeId:'normal',isCompleted:true})).ok,true);assert.equal(sets[0].weight,50);assert.equal(sets[0].reps,10);assert.equal(evaluations,1);
reset('ONE_OFF_EQUIVALENT');assert.equal((await setOneOffAlternative('slot',false,true)).ok,true);assert.equal(item.exerciseChoiceIntent,'TEMPORARY');
console.log('One-off alternatives: ownership, pre-start switching, honest RIR, performance suppression, stale writes, drop-detail guard, muscle-volume accounting and temporary memory passed.');
