import type {AppData, Course, RecurringEvent, Task} from './types';
import {canceledDates, unplannedDates, occurrenceDates} from './statistics';
import {homeworkSeries, homeworkDates, homeworkTitle, homeworkDeadline, homeworkId, homeworkOwner, referenceTaskId, worksheetNumber, type WorksheetReference, type HomeworkSeries} from './homework';
export type CatalogTask=Pick<Task,'title'|'type'|'deadline'|'estimate_minutes'|'priority'|'tracking'>&{source_key:string;homework_key?:string;occurrence_on?:string;sheet_key?:string};
export type CatalogEvent=Omit<RecurringEvent,'id'|'course_id'>&{source_key?:string;excluded:string[];unplanned?:string[]};
export type CatalogHomework={source_key:string;event_key:string;title:string;type:string;starts_on:string;estimate_minutes:number;priority:string;tracking:number;numbering?:HomeworkSeries['numbering'];submission?:HomeworkSeries['submission'];sheets?:HomeworkSeries['reference']};
export const requirementFields=['title','unit','target','kind','dateMode','date','time','bookingDeadline','examScoreType','percentage','pointsPerSheet','maximumPoints','worksheetCount','dropLowest','attendanceRequired','taskType'] as const;
export type CatalogRequirement=Pick<import('./requirements').CourseRequirement,typeof requirementFields[number]>&{source_key:string;event_key?:string};
export function generalRequirement(r:Record<string,any>){return Object.fromEntries(requirementFields.filter(k=>r[k]!==undefined).map(k=>[k,r[k]])) as Omit<CatalogRequirement,'source_key'|'event_key'>;}
export type CourseTemplate={course:Omit<Course,'id'>;events:CatalogEvent[];homework?:CatalogHomework[];tasks?:CatalogTask[];requirements?:CatalogRequirement[];sheet_maximum?:number;source_key?:string;revision?:string;source_snapshot?:CourseTemplate;tasks_start_on?:string;update_course?:boolean;remove_events?:string[];remove_homework?:string[]};
export type CourseCatalogEntry={id:string;name:string;payload:CourseTemplate};
export type CourseOrigin={source_key:string;revision:string;event_map:Record<string,number>;homework_map:Record<string,string>;snapshot:CourseTemplate;requirement_map?:Record<string,string>;task_map?:Record<string,number>};
export const courseOriginKey=(id:number)=>`course-origin-${id}`;
export function courseOrigin(data:AppData,id:number):CourseOrigin|null{try{return JSON.parse(data.settings.find(s=>s.key===courseOriginKey(id))?.value||'null')}catch{return null}}
export const courseVisibilityKey=(courseId:number)=>`course-catalog-visible-${courseId}`;
export const courseIsVisible=(data:AppData,courseId:number)=>data.settings.some(s=>s.key===courseVisibilityKey(courseId)&&s.value==='true');
export function catalogEntries(data:AppData):CourseCatalogEntry[]{
 return data.courses.filter(c=>courseIsVisible(data,c.id)).map(c=>{
  const events=data.recurring.filter(e=>e.course_id===c.id).map(e=>({source_key:String(e.id),title:e.title,weekday:e.weekday,start_time:e.start_time,end_time:e.end_time,starts_on:e.starts_on,ends_on:e.ends_on,auto_track:e.auto_track,excluded:canceledDates(data,e.id),unplanned:unplannedDates(data,e.id)}));
  const homework=homeworkSeries(data).filter(s=>s.task.course_id===c.id&&!s.deleted&&!s.stopped&&events.some(e=>e.source_key===String(s.event_id))).map(s=>({source_key:s.id,event_key:String(s.event_id),title:s.task.title,type:s.task.type,starts_on:s.starts_on,estimate_minutes:s.task.estimate_minutes,priority:s.task.priority,tracking:s.task.tracking,...(s.numbering?{sheets:catalogWorksheetSheets(data,s)}:{}),...(s.numbering?{numbering:s.numbering}:{}),...(s.submission?{submission:s.submission}:{})}));
  let saved:any[]=[];try{const value=JSON.parse(data.settings.find(s=>s.key===`course-requirements-${c.id}`)?.value||'[]');if(Array.isArray(value))saved=value}catch{}
  const requirements=saved.map(r=>({...generalRequirement(r),source_key:r.id,...(r.eventId?{event_key:String(r.eventId)}:{})}));
  const maximum=Number(data.settings.find(s=>s.key===`course-sheet-points-${c.id}`)?.value);
  const tasks=data.tasks.filter(t=>t.course_id===c.id&&t.area==='Universität').sort((a,b)=>a.title.localeCompare(b.title)||a.type.localeCompare(b.type)||(a.deadline??'').localeCompare(b.deadline??'')||a.id-b.id).map(t=>{
   const task:CatalogTask={source_key:String(t.id),title:t.title,type:t.type,deadline:t.deadline,estimate_minutes:t.estimate_minutes,priority:t.priority,tracking:t.tracking};
   const owner=homeworkOwner(data,t.id);
   for(const h of homework){
    if(h.type!==t.type)continue;
    const number=worksheetNumber(t.title,h.title);
    const sheet=h.sheets?.find(s=>s.title===t.title||number!==null&&worksheetNumber(s.title,h.title)===number);
    if(sheet){Object.assign(task,{homework_key:h.source_key,occurrence_on:sheet.date,...(sheet.key?{sheet_key:sheet.key}:{})});break;}
    if(owner?.series.id===h.source_key){Object.assign(task,{homework_key:h.source_key,occurrence_on:owner.date});break;}
   }
   return task;
  });
  const base={tasks,requirements,...(maximum>0&&Number.isFinite(maximum)?{sheet_maximum:maximum}:{}),course:{name:c.name,code:c.code,semester:c.semester,ects:c.ects,hours_per_ects:c.hours_per_ects,color:c.color,description:''},events,homework};
  return {id:String(c.id),name:c.name,payload:{...base,source_key:String(c.id),revision:JSON.stringify(base)}};
 });
}
// Earlier sheets can be standalone tasks or belong to a retired series. Their
// recorded deadlines are authoritative even when the active series starts later.
export function catalogWorksheetSheets(data:AppData,series:HomeworkSeries){
 const event=data.recurring.find(e=>e.id===series.event_id);
 let sheets:WorksheetReference[]=series.reference?series.reference.filter(sheet=>!series.skipped.includes(sheet.date)).map(sheet=>{const task=data.tasks.find(t=>t.id===referenceTaskId(series,sheet));return {...sheet,title:task?.title??sheet.title,deadline:task?.deadline??sheet.deadline,visible:!!task}}):homeworkDates(data,series).filter(date=>!series.skipped.includes(date)).map(date=>{
  const task=data.tasks.find(t=>t.id===homeworkId(series.id,date));
  return {date,title:task?.title??homeworkTitle(data,series,date),deadline:task?.deadline??homeworkDeadline(data,series,date),visible:!!task};
 });
 if(!event)return sheets;
 const tasks=data.tasks.filter(t=>t.course_id===series.task.course_id&&t.type===series.task.type&&worksheetNumber(t.title,series.task.title)!==null&&t.deadline).sort((a,b)=>a.id-b.id);
 const seen=new Set<string>();
 for(const task of tasks){
  const number=worksheetNumber(task.title,series.task.title)!;
  if(seen.has(number))continue;seen.add(number);
  const previous=sheets.find(sheet=>worksheetNumber(sheet.title,series.task.title)===number);
  const owned=sheets.find(sheet=>referenceTaskId(series,sheet)===task.id)?.date??occurrenceDates(event).find(date=>homeworkId(series.id,date)===task.id);
  const day=new Date(`${task.deadline!.slice(0,10)}T12:00:00`);if(!Number.isFinite(day.getTime()))continue;
  day.setDate(day.getDate()+(series.submission?.days_before??0));
  day.setDate(day.getDate()+(event.weekday-day.getDay()+7)%7);
  const date=owned??`${day.getFullYear()}-${String(day.getMonth()+1).padStart(2,'0')}-${String(day.getDate()).padStart(2,'0')}`;
  sheets=sheets.filter(s=>worksheetNumber(s.title,series.task.title)!==number);
  sheets.push({...(previous?.key?{key:previous.key}:{}),date,title:task.title,deadline:task.deadline!,visible:true});
 }
 return sheets.map(sheet=>sheets.filter(other=>other.date===sheet.date).length>1?{...sheet,key:sheet.key??`number:${worksheetNumber(sheet.title,series.task.title)??sheet.title}`} :sheet).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title,undefined,{numeric:true}));
}
export function selectCourseContents(template:CourseTemplate,eventKeys:string[],homeworkKeys:string[],_startsOn?:string):CourseTemplate{
 return {...template,source_snapshot:template,tasks:template.tasks?.filter(t=>!t.homework_key||homeworkKeys.includes(t.homework_key)&&template.homework?.some(h=>h.source_key===t.homework_key&&eventKeys.includes(h.event_key))),events:template.events.filter(e=>eventKeys.includes(e.source_key||'')),homework:(template.homework||[]).filter(h=>homeworkKeys.includes(h.source_key)&&eventKeys.includes(h.event_key))};
}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de-DE');
export function searchCatalog(entries:CourseCatalogEntry[],query:string){
 const words=normalize(query).trim().split(/\s+/).filter(Boolean);
 return entries.filter(e=>{const text=normalize(`${e.name} ${e.payload.course.code} ${e.payload.course.semester}`);return words.every(word=>text.includes(word))});
}
export const catalogEventKey=(e:CatalogEvent,index:number)=>e.source_key||String(index);
