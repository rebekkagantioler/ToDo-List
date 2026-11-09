import {assessWorksheets,worksheetAttendance} from './worksheetRules';
import { courseSheetMaximum } from './sheetPoints';
import { excludedDates, unplannedDates } from './statistics';
import type { AppData, Task } from './types';
export type RequirementKind='exam'|'homework'|'reflection'|'presentation'|'other';
export type CourseRequirement={id:string;title:string;unit:string;target:number;current:number;kind?:RequirementKind;dateMode?:'fixed'|'unknown'|'choose';date?:string;time?:string;bookingDeadline?:string;examResult?:'open'|'passed'|'failed';examTaken?:boolean;examScoreType?:'points'|'grade';examEarned?:number;examPossible?:number;examGrade?:string;percentage?:boolean;pointsPerSheet?:number;maximumPoints?:number;worksheetCount?:number;dropLowest?:number;worksheetFinalized?:boolean;attendanceRequired?:boolean;taskIds?:number[];taskType?:string;eventId?:number|null};
export type PerformanceQuestion={requirement:CourseRequirement;source:string;label:string;date?:string;pointsMaximum?:number};
export type PerformanceEntry={requirementId:string;source:string;amount:number;possible?:number;label:string;date?:string;attended?:boolean};
export const requirementsKey=(id:number)=>`course-requirements-${id}`;
export const entryKey=(id:string,source:string)=>`performance-entry-${id}-${source}`;
export const skippedKey=(id:number)=>`performance-skipped-${id}`;
export function validRequirement(value:unknown):value is CourseRequirement{
 const r=value as CourseRequirement|null;
 return !!r&&typeof r.id==='string'&&!!r.id&&typeof r.title==='string'&&!!r.title.trim()&&typeof r.unit==='string'&&Number.isFinite(r.target)&&r.target>0&&Number.isFinite(r.current)&&r.current>=0
  &&(r.kind===undefined||Object.hasOwn(kindLabels,r.kind))
  &&(!r.percentage||(r.kind==='homework'&&r.target<=100&&r.current===0))
  &&(!r.kind||r.kind==='homework'||r.kind==='exam'||Number.isInteger(r.target)&&Number.isInteger(r.current))
  &&(r.kind!=='exam'||r.dateMode!=='fixed'||typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)&&new Date(r.date+'T12:00').toLocaleDateString('sv-SE')===r.date)
  &&(r.taskIds===undefined||Array.isArray(r.taskIds)&&r.taskIds.every(Number.isSafeInteger))
  &&(r.taskType===undefined||typeof r.taskType==='string')
  &&(r.worksheetCount===undefined||Number.isInteger(r.worksheetCount)&&r.worksheetCount>0)
  &&(r.dropLowest===undefined||Number.isInteger(r.dropLowest)&&r.dropLowest>=0&&(!r.worksheetCount||r.dropLowest<r.worksheetCount))
  &&(r.worksheetFinalized===undefined||typeof r.worksheetFinalized==='boolean')
  &&(r.attendanceRequired===undefined||typeof r.attendanceRequired==='boolean')
  &&(r.maximumPoints===undefined||Number.isFinite(r.maximumPoints)&&r.maximumPoints>0)
  &&(r.pointsPerSheet===undefined||Number.isFinite(r.pointsPerSheet)&&r.pointsPerSheet>0)
  &&(r.examTaken===undefined||typeof r.examTaken==='boolean')
  &&(r.examEarned===undefined||Number.isFinite(r.examEarned)&&r.examEarned>=0)
  &&(r.examPossible===undefined||Number.isFinite(r.examPossible)&&r.examPossible>0)
  &&(r.examEarned===undefined||r.examPossible===undefined||r.examEarned<=r.examPossible)
  &&(r.examGrade===undefined||typeof r.examGrade==='string');
}
export function courseRequirements(data:AppData,id:number):CourseRequirement[]{
 try{const v=JSON.parse(data.settings.find(s=>s.key===requirementsKey(id))?.value||'[]');return Array.isArray(v)?v.filter(validRequirement):[]}catch{return []}
}
export function allRequirements(data:AppData){return data.courses.flatMap(course=>courseRequirements(data,course.id).map(requirement=>({course,requirement})))}
export function performanceEntries(data:AppData,id:string):PerformanceEntry[]{
 return data.settings.filter(s=>s.key.startsWith(`performance-entry-${id}-`)).flatMap(s=>{
  try{const e=JSON.parse(s.value);return e&&e.requirementId===id&&typeof e.source==='string'&&typeof e.label==='string'&&Number.isFinite(e.amount)&&e.amount>=0&&(e.possible===undefined||(Number.isFinite(e.possible)&&e.possible>=e.amount))?[e]:[]}catch{return []}
 });
}
export function isSkipped(data:AppData,id:number){return data.settings.some(s=>s.key===skippedKey(id)&&s.value==='yes')}
export function matchesTask(r:CourseRequirement,t:Task){return r.kind!=='exam'&&(r.taskIds?.includes(t.id)||!!r.taskType&&r.taskType===t.type)}
export function linkedTasks(data:AppData,r:CourseRequirement){
 const courseId=data.courses.find(c=>courseRequirements(data,c.id).some(x=>x.id===r.id))?.id;
 return data.tasks.filter(t=>t.course_id===courseId&&matchesTask(r,t));
}
export function requirementEntries(data:AppData,r:CourseRequirement):PerformanceEntry[]{
 const saved=performanceEntries(data,r.id);
 if(r.kind==='homework'){
  const absent=r.attendanceRequired?linkedTasks(data,r).filter(t=>!saved.some(e=>e.source===`task-${t.id}`)).flatMap(t=>{
   const entry={requirementId:r.id,source:`task-${t.id}`,label:t.title,amount:0,possible:courseSheetMaximum(data,t.course_id!)??r.pointsPerSheet};
   return worksheetAttendance(data,r,entry)==='no'?[entry]:[];
  }):[];
  return [...saved,...absent];
 }
 if(r.kind==='exam')return saved;
 const automatic=linkedTasks(data,r).filter(t=>t.status==='Erledigt'&&!isSkipped(data,t.id)&&!saved.some(e=>e.source===`task-${t.id}`)).map(t=>({requirementId:r.id,source:`task-${t.id}`,label:t.title,amount:1}));
 return [...saved,...automatic];
}
export function worksheetCompletion(data:AppData,r:CourseRequirement){
 const completedTasks=linkedTasks(data,r).filter(t=>t.status==='Erledigt'&&!isSkipped(data,t.id));
 const completedSources=new Set(completedTasks.map(t=>`task-${t.id}`));
 for(const entry of performanceEntries(data,r.id))if(!entry.source.startsWith('task-'))completedSources.add(entry.source);
 const courseId=linkedTasks(data,r)[0]?.course_id??data.courses.find(c=>courseRequirements(data,c.id).some(x=>x.id===r.id))?.id;
 const perSheet=courseId?courseSheetMaximum(data,courseId)??r.pointsPerSheet:r.pointsPerSheet;
 const inferredTotal=r.maximumPoints&&perSheet&&Number.isInteger(r.maximumPoints/perSheet)?r.maximumPoints/perSheet+(r.dropLowest||0):undefined;
 return {completed:completedSources.size,total:r.worksheetCount??inferredTotal,pendingPoints:missingHomeworkResults(data,r).length};
}
export function missingHomeworkResults(data:AppData,r:CourseRequirement){
 return r.kind==='homework'?linkedTasks(data,r).filter(t=>t.status==='Erledigt'&&!isSkipped(data,t.id)&&!requirementEntries(data,r).some(e=>e.source===`task-${t.id}`)):[];
}
export function requirementProgress(data:AppData,r:CourseRequirement){
 const activeEntries=requirementEntries(data,r).filter(e=>{
  if(e.source.startsWith('task-')){const task=linkedTasks(data,r).find(t=>t.id===Number(e.source.slice(5)));return !!task&&(r.kind==='homework'&&r.attendanceRequired&&worksheetAttendance(data,r,e)==='no'||task.status==='Erledigt'&&!isSkipped(data,task.id))}
  if(e.source.startsWith('lecture-attendance-')){
   const match=/^lecture-attendance-(\d+)-(.*)$/.exec(e.source);if(!match)return false;
   const event=data.recurring.find(x=>x.id===Number(match[1]));
   const course=data.courses.find(c=>courseRequirements(data,c.id).some(x=>x.id===r.id));
   return !!event&&event.course_id===course?.id&&!excludedDates(data,event.id).includes(match[2])&&!unplannedDates(data,event.id).includes(match[2])&&data.settings.some(s=>s.key===e.source&&s.value==='yes');
  }
  return true;
 });
 const worksheet=r.kind==='homework'?assessWorksheets(data,r,activeEntries):null;
 const entries=worksheet?worksheet.credited:activeEntries;
 const unallocatedCurrent=r.kind==='homework'&&(r.attendanceRequired||(r.dropLowest||0)>0)?r.current:0;
 const amount=r.current-unallocatedCurrent+entries.reduce((sum,e)=>sum+e.amount,0);
 const recordedPossible=entries.reduce((sum,e)=>sum+(e.possible||0),0);
 const possible=worksheet?.maximum??r.maximumPoints??recordedPossible;
 const value=r.kind==='exam'?(r.examResult==='passed'?1:0):r.percentage?(possible>0?amount/possible*100:0):amount;
 return {entries,amount,possible,recordedPossible,value,worksheet,unallocatedCurrent,fulfilled:r.kind==='exam'?r.examResult==='passed':(!(r.kind==='homework'&&(r.dropLowest||0)>0&&!r.worksheetFinalized))&&(!r.percentage||possible>0)&&value>=r.target};
}
export const kindLabels:Record<RequirementKind,string>={exam:'Klausur / mündliche Prüfung',homework:'Hausaufgaben / Übungspunkte',reflection:'Reflexionen / Texte',presentation:'Vorrechnen / Präsentation',other:'Sonstiges'};
export const examDateLabel=(r:CourseRequirement)=>r.dateMode==='fixed'&&r.date?`${new Date(r.date+'T12:00').toLocaleDateString('de-AT')}${r.time?' · '+r.time:''}`:r.dateMode==='choose'?'Termin selbst wählen':'Termin noch unbekannt';

export function performanceQuestions(data:AppData,path:string,method:string,body:any):PerformanceQuestion[]{
 const taskId=/^\/tasks\/(\d+)$/.exec(path)?.[1];
 const task=taskId?data.tasks.find(t=>t.id===Number(taskId)):undefined;
 if(task&&method==='PUT'&&body?.status==='Erledigt'&&task.status!=='Erledigt'&&!body._skip){
  return allRequirements(data).filter(({course,requirement:r})=>course.id===task.course_id&&r.kind==='homework'&&matchesTask(r,task)&&(!r.attendanceRequired||worksheetAttendance(data,r,{requirementId:r.id,source:`task-${task.id}`,label:task.title,amount:0})!=='no')).map(({course,requirement})=>({requirement,source:`task-${task.id}`,label:task.title,pointsMaximum:courseSheetMaximum(data,course.id)??requirement.pointsPerSheet}));
 }
 const attendance=/^\/settings\/(lecture-attendance-\d+-\d{4}-\d{2}-\d{2})$/.exec(path)?.[1];
 if(attendance&&method==='PUT'&&!body?._performanceBackfill&&body?.value==='yes'&&data.settings.find(s=>s.key===attendance)?.value!=='yes'){
  const match=/^lecture-attendance-(\d+)-(.*)$/.exec(attendance)!;const event=data.recurring.find(e=>e.id===Number(match[1]));
  return allRequirements(data).filter(({course,requirement:r})=>course.id===event?.course_id&&r.kind==='presentation'&&r.eventId===event?.id).map(({requirement})=>({requirement,source:attendance,label:event!.title,date:match[2]}));
 }
 return [];
}

export function isSingleCountRequirement(r:CourseRequirement){
 return r.target===1&&!r.percentage&&r.kind!=='exam'&&r.kind!=='homework';
}
