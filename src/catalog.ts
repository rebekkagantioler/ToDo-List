import type {AppData, Course, RecurringEvent} from './types';
import {excludedDates, occurrenceDates} from './statistics';
import {homeworkSeries, type HomeworkSeries} from './homework';
export type CatalogEvent=Omit<RecurringEvent,'id'|'course_id'>&{source_key?:string;excluded:string[]};
export type CatalogHomework={source_key:string;event_key:string;title:string;type:string;starts_on:string;estimate_minutes:number;priority:string;tracking:number;numbering?:HomeworkSeries['numbering'];submission?:HomeworkSeries['submission']};
export type CourseTemplate={course:Omit<Course,'id'>;events:CatalogEvent[];homework?:CatalogHomework[];source_key?:string;revision?:string;source_snapshot?:CourseTemplate;tasks_start_on?:string;update_course?:boolean;remove_events?:string[];remove_homework?:string[]};
export type CourseCatalogEntry={id:string;name:string;payload:CourseTemplate};
export type CourseOrigin={source_key:string;revision:string;event_map:Record<string,number>;homework_map:Record<string,string>;snapshot:CourseTemplate};
export const courseOriginKey=(id:number)=>`course-origin-${id}`;
export function courseOrigin(data:AppData,id:number):CourseOrigin|null{try{return JSON.parse(data.settings.find(s=>s.key===courseOriginKey(id))?.value||'null')}catch{return null}}
export const courseVisibilityKey=(courseId:number)=>`course-catalog-visible-${courseId}`;
export const courseIsVisible=(data:AppData,courseId:number)=>data.settings.some(s=>s.key===courseVisibilityKey(courseId)&&s.value==='true');
export function catalogEntries(data:AppData):CourseCatalogEntry[]{
 return data.courses.filter(c=>courseIsVisible(data,c.id)).map(c=>{
  const events=data.recurring.filter(e=>e.course_id===c.id).map(e=>({source_key:String(e.id),title:e.title,weekday:e.weekday,start_time:e.start_time,end_time:e.end_time,starts_on:e.starts_on,ends_on:e.ends_on,auto_track:e.auto_track,excluded:excludedDates(data,e.id)}));
  const homework=homeworkSeries(data).filter(s=>s.task.course_id===c.id&&!s.deleted&&!s.stopped&&events.some(e=>e.source_key===String(s.event_id))).map(s=>({source_key:s.id,event_key:String(s.event_id),title:s.task.title,type:s.task.type,starts_on:s.starts_on,estimate_minutes:s.task.estimate_minutes,priority:s.task.priority,tracking:s.task.tracking,...(s.numbering?{numbering:s.numbering}:{}),...(s.submission?{submission:s.submission}:{})}));
  const base={course:{name:c.name,code:c.code,semester:c.semester,ects:c.ects,hours_per_ects:c.hours_per_ects,color:c.color,description:''},events,homework};
  return {id:String(c.id),name:c.name,payload:{...base,source_key:String(c.id),revision:JSON.stringify(base)}};
 });
}
export function selectCourseContents(template:CourseTemplate,eventKeys:string[],homeworkKeys:string[],startsOn:string):CourseTemplate{
 return {...template,source_snapshot:template,events:template.events.filter(e=>eventKeys.includes(e.source_key||'')),homework:(template.homework||[]).filter(h=>homeworkKeys.includes(h.source_key)&&eventKeys.includes(h.event_key)).map(h=>{
  const start=h.starts_on>startsOn?h.starts_on:startsOn,event=template.events.find(e=>e.source_key===h.event_key);
  const numbering=h.numbering&&event?{...h.numbering,start:h.numbering.start+occurrenceDates({...event,id:0,course_id:null}).filter(d=>d>=h.starts_on&&d>=h.numbering!.from&&d<start&&!event.excluded.includes(d)).length,from:start}:undefined;
  return {...h,starts_on:start,...(numbering?{numbering}:{})};
 }),tasks_start_on:startsOn};
}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de-DE');
export function searchCatalog(entries:CourseCatalogEntry[],query:string){
 const words=normalize(query).trim().split(/\s+/).filter(Boolean);
 return entries.filter(e=>{const text=normalize(`${e.name} ${e.payload.course.code} ${e.payload.course.semester}`);return words.every(word=>text.includes(word))});
}
export const catalogEventKey=(e:CatalogEvent,index:number)=>e.source_key||String(index);
