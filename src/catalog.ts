import type {AppData, Course, RecurringEvent} from './types';
import {excludedDates} from './statistics';
export type CourseCatalogEntry={id:string;name:string;payload:{course:Omit<Course,'id'>;events:(Omit<RecurringEvent,'id'|'course_id'>&{excluded:string[]})[]}};
export const courseVisibilityKey=(courseId:number)=>`course-catalog-visible-${courseId}`;
export const courseIsVisible=(data:AppData,courseId:number)=>data.settings.some(s=>s.key===courseVisibilityKey(courseId)&&s.value==='true');
export function catalogEntries(data:AppData):CourseCatalogEntry[]{
 return data.courses.filter(c=>courseIsVisible(data,c.id)).map(c=>({id:String(c.id),name:c.name,payload:{course:{name:c.name,code:c.code,semester:c.semester,ects:c.ects,hours_per_ects:c.hours_per_ects,color:c.color,description:''},events:data.recurring.filter(e=>e.course_id===c.id).map(e=>({title:e.title,weekday:e.weekday,start_time:e.start_time,end_time:e.end_time,starts_on:e.starts_on,ends_on:e.ends_on,auto_track:e.auto_track,excluded:excludedDates(data,e.id)}))}}));
}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('de-DE');
export function searchCatalog(entries:CourseCatalogEntry[],query:string){
 const words=normalize(query).trim().split(/\s+/).filter(Boolean);
 return entries.filter(e=>{const text=normalize(`${e.name} ${e.payload.course.code} ${e.payload.course.semester}`);return words.every(word=>text.includes(word))});
}
