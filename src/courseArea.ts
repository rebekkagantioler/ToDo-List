import type { AppData, Course } from './types';
import { courseOf } from './statistics';
export const courseAreaKey=(id:number)=>`course-area-${id}`;
export function isPrivateCourse(course:Course,data:AppData){
 const saved=data.settings.find(s=>s.key===courseAreaKey(course.id))?.value;
 if(saved==='Privat'||saved==='Universität')return saved==='Privat';
 return course.name.toLocaleLowerCase('de').replace(/[\s-]+/g,'').includes('kapellmeisterkurs');
}
export function privateCourseIds(data:AppData){return new Set(data.courses.filter(c=>isPrivateCourse(c,data)).map(c=>c.id))}
export function statisticsData(data:AppData):AppData{
 const excluded=privateCourseIds(data);
 return {...data,tasks:data.tasks.filter(t=>!excluded.has(t.course_id!)),sessions:data.sessions.filter(s=>!excluded.has(courseOf(s,data)!)),recurring:data.recurring.filter(e=>!excluded.has(e.course_id!))};
}
