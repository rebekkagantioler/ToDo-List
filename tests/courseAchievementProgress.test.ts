import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {courseAchievementSteps,CourseAchievementProgress} from '../src/CourseAchievementProgress';
import {requirementsKey,entryKey,type CourseRequirement} from '../src/requirements';
import type {AppData,Course,Task} from '../src/types';
const course={id:1,name:'Analysis'} as Course;
const homework:CourseRequirement={id:'sheets',kind:'homework',title:'Blätter',unit:'Punkte',target:24,current:0,pointsPerSheet:4,worksheetCount:14,maximumPoints:48,taskType:'Hausaufgabe'};
function fixture(r=homework):AppData{return {courses:[course],tasks:[1,2,3,4,5].map(id=>({id,course_id:1,title:`Blatt ${id}`,type:'Hausaufgabe',status:'Erledigt'} as Task)),sessions:[],blocks:[],recurring:[],settings:[{key:requirementsKey(1),value:JSON.stringify([r])}]}}
test('completed sheets without recorded scores contribute zero point progress',()=>{
 const data=fixture(),step=courseAchievementSteps(data,1)[0];assert.equal(step.done,false);assert.equal(step.progress,0);
 const html=renderToStaticMarkup(createElement(CourseAchievementProgress,{data,course}));assert.match(html,/aria-valuenow="0"/);assert.match(html,/0 von 1 Voraussetzungen erfüllt/);assert.match(html,/Punktefortschritt/);
});
test('meeting the minimum does not fill the bar before all possible points are earned',()=>{
 const r={...homework,target:4},data=fixture(r);data.settings.push({key:entryKey(r.id,'task-1'),value:JSON.stringify({requirementId:r.id,source:'task-1',label:'Blatt 1',amount:4,possible:4})});
 const step=courseAchievementSteps(data,1)[0];assert.equal(step.done,true);assert.equal(step.progress,4/56);
});
test('the configured overall point maximum is used when no sheet count is known',()=>{
 const r={...homework,worksheetCount:undefined,pointsPerSheet:6,maximumPoints:48},data=fixture(r);
 data.settings.push({key:entryKey(r.id,'task-1'),value:JSON.stringify({requirementId:r.id,source:'task-1',label:'Blatt 1',amount:6,possible:6})});
 assert.equal(courseAchievementSteps(data,1)[0].progress,6/48);
});
test('an exam taken retains its existing progress while its pass condition can still remain open',()=>{
 const exam:CourseRequirement={id:'exam',kind:'exam',title:'Klausur',unit:'Prüfung',target:1,current:0,examTaken:true};const data=fixture(exam);const step=courseAchievementSteps(data,1)[0];assert.equal(step.progress,1);assert.equal(step.done,false);
});

test('an unknown overall point maximum shows no invented percentage or completion fallback',()=>{
 const r={...homework,worksheetCount:undefined,maximumPoints:undefined},data=fixture(r);
 assert.equal(courseAchievementSteps(data,1)[0].progress,null);
 const html=renderToStaticMarkup(createElement(CourseAchievementProgress,{data,course}));
 assert.match(html,/Gesamtpunkte noch nicht festgelegt/);assert.doesNotMatch(html,/role="progressbar"|Bearbeitungsfortschritt/);
});

test('Geometry overview uses earned points and the configured drop rule instead of four of nine completed sheets',async()=>{
 const {PerformanceChecklist}=await import('../src/PerformanceChecklist');
 const r={...homework,worksheetCount:9,dropLowest:2},data=fixture(r);data.tasks=data.tasks.slice(0,4);
 for(const task of data.tasks)data.settings.push({key:entryKey(r.id,`task-${task.id}`),value:JSON.stringify({requirementId:r.id,source:`task-${task.id}`,label:task.title,amount:4,possible:4})});
 assert.equal(courseAchievementSteps(data,1)[0].progress,16/28);
 const html=renderToStaticMarkup(createElement(CourseAchievementProgress,{data,course}));
 assert.match(html,/aria-valuenow="57"/);assert.match(html,/Punktefortschritt/);
 const checklist=renderToStaticMarkup(createElement(PerformanceChecklist,{data,course,compact:true}));
 assert.match(checklist,/16 \/ 28 Punkte/);assert.doesNotMatch(checklist,/Blätter bearbeitet/);
 for(const task of data.tasks)task.status='Offen';
 assert.equal(courseAchievementSteps(data,1)[0].progress,16/28);
});
