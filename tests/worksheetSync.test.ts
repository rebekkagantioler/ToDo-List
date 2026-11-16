import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homeworkId,homeworkKey,homeworkPlan,homeworkOwner,referenceTaskId,type HomeworkSeries} from '../src/homework';
import {catalogEntries,courseVisibilityKey} from '../src/catalog';
import {worksheetReassignment} from '../src/worksheetReassignment';
import type {AppData,Task} from '../src/types';
const base:HomeworkSeries={id:'canonical',event_id:1,starts_on:'2026-10-05',skipped:[],numbering:{start:1,from:'2026-10-05'},task:{title:'Blatt',description:'',area:'Universität',type:'Hausaufgabe',course_id:4,deadline:null,estimate_minutes:60,priority:'Mittel',status:'Offen',tracking:1}};
const fixture=():AppData=>({courses:[{id:4,name:'UE',code:'UE',semester:'WS',ects:3,hours_per_ects:25,color:'#123456',description:''}],tasks:[],sessions:[],blocks:[],recurring:[{id:1,course_id:4,title:'UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-05',ends_on:'2026-11-16',auto_track:0}],settings:[{key:courseVisibilityKey(4),value:'true'}]});
const task=(id:number,title:string,deadline:string):Task=>({...base.task,id,title,deadline,created_at:'2026-10-01T10:00',completed_at:null});
const now=new Date('2026-10-20T12:00');
function references(){return ['05','12','19','26'].map((day,i)=>({date:`2026-10-${day}`,title:`Blatt ${i+1}`,deadline:`2026-10-${day}T09:30`,visible:true}))}
function apply(data:AppData){const plan=homeworkPlan(data,now);data.tasks.push(...plan.create);data.tasks=data.tasks.map(t=>plan.update.find(u=>u.id===t.id)??t).filter(t=>!plan.remove.some(r=>r.id===t.id));return plan;}

test('Source exports actual corrected sheet deadlines without personal scores or completion',()=>{
 const data=fixture();data.settings.push({key:homeworkKey(base.id),value:JSON.stringify(base)});
 data.tasks=homeworkPlan(data,now).create;data.tasks[0].deadline='2026-10-04T14:15';data.tasks[0].status='Erledigt';data.tasks[0].description='SECRET';
 const sheets=catalogEntries(data)[0].payload.homework![0].sheets!;
 assert.deepEqual(sheets[0],{date:'2026-10-05',title:'Blatt 1',deadline:'2026-10-04T14:15',visible:true});
 assert.ok(!JSON.stringify(sheets).includes('Erledigt'));assert.ok(!JSON.stringify(sheets).includes('SECRET'));
});

test('Repair fills 1 through highest, corrects completed sheet times, removes duplicates across series, and is idempotent',()=>{
 const data=fixture();const series={...base,reference:references()};
 data.settings.push({key:homeworkKey(base.id),value:JSON.stringify(series)},{key:homeworkKey('legacy'),value:JSON.stringify({...base,id:'legacy',starts_on:'2026-10-19',numbering:{start:3,from:'2026-10-19'}})});
 const completed=task(homeworkId(base.id,'2026-10-19'),'Blatt 3','2026-10-20T17:00');completed.status='Erledigt';completed.completed_at='2026-10-20T10:00';
 data.tasks=[completed,task(homeworkId('legacy','2026-10-19'),'Blatt 3','2026-10-21T14:00'),task(55,'Blatt 3','2026-10-23T14:00'),task(56,'Blatt 99','2026-10-23T14:00'),task(57,'Andere Aufgabe','2026-10-23T14:00')];
 const plan=apply(data);
 assert.equal(plan.remove.length,3);
 assert.deepEqual(data.tasks.filter(t=>t.title.startsWith('Blatt ')).sort((a,b)=>a.title.localeCompare(b.title)).map(t=>[t.title,t.deadline]),references().map(s=>[s.title,s.deadline]));
 assert.equal(data.tasks.find(t=>t.title==='Blatt 3')!.status,'Erledigt');assert.ok(data.tasks.some(t=>t.id===57));
 assert.equal(homeworkOwner(data,homeworkId(base.id,'2026-10-05'))?.date,'2026-10-05');
 assert.deepEqual(homeworkPlan(data,now),{create:[],remove:[],update:[]});
});

test('Sync retains a friend completion but never copies source completion; unreleased future sheets stay weekly',()=>{
 const data=fixture();data.settings.push({key:homeworkKey(base.id),value:JSON.stringify({...base,reference:[...references(),{date:'2026-11-16',title:'Blatt 5',deadline:'2026-11-15T14:00',visible:false}]})});
 const done=task(50,'Blatt 2','2026-10-13T18:00');done.status='Erledigt';done.completed_at='2026-10-14T10:00';data.tasks=[done];
 apply(data);assert.equal(data.tasks.length,4);assert.equal(data.tasks.find(t=>t.title==='Blatt 2')!.status,'Erledigt');assert.equal(data.tasks.find(t=>t.title==='Blatt 1')!.status,'Offen');
});

test('Moving duplicate work preserves tracked times, planned blocks, points and explicit task links',()=>{
 const data=fixture();const to=homeworkId(base.id,'2026-10-19');
 data.sessions=[{id:1,task_id:50,course_id:4,started_at:'2026-10-19T08:00',ended_at:'2026-10-19T09:00',kind:'Selbstlernen',note:'Keep'}];
 data.blocks=[{id:2,task_id:51,course_id:4,title:'Plan',starts_at:'2026-10-21T10:00',ends_at:'2026-10-21T11:00',kind:'Arbeit'}];
 data.settings.push({key:'course-requirements-4',value:JSON.stringify([{id:'r',taskIds:[50,51,to]}])},{key:'performance-entry-r-task-50',value:JSON.stringify({requirementId:'r',source:'task-50',amount:3,possible:4,label:'Blatt 3'})});
 const moves=worksheetReassignment(data,[{from:50,to},{from:51,to:null}]);
 assert.equal(moves.sessions[0].task_id,to);assert.equal(moves.sessions[0].note,'Keep');assert.equal(moves.blocks[0].task_id,null);
 assert.deepEqual(JSON.parse(moves.settings.find(s=>s.key==='course-requirements-4')!.value)[0].taskIds,[to]);
 assert.equal(JSON.parse(moves.settings.find(s=>s.key===`performance-entry-r-task-${to}`)!.value).amount,3);
 assert.equal(moves.settings.find(s=>s.key==='performance-entry-r-task-50')!.value,'{}');
});

test('Screenshot regression: historical standalone sheets before the active series are included exactly once',()=>{
 const data=fixture();data.recurring[0].starts_on='2026-11-09';data.recurring[0].ends_on='2026-11-30';data.recurring[0].start_time='12:00';
 const active={...base,starts_on:'2026-11-09',numbering:{start:3,from:'2026-11-09'}};
 data.settings.push({key:homeworkKey(active.id),value:JSON.stringify(active)});
 data.tasks=[task(11,'Blatt 1','2026-10-12T11:08'),task(12,'Blatt 2','2026-10-19T13:45'),task(homeworkId(active.id,'2026-11-09'),'Blatt 3','2026-11-09T13:00'),task(homeworkId(active.id,'2026-11-16'),'Blatt 4','2026-11-16T13:00'),task(homeworkId(active.id,'2026-11-23'),'Blatt 5','2026-11-23T12:00')];
 const source=catalogEntries(data)[0].payload;
 const sheets=source.homework![0].sheets!;
 assert.deepEqual(sheets.filter(s=>s.visible).map(s=>[s.title,s.deadline]),data.tasks.map(t=>[t.title,t.deadline]));
 const friend=structuredClone(data);friend.tasks=friend.tasks.slice(2);friend.settings=[{key:homeworkKey(active.id),value:JSON.stringify({...active,reference:sheets})}];
 const when=new Date('2026-11-16T14:28');const plan=homeworkPlan(friend,when);
 assert.deepEqual(plan.create.map(t=>[t.title,t.deadline]),[['Blatt 1','2026-10-12T11:08'],['Blatt 2','2026-10-19T13:45']]);
 friend.tasks.push(...plan.create);
 assert.equal(homeworkOwner(friend,homeworkId(active.id,'2026-10-12'))?.date,'2026-10-12');
 assert.deepEqual(homeworkPlan(friend,when),{create:[],remove:[],update:[]});
});

test('The sync prompt disappears after persisted sheets match and returns only for a real difference',async()=>{
 const {courseNeedsWorksheetSync}=await import('../src/courseWorksheetSync');
 const data=fixture();const ref=references(),series={...base,reference:ref};
 data.settings.push({key:homeworkKey(base.id),value:JSON.stringify(series)});
 const source={course:data.courses[0],events:[],homework:[{source_key:'source',event_key:'event',title:'Blatt',type:'Hausaufgabe',starts_on:base.starts_on,estimate_minutes:60,priority:'Mittel',tracking:1,sheets:ref}]};
 const origin={source_key:'course',revision:'same',event_map:{event:1},homework_map:{source:base.id},snapshot:source};
 assert.equal(courseNeedsWorksheetSync(data,4,source,origin,now),true);
 apply(data);
 assert.equal(courseNeedsWorksheetSync(data,4,source,origin,now),false);
 assert.equal(courseNeedsWorksheetSync(structuredClone(data),4,source,origin,now),false);
 source.homework[0].sheets=[...ref,{date:'2026-09-28',title:'Früheres Blatt',deadline:'2026-09-28T09:00',visible:true}];
 assert.equal(courseNeedsWorksheetSync(data,4,source,origin,now),true);
});

test('Two actual numbered sheets are both exported when their deadlines resolve to the same exercise date',()=>{
 const data=fixture();
 data.settings.push({key:homeworkKey(base.id),value:JSON.stringify({...base,starts_on:'2026-10-19',numbering:{start:2,from:'2026-10-19'}})});
 data.tasks=[task(11,'Blatt 1','2026-10-13T11:08'),task(12,'Blatt 2','2026-10-19T13:45')];
 const sheets=catalogEntries(data)[0].payload.homework![0].sheets!;
 assert.deepEqual(sheets.filter(s=>s.visible).map(s=>s.title).sort(),['Blatt 1','Blatt 2']);
 const friend=structuredClone(data),local={...base,starts_on:'2026-10-19',reference:sheets};
 friend.tasks=[];friend.settings=[{key:homeworkKey(local.id),value:JSON.stringify(local)}];
 const when=new Date('2026-10-19T09:00'),plan=homeworkPlan(friend,when);
 assert.equal(plan.create.length,2);assert.equal(new Set(plan.create.map(t=>t.id)).size,2);
 assert.deepEqual(plan.create.map(t=>[t.title,t.deadline]),[['Blatt 1','2026-10-13T11:08'],['Blatt 2','2026-10-19T13:45']]);
 for(const sheet of sheets.filter(s=>s.visible))assert.equal(homeworkOwner(friend,referenceTaskId(local,sheet))?.date,sheet.date);
 friend.tasks=plan.create;assert.deepEqual(homeworkPlan(friend,when),{create:[],remove:[],update:[]});
});
