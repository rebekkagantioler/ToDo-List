import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupTasksByDay} from '../src/taskGroups';
import type {Task} from '../src/types';
const task=(id:number,deadline:string|null,status:Task['status']='Offen')=>({id,deadline,status,title:`Task ${id}`} as Task);
test('Tasks group into overdue, today, tomorrow, individual future dates, and undated',()=>{
 const groups=groupTasksByDay([task(1,'2026-11-09T13:45'),task(2,null),task(3,'2026-10-19T10:00'),task(4,'2026-10-20T10:00'),task(5,'2026-10-21T10:00'),task(6,'2026-10-22T10:00'),task(7,'2026-11-09T16:00')],new Date('2026-10-20T12:00'));
 assert.deepEqual(groups.map(g=>g.key),['overdue','2026-10-20','2026-10-21','2026-10-22','2026-11-09','none']);
 assert.deepEqual(groups.slice(0,3).map(g=>g.title),['Überfällig','Heute','Morgen']);assert.equal(groups[4].detail,'In 20 Tagen');assert.deepEqual(groups[4].tasks.map(t=>t.id),[1,7]);assert.equal(groups[5].title,'Ohne Deadline');
});
test('Completed tasks are not marked overdue and day distance survives DST changes',()=>{
 const groups=groupTasksByDay([task(1,'2026-10-23T10:00','Erledigt'),task(2,'2026-10-26T10:00')],new Date('2026-10-24T12:00'));
 assert.ok(groups.every(g=>g.tone!=='overdue'));assert.equal(groups[1].detail,'In 2 Tagen');
 assert.deepEqual(groupTasksByDay([],new Date('2026-10-20')),[]);
});

test('Weeks start on Monday and keep day groups within this, next, and later weeks',async()=>{
 const {groupTaskDaysByWeek}=await import('../src/taskGroups');
 const now=new Date('2026-10-20T12:00');
 const days=groupTasksByDay([task(1,'2026-10-19T10:00'),task(2,'2026-10-20T18:00'),task(3,'2026-10-25T18:00'),task(4,'2026-10-26T18:00'),task(5,'2026-11-02T18:00'),task(6,'2026-11-09T18:00'),task(7,null)],now);
 const weeks=groupTaskDaysByWeek(days,now);
 assert.deepEqual(weeks.map(w=>w.title),['','Diese Woche','Nächste Woche','Übernächste Woche','Woche ab 9. Nov.','']);
 assert.equal(weeks[1].count,2);assert.deepEqual(weeks[1].days.map(d=>d.key),['2026-10-20','2026-10-25']);assert.equal(weeks[2].days[0].key,'2026-10-26');assert.equal(weeks[0].days[0].title,'Überfällig');assert.equal(weeks.at(-1)?.days[0].title,'Ohne Deadline');
});
test('Tomorrow on a Monday belongs to next week and year boundaries stay correct',async()=>{
 const {groupTaskDaysByWeek}=await import('../src/taskGroups');
 const sunday=new Date('2026-10-25T12:00');
 const weeks=groupTaskDaysByWeek(groupTasksByDay([task(1,'2026-10-25T18:00'),task(2,'2026-10-26T18:00')],sunday),sunday);
 assert.equal(weeks[1].title,'Nächste Woche');assert.equal(weeks[1].days[0].title,'Morgen');
 const year=new Date('2026-12-31T12:00');const boundary=groupTaskDaysByWeek(groupTasksByDay([task(3,'2027-01-01T18:00'),task(4,'2027-01-04T18:00')],year),year);
 assert.equal(boundary[0].title,'Diese Woche');assert.equal(boundary[1].title,'Nächste Woche');assert.ok(boundary[0].range.includes('2027'));
});
