import type { AppData, Task } from './types';
import { excludedDates, occurrenceDates } from './statistics';
export type HomeworkSeries={id:string; event_id:number; starts_on:string; task:Omit<Task,'id'|'created_at'|'completed_at'>; skipped:string[]; stopped?:boolean; deleted?:boolean; numbering?:{start:number; from:string}; submission?:{days_before:number;time:string}; title_updates?:Record<string,{from:string;to:string;deadline_from?:string|null;deadline_to?:string}>};
export const homeworkKey=(id:string)=>`homework-series-${id}`;
export function homeworkSeries(data:AppData):HomeworkSeries[]{return data.settings.filter(s=>s.key.startsWith('homework-series-')).flatMap(s=>{try{const v=JSON.parse(s.value);return v&&typeof v.id==='string'&&v.task&&Array.isArray(v.skipped)?[v]:[]}catch{return []}})}
export function homeworkId(series:string,date:string){let hash=1469598103934665603n;for(const c of `${series}:${date}`)hash=BigInt.asUintN(64,(hash^BigInt(c.charCodeAt(0)))*1099511628211n);return Number(hash%4000000000000000n)+4000000000000000;}
export function nextDeadline(data:AppData,courseId:number|null,now=new Date()):string{
 if(courseId===null)return '';
 const activeSeries=homeworkSeries(data).filter(s=>!s.deleted&&!s.stopped);
 return data.recurring.filter(e=>e.course_id===courseId).flatMap(e=>{
  const matching=activeSeries.filter(s=>s.event_id===e.id);
  return matching.length?matching.flatMap(s=>homeworkDates(data,s).filter(d=>!s.skipped.includes(d)).map(d=>homeworkDeadline(data,s,d))):occurrenceDates(e).filter(d=>!excludedDates(data,e.id).includes(d)).map(d=>`${d}T${e.start_time}`);
 }).filter(d=>new Date(d)>now).sort()[0]||'';
}
export function homeworkDates(data:AppData,series:HomeworkSeries){
 const event=data.recurring.find(e=>e.id===series.event_id);if(!event)return [];
 const excluded=new Set(excludedDates(data,event.id));
 return occurrenceDates(event).filter(date=>date>=series.starts_on&&!excluded.has(date));
}
export function homeworkDeadline(data:AppData,series:HomeworkSeries,date:string){
 const event=data.recurring.find(e=>e.id===series.event_id);if(!event)return '';
 if(!series.submission)return `${date}T${event.start_time}`;
 const day=new Date(`${date}T12:00`);day.setDate(day.getDate()-series.submission.days_before);
 const key=`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
 return `${key}T${series.submission.time}`;
}
export function nextHomeworkDate(data:AppData,series:HomeworkSeries,now=new Date()){
 const event=data.recurring.find(e=>e.id===series.event_id);if(!event)return '';
 return homeworkDates(data,series).find(date=>!series.skipped.includes(date)&&new Date(homeworkDeadline(data,series,date))>=now)||'';
}
export function homeworkTitle(data:AppData,series:HomeworkSeries,date:string){
 const numbering=series.numbering;
 if(!numbering||date<numbering.from)return series.task.title;
 const dates=homeworkDates(data,series).filter(d=>d>=numbering.from);
 const index=dates.indexOf(date);
 if(index<0)return series.task.title;
 let number=numbering.start+index;
 // Existing numbers stay reserved, including after a late cancellation.
 // This keeps newly released sheets from reusing an already visible number.
 const event=data.recurring.find(e=>e.id===series.event_id)!;
 for(const previous of occurrenceDates(event).filter(d=>d>=numbering.from&&d<date)){
  const task=data.tasks.find(t=>t.id===homeworkId(series.id,previous));if(!task)continue;
  const rename=series.title_updates?.[String(task.id)];
  const title=rename&&task.title===rename.from?rename.to:task.title;
  const prefix=`${series.task.title} `,suffix=title.startsWith(prefix)?title.slice(prefix.length):'';
  if(!/^\d+$/.test(suffix))continue;
  const distance=dates.filter(d=>d>previous&&d<=date).length;
  number=Math.max(number,Number(suffix)+distance);
 }
 return `${series.task.title} ${number}`;
}
export function homeworkTitleUpdates(data:AppData,series:HomeworkSeries,from:string){
 const updates={...series.title_updates};
 for(const date of homeworkDates(data,series).filter(d=>d>=from)){
  const task=data.tasks.find(t=>t.id===homeworkId(series.id,date));
  if(task&&task.status!=='Erledigt')updates[String(task.id)]={from:task.title,to:homeworkTitle(data,{...series,title_updates:updates},date),deadline_from:task.deadline,deadline_to:homeworkDeadline(data,series,date)};
 }
 return updates;
}
export function homeworkPlan(data:AppData,now=new Date()){
 const create:Task[]=[],remove:Task[]=[],update:Task[]=[];
 for(const series of homeworkSeries(data)){
  const event=data.recurring.find(e=>e.id===series.event_id);if(!event)continue;
  const excluded=excludedDates(data,event.id),nextDate=nextHomeworkDate(data,series,now);
  for(const date of occurrenceDates(event)){
   if(date<series.starts_on)continue;
   const id=homeworkId(series.id,date),existing=data.tasks.find(t=>t.id===id);
   const deadline=homeworkDeadline(data,series,date),release=new Date(deadline);release.setDate(release.getDate()-7);
   const skipped=excluded.includes(date)||series.skipped.includes(date);
   if(existing&&(skipped||series.deleted)&&existing.status!=='Erledigt'&&!data.sessions.some(s=>s.task_id===id))remove.push(existing);
   const rename=series.title_updates?.[String(id)];
   if(existing&&!skipped&&!series.deleted&&existing.status!=='Erledigt'&&rename){
    const title=existing.title===rename.from?rename.to:existing.title;
    const deadline=rename.deadline_to&&existing.deadline===rename.deadline_from?rename.deadline_to:existing.deadline;
    if(title!==existing.title||deadline!==existing.deadline)update.push({...existing,title,deadline});
   }
   if(!existing&&!series.stopped&&!series.deleted&&!skipped&&(release<=now||date===nextDate))create.push({...series.task,title:homeworkTitle(data,series,date),id,deadline,created_at:now.toISOString(),completed_at:null});
  }
 }
 return {create,remove,update};
}
export function homeworkOwner(data:AppData,id:number){for(const series of homeworkSeries(data)){const event=data.recurring.find(e=>e.id===series.event_id);if(!event)continue;for(const date of occurrenceDates(event))if(homeworkId(series.id,date)===id)return {series,date};}return null;}
