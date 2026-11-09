import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requirementProgress,requirementsKey,entryKey,requirementEntries,validRequirement,type CourseRequirement} from '../src/requirements';
import {worksheetMaximum} from '../src/worksheetRules';
import {worksheetProgress} from '../src/WorksheetProgress';
import {requirementScore,emptyPassingRule} from '../src/passingRules';
import {attendanceKey,exclusionKey} from '../src/statistics';
import type {AppData,Course,RecurringEvent,Task} from '../src/types';
const r:CourseRequirement={id:'analysis',title:'Arbeitsblätter',kind:'homework',unit:'Punkte',target:24,current:0,pointsPerSheet:4,worksheetCount:14,dropLowest:2,attendanceRequired:true,eventId:1,taskType:'Hausaufgabe'};
function fixture(){
 const data:AppData={courses:[{id:1} as Course],tasks:[],recurring:[{id:1,course_id:1} as RecurringEvent],sessions:[],blocks:[],settings:[{key:requirementsKey(1),value:JSON.stringify([r])}]};
 for(let i=1;i<=14;i++){
  const date=`2026-11-${String(i).padStart(2,'0')}`;
  data.settings.push({key:entryKey(r.id,`manual-${i}`),value:JSON.stringify({requirementId:r.id,source:`manual-${i}`,label:`Blatt ${i}`,date,amount:4,possible:4})},{key:attendanceKey(1,date),value:'yes'});
 }
 return data;
}
function attendance(data:AppData,n:number,value:string){data.settings.find(s=>s.key===attendanceKey(1,`2026-11-${String(n).padStart(2,'0')}`))!.value=value}
test('14 sheets of 4 points minus the 2 lowest have a maximum of 48, including bar and grading denominator',()=>{
 const data=fixture(),p=requirementProgress(data,r);assert.equal(worksheetMaximum(data,r),48);assert.equal(p.amount,48);assert.equal(p.possible,48);assert.equal(p.worksheet!.dropped.size,2);assert.equal(worksheetProgress(data,1,r).marker,50);assert.equal(requirementScore(data,r,emptyPassingRule()).percentage,100);
});
test('two absences get zero credit and use up exactly the two discarded sheets',()=>{
 const data=fixture();attendance(data,3,'no');attendance(data,7,'no');const p=requirementProgress(data,r);
 assert.equal(p.amount,48);assert.deepEqual([...p.worksheet!.dropped].sort(),['manual-3','manual-7']);assert.equal(p.worksheet!.rows.find(x=>x.entry.source==='manual-3')!.entry.amount,4);assert.equal(p.worksheet!.rows.find(x=>x.entry.source==='manual-3')!.effectiveAmount,0);
});
test('a third absence remains zero within the retained sheets and is not silently discarded',()=>{
 const data=fixture();for(const n of [3,7,10])attendance(data,n,'no');const p=requirementProgress(data,r);
 assert.equal(p.amount,44);assert.equal(p.possible,48);assert.equal(p.worksheet!.dropped.size,2);assert.equal(p.entries.filter(e=>e.amount===0).length,1);
});
test('without absences the two lowest actual scores are discarded',()=>{
 const data=fixture();for(const [n,amount] of [[2,1],[6,2]]){const setting=data.settings.find(s=>s.key===entryKey(r.id,`manual-${n}`))!;setting.value=JSON.stringify({...JSON.parse(setting.value),amount})}
 const p=requirementProgress(data,r);assert.equal(p.amount,48);assert.deepEqual([...p.worksheet!.dropped].sort(),['manual-2','manual-6']);
});
test('correcting attendance restores the original points and recalculates the dropped sheets',()=>{
 const data=fixture();attendance(data,1,'no');attendance(data,2,'no');attendance(data,3,'no');assert.equal(requirementProgress(data,r).amount,44);
 attendance(data,3,'yes');assert.equal(requirementProgress(data,r).amount,48);assert.equal(JSON.parse(data.settings.find(s=>s.key===entryKey(r.id,'manual-3'))!.value).amount,4);
});
test('unconfirmed attendance and canceled dates do not get credit or use discarded-sheet slots',()=>{
 const data=fixture();attendance(data,1,'');data.settings.push({key:exclusionKey(1),value:'["2026-11-02"]'});const p=requirementProgress(data,r);
 assert.equal(p.worksheet!.rows.find(x=>x.entry.source==='manual-1')!.attendance,null);assert.equal(p.worksheet!.rows.find(x=>x.entry.source==='manual-2')!.attendance,'canceled');assert.ok(!p.worksheet!.dropped.has('manual-1'));assert.ok(!p.worksheet!.dropped.has('manual-2'));assert.equal(p.amount,40);
});
test('an absent linked task appears as a zero sheet even without a saved result or completion',()=>{
 const data=fixture();data.settings=data.settings.filter(s=>!s.key.startsWith('performance-entry-'));data.tasks=[{id:3,course_id:1,type:'Hausaufgabe',title:'Blatt 3',status:'Offen',deadline:'2026-11-03'} as Task];attendance(data,3,'no');
 assert.equal(requirementEntries(data,r).length,1);assert.equal(requirementEntries(data,r)[0].amount,0);assert.equal(requirementProgress(data,r).worksheet!.dropped.has('task-3'),true);
});
test('invalid drop counts are rejected and old lump-sum points need allocation before applying worksheet rules',()=>{
 assert.equal(validRequirement({...r,dropLowest:14}),false);assert.equal(validRequirement({...r,dropLowest:-1}),false);assert.equal(validRequirement({...r,worksheetCount:14.5}),false);
 const data=fixture(),legacy={...r,current:12};assert.equal(requirementProgress(data,legacy).amount,48);assert.equal(requirementProgress(data,legacy).unallocatedCurrent,12);
});

import {homeworkId,homeworkKey} from '../src/homework';
import {worksheetAttendance} from '../src/worksheetRules';
test('attendance follows the exercise occurrence of a homework series, not its earlier submission deadline',()=>{
 const data=fixture(),date='2026-11-09',taskId=homeworkId('series',date);
 data.recurring=[{id:1,course_id:1,title:'Übung',weekday:1,start_time:'09:00',end_time:'10:00',starts_on:date,ends_on:date,auto_track:0}];
 data.settings.push({key:homeworkKey('series'),value:JSON.stringify({id:'series',event_id:1,starts_on:date,task:{title:'Blatt',course_id:1,type:'Hausaufgabe'},skipped:[]})});
 data.tasks=[{id:taskId,course_id:1,title:'Blatt 6',type:'Hausaufgabe',status:'Erledigt',deadline:'2026-11-08T18:00'} as Task];attendance(data,9,'no');
 assert.equal(worksheetAttendance(data,r,{requirementId:r.id,source:`task-${taskId}`,label:'Blatt 6',amount:4,possible:4}),'no');
});

import {worksheetCompletion,skippedKey} from '../src/requirements';
test('worked-sheet count is independent of points, discarded sheets and missed sessions',()=>{
 const data=fixture();data.settings=data.settings.filter(s=>!s.key.startsWith('performance-entry-'));
 data.tasks=[{id:1,course_id:1,title:'Blatt 1',type:'Hausaufgabe',status:'Erledigt',deadline:'2026-11-01'},{id:2,course_id:1,title:'Blatt 2',type:'Hausaufgabe',status:'Erledigt',deadline:'2026-11-02'},{id:3,course_id:1,title:'Blatt 3',type:'Hausaufgabe',status:'Offen',deadline:'2026-11-03'},{id:4,course_id:1,title:'Blatt 4',type:'Hausaufgabe',status:'Erledigt',deadline:'2026-11-04'}] as Task[];
 data.settings.push({key:entryKey(r.id,'task-1'),value:JSON.stringify({requirementId:r.id,source:'task-1',label:'Blatt 1',amount:0,possible:4})},{key:entryKey(r.id,'manual-old'),value:JSON.stringify({requirementId:r.id,source:'manual-old',label:'Früheres Blatt',amount:0,possible:4,attended:true})},{key:skippedKey(4),value:'yes'});
 attendance(data,3,'no');
 assert.equal(requirementEntries(data,r).some(e=>e.source==='task-3'),true);
 const c=worksheetCompletion(data,r);assert.equal(c.completed,3);assert.equal(c.total,14);assert.equal(c.pendingPoints,1);
 data.tasks[1].status='Offen';assert.equal(worksheetCompletion(data,r).completed,2);
});

test('one absence and the lowest attended score consume two drops while 14 remains the work total',()=>{
 const data=fixture();attendance(data,4,'no');
 const setting=data.settings.find(s=>s.key===entryKey(r.id,'manual-8'))!;setting.value=JSON.stringify({...JSON.parse(setting.value),amount:1});
 const p=requirementProgress(data,r);assert.deepEqual([...p.worksheet!.dropped].sort(),['manual-4','manual-8']);assert.equal(p.entries.length,12);assert.equal(p.amount,48);assert.equal(p.possible,48);assert.equal(worksheetCompletion(data,r).total,14);assert.equal(worksheetCompletion(data,r).completed,14);
});
test('no absence still discards exactly two; the work count and 50 percent minimum retain distinct denominators',()=>{
 const data=fixture();
 const p=requirementProgress(data,r);assert.equal(p.entries.length,12);assert.equal(p.worksheet!.rows.length,14);assert.equal(p.worksheet!.dropped.size,2);assert.equal(worksheetCompletion(data,r).total,14);assert.equal(worksheetProgress(data,1,r).minimum,24);assert.equal(worksheetProgress(data,1,r).marker,50);
});
