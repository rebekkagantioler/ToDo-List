import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendance, courseProgress, dailyMinutes } from '../src/statistics';
import type { AppData, Course } from '../src/types';
const course:Course={id:1,name:'Mathe',code:'M',semester:'WS',ects:5,hours_per_ects:25,color:'#123456',description:''};
const data=():AppData=>({courses:[course],tasks:[],blocks:[],settings:[],sessions:[],recurring:[{id:1,course_id:1,title:'Vorlesung',weekday:1,start_time:'09:00',end_time:'10:30',starts_on:'2026-10-05',ends_on:'2026-10-26',auto_track:1}]});
test('Weekly attendance accrues only after a full occurrence has elapsed',()=>{
 const d=data();
 assert.equal(attendance(d,new Date('2026-10-05T10:00')).length,0);
 assert.equal(attendance(d,new Date('2026-10-05T10:30')).length,1);
 assert.equal(attendance(d,new Date('2026-10-18T12:00')).length,2);
 assert.equal(attendance(d,new Date('2027-01-01T12:00')).length,4);
});
test('Manual lecture replaces overlapping automatic occurrence',()=>{
 const d=data();d.sessions.push({id:1,course_id:1,task_id:null,started_at:'2026-10-05T09:00',ended_at:'2026-10-05T10:00',kind:'Vorlesung',note:''});
 assert.equal(attendance(d,new Date('2026-10-06T12:00')).length,0);
 assert.equal(courseProgress(course,d,new Date('2026-10-06T12:00')).lecture,60);
});
test('Self study target excludes semester attendance, total progress includes elapsed attendance',()=>{
 const d=data();d.sessions.push({id:1,course_id:1,task_id:null,started_at:'2026-10-06T09:00',ended_at:'2026-10-06T11:00',kind:'Selbstlernen',note:''});
 const p=courseProgress(course,d,new Date('2026-10-18T12:00'));
 assert.equal(p.target,7500);assert.equal(p.workTarget,7140);assert.equal(p.work,120);assert.equal(p.lecture,180);
 assert.equal(p.totalPercent,4);assert.equal(p.workPercent,120/7140*100);
});
test('Daily chart splits sessions across local midnight',()=>{
 const sessions=[{id:1,task_id:null,course_id:null,started_at:'2026-10-05T23:30',ended_at:'2026-10-06T01:00',kind:'Selbstlernen',note:''}];
 assert.equal(dailyMinutes(sessions,new Date('2026-10-05T00:00')),30);
 assert.equal(dailyMinutes(sessions,new Date('2026-10-06T00:00')),60);
});
