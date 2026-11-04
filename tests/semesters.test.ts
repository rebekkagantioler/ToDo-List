import {test} from 'node:test';
import assert from 'node:assert/strict';
import {semesters,semestersKey,semesterForDate,activeSemester,semesterStatus,semesterError,courseInSemester,updateSemester,validSemesterDate,type Semester} from '../src/semesters';
import {semesterSummary,semesterWeeks} from '../src/statistics';
import type {AppData,Course,Session} from '../src/types';
const data=():AppData=>({courses:[],tasks:[],sessions:[],blocks:[],recurring:[],settings:[]});
const course=(semester:string)=>({id:1,semester} as Course);
const period:Semester={id:'first',name:'WS 2026/27',start:'2026-10-01',end:'2027-02-28',averageStart:'2026-10-05',aliases:[]};
const session=(id:number,started_at:string,ended_at:string):Session=>({id,task_id:null,course_id:null,started_at,ended_at,kind:'Selbstlernen',note:''});
test('Semester presets cover winter, leap February, summer and existing first-week exception',()=>{
 assert.equal(semesterForDate(new Date('2026-11-03T12:00')).name,'WS 2026/27');
 assert.equal(semesterForDate(new Date('2027-02-28T12:00')).start,'2026-10-01');
 assert.equal(semesterForDate(new Date('2028-02-29T12:00')).end,'2028-02-29');
 assert.equal(semesterForDate(new Date('2027-03-01T12:00')).start,'2027-03-01');
 assert.equal(semesterForDate(new Date('2027-09-30T12:00')).end,'2027-09-30');
 assert.equal(semesterForDate(new Date('2026-11-03T12:00')).averageStart,'2026-10-05');
 assert.equal(semesterForDate(new Date('2027-11-03T12:00')).averageStart,'2027-10-01');
});
test('Existing semester names infer periods without mutating courses; renamed periods keep their courses',()=>{
 const d=data();d.courses=[course('WS 2025/26'),course('WS 2026/27'),course('WiSe 2026/2027'),course('Meine alte Uni')];
 const before=structuredClone(d),items=semesters(d,new Date('2026-11-03T12:00'));
 assert.equal(items.length,2);assert.equal(activeSemester(items,new Date('2026-11-03T12:00')).id,'ws-2026');
 const updated=updateSemester(items,{...items[1],name:'Winter 2026'});
 assert.ok(courseInSemester(d.courses[1],updated[1]));assert.ok(courseInSemester(d.courses[2],updated[1]));
 d.settings.push({key:semestersKey,value:JSON.stringify(updated)});
 assert.equal(semesters(d,new Date('2027-06-01T12:00')).length,2);
 assert.equal(d.courses.length,before.courses.length);assert.deepEqual(d.courses,before.courses);
});
test('Semester validation rejects invalid dates, overlaps, duplicate names and invalid average ranges',()=>{
 assert.equal(validSemesterDate('2027-02-29'),false);assert.equal(validSemesterDate('2028-02-29'),true);
 assert.ok(semesterError({...period,end:'2026-09-30'}));
 assert.ok(semesterError({...period,averageStart:'2026-09-30'}));
 assert.ok(semesterError({...period,averageStart:'2027-03-01'}));
 assert.ok(semesterError({...period,id:'second'},[period]));
 assert.ok(semesterError({...period,id:'second',name:'Overlap'},[period]));
 const next={...period,id:'next',name:'SS 2027',start:'2027-03-01',end:'2027-09-30',averageStart:'2027-03-01'};
 assert.equal(semesterError(next,[period]),'');
 assert.equal(semesterStatus(period,new Date('2027-03-01T00:00')),'Abgeschlossen');
 assert.equal(semesterStatus(next,new Date('2027-03-01T00:00')),'Aktuell');
 assert.equal(activeSemester([period,next],new Date('2027-03-01T00:00')).id,'next');
});
test('Closed semester totals and averages stay frozen, include the full last day, and allow backfills',()=>{
 const p={...period,end:'2026-10-07'};
 const sessions=[session(1,'2026-09-30T23:30','2026-10-01T00:30'),session(2,'2026-10-05T10:00','2026-10-05T11:00'),session(3,'2026-10-07T23:30','2026-10-08T00:30'),session(4,'2026-10-10T10:00','2026-10-10T12:00')];
 const result=semesterSummary(sessions,new Date('2026-10-08T12:00'),p),later=semesterSummary(sessions,new Date('2027-01-01T12:00'),p);
 assert.equal(result.minutes,120);assert.equal(result.days,3);assert.equal(result.weeklyAverage,210);assert.equal(later.weeklyAverage,result.weeklyAverage);
 const weeks=semesterWeeks(sessions,new Date('2027-01-01T12:00'),p);
 assert.deepEqual(weeks.map(w=>w.minutes),[30,90]);assert.equal(weeks.at(-1)!.end.getDate(),7);
 const backfill=session(5,'2026-10-06T10:00','2026-10-06T11:00');
 assert.equal(semesterSummary([...sessions,backfill],new Date('2027-01-01T12:00'),p).minutes,180);
});
test('Future semesters are empty and week boundaries and DST do not change calendar-day averages',()=>{
 const now=new Date('2026-09-30T12:00');assert.equal(semesterSummary([],now,period).days,0);assert.deepEqual(semesterWeeks([],now,period),[]);
 const p={...period,start:'2026-10-24',end:'2026-10-26',averageStart:'2026-10-24'};
 const sessions=[session(1,'2026-10-25T23:30','2026-10-26T00:30')];
 assert.equal(semesterSummary(sessions,new Date('2026-10-27T12:00'),p).days,3);
 assert.deepEqual(semesterWeeks(sessions,new Date('2026-10-27T12:00'),p).map(w=>w.minutes),[30,30]);
 assert.equal(semesterWeeks([],new Date('2026-10-05T00:00'),period).length,2);
});


test('Statistics for earlier recorded semesters remain discoverable without courses',()=>{
 const d=data();d.sessions=[session(1,'2025-10-02T10:00','2025-10-02T11:00')];
 const items=semesters(d,new Date('2026-11-03T12:00'));
 assert.deepEqual(items.map(s=>s.name),['WS 2025/26','WS 2026/27']);
 assert.equal(d.sessions.length,1);
});
