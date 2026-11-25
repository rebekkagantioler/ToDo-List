import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('Supabase schema: user isolation, cross-user relationships and atomic import',async()=>{
 const db=new PGlite();
 const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
 try {
  await db.exec(`CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;INSERT INTO auth.users VALUES ('${alice}'),('${bob}');`);
  await db.exec(await readFile('supabase/schema.sql','utf8'));
  await db.exec(await readFile('supabase/optional-task-time.sql','utf8'));
  await db.exec(await readFile('supabase/course-templates.sql','utf8'));
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${alice}',false);`);
  await db.exec(`INSERT INTO courses (id,name,semester,ects,hours_per_ects) VALUES (1,'Mathematik','WS',2.5,25);INSERT INTO tasks (id,title,area,type,course_id) VALUES (2,'Blatt','Universität','Lernen',1);`);
  await db.exec(`INSERT INTO work_sessions(id,course_id,started_at,ended_at) VALUES (10,1,'2026-10-12T09:00Z','2026-10-12T11:00Z'); INSERT INTO work_sessions(id,started_at,ended_at) VALUES (11,'2026-10-12T12:00Z','2026-10-12T13:00Z');`);
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${bob}',false);`);
  assert.equal((await db.query('SELECT * FROM courses')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM work_sessions')).rows.length,0);
  await assert.rejects(()=>db.exec(`INSERT INTO work_sessions(course_id,started_at,ended_at) VALUES(1,'2026-10-12T09:00Z','2026-10-12T10:00Z')`));
  await assert.rejects(()=>db.exec(`INSERT INTO tasks(id,title,area,type,course_id) VALUES (3,'Fremd','Universität','Lernen',1)`));
  assert.equal((await db.query('SELECT course_catalog_visibility_ready() AS ready')).rows[0].ready,true);
  assert.equal((await db.query('SELECT * FROM list_course_catalog()')).rows.length,0);
  // A setting with the same course ID in another account cannot publish Alice's course.
  await db.exec(`INSERT INTO settings(key,value) VALUES('course-catalog-visible-1','true')`);
  assert.equal((await db.query('SELECT * FROM list_course_catalog()')).rows.length,0);
  await db.exec(`DELETE FROM settings WHERE key='course-catalog-visible-1';SELECT set_config('request.jwt.claim.sub','${alice}',false);INSERT INTO settings(key,value) VALUES('course-catalog-visible-1','true');SELECT set_config('request.jwt.claim.sub','${bob}',false);`);
  const catalog=await db.query('SELECT * FROM list_course_catalog()');assert.equal(catalog.rows.length,1);
  const entry:any=catalog.rows[0];assert.equal(entry.name,'Mathematik');assert.equal(entry.payload.course.description,'');assert.equal(entry.payload.course.ects,2.5);assert.equal(entry.payload.events.length,0);assert.ok(!JSON.stringify(entry).includes(alice));
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${alice}',false);UPDATE courses SET description='PRIVATE NOTES' WHERE id=1;INSERT INTO recurring_events(id,course_id,title,weekday,start_time,end_time,starts_on,ends_on) VALUES(42,1,'UE',1,'10:00','11:00','2026-10-19','2026-11-02');INSERT INTO settings(key,value) VALUES('lecture-exclusions-42','["2026-10-26"]'),('private-setting','PRIVATE NOTES');SELECT set_config('request.jwt.claim.sub','${bob}',false);`);
  const updated:any=(await db.query('SELECT * FROM list_course_catalog()')).rows[0];assert.deepEqual(updated.payload.events[0].excluded,['2026-10-26']);assert.ok(!JSON.stringify(updated).includes('PRIVATE NOTES'));assert.equal(updated.payload.events[0].id,undefined);assert.equal(updated.payload.events[0].user_id,undefined);
  await assert.rejects(()=>db.query("SELECT catalog_exclusions('[]')"));
  await assert.rejects(()=>db.query('SELECT * FROM course_templates'));
  const shared=updated;
  await db.query('SELECT copy_course_template($1::jsonb)',[JSON.stringify(shared.payload)]);
  assert.equal((await db.query('SELECT * FROM list_course_catalog()')).rows.length,1); // Imported copies remain private.
  assert.equal((await db.query('SELECT * FROM tasks')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM recurring_events')).rows.length,1);
  assert.equal((await db.query("SELECT value FROM settings WHERE key LIKE 'lecture-exclusions-%'")).rows[0].value,'["2026-10-26"]');
  const copiedId=(await db.query('SELECT id FROM courses')).rows[0].id;
  await db.query("INSERT INTO settings(key,value) VALUES($1,'true')",['course-catalog-visible-'+copiedId]);
  assert.equal((await db.query('SELECT * FROM list_course_catalog()')).rows.length,1); // Identical shared copies collapse into one entry.
  await db.query("UPDATE settings SET value='false' WHERE key=$1",['course-catalog-visible-'+copiedId]);
  const invalidTemplate=structuredClone(shared.payload);invalidTemplate.events[0].weekday=9;
  await assert.rejects(()=>db.query('SELECT copy_course_template($1::jsonb)',[JSON.stringify(invalidTemplate)]));
  assert.equal((await db.query('SELECT * FROM courses')).rows.length,1);
  // Shared routines are templates only; selection controls importing and updating.
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${alice}',false);INSERT INTO settings(key,value) VALUES('homework-series-source','{"id":"source","event_id":42,"starts_on":"2026-10-19","skipped":[],"task":{"title":"VO nachbereiten","description":"SECRET ROUTINE","course_id":1,"type":"Nachbereitung","estimate_minutes":45,"priority":"Mittel","tracking":1}}');SELECT set_config('request.jwt.claim.sub','${bob}',false);`);
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${alice}',false);INSERT INTO settings(key,value) VALUES('course-requirements-1','[{"id":"private-id","title":"Blattpunkte","unit":"Punkte","kind":"homework","target":50,"current":27,"worksheetCount":12,"dropLowest":2,"examGrade":"SECRET GRADE","worksheetFinalized":true,"taskType":"Nachbereitung","eventId":42}]');SELECT set_config('request.jwt.claim.sub','${bob}',false);`);
  const withRoutine:any=(await db.query('SELECT get_course_catalog_entry($1) AS p',[shared.payload.source_key])).rows[0].p;
  assert.equal(withRoutine.homework.length,1);assert.ok(!JSON.stringify(withRoutine).includes('SECRET ROUTINE'));
  assert.equal(withRoutine.requirements[0].target,50);assert.equal(withRoutine.requirements[0].current,undefined);assert.ok(!JSON.stringify(withRoutine).includes('SECRET GRADE'));assert.ok(!JSON.stringify(withRoutine).includes('private-id'));
  const declined={...withRoutine,events:[],homework:[],update_course:false};
  await db.query('SELECT apply_course_update($1,$2::jsonb)',[copiedId,JSON.stringify(declined)]);
  assert.equal((await db.query("SELECT * FROM settings WHERE key LIKE 'homework-series-%'")).rows.length,0);
  await db.query('SELECT apply_course_update($1,$2::jsonb)',[copiedId,JSON.stringify({...withRoutine,update_course:false})]);
  const requirements=JSON.parse((await db.query("SELECT value FROM settings WHERE key=$1",['course-requirements-'+copiedId])).rows[0].value as string);
  assert.equal(requirements.length,1);assert.equal(requirements[0].current,0);assert.equal(requirements[0].worksheetCount,12);assert.equal(requirements[0].dropLowest,2);assert.equal(requirements[0].worksheetFinalized,undefined);assert.notEqual(requirements[0].eventId,42);
  requirements[0].current=9;
  await db.query('UPDATE settings SET value=$1 WHERE key=$2',[JSON.stringify(requirements),'course-requirements-'+copiedId]);
  await db.query('SELECT apply_course_update($1,$2::jsonb)',[copiedId,JSON.stringify(withRoutine)]);
  const preserved=JSON.parse((await db.query('SELECT value FROM settings WHERE key=$1',['course-requirements-'+copiedId])).rows[0].value as string);
  assert.equal(preserved.length,1);assert.equal(preserved[0].current,9);assert.equal(preserved[0].id,requirements[0].id);
  const imported:any=(await db.query("SELECT value FROM settings WHERE key LIKE 'homework-series-%'")).rows[0];
  const routine=JSON.parse(imported.value);assert.equal(routine.task.course_id,Number(copiedId));assert.notEqual(routine.event_id,42);assert.equal(routine.task.description,'');
  assert.equal((await db.query('SELECT * FROM tasks')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM recurring_events')).rows.length,1);
  await assert.rejects(()=>db.query('SELECT apply_course_update($1,$2::jsonb)',[1,JSON.stringify(withRoutine)]));
  const change=structuredClone(withRoutine);change.events[0].start_time='09:30';change.homework=[];change.update_course=false;
  await db.query('SELECT apply_course_update($1,$2::jsonb)',[copiedId,JSON.stringify(change)]);
  assert.equal((await db.query('SELECT start_time FROM recurring_events')).rows[0].start_time,'09:30');
  assert.equal((await db.query("SELECT value FROM settings WHERE key LIKE 'homework-series-%'")).rows[0].value,imported.value);
  // Withdrawing the original hides it but preserves Bob's independent private copy.
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${alice}',false);UPDATE settings SET value='false' WHERE key='course-catalog-visible-1';SELECT set_config('request.jwt.claim.sub','${bob}',false);`);
  assert.equal((await db.query('SELECT * FROM list_course_catalog()')).rows.length,0);assert.equal((await db.query('SELECT * FROM courses')).rows.length,1);
  await db.exec('DELETE FROM courses');
  await db.exec(`INSERT INTO courses (id,name,semester) VALUES (1,'Bobs Kurs','WS');SELECT set_config('request.jwt.claim.sub','${alice}',false);`);
  // Device updates compare the exact previous value; stale devices cannot revive a stopped timer.
  await db.exec(`INSERT INTO settings(key,value) VALUES('active-timer-v1','running');`);
  assert.equal((await db.query("UPDATE settings SET value='paused' WHERE key='active-timer-v1' AND value='running' RETURNING value")).rows.length,1);
  assert.equal((await db.query("UPDATE settings SET value='stale' WHERE key='active-timer-v1' AND value='running' RETURNING value")).rows.length,0);
  const timer=JSON.stringify({id:123,startedAt:'2026-10-12T09:00Z'});
  const session={id:123,started_at:'2026-10-12T09:00Z',ended_at:'2026-10-12T10:00Z'};
  await db.query("UPDATE settings SET value=$1 WHERE key='active-timer-v1'",[timer]);
  const finish=(expected:string,entry:object)=>db.query('SELECT * FROM finish_timer($1,$2::jsonb)',[expected,JSON.stringify(entry)]);
  await assert.rejects(()=>finish('null',session),/anderen Gerät/);
  await assert.rejects(()=>finish(timer,{...session,ended_at:session.started_at}));
  assert.equal((await db.query("SELECT value FROM settings WHERE key='active-timer-v1'")).rows[0].value,timer);
  await finish(timer,session);
  assert.equal((await db.query("SELECT value FROM settings WHERE key='active-timer-v1'")).rows[0].value,'null');
  const newer=JSON.stringify({id:456});
  await db.query("UPDATE settings SET value=$1 WHERE key='active-timer-v1'",[newer]);
  await finish(timer,session);
  assert.equal((await db.query("SELECT value FROM settings WHERE key='active-timer-v1'")).rows[0].value,newer);
  assert.equal((await db.query('SELECT * FROM work_sessions WHERE id=123')).rows.length,1);
  await db.exec("DELETE FROM work_sessions WHERE id=123; DELETE FROM settings WHERE key='active-timer-v1'");
  const c=(await db.query('SELECT * FROM courses')).rows;assert.equal((c[0] as any).ects,2.5);
  await db.exec(`INSERT INTO planned_blocks(task_id,course_id,title,starts_at,ends_at) VALUES(2,1,'Einheit 1','2026-10-12T09:00','2026-10-12T09:25'),(2,1,'Einheit 2','2026-10-13T09:00','2026-10-13T09:25');`);
  assert.equal((await db.query('SELECT * FROM planned_blocks WHERE task_id=2')).rows.length,2);const t=(await db.query('SELECT * FROM tasks')).rows;
  const backup={courses:c,tasks:t,sessions:(await db.query('SELECT * FROM work_sessions')).rows,blocks:[],recurring:[],settings:[{key:'theme',value:'dark'}]};
  await db.query('SELECT import_backup($1::jsonb)',[JSON.stringify(backup)]);
  assert.equal((await db.query('SELECT * FROM tasks')).rows.length,1);
  const invalid=structuredClone(backup);(invalid.tasks[0] as any).course_id=999;
  await assert.rejects(()=>db.query('SELECT import_backup($1::jsonb)',[JSON.stringify(invalid)]));
  assert.equal((await db.query('SELECT * FROM tasks')).rows.length,1);
  await db.exec('DELETE FROM courses WHERE id=1');assert.equal((await db.query('SELECT * FROM work_sessions')).rows.length,2);assert.ok((await db.query('SELECT course_id FROM work_sessions')).rows.every((s:any)=>s.course_id===null));assert.equal((await db.query('SELECT course_id FROM tasks')).rows[0].course_id,null);
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${bob}',false);`);assert.equal((await db.query('SELECT * FROM courses')).rows.length,1);
 }finally{await db.close()}
});

test('Shared numbered sheets use the original actual dates and can repair a legacy copy without another series',async()=>{
 const {homeworkId,homeworkPlan,homeworkKey}=await import('../src/homework');
 const {catalogEntries,courseVisibilityKey}=await import('../src/catalog');
 const db=new PGlite();
 const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;INSERT INTO auth.users VALUES ('${alice}'),('${bob}');`);
  await db.exec(await readFile('supabase/schema.sql','utf8'));
  await db.exec(await readFile('supabase/optional-task-time.sql','utf8'));
  await db.exec(await readFile('supabase/course-templates.sql','utf8'));
  for(const series of ['original','8e82f4b9-654a-4e49-bc22-aaa978cb6cb4'])for(const day of ['2026-10-05','2026-10-12','2026-10-19'])assert.equal(Number((await db.query('SELECT worksheet_task_id($1,$2) AS id',[series,day])).rows[0].id),homeworkId(series,day));
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${alice}',false);INSERT INTO courses(id,name,code,semester,ects,hours_per_ects) VALUES(4,'UE','UE','WS',3,25);INSERT INTO recurring_events(id,course_id,title,weekday,start_time,end_time,starts_on,ends_on) VALUES(1,4,'UE',1,'10:00','11:00','2026-10-05','2026-11-16');INSERT INTO settings(key,value) VALUES('course-catalog-visible-4','true');`);
  const source:any={courses:[{id:4,name:'UE',code:'UE',semester:'WS',ects:3,hours_per_ects:25,color:'#123456',description:''}],tasks:[],sessions:[],blocks:[],recurring:[{id:1,course_id:4,title:'UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-05',ends_on:'2026-11-16',auto_track:0}],settings:[{key:courseVisibilityKey(4),value:'true'}]};
  const series={id:'original',event_id:1,starts_on:'2026-10-05',skipped:[],numbering:{start:1,from:'2026-10-05'},task:{title:'Blatt',description:'SECRET DESCRIPTION',area:'Universität',type:'Hausaufgabe',course_id:4,deadline:null,estimate_minutes:60,priority:'Mittel',status:'Offen',tracking:1}};
  source.settings.push({key:homeworkKey(series.id),value:JSON.stringify(series)});
  await db.query('INSERT INTO settings(key,value) VALUES($1,$2)',[homeworkKey(series.id),JSON.stringify(series)]);
  source.tasks=homeworkPlan(source,new Date('2026-10-20T12:00')).create;
  source.tasks[0].deadline='2026-10-04T14:15';source.tasks[0].status='Erledigt';
  for(const t of source.tasks)await db.query('INSERT INTO tasks(id,course_id,title,area,type,deadline,status) VALUES($1,4,$2,$3,$4,$5,$6)',[t.id,t.title,t.area,t.type,t.deadline,t.status]);
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${bob}',false)`);
  const payload:any=(await db.query('SELECT * FROM list_course_catalog()')).rows[0].payload;
  const expected=catalogEntries(source)[0].payload.homework![0].sheets;
  assert.deepEqual(payload.homework[0].sheets,expected);
  assert.ok(!JSON.stringify(payload).includes('Erledigt'));assert.ok(!JSON.stringify(payload).includes('SECRET DESCRIPTION'));assert.ok(!JSON.stringify(payload).includes(alice));
  await assert.rejects(()=>db.query('SELECT catalog_homework_sheets($1,$2::jsonb,1)',[alice,JSON.stringify(series)]));
  await db.exec(`INSERT INTO courses(id,name,code,semester,ects,hours_per_ects) VALUES(40,'UE','UE','WS',3,25);INSERT INTO recurring_events(id,course_id,title,weekday,start_time,end_time,starts_on,ends_on) VALUES(10,40,'UE',1,'10:00','11:00','2026-10-05','2026-11-16')`);
  const legacy={...series,id:'legacy',event_id:10,starts_on:'2026-10-19',numbering:{start:3,from:'2026-10-19'},skipped:['2026-10-19'],task:{...series.task,course_id:40}};
  await db.query('INSERT INTO settings(key,value) VALUES($1,$2)',[homeworkKey('legacy'),JSON.stringify(legacy)]);
  await db.query('SELECT apply_course_update(40,$1::jsonb)',[JSON.stringify({...payload,requirements:undefined})]);
  const local=JSON.parse((await db.query("SELECT value FROM settings WHERE key='homework-series-legacy'")).rows[0].value as string);
  assert.deepEqual(local.reference,expected);assert.equal(local.starts_on,'2026-10-05');assert.deepEqual(local.skipped,[]);
  assert.equal((await db.query('SELECT * FROM recurring_events')).rows.length,1);assert.equal((await db.query("SELECT * FROM settings WHERE key LIKE 'homework-series-%'")).rows.length,1);
  await db.query('SELECT apply_course_update(40,$1::jsonb)',[JSON.stringify(payload)]);
  assert.equal((await db.query("SELECT * FROM settings WHERE key LIKE 'homework-series-%'")).rows.length,1);
  const target:any={...source,courses:[{...source.courses[0],id:40}],tasks:[],recurring:[{...source.recurring[0],course_id:40,id:10}],settings:[{key:homeworkKey('legacy'),value:JSON.stringify(local)}]};
  const plan=homeworkPlan(target,new Date('2026-10-20T12:00'));
  assert.deepEqual(plan.create.map(t=>[t.title,t.deadline]),source.tasks.map((t:any)=>[t.title,t.deadline]));

  // Exact screenshot case: the active series starts with Blatt 3 in November,
  // while Blatt 1 and 2 are older standalone tasks with individually set times.
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${alice}',false);DELETE FROM tasks WHERE course_id=4;UPDATE recurring_events SET starts_on='2026-11-09',ends_on='2026-11-30',start_time='12:00' WHERE id=1;`);
  const november={...series,starts_on:'2026-11-09',numbering:{start:3,from:'2026-11-09'}};
  await db.query('UPDATE settings SET value=$1 WHERE key=$2',[JSON.stringify(november),homeworkKey('original')]);
  const roster=[{id:11,title:'Blatt 1',deadline:'2026-10-12T11:08'},{id:12,title:'Blatt 2',deadline:'2026-10-19T13:45'},{id:homeworkId('original','2026-11-09'),title:'Blatt 3',deadline:'2026-11-09T13:00'},{id:homeworkId('original','2026-11-16'),title:'Blatt 4',deadline:'2026-11-16T13:00'},{id:homeworkId('original','2026-11-23'),title:'Blatt 5',deadline:'2026-11-23T12:00'}];
  for(const t of roster)await db.query("INSERT INTO tasks(id,title,course_id,area,type,deadline,status) VALUES($1,$2,4,'Universität','Hausaufgabe',$3,'Erledigt')",[t.id,t.title,t.deadline]);
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${bob}',false)`);
  const historical:any=(await db.query('SELECT get_course_catalog_entry($1) AS p',[payload.source_key])).rows[0].p;
  assert.deepEqual(historical.homework[0].sheets.filter((r:any)=>r.visible).map((r:any)=>[r.title,r.deadline]),roster.map(r=>[r.title,r.deadline]));
  await db.query('SELECT apply_course_update(40,$1::jsonb)',[JSON.stringify(historical)]);
  const repaired=JSON.parse((await db.query("SELECT value FROM settings WHERE key='homework-series-legacy'")).rows[0].value as string);
  const friend:any={...target,tasks:[],recurring:[{...target.recurring[0],starts_on:'2026-11-09',ends_on:'2026-11-30',start_time:'12:00'}],settings:[{key:homeworkKey('legacy'),value:JSON.stringify(repaired)}]};
  const synced=homeworkPlan(friend,new Date('2026-11-16T14:28'));
  assert.deepEqual(synced.create.map(t=>[t.title,t.deadline]),roster.map(r=>[r.title,r.deadline]));
  friend.tasks=synced.create;assert.deepEqual(homeworkPlan(friend,new Date('2026-11-16T14:28')),{create:[],remove:[],update:[]});

  // Distinct sheet numbers must survive even when deadline-based inference
  // associates their historical tasks with the same exercise occurrence.
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${alice}',false);UPDATE tasks SET deadline='2026-10-13T11:08' WHERE id=11;SELECT set_config('request.jwt.claim.sub','${bob}',false)`);
  const overlapping:any=(await db.query('SELECT get_course_catalog_entry($1) AS p',[payload.source_key])).rows[0].p;
  const firstTwo=overlapping.homework[0].sheets.filter((r:any)=>r.title==='Blatt 1'||r.title==='Blatt 2');
  assert.equal(firstTwo.length,2);assert.equal(firstTwo[0].date,firstTwo[1].date);assert.notEqual(firstTwo[0].key,firstTwo[1].key);
  await db.query('SELECT apply_course_update(40,$1::jsonb)',[JSON.stringify(overlapping)]);
  const collisionSeries=JSON.parse((await db.query("SELECT value FROM settings WHERE key='homework-series-legacy'")).rows[0].value as string);
  const collisionData:any={...friend,tasks:[],settings:[{key:homeworkKey('legacy'),value:JSON.stringify(collisionSeries)}]};
  const collisionPlan=homeworkPlan(collisionData,new Date('2026-11-16T14:28'));
  assert.equal(collisionPlan.create.length,5);assert.equal(new Set(collisionPlan.create.map(t=>t.id)).size,5);
  assert.deepEqual(collisionPlan.create.filter(t=>t.title==='Blatt 1'||t.title==='Blatt 2').map(t=>[t.title,t.deadline]),[['Blatt 1','2026-10-13T11:08'],['Blatt 2','2026-10-19T13:45']]);
  collisionData.tasks=collisionPlan.create;assert.deepEqual(homeworkPlan(collisionData,new Date('2026-11-16T14:28')),{create:[],remove:[],update:[]});

  for(const title of ['Blatt1','Blatt 1','Blatt 1','Blatt   1','Blatt 01']){
   await db.exec(`SELECT set_config('request.jwt.claim.sub','${alice}',false)`);
   await db.query("UPDATE tasks SET title=$1,deadline='2026-10-08T14:00' WHERE id=11",[title]);
   await db.exec(`SELECT set_config('request.jwt.claim.sub','${bob}',false)`);
   const analysis:any=(await db.query('SELECT get_course_catalog_entry($1) AS p',[payload.source_key])).rows[0].p;
   const first=analysis.homework[0].sheets.filter((r:any)=>/1$/.test(r.title.replace(/\s/g,'')));
   assert.equal(first.length,1);assert.equal(first[0].title,title);assert.equal(first[0].deadline,'2026-10-08T14:00');
   await db.query('SELECT apply_course_update(40,$1::jsonb)',[JSON.stringify(analysis)]);
   const analysisSeries=JSON.parse((await db.query("SELECT value FROM settings WHERE key='homework-series-legacy'")).rows[0].value as string);
   const analysisData:any={...friend,tasks:[{...series.task,id:88,course_id:40,title:'Blatt 1',deadline:'2026-10-09T10:00'}],settings:[{key:homeworkKey('legacy'),value:JSON.stringify(analysisSeries)}]};
   const analysisPlan=homeworkPlan(analysisData,new Date('2026-11-16T14:28'));
   assert.equal(analysisPlan.create.length,5);assert.equal(analysisPlan.remove[0].id,88);
   assert.equal(analysisPlan.create.find(t=>t.title===title)?.deadline,'2026-10-08T14:00');
   analysisData.tasks=analysisPlan.create;assert.deepEqual(homeworkPlan(analysisData,new Date('2026-11-16T14:28')),{create:[],remove:[],update:[]});
  }
 }finally{await db.close()}
});

test('A brand-new cloud account receives only series tasks from week one; individual tasks stay private',async()=>{
 const {homeworkId,homeworkPlan}=await import('../src/homework');
 const db=new PGlite();const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
 try{
  await db.exec(`CREATE ROLE authenticated;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;INSERT INTO auth.users VALUES ('${alice}'),('${bob}');`);
  await db.exec(await readFile('supabase/schema.sql','utf8'));await db.exec(await readFile('supabase/optional-task-time.sql','utf8'));await db.exec(await readFile('supabase/course-templates.sql','utf8'));
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${alice}',false);INSERT INTO courses(id,name,code,semester,ects,hours_per_ects) VALUES(1,'Analysis','AN','WS',3,25);INSERT INTO recurring_events(id,course_id,title,weekday,start_time,end_time,starts_on,ends_on) VALUES(10,1,'UE',4,'14:00','15:00','2026-10-15','2026-12-17'),(11,1,'VO',3,'18:00','19:00','2026-10-07','2026-12-16');INSERT INTO settings(key,value) VALUES('course-catalog-visible-1','true');`);
  const base={title:'Blatt',description:'SECRET',area:'Universität',type:'Hausaufgabe',course_id:1,deadline:null,estimate_minutes:60,priority:'Mittel',status:'Offen',tracking:1};
  for(const series of [{id:'sheets',event_id:10,starts_on:'2026-10-15',skipped:[],numbering:{start:2,from:'2026-10-15'},task:base},{id:'review',event_id:11,starts_on:'2026-10-07',skipped:[],task:{...base,title:'Nachbereiten',type:'Nachbereitung'}}])await db.query('INSERT INTO settings(key,value) VALUES($1,$2)',['homework-series-'+series.id,JSON.stringify(series)]);
  const tasks=[{id:21,title:'Blatt1',type:'Hausaufgabe',deadline:'2026-10-08T14:00'},{id:homeworkId('sheets','2026-10-15'),title:'Blatt 2',type:'Hausaufgabe',deadline:'2026-10-15T14:00'},{id:22,title:'Literatur lesen',type:'Lernen',deadline:'2026-10-01T12:00'},{id:23,title:'Gruppe organisieren',type:'Organisation',deadline:null},{id:24,title:'Referat vorbereiten',type:'Lernen',deadline:'2026-12-12T12:00'},{id:25,title:'Blatt99',type:'Hausaufgabe',deadline:'2026-10-10T15:00'},{id:26,title:'Nachbereiten',type:'Nachbereitung',deadline:'2026-10-08T15:00'},{id:homeworkId('review','2026-12-16'),title:'Nachbereiten',type:'Nachbereitung',deadline:'2026-12-16T18:00'}];
  for(const t of tasks)await db.query("INSERT INTO tasks(id,course_id,title,description,area,type,deadline,status,completed_at) VALUES($1,1,$2,'SECRET','Universität',$3,$4,'Erledigt','2026-11-15T12:00')",[t.id,t.title,t.type,t.deadline]);
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${bob}',false)`);
  await assert.rejects(()=>db.query('SELECT catalog_course_tasks($1,1)',[alice]));
  const template:any=(await db.query('SELECT * FROM list_course_catalog()')).rows[0].payload;
  const seriesTasks=tasks.filter(t=>![22,23,24,25,26].includes(t.id));
  for(const label of ['Literatur lesen','Gruppe organisieren','Referat vorbereiten','Blatt99','2026-10-08T15:00'])assert.ok(!JSON.stringify(template).includes(label));
  assert.equal(template.tasks.length,seriesTasks.length);assert.ok(!JSON.stringify(template).includes('SECRET'));assert.ok(!JSON.stringify(template).includes('Erledigt'));assert.ok(!JSON.stringify(template).includes(alice));
  const cached={...template,tasks:[...template.tasks,{source_key:'old-private',title:'PRIVATE ONE-OFF',type:'Lernen',deadline:null,estimate_minutes:60,priority:'Mittel',tracking:1}]};
  const copy:any=(await db.query('SELECT copy_course_template($1::jsonb) AS p',[JSON.stringify(cached)])).rows[0].p;
  const rows:any[]=(await db.query('SELECT * FROM tasks WHERE course_id=$1',[copy.id])).rows;
  assert.equal(rows.length,seriesTasks.length);
  for(const t of seriesTasks){const row=rows.find(r=>r.title===t.title);assert.equal(row?.deadline,t.deadline);assert.equal(row?.status,'Offen');assert.equal(row?.completed_at,null);assert.equal(row?.description,'');}
  const snapshot:any={courses:(await db.query('SELECT * FROM courses')).rows,tasks:rows,recurring:(await db.query('SELECT * FROM recurring_events')).rows,settings:(await db.query('SELECT * FROM settings')).rows,sessions:[],blocks:[]};
  const plan=homeworkPlan(snapshot,new Date('2026-11-16T14:28'));
  assert.ok(!plan.remove.some(t=>t.title==='Nachbereiten'&&t.deadline==='2026-12-16T18:00'));
  assert.ok(!plan.create.some(t=>t.title==='Blatt1'||t.title==='Blatt 2'));
  const own=rows.find(t=>t.title==='Blatt 2');await db.query("UPDATE tasks SET status='Erledigt' WHERE id=$1",[own.id]);
  await db.query('SELECT apply_course_update($1,$2::jsonb)',[copy.id,JSON.stringify(template)]);
  assert.equal((await db.query('SELECT * FROM tasks WHERE course_id=$1',[copy.id])).rows.length,rows.length);
  assert.equal((await db.query('SELECT status FROM tasks WHERE id=$1',[own.id])).rows[0].status,'Erledigt');
 }finally{await db.close()}
});
