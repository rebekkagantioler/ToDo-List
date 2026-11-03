import { test } from 'node:test';
import assert from 'node:assert/strict';
import { courseAreaKey, isPrivateCourse, statisticsData } from '../src/courseArea';
import { attendance, semesterSummary, semesterWeeks } from '../src/statistics';
import type { AppData, Course, Task } from '../src/types';
const course=(id:number,name:string):Course=>({id,name,code:'',semester:'WS',ects:1,hours_per_ects:25,color:'#123456',description:''});
function fixture():AppData{
 const courses=[course(1,'Kapellmeisterkurs'),course(2,'Mathe')];
 const tasks=[{id:1,course_id:1,status:'Erledigt',completed_at:'2026-10-06T12:00'} as Task];
 const session=(id:number,course_id:number|null,task_id:number|null)=>({id,course_id,task_id,kind:'Selbstlernen',note:'',started_at:'2026-10-06T10:00',ended_at:'2026-10-06T11:00'});
 return {courses,tasks,sessions:[session(1,null,1),session(2,1,null),session(3,2,null),session(4,null,null)],blocks:[],settings:[{key:'lecture-attendance-1-2026-10-05',value:'yes'}],recurring:[{id:1,course_id:1,title:'Musik',weekday:1,starts_on:'2026-10-05',ends_on:'2026-10-05',start_time:'09:00',end_time:'10:00',auto_track:1}]};
}
test('Kapellmeisterkurs is private by default; explicit assignment wins',()=>{
 const d=fixture();assert.equal(isPrivateCourse(d.courses[0],d),true);assert.equal(isPrivateCourse(d.courses[1],d),false);
 d.settings.push({key:courseAreaKey(1),value:'Universität'});assert.equal(isPrivateCourse(d.courses[0],d),false);
 d.settings.push({key:courseAreaKey(2),value:'Privat'});assert.equal(isPrivateCourse(d.courses[1],d),true);
});
test('Private course task times, direct times, attendance and completions are excluded without deleting records',()=>{
 const d=fixture(),before=structuredClone(d),filtered=statisticsData(d),now=new Date('2026-10-07T12:00');
 assert.deepEqual(filtered.sessions.map(s=>s.id),[3,4]);assert.equal(filtered.tasks.length,0);assert.equal(attendance(filtered,now).length,0);
 assert.equal(semesterSummary(filtered.sessions,now).minutes,120);
 assert.equal(semesterWeeks(filtered.sessions,now).reduce((sum,w)=>sum+w.minutes,0),120);
 assert.deepEqual(d,before);
});
