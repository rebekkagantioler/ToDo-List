import type {AppData, Course, RecurringEvent} from './types';
import {canceledDates, unplannedDates} from './statistics';
import {homeworkSeries, homeworkDates, homeworkTitle, homeworkDeadline, homeworkId, type HomeworkSeries} from './homework';
export type CatalogEvent=Omit<RecurringEvent,'id'|'course_id'>&{source_key?:string;excluded:string[];unplanned?:string[]};
export type CatalogHomework={source_key:string;event_key:string;title:string;type:string;starts_on:string;estimate_minutes:number;priority:string;tracking:number;numbering?:HomeworkSeries['numbering'];submission?:HomeworkSeries['submission'];sheets?:HomeworkSeries['reference']};
export const requirementFields=['title','unit','target','kind','dateMode','date','time','bookingDeadline','examScoreType','percentage','pointsPerSheet','maximumPoints','worksheetCount','dropLowest','attendanceRequired','taskType'] as const;
export type CatalogRequirement=Pick<import('./requirements').CourseRequirement,typeof requirementFields[number]>&{source_key:string;event_key?:string};
export function generalRequirement(r:Record<string,any>){return Object.fromEntries(requirementFields.filter(k=>r[k]!==undefined).map(k=>[k,r[k]])) as Omit<CatalogRequirement,'source_key'|'event_key'>;}
export type CourseTemplate={course:Omit<Course,'id'>;events:CatalogEvent[];homework?:CatalogHomework[];requirements?:CatalogRequirement[];sheet_maximum?:number;source_key?:string;revision?:string;source_snapshot?:CourseTemplate;tasks_start_on?:string;update_course?:boolean;remove_events?:string[];remove_homework?:string[]};
export type CourseCatalogEntry={id:string;name:string;payload:CourseTemplate};
export type CourseOrigin={source_key:string;revision:string;event_map:Record<string,number>;homework_map:Record<string,string>;snapshot:CourseTemplate;requirement_map?:Record<string,string>};
export const courseOriginKey=(id:number)=>`course-origin-${id}`;
export function courseOrigin(data:AppData,id:number):CourseOrigin|null{try{return JSON.parse(data.settings.find(s=>s.key===courseOriginKey(id))?.value||'null')}catch{return null}}
export const courseVisibilityKey=(courseId:number)=>`course-catalog-visible-${courseId}`;
export const courseIsVisible=(data:AppData,courseId:number)=>data.settings.some(s=>s.key===courseVisibilityKey(courseId)&&s.value==='true');
export function catalogEntries(data:AppData):CourseCatalogEntry[]{
 return data.courses.filter(c=>courseIsVisible(data,c.id)).map(c=>{
  const events=data.recurring.filter(e=>e.course_id===c.id).map(e=>({source_key:String(e.id),title:e.title,weekday:e.weekday,start_time:e.start_time,end_time:e.end_time,starts_on:e.starts_on,ends_on:e.ends_on,auto_track:e.auto_track,excluded:canceledDates(data,e.id),unplanned:unplannedDates(data,e.id)}));
  const homework=homeworkSeries(data).filter(s=>s.task.course_id===c.id&&!s.deleted&&!s.stopped&&events.some(e=>e.source_key===String(s.event_id))).map(s=>({source_key:s.id,event_key:String(s.event_id),title:s.task.title,type:s.task.type,starts_on:s.starts_on,estimate_minutes:s.task.estimate_minutes,priority:s.task.priority,tracking:s.task.tracking,...(s.numbering?{sheets:homeworkDates(data,s).filter(date=>!s.skipped.includes(date)).map(date=>{const task=data.tasks.find(t=>t.id===homeworkId(s.id,date))??data.tasks.find(t=>t.course_id===c.id&&t.type===s.task.type&&t.title===homeworkTitle(data,s,date));return {date,title:task?.title??homeworkTitle(data,s,date),deadline:task?.deadline??homeworkDeadline(data,s,date),visible:!!task}})}:{}),...(s.numbering?{numbering:s.numbering}:{}),...(s.submission?{submission:s.submission}:{})}));
  let saved:any[]=[];try{const value=JSON.parse(data.settings.find(s=>s.key===`course-requirements-${c.id}`)?.value||'[]');if(Array.isArray(value))saved=value}catch{}
  const requirements=saved.map(r=>({...generalRequirement(r),source_key:r.id,...(r.eventId?{event_key:String(r.eventId)}:{})}));
  const maximum=Number(data.settings.find(s=>s.key===`course-sheet-points-${c.id}`)?.value);
  const base={requirements,...(maximum>0&&Number.isFinite(maximum)?{sheet_maximum:maximum}:{}),course:{name:c.name,code:c.code,semester:c.semester,ects:c.ects,hours_per_ects:c.hours_per_ects,color:c.color,description:''},events,homework};
  return {id:String(c.id),name:c.name,payload:{...base,source_key:String(c.id),revision:JSON.stringify(base)}};
 });
}
export function selectCourseContents(template:CourseTemplate,eventKeys:string[],homeworkKeys:string[],_startsOn?:string):CourseTemplate{
 return {...template,source_snapshot:template,events:template.events.filter(e=>eventKeys.includes(e.source_key||'')),homework:(template.homework||[]).filter(h=>homeworkKeys.includes(h.source_key)&&eventKeys.includes(h.event_key))};
}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de-DE');
export function searchCatalog(entries:CourseCatalogEntry[],query:string){
 const words=normalize(query).trim().split(/\s+/).filter(Boolean);
 return entries.filter(e=>{const text=normalize(`${e.name} ${e.payload.course.code} ${e.payload.course.semester}`);return words.every(word=>text.includes(word))});
}
export const catalogEventKey=(e:CatalogEvent,index:number)=>e.source_key||String(index);
