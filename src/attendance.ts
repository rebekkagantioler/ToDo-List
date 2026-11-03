import type { AppData, Course } from './types';
import { attendanceAnswer, excludedDates, occurrenceDates } from './statistics';

export const attendancePolicyKey=(id:number)=>`attendance-policy-${id}`;
export function attendancePolicy(data:AppData,course:Course):{required:boolean;limit:number|null}{
 const fallback={required:!/(?:^|\s|[(:-])(?:VO|Vorlesung)(?=$|\s|[):.-])/i.test(`${course.code} ${course.name}`),limit:null};
 try{
  const value=JSON.parse(data.settings.find(s=>s.key===attendancePolicyKey(course.id))?.value||'null');
  return {required:typeof value?.required==='boolean'?value.required:fallback.required,limit:Number.isInteger(value?.limit)&&value.limit>=0?value.limit:null};
 }catch{return fallback}
}
export function courseAttendance(data:AppData,course:Course,now=new Date()){
 const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 const events=data.recurring.filter(e=>e.course_id===course.id);
 const rows=events.flatMap(event=>{
  const excluded=new Set(excludedDates(data,event.id));
  return occurrenceDates({...event,ends_on:event.ends_on||today}).map(date=>({event,date,canceled:excluded.has(date),answer:attendanceAnswer(data,event.id,date),started:new Date(`${date}T${event.start_time}`)<=now}));
 }).sort((a,b)=>`${a.date}T${a.event.start_time}`.localeCompare(`${b.date}T${b.event.start_time}`)||a.event.id-b.event.id);
 const active=rows.filter(r=>!r.canceled),present=active.filter(r=>r.started&&r.answer==='yes').length,absent=active.filter(r=>r.started&&r.answer==='no').length;
 const policy=attendancePolicy(data,course);
 return {rows,present,absent,total:active.length,pending:active.filter(r=>r.started&&!r.answer).length,openEnded:events.some(e=>!e.ends_on),policy,remaining:policy.limit===null?null:Math.max(0,policy.limit-absent)};
}
