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
 const html=render(fixture());assert.match(html,/exam-calendar/);assert.doesNotMatch(html,/panel exam-agenda/);assert.doesNotMatch(html,/Noch kein Termin/);assert.match(html,/Noch keine Termine eingetragen/);
});

test('calendar includes dated other requirements alongside exams and identifies their type',()=>{
 const d=fixture(),now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-15`;
 d.settings[0].value=JSON.stringify([
  {id:'exam',kind:'exam',title:'Klausur',unit:'Prüfung',target:1,current:0,dateMode:'fixed',date,time:'10:00'},
  {id:'other',kind:'other',title:'Microteaching',unit:'Leistung',target:1,current:0,dateMode:'fixed',date,time:'14:00'},
  {id:'unknown',kind:'exam',title:'Mündlich',unit:'Prüfung',target:1,current:0,dateMode:'unknown'},
  {id:'no-date',kind:'other',title:'Ohne Termin',unit:'Leistung',target:1,current:0}
 ]);
 const html=render(d),agenda=html.slice(html.indexOf('panel exam-agenda'),html.indexOf('performance-courses-column'));
 assert.match(agenda,/Microteaching/);assert.match(agenda,/14:00/);assert.match(agenda,/calendar-kind-badge is-requirement/);assert.match(agenda,/calendar-kind-badge is-exam/);assert.match(agenda,/Prüfungen ohne Termin/);assert.match(agenda,/Mündlich/);assert.doesNotMatch(agenda,/Ohne Termin/);assert.match(html,/calendar-requirement-dot/);assert.match(html,/1 weiterer Termin/);
 d.settings[0].value=JSON.stringify([{id:'only',kind:'other',title:'Abgabe',unit:'Leistung',target:1,current:0,dateMode:'fixed',date}]);
 assert.match(render(d),/panel exam-agenda/);
});

test('agenda groups only populated months chronologically and keeps undated exams separate',()=>{
 const d=fixture(),now=new Date();
 const monthKey=(offset:number)=>{const date=new Date(now.getFullYear(),now.getMonth()+offset,1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`};
 const exam=(id:string,offset:number)=>({id,kind:'exam',title:id,unit:'Prüfung',target:1,current:0,dateMode:'fixed',date:monthKey(offset)+'-15'});
 d.settings[0].value=JSON.stringify([exam('Spätere Klausur',3),exam('Aktuelle Klausur',0),exam('Frühere Klausur',1),{id:'unknown',kind:'exam',title:'Offene Mündliche',unit:'Prüfung',target:1,current:0}]);
 const html=render(d),agenda=html.slice(html.indexOf('panel exam-agenda'),html.indexOf('performance-courses-column'));
 assert.equal((agenda.match(/class="exam-agenda-month"/g)||[]).length,2);
 assert.ok(agenda.indexOf('Frühere Klausur')<agenda.indexOf('Spätere Klausur'));
 for(const title of ['Spätere Klausur','Aktuelle Klausur','Frühere Klausur','Offene Mündliche'])assert.equal(agenda.split(`<strong>${title}</strong>`).length-1,1);
 for(const offset of [1,3])assert.ok(agenda.includes(new Date(monthKey(offset)+'-01T12:00').toLocaleDateString('de-AT',{month:'long',year:'numeric'})));
 assert.ok(!agenda.includes(new Date(monthKey(2)+'-01T12:00').toLocaleDateString('de-AT',{month:'long',year:'numeric'})));
 assert.match(agenda,/Prüfungen ohne Termin/);
});
