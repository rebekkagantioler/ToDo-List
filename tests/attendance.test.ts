import {test} from 'node:test';
import assert from 'node:assert/strict';
import {attendancePolicy,attendancePolicyKey,courseAttendance} from '../src/attendance';
import {attendanceKey,exclusionKey} from '../src/statistics';
import type {AppData,Course} from '../src/types';
const course:Course={id:1,name:'VU Medienformate',code:'',semester:'WS',ects:3,hours_per_ects:25,color:'#123456',description:''};
function data():AppData{return {courses:[course],tasks:[],sessions:[],blocks:[],settings:[],recurring:[{id:1,course_id:1,title:'Übung',weekday:1,start_time:'09:00',end_time:'10:00',starts_on:'2026-10-05',ends_on:'2026-11-02',auto_track:0}]}}
test('VOs sort below required courses; explicit rules override the course type',()=>{
 const d=data();assert.equal(attendancePolicy(d,course).required,true);
 assert.equal(attendancePolicy(d,{...course,name:'VO Analysis'}).required,false);
 assert.equal(attendancePolicy(d,{...course,name:'Vorlesung Analysis'}).required,false);
 d.settings.push({key:attendancePolicyKey(1),value:'{"required":false,"limit":3}'});
 assert.deepEqual(attendancePolicy(d,course),{required:false,limit:3});
 d.settings[0].value='broken';assert.equal(attendancePolicy(d,course).limit,null);
});
test('Counts confirmed attendance and absences, excludes cancellations and future answers, keeps unanswered dates separate',()=>{
 const d=data();d.settings=[{key:attendanceKey(1,'2026-10-05'),value:'yes'},{key:attendanceKey(1,'2026-10-12'),value:'no'},{key:attendanceKey(1,'2026-10-19'),value:'no'},{key:attendanceKey(1,'2026-11-02'),value:'yes'},{key:exclusionKey(1),value:'["2026-10-19"]'},{key:attendancePolicyKey(1),value:'{"required":true,"limit":3}'}];
 const s=courseAttendance(d,course,new Date('2026-10-26T12:00'));
 assert.equal(s.rows.length,5);assert.equal(s.total,4);assert.equal(s.present,1);assert.equal(s.absent,1);assert.equal(s.pending,1);assert.equal(s.remaining,2);
 d.settings.find(s=>s.key===attendancePolicyKey(1))!.value='{"limit":0}';assert.equal(courseAttendance(d,course).remaining,0);
});
test('Unknown allowance stays unknown and open-ended series are explicitly bounded at today',()=>{
 const d=data();d.recurring[0].ends_on=null;
 const s=courseAttendance(d,course,new Date('2026-10-13T12:00'));
 assert.equal(s.remaining,null);assert.equal(s.openEnded,true);assert.equal(s.total,2);
});

test('Never scheduled dates are hidden, cancellations stay visible; both are excluded from totals',()=>{
 const d=data();d.settings=[{key:'lecture-unplanned-1',value:'["2026-10-12"]'},{key:exclusionKey(1),value:'["2026-10-19"]'},{key:attendanceKey(1,'2026-10-12'),value:'no'}];
 const s=courseAttendance(d,course,new Date('2026-11-03T12:00'));
 assert.equal(s.rows.length,4);assert.equal(s.total,3);assert.equal(s.absent,0);
 assert.equal(s.rows.some(r=>r.date==='2026-10-12'),false);
 assert.equal(s.rows.find(r=>r.date==='2026-10-19')?.canceled,true);
});
