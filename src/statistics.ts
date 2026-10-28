import type { AppData, Course, RecurringEvent, Session } from './types';
export const courseOf = (s:Session,data:AppData)=>data.tasks.find(t=>t.id===s.task_id)?.course_id??s.course_id??null;
export const isLecture=(s:Session)=>['Vorlesung','Übung','Lehrveranstaltung'].includes(s.kind);
export const duration=(s:Session)=>Math.max(0,(new Date(s.ended_at).getTime()-new Date(s.started_at).getTime())/60000);
const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const exclusionKey=(eventId:number)=>`lecture-exclusions-${eventId}`;
export function excludedDates(data:AppData,eventId:number):string[]{
 try{const value=JSON.parse(data.settings.find(s=>s.key===exclusionKey(eventId))?.value||'[]');return Array.isArray(value)?value.filter((d:unknown)=>typeof d==='string'):[]}catch{return []}
}
export function occurrenceDates(event:RecurringEvent):string[]{
 if(!event.ends_on)return [];
 const day=new Date(`${event.starts_on}T00:00`),last=new Date(`${event.ends_on}T23:59:59`),dates:string[]=[];
 if(!Number.isFinite(day.getTime())||!Number.isFinite(last.getTime())||!Number.isInteger(event.weekday)||event.weekday<0||event.weekday>6)return dates;
 day.setDate(day.getDate()+(event.weekday-day.getDay()+7)%7);
 for(;day<=last;day.setDate(day.getDate()+7))dates.push(key(day));
 return dates;
}
export function lastOccurrence(startsOn:string,weekday:number,count:number):string{
 const day=new Date(`${startsOn}T00:00`);
 if(!Number.isFinite(day.getTime())||!Number.isInteger(count)||count<1||count>520)return '';
 day.setDate(day.getDate()+(weekday-day.getDay()+7)%7+(count-1)*7);
 return key(day);
}
export const attendanceKey=(eventId:number,date:string)=>`lecture-attendance-${eventId}-${date}`;
export function attendanceAnswer(data:AppData,eventId:number,date:string):'yes'|'no'|null{
 const value=data.settings.find(s=>s.key===attendanceKey(eventId,date))?.value;
 return value==='yes'||value==='no'?value:null;
}
export function attendanceRequests(data:AppData,now=new Date()){
 return data.recurring.filter(e=>e.course_id).flatMap(event=>{
  const excluded=new Set(excludedDates(data,event.id));
  // Open-ended series only need occurrences through today.
  return occurrenceDates({...event,ends_on:event.ends_on||key(now)}).filter(date=>!excluded.has(date)&&new Date(`${date}T${event.start_time}`)<=now).map(date=>({event,date,answer:attendanceAnswer(data,event.id,date)}));
 }).sort((a,b)=>`${b.date}T${b.event.start_time}`.localeCompare(`${a.date}T${a.event.start_time}`));
}
// Only confirmed, completed occurrences increase progress.
export function attendance(data:AppData,now=new Date()):Session[]{
 const result:Session[]=[];
 for(const event of data.recurring){
  if(!event.auto_track||!event.course_id)continue;
  const excluded=new Set(excludedDates(data,event.id));
  for(const date of occurrenceDates({...event,ends_on:event.ends_on||key(now)})){
   if(excluded.has(date)||attendanceAnswer(data,event.id,date)!=='yes')continue;
   const started_at=`${date}T${event.start_time}`,ended_at=`${date}T${event.end_time}`;
   const start=new Date(started_at),end=new Date(ended_at);
   if(end>now||end<=start)continue;
   // A manually recorded lecture replaces the overlapping automatic occurrence.
   if(data.sessions.some(s=>isLecture(s)&&courseOf(s,data)===event.course_id&&new Date(s.started_at)<end&&new Date(s.ended_at)>start))continue;
   result.push({id:-result.length-1,task_id:null,course_id:event.course_id,started_at,ended_at,kind:'Lehrveranstaltung',note:event.title});
  }
 }
 return result;
}
export function courseProgress(course:Course,data:AppData,now=new Date()){
 const sessions=data.sessions.filter(s=>courseOf(s,data)===course.id);
 const work=sessions.filter(s=>!isLecture(s)).reduce((sum,s)=>sum+duration(s),0);
 const lecture=[...sessions.filter(isLecture),...attendance(data,now).filter(s=>s.course_id===course.id)].reduce((sum,s)=>sum+duration(s),0);
 const target=course.ects*course.hours_per_ects*60;
 const planned=data.recurring.filter(e=>e.course_id===course.id&&e.auto_track).reduce((sum,e)=>{
  const excluded=new Set(excludedDates(data,e.id));
  const count=occurrenceDates(e).filter(date=>!excluded.has(date)).length;
  return sum+count*Math.max(0,(new Date(`2000-01-01T${e.end_time}`).getTime()-new Date(`2000-01-01T${e.start_time}`).getTime())/60000);
 },0);
 const workTarget=Math.max(0,target-Math.max(planned,lecture));
 return {work,lecture,target,workTarget,workPercent:workTarget?work/workTarget*100:0,totalPercent:target?(work+lecture)/target*100:0};
}
export function dailyMinutes(sessions:Session[],day:Date){
 const end=new Date(day);end.setDate(end.getDate()+1);
 return sessions.reduce((sum,s)=>sum+Math.max(0,Math.min(end.getTime(),new Date(s.ended_at).getTime())-Math.max(day.getTime(),new Date(s.started_at).getTime()))/60000,0);
}

export function semesterSummary(sessions:Session[],now=new Date()){
 const start=new Date(now.getFullYear()-(now.getMonth()<9?1:0),9,1);
 const minutes=sessions.reduce((sum,s)=>sum+Math.max(0,Math.min(now.getTime(),new Date(s.ended_at).getTime())-Math.max(start.getTime(),new Date(s.started_at).getTime()))/60000,0);
 // Calendar days avoid daylight-saving shifts; today counts as one day.
 const days=Math.floor((Date.UTC(now.getFullYear(),now.getMonth(),now.getDate())-Date.UTC(start.getFullYear(),9,1))/86400000)+1;
 return {start,minutes,weeklyAverage:minutes*7/days,days};
}
