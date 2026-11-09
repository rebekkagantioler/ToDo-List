import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {isSingleCountRequirement,requirementsKey} from '../src/requirements';
import {PerformanceChecklist} from '../src/PerformanceChecklist';
import {CourseRequirements} from '../src/CourseRequirements';
import type {CourseRequirement} from '../src/requirements';
import type {AppData,Course} from '../src/types';
const course={id:1,name:'Seminar'} as Course;
const single:CourseRequirement={id:'feedback',title:'Peerfeedback',kind:'other',unit:'Leistungen',target:1,current:0};
function data(r:CourseRequirement):AppData{return {courses:[course],tasks:[],sessions:[],blocks:[],recurring:[],settings:[{key:requirementsKey(1),value:JSON.stringify([r])}]}}
test('single count requirements show independent open/done status in full and compact checklists',()=>{
 for(const compact of [false,true])for(const current of [0,1]){
  const r={...single,current},html=renderToStaticMarkup(createElement(PerformanceChecklist,{course,data:data(r),compact}));assert.match(html,current?/Erledigt/:/Noch offen/);assert.doesNotMatch(html,/0 \/ 1|1 \/ 1|0 von 1 Leistungen|1 von 1 Leistungen/);
 }
});
test('single requirement details have a completion action and no numeric minimum display',()=>{
 const html=renderToStaticMarkup(createElement(CourseRequirements,{course,data:data(single),mutate:async()=>{}}));assert.match(html,/Als erledigt markieren/);assert.doesNotMatch(html,/requirement-score/);assert.doesNotMatch(html,/Mindestleistung: /);assert.doesNotMatch(html,/0 Einzelleistungen/);
});
test('single-count presentation and reflection qualify; point-based homework and exams keep their own forms',()=>{
 assert.equal(isSingleCountRequirement({...single,kind:'reflection'}),true);assert.equal(isSingleCountRequirement({...single,kind:'presentation'}),true);assert.equal(isSingleCountRequirement({...single,target:5}),false);assert.equal(isSingleCountRequirement({...single,kind:'homework'}),false);assert.equal(isSingleCountRequirement({...single,kind:'exam'}),false);
});
