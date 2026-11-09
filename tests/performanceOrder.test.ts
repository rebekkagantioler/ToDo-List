import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderedPerformanceEntries} from '../src/performanceOrder';
import type {PerformanceEntry} from '../src/requirements';
import type {AppData,Task} from '../src/types';
const data={tasks:[]} as unknown as AppData;
const entry=(n:number,date?:string):PerformanceEntry=>({requirementId:'sheets',source:`manual-${n}`,label:`Blatt ${n}`,amount:4,possible:6,date});
test('sheets are sorted newest first by their date without modifying saved entries',()=>{
 const entries=[entry(5,'2026-11-02'),entry(4,'2026-10-26'),entry(6,'2026-11-09')];
 assert.deepEqual(orderedPerformanceEntries(data,entries).map(e=>e.label),['Blatt 6','Blatt 5','Blatt 4']);assert.deepEqual(entries.map(e=>e.label),['Blatt 5','Blatt 4','Blatt 6']);
});
test('linked tasks use their deadline when older result records have no date',()=>{
 const d={tasks:[{id:1,deadline:'2026-11-09T09:00',completed_at:'2026-11-01'},{id:2,deadline:'2026-11-02T09:00',completed_at:'2026-11-09'}] as Task[]} as AppData;
 const entries=[{...entry(5),source:'task-2'},{...entry(6),source:'task-1'}];assert.deepEqual(orderedPerformanceEntries(d,entries).map(e=>e.label),['Blatt 6','Blatt 5']);
});
test('sheet numbers break date ties naturally, including sheet 10 before sheet 6',()=>{
 for(const date of [undefined,'2026-11-09'])assert.deepEqual(orderedPerformanceEntries(data,[entry(1,date),entry(6,date),entry(10,date),entry(5,date)]).map(e=>e.label),['Blatt 10','Blatt 6','Blatt 5','Blatt 1']);
});
test('the explicit result date takes precedence over task dates and sheet numbering',()=>{
 const d={tasks:[{id:1,deadline:'2026-11-09'}] as Task[]} as AppData;
 assert.deepEqual(orderedPerformanceEntries(d,[{...entry(6,'2026-10-01'),source:'task-1'},entry(5,'2026-11-02')]).map(e=>e.label),['Blatt 5','Blatt 6']);
});
