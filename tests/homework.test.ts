import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homeworkId,homeworkKey,homeworkOwner,homeworkPlan,homeworkTitleUpdates,homeworkDeadline,nextDeadline,type HomeworkSeries} from '../src/homework';
import type {AppData} from '../src/types';
const series:HomeworkSeries={id:'test',event_id:1,starts_on:'2026-10-19',skipped:[],task:{title:'Blatt',description:'',area:'Universität',type:'Hausaufgabe',course_id:4,deadline:null,estimate_minutes:60,priority:'Mittel',status:'Offen',tracking:1}};
const fixture=():AppData=>({courses:[],tasks:[],sessions:[],blocks:[],recurring:[{id:1,course_id:4,title:'Analysis UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-19',ends_on:'2026-11-02',auto_track:1}],settings:[{key:homeworkKey(series.id),value:JSON.stringify(series)}]});
test('Next deadline skips cancellations and past meetings',()=>{const d=fixture();d.settings.push({key:'lecture-exclusions-1',value:'["2026-10-26"]'});assert.equal(nextDeadline(d,4,new Date('2026-10-19T11:00')),'2026-11-02T10:00');assert.equal(nextDeadline(d,null),'');});
test('Weekly homework releases seven calendar days before its meeting and never duplicates',()=>{const d=fixture();const now=new Date('2026-10-19T10:00');const plan=homeworkPlan(d,now);assert.deepEqual(plan.create.map(t=>t.deadline),['2026-10-19T10:00','2026-10-26T10:00']);assert.ok(plan.create.every(t=>Number.isSafeInteger(t.id)));d.tasks=plan.create;assert.equal(homeworkPlan(d,now).create.length,0);assert.equal(homeworkOwner(d,d.tasks[1].id)?.date,'2026-10-26');});
test('Cancellation removes open homework, preserves completed work, and restoration recreates homework',()=>{const d=fixture(),now=new Date('2026-10-19T10:00');d.tasks=homeworkPlan(d,now).create;d.tasks[0].status='Erledigt';d.settings.push({key:'lecture-exclusions-1',value:'["2026-10-19","2026-10-26"]'});assert.deepEqual(homeworkPlan(d,now).remove.map(t=>t.id),[homeworkId('test','2026-10-26')]);d.tasks=d.tasks.slice(0,1);d.settings.pop();assert.equal(homeworkPlan(d,now).create.length,1);});
test('Deleted individual homework stays skipped; ending series retains existing tasks',()=>{const d=fixture();d.settings[0].value=JSON.stringify({...series,skipped:['2026-10-19']});assert.deepEqual(homeworkPlan(d,new Date('2026-10-19T10:00')).create.map(t=>t.deadline),['2026-10-26T10:00']);d.tasks=homeworkPlan(d,new Date('2026-10-19T10:00')).create;d.settings[0].value=JSON.stringify({...series,stopped:true});assert.deepEqual(homeworkPlan(d,new Date('2026-11-01')),{create:[],remove:[],update:[]});});
test('Deleting a series removes unworked open sheets, preserves completed and tracked tasks, and never regenerates',()=>{
 const d=fixture();d.tasks=homeworkPlan(d,new Date('2026-11-02T10:00')).create;
 d.tasks[0].status='Erledigt';d.sessions.push({id:1,task_id:d.tasks[1].id,course_id:4,started_at:'2026-10-19T09:00',ended_at:'2026-10-19T10:00',kind:'Selbstlernen',note:''});
 d.settings[0].value=JSON.stringify({...series,stopped:true,deleted:true});
 const plan=homeworkPlan(d,new Date('2026-11-02T10:00'));assert.deepEqual(plan.remove.map(t=>t.id),[d.tasks[2].id]);assert.equal(plan.create.length,0);
 d.tasks=d.tasks.filter(t=>!plan.remove.some(r=>r.id===t.id));assert.deepEqual(homeworkPlan(d,new Date('2026-11-02T10:00')),{create:[],remove:[],update:[]});
});

test('Optional numbering starts at 4, skips canceled meetings and retains the number of deleted individual sheets',()=>{
 const d=fixture(),numbered={...series,numbering:{start:4,from:'2026-10-19'}};
 d.settings[0].value=JSON.stringify(numbered);d.settings.push({key:'lecture-exclusions-1',value:'["2026-10-26"]'});
 assert.deepEqual(homeworkPlan(d,new Date('2026-11-02T10:00')).create.map(t=>t.title),['Blatt 4','Blatt 5']);
 d.settings[0].value=JSON.stringify({...numbered,skipped:['2026-10-19']});assert.deepEqual(homeworkPlan(d,new Date('2026-11-02T10:00')).create.map(t=>t.title),['Blatt 5']);
});
test('Editing an existing series numbers open sheets without duplicating tasks or changing completed/manual titles',()=>{
 const d=fixture(),now=new Date('2026-11-02T10:00');d.tasks=homeworkPlan(d,now).create;d.tasks[0].status='Erledigt';
 const edited={...series,numbering:{start:4,from:'2026-10-26'}};const saved={...edited,title_updates:homeworkTitleUpdates(d,edited,'2026-10-26')};d.settings[0].value=JSON.stringify(saved);
 const plan=homeworkPlan(d,now);assert.equal(plan.create.length,0);assert.deepEqual(plan.update.map(t=>t.title),['Blatt 4','Blatt 5']);assert.ok(!plan.update.some(t=>t.id===d.tasks[0].id));
 d.tasks[1].title='Individuell benannt';assert.deepEqual(homeworkPlan(d,now).update.map(t=>t.title),['Blatt 5']);
});

test('Late cancellation does not reuse an already released sheet number',()=>{
 const d=fixture();d.recurring[0].ends_on='2026-11-16';d.settings[0].value=JSON.stringify({...series,numbering:{start:4,from:'2026-10-19'}});
 d.tasks=homeworkPlan(d,new Date('2026-10-19T10:00')).create;
 d.settings.push({key:'lecture-exclusions-1',value:'["2026-10-19"]'});
 assert.deepEqual(homeworkPlan(d,new Date('2026-11-09T10:00')).create.map(t=>t.title),['Blatt 6','Blatt 7','Blatt 8']);
});
test('Next sheet appears immediately even if its deadline is several weeks away',()=>{
 const d=fixture();d.recurring[0].starts_on='2026-11-09';d.recurring[0].ends_on='2026-11-23';
 d.settings[0].value=JSON.stringify({...series,starts_on:'2026-11-09',numbering:{start:4,from:'2026-11-09'}});
 const now=new Date('2026-10-20T10:00'),plan=homeworkPlan(d,now);
 assert.deepEqual(plan.create.map(t=>({title:t.title,deadline:t.deadline})),[{title:'Blatt 4',deadline:'2026-11-09T10:00'}]);
 d.tasks=plan.create;assert.equal(homeworkPlan(d,now).create.length,0);
});
test('Immediate next sheet respects cancellations, explicitly deleted sheets and stopped series',()=>{
 const d=fixture();d.recurring[0].starts_on='2026-11-09';d.recurring[0].ends_on='2026-11-23';d.settings[0].value=JSON.stringify({...series,starts_on:'2026-11-09'});
 d.settings.push({key:'lecture-exclusions-1',value:'["2026-11-09"]'});
 assert.deepEqual(homeworkPlan(d,new Date('2026-10-20T10:00')).create.map(t=>t.deadline),['2026-11-16T10:00']);
 d.settings[0].value=JSON.stringify({...series,starts_on:'2026-11-09',skipped:['2026-11-16']});assert.deepEqual(homeworkPlan(d,new Date('2026-10-20T10:00')).create.map(t=>t.deadline),['2026-11-23T10:00']);
 d.settings[0].value=JSON.stringify({...series,starts_on:'2026-11-09',stopped:true});assert.equal(homeworkPlan(d,new Date('2026-10-20T10:00')).create.length,0);
});

test('Thursday at noon can have a Wednesday 14:00 deadline, including month/year and DST boundaries',()=>{
 const d=fixture(),rule={...series,submission:{days_before:1,time:'14:00'}};
 d.recurring[0].weekday=4;d.recurring[0].start_time='12:00';d.recurring[0].starts_on='2026-10-22';d.recurring[0].ends_on='2026-11-05';d.settings[0].value=JSON.stringify(rule);
 assert.equal(homeworkDeadline(d,rule,'2026-10-22'),'2026-10-21T14:00');
 assert.equal(homeworkDeadline(d,rule,'2026-10-29'),'2026-10-28T14:00');
 assert.equal(homeworkDeadline(d,rule,'2027-01-01'),'2026-12-31T14:00');
 assert.equal(homeworkDeadline(d,{...series,submission:{days_before:0,time:'09:00'}},'2026-10-22'),'2026-10-22T09:00');
 assert.equal(nextDeadline(d,4,new Date('2026-10-20T10:00')),'2026-10-21T14:00');
 assert.equal(nextDeadline(d,4,new Date('2026-10-21T15:00')),'2026-10-28T14:00');
 const plan=homeworkPlan(d,new Date('2026-10-20T10:00'));assert.equal(plan.create[0].deadline,'2026-10-21T14:00');
 d.tasks=plan.create;d.settings.push({key:'lecture-exclusions-1',value:'["2026-10-22"]'});assert.equal(homeworkPlan(d,new Date('2026-10-20T10:00')).remove[0].id,d.tasks[0].id);
});
test('Changing submission rules updates existing open deadlines, preserving completed work and later individual edits',()=>{
 const d=fixture(),now=new Date('2026-11-02T10:00');d.tasks=homeworkPlan(d,now).create;d.tasks[0].status='Erledigt';
 const edited={...series,submission:{days_before:1,time:'14:00'}};const saved={...edited,title_updates:homeworkTitleUpdates(d,edited,'2026-10-26')};d.settings[0].value=JSON.stringify(saved);
 const plan=homeworkPlan(d,now);assert.deepEqual(plan.update.map(t=>t.deadline),['2026-10-25T14:00','2026-11-01T14:00']);assert.equal(plan.create.length,0);assert.ok(!plan.update.some(t=>t.id===d.tasks[0].id));
 d.tasks[1].deadline='2026-10-24T09:00';assert.equal(homeworkPlan(d,now).update.length,1);
});

test('Early submission does not release the next sheet before the lecture',()=>{
 const d=fixture();d.recurring[0]={...d.recurring[0],weekday:4,start_time:'12:00',starts_on:'2026-10-22',ends_on:'2026-11-05'};
 d.settings[0].value=JSON.stringify({...series,submission:{days_before:1,time:'14:00'}});
 d.tasks=homeworkPlan(d,new Date('2026-10-20T10:00')).create;
 assert.deepEqual(d.tasks.map(t=>t.deadline),['2026-10-21T14:00']);
 assert.equal(homeworkPlan(d,new Date('2026-10-21T14:01')).create.length,0);
 assert.equal(homeworkPlan(d,new Date('2026-10-22T11:59')).create.length,0);
 assert.deepEqual(homeworkPlan(d,new Date('2026-10-22T12:00')).create.map(t=>t.deadline),['2026-10-28T14:00']);
});

test('Previously generated early sheets disappear until lecture time without losing started or completed work',()=>{
 const d=fixture();d.recurring[0]={...d.recurring[0],weekday:4,start_time:'12:00',starts_on:'2026-10-22',ends_on:'2026-11-05'};
 d.settings[0].value=JSON.stringify({...series,submission:{days_before:1,time:'14:00'}});
 const early=new Date('2026-10-21T15:00');
 d.tasks=homeworkPlan(d,new Date('2026-10-22T12:00')).create;
 const next=d.tasks.find(t=>t.deadline==='2026-10-28T14:00')!;
 assert.deepEqual(homeworkPlan(d,early).remove.map(t=>t.id),[next.id]);
 next.status='In Bearbeitung';assert.equal(homeworkPlan(d,early).remove.length,0);
 next.status='Erledigt';assert.equal(homeworkPlan(d,early).remove.length,0);
 next.status='Offen';d.sessions=[{id:1,task_id:next.id,course_id:4,started_at:'2026-10-21T14:00',ended_at:'2026-10-21T14:10',kind:'Selbstlernen',note:''}];assert.equal(homeworkPlan(d,early).remove.length,0);
 d.sessions=[];d.tasks=d.tasks.filter(t=>t.id!==next.id);
 assert.equal(homeworkPlan(d,early).create.length,0);
 assert.deepEqual(homeworkPlan(d,new Date('2026-10-22T12:00')).create.map(t=>t.id),[next.id]);
});
