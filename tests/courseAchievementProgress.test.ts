import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {courseAchievementSteps,CourseAchievementProgress} from '../src/CourseAchievementProgress';
import {requirementsKey,entryKey,worksheetCompletion,type CourseRequirement} from '../src/requirements';
import type {AppData,Course,Task} from '../src/types';
const course={id:1,name:'Analysis'} as Course;
const homework:CourseRequirement={id:'sheets',kind:'homework',title:'Blätter',unit:'Punkte',target:24,current:0,pointsPerSheet:4,worksheetCount:14,maximumPoints:48,taskType:'Hausaufgabe'};
function fixture(r=homework):AppData{return {courses:[course],tasks:[1,2,3,4,5].map(id=>({id,course_id:1,title:`Blatt ${id}`,type:'Hausaufgabe',status:'Erledigt'} as Task)),sessions:[],blocks:[],recurring:[],settings:[{key:requirementsKey(1),value:JSON.stringify([r])}]}}
test('five of fourteen completed sheets show partial progress even before their points have been recorded',()=>{
 const data=fixture(),step=courseAchievementSteps(data,1)[0];assert.equal(step.done,false);assert.equal(step.progress,5/14);
 const html=renderToStaticMarkup(createElement(CourseAchievementProgress,{data,course}));assert.match(html,/aria-valuenow="36"/);assert.match(html,/0 von 1 Voraussetzungen erfüllt/);assert.match(html,/Bearbeitungsfortschritt/);
});
test('homework minimum does not fill the work progress bar when other sheets are still undone',()=>{
 const r={...homework,target:4},data=fixture(r);data.settings.push({key:entryKey(r.id,'task-1'),value:JSON.stringify({requirementId:r.id,source:'task-1',label:'Blatt 1',amount:4,possible:4})});
 const step=courseAchievementSteps(data,1)[0];assert.equal(step.done,true);assert.equal(step.progress,5/14);
});
test('a known total maximum and per-sheet maximum supply the missing overall sheet count',()=>{
 const r={...homework,worksheetCount:undefined,pointsPerSheet:6,maximumPoints:48},data=fixture(r);
 assert.equal(worksheetCompletion(data,r).total,8);assert.equal(courseAchievementSteps(data,1)[0].progress,5/8);
});
test('an exam taken contributes to work progress while its pass condition can still remain open',()=>{
 const exam:CourseRequirement={id:'exam',kind:'exam',title:'Klausur',unit:'Prüfung',target:1,current:0,examTaken:true};const data=fixture(exam);const step=courseAchievementSteps(data,1)[0];assert.equal(step.progress,1);assert.equal(step.done,false);
});
