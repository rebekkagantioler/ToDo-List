import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {transferCourse} from '../server/courseTransfer';
import {catalogEntries,courseOrigin} from '../src/catalog';
import {homeworkId,homeworkKey,homeworkPlan,homeworkSeries} from '../src/homework';
import {courseRequirements,requirementProgress} from '../src/requirements';
import type {AppData} from '../src/types';

test('A new course copy contains every existing task from week one, all open, including historical standalone and future tasks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'course-onboarding-'));process.env.DATABASE_PATH=join(dir,'test.sqlite');
 const {db,allData}=await import('../server/db');
 const setting=(key:string,value:unknown)=>db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
 try{
  db.exec("INSERT INTO courses(id,name,code,semester) VALUES(4,'Analysis','AN','WS');INSERT INTO recurring_events(id,course_id,title,weekday,start_time,end_time,starts_on,ends_on) VALUES(1,4,'UE',1,'12:00','13:00','2026-11-09','2026-11-30'),(2,4,'VO',3,'18:00','19:00','2026-10-07','2026-12-16')");
  const task={title:'Blatt',description:'SECRET',area:'Universität',type:'Hausaufgabe',course_id:4,deadline:null,estimate_minutes:60,priority:'Mittel',status:'Offen',tracking:1};
  setting(homeworkKey('sheets'),{id:'sheets',event_id:1,starts_on:'2026-11-09',skipped:[],numbering:{start:3,from:'2026-11-09'},task});
  setting(homeworkKey('review'),{id:'review',event_id:2,starts_on:'2026-10-07',skipped:[],task:{...task,title:'Nachbereiten',type:'Nachbereitung'}});
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run('course-catalog-visible-4','true');
  const roster=[{id:11,title:'Blatt1',deadline:'2026-10-08T14:00',type:'Hausaufgabe'},{id:12,title:'Blatt 2',deadline:'2026-10-15T14:00',type:'Hausaufgabe'},{id:homeworkId('sheets','2026-11-09'),title:'Blatt 3',deadline:'2026-11-09T13:00',type:'Hausaufgabe'},{id:homeworkId('sheets','2026-11-16'),title:'Blatt 4',deadline:'2026-11-16T13:00',type:'Hausaufgabe'},{id:homeworkId('sheets','2026-11-23'),title:'Blatt 5',deadline:'2026-11-23T12:00',type:'Hausaufgabe'},{id:13,title:'Literatur lesen',deadline:'2026-10-01T15:00',type:'Lernen'},{id:14,title:'Übungsgruppe organisieren',deadline:null,type:'Organisation'},{id:15,title:'Referat vorbereiten',deadline:'2026-12-12T15:00',type:'Lernen'},{id:homeworkId('review','2026-12-16'),title:'Nachbereiten',deadline:'2026-12-16T18:00',type:'Nachbereitung'}];
  for(const t of roster)db.prepare("INSERT INTO tasks(id,course_id,title,description,area,type,deadline,status,completed_at) VALUES(?,4,?,'SECRET','Universität',?,?,'Erledigt','2026-11-15T12:00')").run(t.id,t.title,t.type,t.deadline);
  setting('course-requirements-4',[{id:'source-points',title:'Übungsblätter',unit:'Punkte',target:20,current:30,kind:'homework',taskType:'Hausaufgabe',worksheetCount:5}]);
  const template=catalogEntries(allData() as AppData)[0].payload;
  assert.equal(template.tasks?.length,roster.length);assert.ok(!JSON.stringify(template).includes('SECRET'));assert.ok(!JSON.stringify(template).includes('Erledigt'));
  const copied=transferCourse(db,template).id;
  let data=allData() as AppData,rows=data.tasks.filter(t=>t.course_id===copied);
  assert.equal(rows.length,roster.length);
  for(const expected of roster){const row=rows.find(t=>t.title===expected.title&&t.type===expected.type);assert.equal(row?.deadline,expected.deadline);assert.equal(row?.status,'Offen');assert.equal(row?.completed_at,null);assert.equal(row?.description,'');}
  const requirements=courseRequirements(data,copied!);assert.equal(requirements[0].current,0);assert.equal(requirementProgress(data,requirements[0]).amount,0);
  const now=new Date('2026-11-16T14:28'),plan=homeworkPlan(data,now);
  assert.ok(!plan.remove.some(t=>t.course_id===copied));
  for(const t of plan.create.filter(t=>t.course_id===copied))db.prepare('INSERT INTO tasks(id,course_id,title,description,area,type,deadline,status,tracking) VALUES(?,?,?,?,?,?,?,?,?)').run(t.id,t.course_id,t.title,t.description,t.area,t.type,t.deadline,t.status,t.tracking);
  data=allData() as AppData;rows=data.tasks.filter(t=>t.course_id===copied);
  for(const expected of roster)assert.equal(rows.filter(t=>t.title===expected.title&&t.deadline===expected.deadline).length,1);
  assert.ok(homeworkSeries(data).find(s=>s.task.course_id===copied&&s.task.title==='Nachbereiten')?.imported_dates?.includes('2026-12-16'));
  assert.equal([...homeworkPlan(data,now).create,...homeworkPlan(data,now).remove].filter(t=>t.course_id===copied).length,0);
  const ownTask=rows.find(t=>t.title==='Literatur lesen')!;db.prepare("UPDATE tasks SET status='Erledigt' WHERE id=?").run(ownTask.id);
  transferCourse(db,template,copied);
  data=allData() as AppData;assert.equal(data.tasks.find(t=>t.id===ownTask.id)?.status,'Erledigt');
  assert.equal(data.tasks.filter(t=>t.course_id===copied).length,rows.length);
  assert.equal(Object.keys(courseOrigin(data,copied!)!.task_map!).length,roster.length);
 }finally{db.close();await rm(dir,{recursive:true,force:true})}
});
