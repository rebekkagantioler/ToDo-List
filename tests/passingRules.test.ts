import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coursePassingRule,emptyPassingRule,evaluatePassingRule,passingRuleError,passingRuleKey,requirementScore,type PassingRule,type PassingGroup} from '../src/passingRules';
import {entryKey,requirementsKey,validRequirement,type CourseRequirement} from '../src/requirements';
import type {AppData,Course} from '../src/types';
const homework:CourseRequirement={id:'homework',kind:'homework',title:'Hausaufgaben',unit:'Punkte',target:50,current:0,percentage:true};
const exam=(id:string,earned?:number,possible=100):CourseRequirement=>({id,kind:'exam',title:id,unit:'Prüfung',target:1,current:0,examEarned:earned,examPossible:possible});
const group=(ids:string[],patch:Partial<PassingGroup>={}):PassingGroup=>({id:ids.join('-'),title:ids.join(' + '),requirementIds:ids,weight:null,minimum:null,mustFulfill:false,examMode:'each',aggregation:'points',...patch});
function fixture(requirements:CourseRequirement[],rule:PassingRule):AppData{
 return {courses:[{id:1,name:'Mathematik'} as Course],tasks:[],sessions:[],blocks:[],recurring:[],settings:[{key:requirementsKey(1),value:JSON.stringify(requirements)},{key:passingRuleKey(1),value:JSON.stringify(rule)}]};
}
const rule=(groups:PassingGroup[],overallMinimum:number|null=null):PassingRule=>({...emptyPassingRule(),groups,overallMinimum});
function homeworkResult(data:AppData,amount:number,possible:number){data.settings.push({key:entryKey(homework.id,'manual-before'),value:JSON.stringify({requirementId:homework.id,source:'manual-before',label:'Übungsblätter',amount,possible})})}
test('40/60 weighting never compensates for a required component minimum',()=>{
 const r=rule([group(['homework'],{weight:40,minimum:50}),group(['exam'],{weight:60,minimum:50})],50);
 const data=fixture([homework,exam('exam',45)],r);homeworkResult(data,65,100);
 const result=evaluatePassingRule(data,1)!;
 assert.equal(result.error,'');assert.equal(result.overall,53);assert.equal(result.groups[0].status,'met');assert.equal(result.groups[1].status,'unmet');assert.equal(result.status,'unmet');
});
test('each exam must pass vs pooled exam score changes the outcome without changing total score',()=>{
 const exams=[exam('exam1',40),exam('exam2',80)];
 const each=rule([group(['exam1','exam2'],{weight:100,minimum:50,examMode:'each'})],50);
 const combined=rule([group(['exam1','exam2'],{weight:100,minimum:50,examMode:'combined'})],50);
 const a=evaluatePassingRule(fixture(exams,each),1)!,b=evaluatePassingRule(fixture(exams,combined),1)!;
 assert.equal(a.overall,60);assert.equal(a.status,'unmet');assert.equal(b.overall,60);assert.equal(b.status,'met');
});
test('pooled points and equally averaged percentages are distinct, including unequal exam maxima',()=>{
 const exams=[exam('small',10,10),exam('large',30,90)];
 const points=rule([group(['small','large'],{minimum:50,examMode:'combined',aggregation:'points'})]);
 const average=rule([group(['small','large'],{minimum:50,examMode:'combined',aggregation:'average'})]);
 assert.equal(evaluatePassingRule(fixture(exams,points),1)!.groups[0].percentage,40);
 assert.equal(evaluatePassingRule(fixture(exams,points),1)!.status,'unmet');
 assert.ok(Math.abs(evaluatePassingRule(fixture(exams,average),1)!.groups[0].percentage!-66.6666666667)<1e-7);
 assert.equal(evaluatePassingRule(fixture(exams,average),1)!.status,'met');
});
test('missing exam results do not become zero or automatically pass, and weighted totals remain open',()=>{
 const exams=[exam('a',75),exam('b')];
 const r=rule([group(['a','b'],{weight:100,minimum:50,examMode:'combined'})],50);
 const result=evaluatePassingRule(fixture(exams,r),1)!;
 assert.equal(result.groups[0].percentage,null);assert.equal(result.groups[0].status,'pending');assert.equal(result.overall,null);assert.equal(result.status,'pending');
});
test('weighting, minima and overall threshold can each be absent',()=>{
 const exams=[exam('a',70)];
 const minimumOnly=rule([group(['a'],{minimum:50})]);assert.equal(evaluatePassingRule(fixture(exams,minimumOnly),1)!.status,'met');assert.equal(passingRuleError(minimumOnly,exams),'');
 const weightsOnly=rule([group(['a'],{weight:100})]);assert.equal(passingRuleError(weightsOnly,exams),'');assert.equal(evaluatePassingRule(fixture(exams,weightsOnly),1)!.overall,70);assert.equal(evaluatePassingRule(fixture(exams,weightsOnly),1)!.hasConditions,false);
 const data=fixture([{...exams[0],examResult:'passed'}],emptyPassingRule());assert.equal(evaluatePassingRule(data,1)!.status,'met');
 assert.equal(evaluatePassingRule({...data,settings:[]},1),null);
});
test('total threshold applies independently from component minima',()=>{
 const exams=[exam('a',60),exam('b',60)];
 const r=rule([group(['a'],{weight:40,minimum:50}),group(['b'],{weight:60,minimum:50})],65);
 const result=evaluatePassingRule(fixture(exams,r),1)!;assert.ok(result.groups.every(g=>g.status==='met'));assert.equal(result.status,'unmet');assert.equal(result.overall,60);
});
test('additional unweighted requirements remain compulsory',()=>{
 const presentation:CourseRequirement={id:'present',title:'Vorrechnen',kind:'presentation',unit:'Mal',target:3,current:2};
 const r=rule([group(['exam'],{weight:100,minimum:50})],50);const data=fixture([exam('exam',80),presentation],r);
 const result=evaluatePassingRule(data,1)!;assert.equal(result.overall,80);assert.equal(result.status,'unmet');assert.equal(result.additional[0].requirement.id,'present');
});
test('grades require explicit course mapping and never use a guessed conversion',()=>{
 const e={...exam('oral'),examScoreType:'grade' as const,examGrade:' Gut '};
 const r=rule([group(['oral'],{weight:100,minimum:50})],50);let data=fixture([e],r);
 assert.equal(requirementScore(data,e,r).percentage,null);assert.equal(evaluatePassingRule(data,1)!.status,'pending');
 r.gradeScale=[{grade:'gut',percentage:80}];data=fixture([e],r);assert.equal(requirementScore(data,e,r).percentage,80);assert.equal(evaluatePassingRule(data,1)!.status,'met');
});
test('grade and point exams can average normalized percentages, but cannot silently pool grades as points',()=>{
 const exams=[{...exam('oral'),examScoreType:'grade' as const,examGrade:'2'},exam('written',40)];
 const r=rule([group(['oral','written'],{minimum:50,examMode:'combined'})]);r.gradeScale=[{grade:'2',percentage:80}];
 assert.equal(evaluatePassingRule(fixture(exams,r),1)!.groups[0].percentage,null);
 r.groups[0].aggregation='average';assert.equal(evaluatePassingRule(fixture(exams,r),1)!.groups[0].percentage,60);assert.equal(evaluatePassingRule(fixture(exams,r),1)!.status,'met');
});
test('invalid weights, duplicate assignments, invalid percentages and missing requirements are rejected',()=>{
 const req=[exam('a',50),exam('b',50)];
 assert.match(passingRuleError(rule([group(['a'],{weight:40})]),req),/100/);
 assert.match(passingRuleError(rule([group(['a']),group(['a'],{id:'second'})]),req),/nur einem/);
 assert.match(passingRuleError(rule([group(['a'],{minimum:101})]),req),/zwischen 0 und 100/);
 assert.match(passingRuleError(rule([group(['deleted'])]),req),/entfernt/);
 assert.match(passingRuleError(rule([group(['a'])],50),req),/Gewichtungen/);
 assert.match(passingRuleError(rule([group(['a','b'],{examMode:'combined',mustFulfill:true})]),req),/gemeinsame Mindestleistung/);
 const r=rule([]);r.gradeScale=[{grade:'Gut',percentage:80},{grade:' gut ',percentage:60}];assert.match(passingRuleError(r,req),/nur einmal/);
});
test('zero exam points are a known failing score; impossible exam points are invalid',()=>{
 const e=exam('a',0);const r=rule([group(['a'],{minimum:50})]);const data=fixture([e],r);
 assert.equal(requirementScore(data,e,r).percentage,0);assert.equal(evaluatePassingRule(data,1)!.status,'unmet');
 assert.equal(validRequirement(exam('a',101)),false);assert.equal(validRequirement(exam('a',0,0)),false);assert.equal(validRequirement(exam('a',0)),true);
});
test('legacy homework totals without possible points stay unknown in percentage calculations',()=>{
 const r=rule([group(['homework'],{weight:100,minimum:50})],50);const h={...homework,percentage:false,current:60};
 const data=fixture([h],r);assert.equal(requirementScore(data,h,r).percentage,null);assert.equal(evaluatePassingRule(data,1)!.status,'pending');
});
test('passing rule settings survive serialization and stay scoped to their course',()=>{
 const r=rule([group(['a'],{minimum:50})]);const data=fixture([exam('a',80)],r);
 assert.deepEqual(coursePassingRule(data,1),r);assert.equal(coursePassingRule(data,2),null);
 data.settings.find(s=>s.key===passingRuleKey(1))!.value='broken';assert.equal(coursePassingRule(data,1),null);
});

test('malformed settings never produce a course pass result',()=>{
 const data=fixture([exam('a',90)],emptyPassingRule());
 for(const value of ['null','{}','{"groups":[null]}','broken']){data.settings.find(s=>s.key===passingRuleKey(1))!.value=value;assert.equal(evaluatePassingRule(data,1),null)}
});

import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {CoursePassingRules} from '../src/CoursePassingRules';
import {CourseRequirements} from '../src/CourseRequirements';
test('course requirements render scored exams and the combined rule together',()=>{
 const data=fixture([homework,exam('Klausur 1',45)],rule([group(['homework'],{weight:40,minimum:50}),group(['Klausur 1'],{weight:60,minimum:50})],50));homeworkResult(data,65,100);
 const html=renderToStaticMarkup(createElement(CourseRequirements,{course:data.courses[0],data,mutate:async()=>{}}));
 assert.match(html,/Gewichtetes Gesamtergebnis: /);assert.match(html,/53/);assert.match(html,/Bedingungen noch nicht erfüllt/);assert.match(html,/45/);assert.match(html,/Punkte/);
});
test('an unconfigured course offers the optional editor without adding any pass rule',()=>{
 const data=fixture([exam('a')],emptyPassingRule());data.settings=data.settings.filter(s=>s.key!==passingRuleKey(1));
 const html=renderToStaticMarkup(createElement(CoursePassingRules,{course:data.courses[0],data,mutate:async()=>{}}));assert.match(html,/Regel einrichten/);assert.match(html,/Noch keine kombinierte Regel hinterlegt/);assert.equal(coursePassingRule(data,1),null);
});

import {courseRequirementSatisfied,examRuleStatus} from '../src/passingRules';
test('exam cards and overview credit scores evaluated by the course rule without requiring a manual pass flag',()=>{
 const exams=[exam('a',40),exam('b',80)];const each=rule([group(['a','b'],{minimum:50,examMode:'each'})]);let data=fixture(exams,each);
 assert.equal(examRuleStatus(data,1,exams[0]),'unmet');assert.equal(courseRequirementSatisfied(data,1,exams[1]),true);
 const combined=rule([group(['a','b'],{minimum:50,examMode:'combined'})]);data=fixture(exams,combined);
 assert.equal(courseRequirementSatisfied(data,1,exams[0]),true);assert.equal(courseRequirementSatisfied(data,1,exams[1]),true);
 data=fixture([exam('a')],rule([group(['a'],{minimum:50})]));assert.equal(examRuleStatus(data,1,exam('a')),'pending');
 const manual={...exam('a'),examResult:'passed' as const};data=fixture([manual],emptyPassingRule());assert.equal(courseRequirementSatisfied(data,1,manual),true);
});
