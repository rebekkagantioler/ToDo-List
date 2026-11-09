import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RequirementSetupForm} from '../src/RequirementSetupForm';
import {ExamResultForm,examResultMode} from '../src/ExamResultForm';
import type {AppData,Course} from '../src/types';
import type {CourseRequirement} from '../src/requirements';
const course={id:1,name:'Geometrie'} as Course;
const data:AppData={courses:[course],tasks:[],sessions:[],blocks:[],recurring:[],settings:[]};
const exam:CourseRequirement={id:'exam',title:'1. Klausur',kind:'exam',unit:'Prüfung',target:1,current:0,dateMode:'fixed',date:'2026-11-27',time:'13:00'};
const noop=()=>{};
function setup(r:CourseRequirement,rows:CourseRequirement[]=[]){return renderToStaticMarkup(createElement(RequirementSetupForm,{draft:r,setDraft:noop,rows,data,course,busy:false,save:noop,onClose:noop}))}
function result(r:CourseRequirement){return renderToStaticMarkup(createElement(ExamResultForm,{requirement:r,busy:false,error:'',onClose:noop,onSave:noop}))}
test('creating an exam asks for its requirement and schedule, never scores, grades or pass status',()=>{
 const html=setup(exam);assert.match(html,/Bezeichnung/);assert.match(html,/Prüfungstermin/);assert.match(html,/2026-11-27/);assert.match(html,/13:00/);assert.match(html,/Ergebnisse trägst du später/);
 for(const label of ['Erreichte Punkte','Maximale Punkte','Prüfung abgelegt','Deine Note','Bestanden?','Ergebnis erfassen als'])assert.ok(!html.includes(label),label);
});
test('editing a requirement with saved results still shows only setup fields',()=>{
 const existing={...exam,examEarned:35,examPossible:50,examResult:'passed' as const};const html=setup(existing,[existing]);assert.doesNotMatch(html,/Erreichte Punkte/);assert.match(html,/Anforderung bearbeiten/);assert.equal(existing.examEarned,35);
});
test('count and homework setup asks for targets without a current achievement field',()=>{
 for(const kind of ['reflection','homework','presentation'] as const){const html=setup({...exam,kind,dateMode:undefined});assert.match(html,kind==='homework'?/Mindestpunkte im ganzen Kurs/:/Benötigte Anzahl/);assert.doesNotMatch(html,/Bereits erreicht/)}
});
test('result entry supports attendance without a known result and uses plain result labels',()=>{
 assert.equal(examResultMode(exam),'pending');const html=result({...exam,examTaken:true});assert.match(html,/Prüfung abgelegt/);assert.match(html,/Ergebnis noch nicht bekannt/);assert.match(html,/>Punkte<\/option>/);assert.match(html,/>Note<\/option>/);assert.doesNotMatch(html,/kursbezogenem/);assert.doesNotMatch(html,/Erreichte Punkte/);
});
test('recorded points and grades reopen in the matching dedicated result form',()=>{
 const points={...exam,examEarned:0,examPossible:50};assert.equal(examResultMode(points),'points');assert.match(result(points),/Erreichte Punkte/);assert.match(result(points),/value="0"/);assert.match(result(points),/Maximale Punkte/);
 const grade={...exam,examScoreType:'grade' as const,examGrade:'2'};assert.equal(examResultMode(grade),'grade');const html=result(grade);assert.match(html,/Deine Note/);assert.match(html,/Deine Note lässt sich auch ohne Umrechnung speichern/);assert.match(html,/value="2"/);
 assert.equal(examResultMode({...exam,examResult:'passed'}),'pass');
});

import {courseSheetPointsKey} from '../src/sheetPoints';
test('homework setup separates the fixed per-sheet maximum, course minimum and overall maximum',()=>{
 const r={...exam,kind:'homework' as const,target:24,maximumPoints:48,pointsPerSheet:6};
 const html=setup(r);assert.match(html,/Maximale Punkte pro Hausaufgabe/);assert.match(html,/Mindestpunkte im ganzen Kurs/);assert.match(html,/Insgesamt erreichbare Punkte/);assert.match(html,/value="6"/);assert.match(html,/value="24"/);assert.match(html,/value="48"/);assert.doesNotMatch(html,/Erreichte Punkte/);
 let saved:CourseRequirement[]=[];let maximum:number|undefined;
 const tree=RequirementSetupForm({draft:r,setDraft:noop,rows:[],data,course,busy:false,onClose:noop,save:(rows,points)=>{saved=rows;maximum=points}});
 (tree.props.children as any).props.onSubmit({preventDefault:noop});
 assert.equal(maximum,6);assert.equal(saved[0].pointsPerSheet,6);assert.equal(saved[0].target,24);assert.equal(saved[0].maximumPoints,48);
});
test('a course-level maximum is prefilled when creating another homework requirement',()=>{
 const configured={...data,settings:[{key:courseSheetPointsKey(course.id),value:'6'}]};
 const draft={...exam,kind:'homework' as const,target:24};let maximum:number|undefined;
 const props={draft,setDraft:noop,rows:[],data:configured,course,busy:false,onClose:noop,save:(_:CourseRequirement[],points?:number)=>{maximum=points}};
 const html=renderToStaticMarkup(createElement(RequirementSetupForm,props));assert.match(html,/value="6"/);
 const tree=RequirementSetupForm(props);(tree.props.children as any).props.onSubmit({preventDefault:noop});assert.equal(maximum,6);
});

test('exam point results use the same clickable score boxes as homework',()=>{
 const html=result({...exam,examEarned:3,examPossible:6});assert.equal((html.match(/type="radio"/g)||[]).length,7);assert.match(html,/<input[^>]*checked=""[^>]*value="3"/);assert.doesNotMatch(html,/aria-label="Erreichte Punkte" type="number"/);
});
