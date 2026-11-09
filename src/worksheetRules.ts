import type {AppData} from './types';
import type {CourseRequirement,PerformanceEntry} from './requirements';
import {courseSheetMaximum} from './sheetPoints';
import {homeworkOwner} from './homework';
import {attendanceAnswer,excludedDates,unplannedDates} from './statistics';
export function worksheetCourseId(data:AppData,r:CourseRequirement){
 return data.courses.find(c=>{try{return JSON.parse(data.settings.find(s=>s.key===`course-requirements-${c.id}`)?.value||'[]').some((x:any)=>x.id===r.id)}catch{return false}})?.id;
}
export function worksheetMaximum(data:AppData,r:CourseRequirement){
 const courseId=worksheetCourseId(data,r),perSheet=courseId===undefined?r.pointsPerSheet:courseSheetMaximum(data,courseId)??r.pointsPerSheet;
 return r.worksheetCount&&perSheet?(r.worksheetCount-(r.dropLowest||0))*perSheet:r.maximumPoints;
}
export function worksheetAttendanceTarget(data:AppData,r:CourseRequirement,e:PerformanceEntry){
 const task=e.source.startsWith('task-')?data.tasks.find(t=>t.id===Number(e.source.slice(5))):undefined;
 const owner=e.source.startsWith('task-')?homeworkOwner(data,Number(e.source.slice(5))):null;
 const eventId=owner?.series.event_id??r.eventId,date=owner?.date??e.date??task?.deadline?.slice(0,10);
 return eventId&&date?{eventId,date}:null;
}
export function worksheetAttendance(data:AppData,r:CourseRequirement,e:PerformanceEntry):'yes'|'no'|'canceled'|'unplanned'|null{
 if(!r.attendanceRequired)return 'yes';
 const target=worksheetAttendanceTarget(data,r,e);
 if(target){
  if(unplannedDates(data,target.eventId).includes(target.date))return 'unplanned';
  if(excludedDates(data,target.eventId).includes(target.date))return 'canceled';
  return attendanceAnswer(data,target.eventId,target.date);
 }
 return e.attended===true?'yes':e.attended===false?'no':null;
}
export function assessWorksheets(data:AppData,r:CourseRequirement,entries:PerformanceEntry[]){
 const rows=entries.map(entry=>{
  const attendance=worksheetAttendance(data,r,entry);
  return {entry,attendance,effectiveAmount:attendance==='yes'||attendance==='canceled'?entry.amount:0};
 });
 const eligible=rows.filter(x=>x.attendance==='yes'||x.attendance==='no'||x.attendance==='canceled');
 const lowest=[...eligible].sort((a,b)=>a.effectiveAmount-b.effectiveAmount||(a.attendance==='no'?-1:0)-(b.attendance==='no'?-1:0)||a.entry.source.localeCompare(b.entry.source)).slice(0,r.worksheetFinalized?r.dropLowest||0:0);
 const dropped=new Set(lowest.map(x=>x.entry.source));
 const finalMaximum=worksheetMaximum(data,r),pendingFinalization=(r.dropLowest||0)>0&&!r.worksheetFinalized;
 const maximum=finalMaximum;
 const canFinalize=!!r.worksheetCount&&eligible.length===r.worksheetCount&&rows.every(x=>x.attendance==='yes'||x.attendance==='no'||x.attendance==='canceled')&&r.current===0;
 return {rows,dropped,credited:eligible.filter(x=>!dropped.has(x.entry.source)).map(x=>({...x.entry,amount:x.effectiveAmount})),maximum,finalMaximum,pendingFinalization,canFinalize};
}
