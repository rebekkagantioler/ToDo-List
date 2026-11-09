import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courseRequirements,requirementsKey,validRequirement} from '../src/requirements';
import type {AppData} from '../src/types';
const requirement={id:'a',title:'Übungsblätter',unit:'Punkte',target:60,current:62.5};
test('requirements survive settings serialization and stay scoped to their course',()=>{
 const data={settings:[{key:requirementsKey(1),value:JSON.stringify([requirement])}]} as AppData;
 assert.deepEqual(courseRequirements(data,1),[requirement]);
 assert.deepEqual(courseRequirements(data,2),[]);
 assert.equal(validRequirement(requirement),true);
});
test('invalid saved goals and broken settings do not break course details',()=>{
 for(const value of ['broken','null','{}',JSON.stringify([null,{...requirement,target:0},{...requirement,current:-1},{...requirement,title:' '}])]){
  assert.deepEqual(courseRequirements({settings:[{key:requirementsKey(1),value}]} as AppData,1),[]);
 }
 assert.equal(validRequirement({...requirement,current:NaN}),false);
 assert.equal(validRequirement({...requirement,target:Infinity}),false);
});

import {entryKey,performanceEntries,requirementEntries,requirementProgress,missingHomeworkResults,performanceQuestions,skippedKey,examDateLabel,type CourseRequirement,type PerformanceEntry} from '../src/requirements';
import {attendanceKey,exclusionKey} from '../src/statistics';
import type {Task,Course,RecurringEvent} from '../src/types';
function fixture(r:CourseRequirement):AppData{return {courses:[{id:1,name:'Mathematik',semester:'WS 2026/27'} as Course,{id:2,name:'Sprache'} as Course],tasks:[],sessions:[],blocks:[],recurring:[],settings:[{key:requirementsKey(1),value:JSON.stringify([r])}]}}
function put(data:AppData,key:string,value:unknown){data.settings=data.settings.filter(s=>s.key!==key);data.settings.push({key,value:typeof value==='string'?value:JSON.stringify(value)})}
function saveEntry(data:AppData,e:PerformanceEntry){put(data,entryKey(e.requirementId,e.source),e)}
const points:CourseRequirement={id:'points',title:'Übungsblätter',unit:'Punkte',kind:'homework',target:60,current:0,taskType:'Hausaufgabe'};
const reflection:CourseRequirement={id:'texts',title:'Reflexionen',unit:'Texte',kind:'reflection',target:5,current:2,taskType:'Reflexion'};
const task=(id:number,course_id=1,type='Hausaufgabe',status:Task['status']='Erledigt')=>({id,course_id,type,status,title:`Blatt ${id}`} as Task);
test('points use per-sheet results, corrections replace the same sheet and reopened/skipped/deleted sheets do not count',()=>{
 const data=fixture(points);data.tasks=[task(1),task(2)];
 const e={requirementId:points.id,source:'task-1',label:'Blatt 1',amount:8,possible:12};saveEntry(data,e);
 assert.equal(requirementProgress(data,points).amount,8);
 saveEntry(data,{...e,amount:10});assert.equal(requirementProgress(data,points).amount,10);assert.equal(performanceEntries(data,points.id).length,1);
 put(data,skippedKey(1),'yes');assert.equal(requirementProgress(data,points).amount,0);
 put(data,skippedKey(1),'no');data.tasks[0].status='Offen';assert.equal(requirementProgress(data,points).amount,0);
 data.tasks=[];assert.equal(requirementProgress(data,points).amount,0);
});
test('percentage goals include possible points from zero-point sheets and do not start fulfilled',()=>{
 const r={...points,percentage:true,target:50};const data=fixture(r);
 assert.equal(requirementProgress(data,r).fulfilled,false);
 saveEntry(data,{requirementId:r.id,source:'manual-a',label:'Blatt A',amount:8,possible:10});
 saveEntry(data,{requirementId:r.id,source:'manual-b',label:'Blatt B',amount:0,possible:10});
 assert.equal(requirementProgress(data,r).value,40);assert.equal(requirementProgress(data,r).fulfilled,false);
 saveEntry(data,{requirementId:r.id,source:'manual-b',label:'Blatt B',amount:4,possible:10});assert.equal(requirementProgress(data,r).value,60);assert.equal(requirementProgress(data,r).fulfilled,true);
});
test('completed reflections count automatically within their own course; skipping and reopening removes their credit',()=>{
 const data=fixture(reflection);data.tasks=[task(1,1,'Reflexion'),task(2,1,'Reflexion'),task(3,2,'Reflexion'),task(4,1,'Reflexion','Offen')];
 assert.equal(requirementProgress(data,reflection).amount,4);
 assert.equal(requirementEntries(data,reflection).length,2);
 put(data,skippedKey(2),'yes');assert.equal(requirementProgress(data,reflection).amount,3);
 data.tasks[0].status='Offen';assert.equal(requirementProgress(data,reflection).amount,2);
});
test('manual backfill and a linked event accumulate once; absence, cancellation or event deletion removes event credit',()=>{
 const r:CourseRequirement={id:'present',title:'Vorrechnen',kind:'presentation',unit:'Mal',target:4,current:0,eventId:3};const data=fixture(r);
 data.recurring=[{id:3,course_id:1} as RecurringEvent];const source=attendanceKey(3,'2026-11-02');put(data,source,'yes');
 saveEntry(data,{requirementId:r.id,source:'manual-before',label:'Vor Beginn',amount:2});
 const e={requirementId:r.id,source,label:'Übung',amount:1};saveEntry(data,e);saveEntry(data,e);
 assert.equal(requirementProgress(data,r).amount,3);
 put(data,source,'no');assert.equal(requirementProgress(data,r).amount,2);
 put(data,source,'yes');put(data,exclusionKey(3),['2026-11-02']);assert.equal(requirementProgress(data,r).amount,2);
 put(data,exclusionKey(3),[]);data.recurring=[];assert.equal(requirementProgress(data,r).amount,2);
});
test('completion asks points for linked homework only; skip, reflection and ordinary edits have no prompt',()=>{
 const data=fixture(points);data.tasks=[task(1,1,'Hausaufgabe','Offen'),task(2,2,'Hausaufgabe','Offen')];
 assert.equal(performanceQuestions(data,'/tasks/1','PUT',{status:'Erledigt'}).length,1);
 assert.equal(performanceQuestions(data,'/tasks/1','PUT',{status:'Erledigt',_skip:true}).length,0);
 assert.equal(performanceQuestions(data,'/tasks/2','PUT',{status:'Erledigt'}).length,0);
 data.tasks[0].status='Erledigt';assert.equal(performanceQuestions(data,'/tasks/1','PUT',{status:'Erledigt'}).length,0);
 const d=fixture(reflection);d.tasks=[task(1,1,'Reflexion','Offen')];assert.equal(performanceQuestions(d,'/tasks/1','PUT',{status:'Erledigt'}).length,0);
});
test('attendance prompt is scoped to the chosen course series, never to absence or explicit performance backfill',()=>{
 const r:CourseRequirement={id:'present',title:'Vorrechnen',kind:'presentation',unit:'Mal',target:3,current:0,eventId:3};const data=fixture(r);data.recurring=[{id:3,course_id:1} as RecurringEvent,{id:4,course_id:1} as RecurringEvent];
 const path=`/settings/${attendanceKey(3,'2026-11-02')}`;
 assert.equal(performanceQuestions(data,path,'PUT',{value:'yes'}).length,1);
 assert.equal(performanceQuestions(data,path,'PUT',{value:'no'}).length,0);
 assert.equal(performanceQuestions(data,path,'PUT',{value:'yes',_performanceBackfill:true}).length,0);
 assert.equal(performanceQuestions(data,`/settings/${attendanceKey(4,'2026-11-02')}`,'PUT',{value:'yes'}).length,0);
 put(data,attendanceKey(3,'2026-11-02'),'yes');assert.equal(performanceQuestions(data,path,'PUT',{value:'yes'}).length,0);
});
test('exams may have unknown/self-selected dates, but fixed dates must be real; completion alone cannot pass an exam',()=>{
 const r:CourseRequirement={id:'exam',kind:'exam',title:'Mündliche Prüfung',unit:'Prüfung',target:1,current:0,dateMode:'choose'};
 assert.equal(validRequirement(r),true);assert.equal(examDateLabel(r),'Termin selbst wählen');assert.equal(requirementProgress(fixture(r),r).fulfilled,false);
 assert.equal(validRequirement({...r,dateMode:'fixed',date:'2026-02-30'}),false);
 assert.equal(validRequirement({...r,dateMode:'fixed',date:'2026-12-03'}),true);
 assert.equal(requirementProgress(fixture(r),{...r,examResult:'passed'}).fulfilled,true);
});
test('already completed linked homework is shown as missing results until points are entered',()=>{
 const data=fixture(points);data.tasks=[task(1),task(2),task(3,1,'Hausaufgabe','Offen')];put(data,skippedKey(2),'yes');
 assert.deepEqual(missingHomeworkResults(data,points).map(t=>t.id),[1]);
 saveEntry(data,{requirementId:points.id,source:'task-1',label:'Blatt 1',amount:0,possible:10});assert.deepEqual(missingHomeworkResults(data,points),[]);
});
