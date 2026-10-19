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
  const catalog=await db.query('SELECT * FROM list_course_catalog()');assert.equal(catalog.rows.length,1);
  const entry:any=catalog.rows[0];assert.equal(entry.name,'Mathematik');assert.equal(entry.payload.course.description,'');assert.equal(entry.payload.course.ects,2.5);assert.equal(entry.payload.events.length,0);assert.ok(!JSON.stringify(entry).includes(alice));
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${alice}',false);UPDATE courses SET description='PRIVATE NOTES' WHERE id=1;INSERT INTO recurring_events(id,course_id,title,weekday,start_time,end_time,starts_on,ends_on) VALUES(42,1,'UE',1,'10:00','11:00','2026-10-19','2026-11-02');INSERT INTO settings(key,value) VALUES('lecture-exclusions-42','["2026-10-26"]'),('private-setting','PRIVATE NOTES');SELECT set_config('request.jwt.claim.sub','${bob}',false);`);
  const updated:any=(await db.query('SELECT * FROM list_course_catalog()')).rows[0];assert.deepEqual(updated.payload.events[0].excluded,['2026-10-26']);assert.ok(!JSON.stringify(updated).includes('PRIVATE NOTES'));assert.equal(updated.payload.events[0].id,undefined);assert.equal(updated.payload.events[0].user_id,undefined);
  await assert.rejects(()=>db.query("SELECT catalog_exclusions('[]')"));
  await assert.rejects(()=>db.query('SELECT * FROM course_templates'));
  const shared=updated;
  await db.query('SELECT copy_course_template($1::jsonb)',[JSON.stringify(shared.payload)]);
  assert.equal((await db.query('SELECT * FROM list_course_catalog()')).rows.length,1); // Identical copies collapse into one entry.
  assert.equal((await db.query('SELECT * FROM tasks')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM recurring_events')).rows.length,1);
  assert.equal((await db.query('SELECT value FROM settings')).rows[0].value,'["2026-10-26"]');
  const invalidTemplate=structuredClone(shared.payload);invalidTemplate.events[0].weekday=9;
  await assert.rejects(()=>db.query('SELECT copy_course_template($1::jsonb)',[JSON.stringify(invalidTemplate)]));
  assert.equal((await db.query('SELECT * FROM courses')).rows.length,1);
  await db.exec('DELETE FROM courses');
  await db.exec(`INSERT INTO courses (id,name,semester) VALUES (1,'Bobs Kurs','WS');SELECT set_config('request.jwt.claim.sub','${alice}',false);`);
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
