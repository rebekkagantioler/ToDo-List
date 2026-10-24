import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendance, attendanceKey, attendanceRequests, courseProgress, dailyMinutes, exclusionKey, lastOccurrence, occurrenceDates } from '../src/statistics';
import type { AppData, Course } from '../src/types';
const course:Course={id:1,name:'Mathe',code:'M',semester:'WS',ects:5,hours_per_ects:25,color:'#123456',description:''};
const data=():AppData=>({courses:[course],tasks:[],blocks:[],settings:[],sessions:[],recurring:[{id:1,course_id:1,title:'Vorlesung',weekday:1,start_time:'09:00',end_time:'10:30',starts_on:'2026-10-05',ends_on:'2026-10-26',auto_track:1}]});
test('Weekly attendance accrues only after a full occurrence has elapsed',()=>{
 const d=confirmedData();
 assert.equal(attendance(d,new Date('2026-10-05T10:00')).length,0);
 assert.equal(attendance(d,new Date('2026-10-05T10:30')).length,1);
 assert.equal(attendance(d,new Date('2026-10-18T12:00')).length,2);
 assert.equal(attendance(d,new Date('2027-01-01T12:00')).length,4);
});
test('Manual lecture replaces overlapping automatic occurrence',()=>{
 const d=confirmedData();d.sessions.push({id:1,course_id:1,task_id:null,started_at:'2026-10-05T09:00',ended_at:'2026-10-05T10:00',kind:'Vorlesung',note:''});
 assert.equal(attendance(d,new Date('2026-10-06T12:00')).length,0);
 assert.equal(courseProgress(course,d,new Date('2026-10-06T12:00')).lecture,60);
});
test('Self study target excludes semester attendance, total progress includes elapsed attendance',()=>{
 const d=confirmedData();d.sessions.push({id:1,course_id:1,task_id:null,started_at:'2026-10-06T09:00',ended_at:'2026-10-06T11:00',kind:'Selbstlernen',note:''});
 const p=courseProgress(course,d,new Date('2026-10-18T12:00'));
 assert.equal(p.target,7500);assert.equal(p.workTarget,7140);assert.equal(p.work,120);assert.equal(p.lecture,180);
 assert.equal(p.totalPercent,4);assert.equal(p.workPercent,120/7140*100);
});
test('Daily chart splits sessions across local midnight',()=>{
 const sessions=[{id:1,task_id:null,course_id:null,started_at:'2026-10-05T23:30',ended_at:'2026-10-06T01:00',kind:'Selbstlernen',note:''}];
 assert.equal(dailyMinutes(sessions,new Date('2026-10-05T00:00')),30);
 assert.equal(dailyMinutes(sessions,new Date('2026-10-06T00:00')),60);
});

test('Canceled occurrences are removed from attendance and the planned study target',()=>{
 const d=confirmedData();d.settings.push({key:exclusionKey(1),value:JSON.stringify(['2026-10-12'])});
 assert.equal(attendance(d,new Date('2026-10-18T12:00')).length,1);
 const p=courseProgress(course,d,new Date('2026-10-18T12:00'));
 assert.equal(p.lecture,90);assert.equal(p.workTarget,7500-270);
 d.settings=d.settings.filter(s=>s.key!==exclusionKey(1));
 assert.equal(attendance(d,new Date('2026-10-18T12:00')).length,2);
});
test('A series can contain exactly six dates even if the start is not the selected weekday',()=>{
 const event={...data().recurring[0],starts_on:'2026-10-06',ends_on:lastOccurrence('2026-10-06',1,6)};
 const dates=occurrenceDates(event);
 assert.equal(dates.length,6);assert.equal(dates[0],'2026-10-12');assert.equal(dates[5],'2026-11-16');
 assert.equal(lastOccurrence('2026-10-06',1,0),'');assert.equal(lastOccurrence('2026-10-06',1,1.5),'');
});
test('A single date accrues once and ignores unrelated exclusions',()=>{
 const d=confirmedData();d.recurring[0]={...d.recurring[0],weekday:2,starts_on:'2026-10-06',ends_on:'2026-10-06'};
 d.settings.push({key:attendanceKey(1,'2026-10-06'),value:'yes'},{key:exclusionKey(2),value:'["2026-10-06"]'});
 assert.equal(occurrenceDates(d.recurring[0]).length,1);
 assert.equal(attendance(d,new Date('2026-10-05T12:00')).length,0);
 assert.equal(attendance(d,new Date('2026-12-01T12:00')).length,1);
 d.settings.push({key:exclusionKey(1),value:'["2026-10-06"]'});
 assert.equal(courseProgress(course,d,new Date('2026-12-01T12:00')).lecture,0);
});

function confirmedData():AppData{
 const d=data();d.settings=occurrenceDates(d.recurring[0]).map(date=>({key:attendanceKey(1,date),value:'yes'}));return d;
}
test('Unanswered past occurrences stay pending and never count as attendance',()=>{
 const d=data(),now=new Date('2026-10-18T12:00');
 assert.equal(attendance(d,now).length,0);
 assert.equal(attendanceRequests(d,now).filter(r=>r.answer===null).length,2);
 d.settings.push({key:attendanceKey(1,'2026-10-05'),value:'yes'},{key:attendanceKey(1,'2026-10-12'),value:'no'});
 assert.equal(attendance(d,now).length,1);
 assert.equal(attendanceRequests(d,now).filter(r=>r.answer===null).length,0);
 d.settings[0].value='no';assert.equal(attendance(d,now).length,0);
});
test('Requests appear at the exact start, exclude cancellations, and support open-ended series',()=>{
 const d=data();
 assert.equal(attendanceRequests(d,new Date('2026-10-05T08:59:59')).length,0);
 assert.equal(attendanceRequests(d,new Date('2026-10-05T09:00')).length,1);
 d.recurring[0].ends_on=null;
 d.settings.push({key:exclusionKey(1),value:'["2026-10-12"]'});
 assert.equal(attendanceRequests(d,new Date('2026-10-19T09:00')).length,2);
});
