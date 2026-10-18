import type { AppData, Course, Session } from './types';
export const courseOf = (s:Session,data:AppData)=>data.tasks.find(t=>t.id===s.task_id)?.course_id??s.course_id??null;
export const isLecture=(s:Session)=>['Vorlesung','Übung','Lehrveranstaltung'].includes(s.kind);
export const duration=(s:Session)=>Math.max(0,(new Date(s.ended_at).getTime()-new Date(s.started_at).getTime())/60000);
const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
// Generate elapsed weekly occurrences; future attendance never increases progress.
export function attendance(data:AppData,now=new Date()):Session[]{
 const result:Session[]=[];
 for(const event of data.recurring){
  if(!event.auto_track||!event.course_id||!event.ends_on)continue;
  const day=new Date(`${event.starts_on}T00:00`),last=new Date(`${event.ends_on}T23:59:59`);
  if(!Number.isFinite(day.getTime())||!Number.isFinite(last.getTime()))continue;
  day.setDate(day.getDate()+(Number(event.weekday)-day.getDay()+7)%7);
  for(;day<=last&&day<=now;day.setDate(day.getDate()+7)){
   const started_at=`${key(day)}T${event.start_time}`,ended_at=`${key(day)}T${event.end_time}`;
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
  if(!e.ends_on)return sum;
  const first=new Date(`${e.starts_on}T00:00`),last=new Date(`${e.ends_on}T23:59:59`);
  first.setDate(first.getDate()+(Number(e.weekday)-first.getDay()+7)%7);
  let count=0;for(;first<=last;first.setDate(first.getDate()+7))count++;
  return sum+count*Math.max(0,(new Date(`2000-01-01T${e.end_time}`).getTime()-new Date(`2000-01-01T${e.start_time}`).getTime())/60000);
 },0);
 const workTarget=Math.max(0,target-Math.max(planned,lecture));
 return {work,lecture,target,workTarget,workPercent:workTarget?work/workTarget*100:0,totalPercent:target?(work+lecture)/target*100:0};
}
export function dailyMinutes(sessions:Session[],day:Date){
 const end=new Date(day);end.setDate(end.getDate()+1);
 return sessions.reduce((sum,s)=>sum+Math.max(0,Math.min(end.getTime(),new Date(s.ended_at).getTime())-Math.max(day.getTime(),new Date(s.started_at).getTime()))/60000,0);
}
