import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Performances} from '../src/Performances';
import {requirementsKey} from '../src/requirements';
import {semesterForDate} from '../src/semesters';
import type {AppData,Course} from '../src/types';
function fixture():AppData{
 const semester=semesterForDate().name;
 return {courses:[{id:1,name:'Geometrie',semester,color:'#6994bb'},{id:2,name:'Kurs ohne Leistungen',semester,color:'#aa77cc'}] as Course[],tasks:[],sessions:[],blocks:[],recurring:[],settings:[{key:requirementsKey(1),value:JSON.stringify([{id:'sheets',kind:'homework',title:'Übungsblätter',unit:'Punkte',target:24,current:12}])}]};
}
const render=(data:AppData)=>renderToStaticMarkup(createElement(Performances,{data,mutate:async()=>{}}));
test('performance cards and course filter exclude courses without requirements',()=>{
 const html=render(fixture());
 assert.match(html,/Geometrie/);assert.match(html,/Übungsblätter/);assert.match(html,/performance-course-1/);assert.doesNotMatch(html,/Kurs ohne Leistungen/);assert.doesNotMatch(html,/performance-course-2/);assert.match(html,/1 Kurs/);assert.doesNotMatch(html,/Anforderungen ergänzen/);
});
test('courses disappear from overview after their last requirement is removed',()=>{
 const data=fixture();data.settings=[];const html=render(data);
 assert.doesNotMatch(html,/performance-course-1/);assert.doesNotMatch(html,/performance-course-2/);assert.match(html,/Keine Leistungen für diese Auswahl/);assert.match(html,/Prüfungskalender/);
});
test('an empty exam collection keeps the calendar without redundant empty exam panels',()=>{
 const html=render(fixture());assert.match(html,/exam-calendar/);assert.doesNotMatch(html,/panel exam-agenda/);assert.doesNotMatch(html,/Noch kein Termin/);assert.match(html,/Noch keine Prüfungen eingetragen/);
});
