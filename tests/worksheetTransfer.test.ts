import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {transferCourse} from '../server/courseTransfer';
import {catalogEntries} from '../src/catalog';
import {homeworkId,homeworkKey,homeworkPlan} from '../src/homework';
import {worksheetReassignment} from '../src/worksheetReassignment';
import type {AppData} from '../src/types';

test('Local transfer repairs legacy worksheets once and keeps tracked work on the surviving sheet',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'worksheet-transfer-'));process.env.DATABASE_PATH=join(dir,'test.sqlite');
 const {db,allData}=await import('../server/db');
 const setting=(key:string,value:unknown)=>db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
 const series={id:'source',event_id:1,starts_on:'2026-10-05',skipped:[],numbering:{start:1,from:'2026-10-05'},task:{title:'Blatt',description:'',area:'Universität',type:'Hausaufgabe',course_id:4,deadline:null,estimate_minutes:60,priority:'Mittel',status:'Offen',tracking:1}};
 const insert=(t:any)=>db.prepare('INSERT INTO tasks(id,title,area,type,course_id,deadline,status,completed_at) VALUES(?,?,?,?,?,?,?,?)').run(t.id,t.title,t.area,t.type,t.course_id,t.deadline,t.status,t.completed_at);
 const now=new Date('2026-10-20T12:00');
 try{
  db.exec("INSERT INTO courses(id,name,code,semester) VALUES(4,'UE','UE','WS'),(40,'UE','UE','WS');INSERT INTO recurring_events(id,course_id,title,weekday,start_time,end_time,starts_on,ends_on) VALUES(1,4,'UE',1,'10:00','11:00','2026-10-05','2026-11-16'),(10,40,'UE',1,'10:00','11:00','2026-10-05','2026-11-16')");
  setting(homeworkKey(series.id),series);db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('course-catalog-visible-4','true');
  for(const t of homeworkPlan(allData() as AppData,now).create){t.deadline=t.deadline!.replace('10:00','09:15');insert(t)}
  const template=catalogEntries(allData() as AppData)[0].payload;
  for(const id of ['legacy-a','legacy-b'])setting(homeworkKey(id),{...series,id,event_id:10,starts_on:'2026-10-19',numbering:{start:3,from:'2026-10-19'},task:{...series.task,course_id:40}});
  insert({...series.task,id:homeworkId('legacy-a','2026-10-19'),course_id:40,title:'Blatt 3',deadline:'2026-10-22T15:00',status:'Erledigt',completed_at:'2026-10-20T08:00'});
  insert({...series.task,id:55,course_id:40,title:'Blatt 3',deadline:'2026-10-25T15:00',completed_at:null});
  db.prepare('INSERT INTO work_sessions(id,task_id,course_id,started_at,ended_at) VALUES(1,55,40,?,?)').run('2026-10-19T08:00','2026-10-19T09:00');
  transferCourse(db,template,40);
  assert.equal((db.prepare('SELECT * FROM recurring_events WHERE course_id=40').all()).length,1);
  const data=allData() as AppData,plan=homeworkPlan(data,now);
  for(const t of plan.create)insert(t);
  for(const t of plan.update)db.prepare('UPDATE tasks SET title=?,deadline=?,status=?,completed_at=? WHERE id=?').run(t.title,t.deadline,t.status,t.completed_at,t.id);
  const references=worksheetReassignment(data,plan.reassign??[]);
  for(const session of references.sessions)db.prepare('UPDATE work_sessions SET task_id=? WHERE id=?').run(session.task_id,session.id);
  for(const s of references.settings)db.prepare('UPDATE settings SET value=? WHERE key=?').run(s.value,s.key);
  for(const t of plan.remove)db.prepare('DELETE FROM tasks WHERE id=?').run(t.id);
  const repaired=db.prepare('SELECT title,deadline,status FROM tasks WHERE course_id=40 ORDER BY title').all() as any[];
  assert.deepEqual(repaired.map(t=>[t.title,t.deadline]),template.homework![0].sheets!.filter(s=>s.visible).map(s=>[s.title,s.deadline]));
  assert.equal(repaired.find(t=>t.title==='Blatt 3').status,'Erledigt');
  assert.equal((db.prepare('SELECT task_id FROM work_sessions WHERE id=1').get() as any).task_id,homeworkId('legacy-a','2026-10-19'));
  transferCourse(db,template,40);
  const again=homeworkPlan(allData() as AppData,now);
  assert.deepEqual(again,{create:[],remove:[],update:[]});
 }finally{db.close();await rm(dir,{recursive:true,force:true})}
});
