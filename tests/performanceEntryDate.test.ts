import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PerformanceEntryDate,linkedEntryDate} from '../src/PerformanceEntryDate';
import {homeworkId,homeworkKey} from '../src/homework';
import type {AppData,Task} from '../src/types';
import type {CourseRequirement,PerformanceEntry} from '../src/requirements';
const requirement={id:'sheets',kind:'homework',title:'Blätter',unit:'Punkte',target:24,current:0} as CourseRequirement;
const entry:PerformanceEntry={requirementId:'sheets',source:'manual-3',label:'Blatt 3',amount:3,possible:4};
const empty={courses:[],tasks:[],sessions:[],blocks:[],recurring:[],settings:[]} as AppData;
test('a linked series shows its actual exercise date, ignoring today, entered date and the submission date',()=>{
 const date='2026-11-02',id=homeworkId('series',date),data={...empty,tasks:[{id,deadline:'2026-11-01T18:00'} as Task],recurring:[{id:1,course_id:1,title:'Übung',weekday:1,start_time:'09:00',end_time:'10:00',starts_on:date,ends_on:date,auto_track:0}],settings:[{key:homeworkKey('series'),value:JSON.stringify({id:'series',event_id:1,starts_on:date,task:{title:'Blatt'},skipped:[]})}]} as AppData;
 const linked={...entry,source:`task-${id}`,date:'2026-11-09'};assert.deepEqual(linkedEntryDate(data,linked),{label:'Zugehöriger Übungstermin',date});
 const html=renderToStaticMarkup(createElement(PerformanceEntryDate,{data,entry:linked,requirement,onChange:()=>{}}));assert.match(html,/02.11.2026/);assert.doesNotMatch(html,/type="date"/);assert.doesNotMatch(html,/09.11.2026/);
});
test('an ordinary task date is clearly identified as its deadline',()=>{
 const data={...empty,tasks:[{id:3,deadline:'2026-11-03T18:00'} as Task]};assert.deepEqual(linkedEntryDate(data,{...entry,source:'task-3'}),{label:'Fälligkeit der verknüpften Aufgabe',date:'2026-11-03'});
});
test('an undated linked task never substitutes the current date',()=>{
 const data={...empty,tasks:[{id:3,deadline:null} as Task]},linked={...entry,source:'task-3'};
 const html=renderToStaticMarkup(createElement(PerformanceEntryDate,{data,entry:linked,requirement,onChange:()=>{}}));assert.match(html,/noch nicht festgelegt/);assert.doesNotMatch(html,/type="date"/);
});
test('manual backfill uses a clear exercise-date label and leaves an unknown date empty',()=>{
 const html=renderToStaticMarkup(createElement(PerformanceEntryDate,{data:empty,entry,requirement,onChange:()=>{}}));assert.match(html,/Datum der Übung \(optional\)/);assert.match(html,/type="date" value=""/);assert.match(html,/Info: Welches Datum/);
});
