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
