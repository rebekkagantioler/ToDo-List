import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {HomeworkPointsFields,pointOptions} from '../src/HomeworkPointsFields';
import {courseRequirements,requirementsKey,entryKey,performanceEntries,requirementProgress,validRequirement,type CourseRequirement} from '../src/requirements';
import type {AppData,Course} from '../src/types';
const requirement:CourseRequirement={id:'points',title:'Arbeitsblätter',unit:'Punkte',kind:'homework',target:50,current:0,percentage:true,pointsPerSheet:10};
test('fixed maximum is persisted per requirement and changing it preserves previous sheet results',()=>{
 const entry={requirementId:requirement.id,source:'manual-old',label:'Blatt 1',amount:8,possible:10};
 const data:AppData={courses:[{id:1} as Course],tasks:[],sessions:[],blocks:[],recurring:[],settings:[{key:requirementsKey(1),value:JSON.stringify([requirement])},{key:entryKey(requirement.id,entry.source),value:JSON.stringify(entry)}]};
 assert.equal(courseRequirements(data,1)[0].pointsPerSheet,10);
 data.settings[0].value=JSON.stringify([{...requirement,pointsPerSheet:12}]);
 assert.equal(courseRequirements(data,1)[0].pointsPerSheet,12);assert.deepEqual(performanceEntries(data,requirement.id),[entry]);assert.equal(requirementProgress(data,courseRequirements(data,1)[0]).value,80);
 for(const maximum of [0,-1,NaN,Infinity])assert.equal(validRequirement({...requirement,pointsPerSheet:maximum}),false);
 assert.equal(validRequirement({...requirement,pointsPerSheet:undefined}),true);
});
test('earned point boxes include zero and the maximum without preselecting a score',()=>{
 const html=renderToStaticMarkup(createElement(HomeworkPointsFields,{amount:'',possible:'10',onChange:()=>{}}));
 assert.equal((html.match(/type="radio"/g)||[]).length,11);assert.match(html,/value="0"/);assert.match(html,/value="10"/);assert.doesNotMatch(html,/checked=""/);assert.doesNotMatch(html,/value="11"/);assert.doesNotMatch(html,/<select/);
});
test('fractional scores, fractional maxima and large ranges retain bounded numeric entry',()=>{
 for(const [amount,possible] of [['2.5','10'],['0','7.5'],['0','1000']]){
  const html=renderToStaticMarkup(createElement(HomeworkPointsFields,{amount,possible,onChange:()=>{}}));assert.match(html,/aria-label="Erreichte Punkte"/);assert.ok(html.includes(`max="${possible}"`));assert.ok(html.includes(`value="${amount}"`));
 }
 assert.deepEqual(pointOptions(3),[0,1,2,3]);assert.equal(pointOptions(Infinity),null);assert.equal(pointOptions(1000000),null);
});

import {courseSheetMaximum,courseSheetPointsKey} from '../src/sheetPoints';
import {performanceQuestions} from '../src/requirements';
import type {Task} from '../src/types';
test('course maximum is shared by all linked homework requirements and overrides old individual defaults',()=>{
 const a={...requirement,taskIds:[1],pointsPerSheet:10},b={...requirement,id:'other-points',taskIds:[1],pointsPerSheet:4};
 const data:AppData={courses:[{id:1} as Course],tasks:[{id:1,course_id:1,title:'Blatt 1',status:'Offen'} as Task],sessions:[],blocks:[],recurring:[],settings:[{key:requirementsKey(1),value:JSON.stringify([a,b])},{key:courseSheetPointsKey(1),value:'6'}]};
 assert.equal(courseSheetMaximum(data,1),6);assert.equal(courseSheetMaximum(data,2),undefined);
 assert.deepEqual(performanceQuestions(data,'/tasks/1','PUT',{status:'Erledigt'}).map(q=>q.pointsMaximum),[6,6]);
 data.settings=data.settings.filter(s=>s.key!==courseSheetPointsKey(1));assert.deepEqual(performanceQuestions(data,'/tasks/1','PUT',{status:'Erledigt'}).map(q=>q.pointsMaximum),[10,4]);
});
test('small fixed maxima show a zero-to-maximum picker and no per-sheet maximum field',()=>{
 const html=renderToStaticMarkup(createElement(HomeworkPointsFields,{amount:'',possible:'6',fixedMaximum:6,onChange:()=>{}}));
 assert.equal((html.match(/type="radio"/g)||[]).length,7);assert.match(html,/value="0"/);assert.match(html,/value="6"/);assert.doesNotMatch(html,/checked=""/);assert.doesNotMatch(html,/Maximale Punkte für dieses Blatt/);
 const fractional=renderToStaticMarkup(createElement(HomeworkPointsFields,{amount:'2.5',possible:'6',fixedMaximum:6,onChange:()=>{}}));assert.match(fractional,/value="2.5"/);assert.match(fractional,/max="6"/);
});
