import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applySavedRecord, byDeadline } from '../src/data';
import type { AppData, Task } from '../src/types';
const empty=():AppData=>({courses:[],tasks:[],blocks:[],sessions:[],recurring:[],settings:[]});

test('Saved task is immediately available with tracking and course metadata',()=>{
 let data=applySavedRecord(empty(),'/courses','POST',{name:'Mathe',ects:2.5,color:'#123456'},{id:1});
 data=applySavedRecord(data,'/tasks','POST',{title:'Lernen',area:'Universität',course_id:1,tracking:true,status:'Offen'},{id:2});
 assert.equal(data.tasks[0].tracking,1);
 assert.equal(data.tasks[0].course_name,'Mathe');
 assert.equal(data.tasks[0].deadline,null);
 data=applySavedRecord(data,'/courses/1','PUT',{name:'Mathematik',color:'#abcdef'},{ok:true});
 assert.equal(data.tasks[0].course_name,'Mathematik');
 assert.equal(data.tasks[0].course_color,'#abcdef');
});

test('Multiple saved blocks retain the same task and existing blocks',()=>{
 let data=applySavedRecord(empty(),'/tasks','POST',{title:'Projekt',area:'Privat',tracking:false,status:'Offen'},{id:2});
 for(const id of [3,4])data=applySavedRecord(data,'/blocks','POST',{task_id:2,title:'Projekt',starts_at:`2026-10-${id+10}T09:00`,ends_at:`2026-10-${id+10}T10:00`},{id});
 assert.equal(data.tasks.length,1);
 assert.equal(data.blocks.length,2);
 assert.ok(data.blocks.every(b=>b.task_id===2&&b.task_title==='Projekt'));
 data=applySavedRecord(data,'/blocks/3','DELETE',undefined,{ok:true});
 assert.equal(data.tasks.length,1);
 assert.equal(data.blocks[0].id,4);
});

test('Calendar backlog places earliest deadline first, missing deadlines last',()=>{
 const tasks=[{title:'Ohne',deadline:null},{title:'Später',deadline:'2026-11-01T10:00'},{title:'Früher',deadline:'2026-10-13T10:00'}] as Task[];
 assert.deepEqual(tasks.sort(byDeadline).map(t=>t.title),['Früher','Später','Ohne']);
});

test('Confirmed session is immediately shown and server fields take precedence',()=>{
 const data=applySavedRecord(empty(),'/sessions','POST',{started_at:'2026-10-12T09:00',ended_at:'2026-10-12T09:25'},{id:5,course_id:null,kind:'Selbstlernen'});
 assert.equal(data.sessions.length,1);
 assert.equal((new Date(data.sessions[0].ended_at).getTime()-new Date(data.sessions[0].started_at).getTime())/60000,25);
 assert.equal(data.sessions[0].kind,'Selbstlernen');
});

test('Confirmed deletions also update dependent records in the visible data',()=>{
 let data=applySavedRecord(empty(),'/courses','POST',{name:'Kurs'},{id:1});
 data=applySavedRecord(data,'/tasks','POST',{title:'Lernen',course_id:1,area:'Universität',tracking:1},{id:2});
 data=applySavedRecord(data,'/sessions','POST',{course_id:1,task_id:2},{id:3});
 data=applySavedRecord(data,'/blocks','POST',{course_id:1,task_id:2,title:'Plan'},{id:4});
 data=applySavedRecord(data,'/courses/1','DELETE',undefined,{ok:true});
 assert.equal(data.tasks[0].course_id,null);
 assert.equal(data.sessions[0].course_id,null);
 assert.equal(data.blocks[0].course_id,null);
 data=applySavedRecord(data,'/tasks/2','DELETE',undefined,{ok:true});
 assert.equal(data.tasks.length,0);
 assert.equal(data.sessions.length,0);
 assert.equal(data.blocks.length,0);
});

test('Saved lecture exclusions use the setting key and replace existing dates',()=>{
 let d=applySavedRecord(empty(),'/settings/lecture-exclusions-1','PUT',{value:'["2026-10-12"]'},{key:'lecture-exclusions-1',value:'["2026-10-12"]'});
 assert.deepEqual(d.settings,[{key:'lecture-exclusions-1',value:'["2026-10-12"]'}]);
 d=applySavedRecord(d,'/settings/lecture-exclusions-2','PUT',{value:'[]'},{ok:true});
 d=applySavedRecord(d,'/settings/lecture-exclusions-1','PUT',{value:'[]'},{ok:true});
 assert.equal(d.settings.length,2);
 assert.equal(d.settings.find(s=>s.key==='lecture-exclusions-1').value,'[]');
});
