import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homeworkId,homeworkKey,homeworkOwner,homeworkPlan,nextDeadline,type HomeworkSeries} from '../src/homework';
import type {AppData} from '../src/types';
const series:HomeworkSeries={id:'test',event_id:1,starts_on:'2026-10-19',skipped:[],task:{title:'Blatt',description:'',area:'Universität',type:'Hausaufgabe',course_id:4,deadline:null,estimate_minutes:60,priority:'Mittel',status:'Offen',tracking:1}};
const fixture=():AppData=>({courses:[],tasks:[],sessions:[],blocks:[],recurring:[{id:1,course_id:4,title:'Analysis UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-19',ends_on:'2026-11-02',auto_track:1}],settings:[{key:homeworkKey(series.id),value:JSON.stringify(series)}]});
test('Next deadline skips cancellations and past meetings',()=>{const d=fixture();d.settings.push({key:'lecture-exclusions-1',value:'["2026-10-26"]'});assert.equal(nextDeadline(d,4,new Date('2026-10-19T11:00')),'2026-11-02T10:00');assert.equal(nextDeadline(d,null),'');});
test('Weekly homework releases seven calendar days before its meeting and never duplicates',()=>{const d=fixture();const now=new Date('2026-10-19T10:00');const plan=homeworkPlan(d,now);assert.deepEqual(plan.create.map(t=>t.deadline),['2026-10-19T10:00','2026-10-26T10:00']);assert.ok(plan.create.every(t=>Number.isSafeInteger(t.id)));d.tasks=plan.create;assert.equal(homeworkPlan(d,now).create.length,0);assert.equal(homeworkOwner(d,d.tasks[1].id)?.date,'2026-10-26');});
test('Cancellation removes open homework, preserves completed work, and restoration recreates homework',()=>{const d=fixture(),now=new Date('2026-10-19T10:00');d.tasks=homeworkPlan(d,now).create;d.tasks[0].status='Erledigt';d.settings.push({key:'lecture-exclusions-1',value:'["2026-10-19","2026-10-26"]'});assert.deepEqual(homeworkPlan(d,now).remove.map(t=>t.id),[homeworkId('test','2026-10-26')]);d.tasks=d.tasks.slice(0,1);d.settings.pop();assert.equal(homeworkPlan(d,now).create.length,1);});
test('Deleted individual homework stays skipped; ending series retains existing tasks',()=>{const d=fixture();d.settings[0].value=JSON.stringify({...series,skipped:['2026-10-19']});assert.deepEqual(homeworkPlan(d,new Date('2026-10-19T10:00')).create.map(t=>t.deadline),['2026-10-26T10:00']);d.tasks=homeworkPlan(d,new Date('2026-10-19T10:00')).create;d.settings[0].value=JSON.stringify({...series,stopped:true});assert.deepEqual(homeworkPlan(d,new Date('2026-11-01')),{create:[],remove:[]});});
test('Deleting a series removes unworked open sheets, preserves completed and tracked tasks, and never regenerates',()=>{
 const d=fixture();d.tasks=homeworkPlan(d,new Date('2026-11-02T10:00')).create;
 d.tasks[0].status='Erledigt';d.sessions.push({id:1,task_id:d.tasks[1].id,course_id:4,started_at:'2026-10-19T09:00',ended_at:'2026-10-19T10:00',kind:'Selbstlernen',note:''});
 d.settings[0].value=JSON.stringify({...series,stopped:true,deleted:true});
 const plan=homeworkPlan(d,new Date('2026-11-02T10:00'));assert.deepEqual(plan.remove.map(t=>t.id),[d.tasks[2].id]);assert.equal(plan.create.length,0);
 d.tasks=d.tasks.filter(t=>!plan.remove.some(r=>r.id===t.id));assert.deepEqual(homeworkPlan(d,new Date('2026-11-02T10:00')),{create:[],remove:[]});
});
