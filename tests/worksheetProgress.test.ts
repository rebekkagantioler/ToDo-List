import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {worksheetProgress,WorksheetProgress} from '../src/WorksheetProgress';
import {requirementsKey,entryKey,requirementProgress,type CourseRequirement} from '../src/requirements';
import {requirementScore,emptyPassingRule} from '../src/passingRules';
import {CourseRequirements} from '../src/CourseRequirements';
import type {AppData,Course} from '../src/types';
const course={id:1,name:'UE Geometrie'} as Course;
const sheets:CourseRequirement={id:'sheets',kind:'homework',title:'Übungsblätter',unit:'Punkte',target:24,current:0,maximumPoints:48};
function fixture(r=sheets):AppData{return {courses:[course],tasks:[],sessions:[],blocks:[],recurring:[],settings:[{key:requirementsKey(1),value:JSON.stringify([r])},...[1,2,3].map(n=>({key:entryKey(r.id,`manual-${n}`),value:JSON.stringify({requirementId:r.id,source:`manual-${n}`,label:`Blatt ${n}`,amount:4,possible:6})}))]}}
test('12 points use the full 48 point maximum; minimum 24 is a marker at 50 percent',()=>{
 const data=fixture(),p=worksheetProgress(data,1,sheets);assert.equal(p.amount,12);assert.equal(p.fill,25);assert.equal(p.marker,50);assert.equal(p.minimum,24);assert.equal(p.done,false);
 const html=renderToStaticMarkup(createElement(WorksheetProgress,{data,course,requirement:sheets,onEdit:()=>{}}));assert.match(html,/width:25%/);assert.match(html,/left:50%/);assert.match(html,/aria-valuemax="48"/);assert.match(html,/Noch 12 Punkte/);
});
test('meeting or exceeding the minimum does not fill the bar until the maximum',()=>{
 for(const [amount,fill] of [[24,50],[36,75],[48,100]]){
  const r={...sheets,current:amount};const data=fixture(r);data.settings=data.settings.slice(0,1);
  const p=worksheetProgress(data,1,r);assert.equal(p.fill,fill);assert.equal(p.marker,50);assert.equal(p.done,true);
 }
});
test('an unknown total never treats the minimum or recorded sheet maxima as the overall maximum',()=>{
 const r={...sheets,maximumPoints:undefined},data=fixture(r),p=worksheetProgress(data,1,r);assert.equal(p.maximum,undefined);assert.equal(p.fill,undefined);assert.equal(p.marker,undefined);
 const html=renderToStaticMarkup(createElement(WorksheetProgress,{data,course,requirement:r,onEdit:()=>{}}));assert.match(html,/Gesamtmaximum noch nicht festgelegt/);assert.doesNotMatch(html,/role="progressbar"/);
});
test('a known total maximum is also the denominator for percentage targets and course weighting',()=>{
 const r={...sheets,percentage:true,target:50},data=fixture(r);
 assert.equal(requirementProgress(data,r).value,25);assert.equal(requirementProgress(data,r).recordedPossible,18);assert.equal(requirementScore(data,r,emptyPassingRule()).percentage,25);assert.equal(worksheetProgress(data,1,r).minimum,24);
});
test('worksheet details list every sheet directly and preserve their original maxima',()=>{
 const html=renderToStaticMarkup(createElement(CourseRequirements,{data:fixture(),course,mutate:async()=>{}}));assert.match(html,/Blätter \(3\)/);
 for(const n of [1,2,3])assert.ok(html.includes(`Blatt ${n}`));assert.equal((html.match(/4 \/ 6/g)||[]).length,3);assert.match(html,/worksheet-entries/);
});
