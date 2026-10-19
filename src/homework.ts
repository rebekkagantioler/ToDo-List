import type { AppData, Task } from './types';
import { excludedDates, occurrenceDates } from './statistics';
export type HomeworkSeries={id:string; event_id:number; starts_on:string; task:Omit<Task,'id'|'created_at'|'completed_at'>; skipped:string[]; stopped?:boolean; deleted?:boolean};
export const homeworkKey=(id:string)=>`homework-series-${id}`;
export function homeworkSeries(data:AppData):HomeworkSeries[]{return data.settings.filter(s=>s.key.startsWith('homework-series-')).flatMap(s=>{try{const v=JSON.parse(s.value);return v&&typeof v.id==='string'&&v.task&&Array.isArray(v.skipped)?[v]:[]}catch{return []}})}
export function homeworkId(series:string,date:string){let hash=1469598103934665603n;for(const c of `${series}:${date}`)hash=BigInt.asUintN(64,(hash^BigInt(c.charCodeAt(0)))*1099511628211n);return Number(hash%4000000000000000n)+4000000000000000;}
export function nextDeadline(data:AppData,courseId:number|null,now=new Date()):string{
 if(courseId===null)return '';
 return data.recurring.filter(e=>e.course_id===courseId).flatMap(e=>occurrenceDates(e).filter(d=>!excludedDates(data,e.id).includes(d)).map(d=>`${d}T${e.start_time}`)).filter(d=>new Date(d)>now).sort()[0]||'';
}
export function homeworkPlan(data:AppData,now=new Date()){
 const create:Task[]=[],remove:Task[]=[];
 for(const series of homeworkSeries(data)){
  const event=data.recurring.find(e=>e.id===series.event_id);if(!event)continue;
  const excluded=excludedDates(data,event.id);
  for(const date of occurrenceDates(event)){
   if(date<series.starts_on)continue;
   const id=homeworkId(series.id,date),existing=data.tasks.find(t=>t.id===id);
   const deadline=`${date}T${event.start_time}`,release=new Date(deadline);release.setDate(release.getDate()-7);
   const skipped=excluded.includes(date)||series.skipped.includes(date);
   if(existing&&(skipped||series.deleted)&&existing.status!=='Erledigt'&&!data.sessions.some(s=>s.task_id===id))remove.push(existing);
   if(!existing&&!series.stopped&&!series.deleted&&!skipped&&release<=now)create.push({...series.task,id,deadline,created_at:now.toISOString(),completed_at:null});
  }
 }
 return {create,remove};
}
export function homeworkOwner(data:AppData,id:number){for(const series of homeworkSeries(data)){const event=data.recurring.find(e=>e.id===series.event_id);if(!event)continue;for(const date of occurrenceDates(event))if(homeworkId(series.id,date)===id)return {series,date};}return null;}
