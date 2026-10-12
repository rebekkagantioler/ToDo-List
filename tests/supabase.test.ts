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
  await db.exec(`SET ROLE authenticated;SELECT set_config('request.jwt.claim.sub','${alice}',false);`);
  await db.exec(`INSERT INTO courses (id,name,semester,ects,hours_per_ects) VALUES (1,'Mathematik','WS',2.5,25);INSERT INTO tasks (id,title,area,type,course_id) VALUES (2,'Blatt','Universität','Lernen',1);`);
  await db.exec(`INSERT INTO work_sessions(id,course_id,started_at,ended_at) VALUES (10,1,'2026-10-12T09:00Z','2026-10-12T11:00Z'); INSERT INTO work_sessions(id,started_at,ended_at) VALUES (11,'2026-10-12T12:00Z','2026-10-12T13:00Z');`);
  await db.exec(`SELECT set_config('request.jwt.claim.sub','${bob}',false);`);
  assert.equal((await db.query('SELECT * FROM courses')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM work_sessions')).rows.length,0);
  await assert.rejects(()=>db.exec(`INSERT INTO work_sessions(course_id,started_at,ended_at) VALUES(1,'2026-10-12T09:00Z','2026-10-12T10:00Z')`));
  await assert.rejects(()=>db.exec(`INSERT INTO tasks(id,title,area,type,course_id) VALUES (3,'Fremd','Universität','Lernen',1)`));
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
