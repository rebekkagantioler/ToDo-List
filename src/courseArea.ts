import type { AppData, Course, Task } from './types';
import { courseOf } from './statistics';
import { categoryCounts } from './privateCategories';
export const courseAreaKey=(id:number)=>`course-area-${id}`;
export function isPrivateCourse(course:Course,data:AppData){
 const saved=data.settings.find(s=>s.key===courseAreaKey(course.id))?.value;
 if(saved==='Privat'||saved==='Universität')return saved==='Privat';
 return course.name.toLocaleLowerCase('de').replace(/[\s-]+/g,'').includes('kapellmeisterkurs');
}
export function privateCourseIds(data:AppData){return new Set(data.courses.filter(c=>isPrivateCourse(c,data)).map(c=>c.id))}
export function statisticsData(data:AppData):AppData{
 const excluded=new Set(data.courses.filter(c=>isPrivateCourse(c,data)&&!categoryCounts(data,c.name)).map(c=>c.id));
 const excludedTasks=new Set(data.tasks.filter(t=>excluded.has(t.course_id!)||(t.area==='Privat'&&!categoryCounts(data,t.type))).map(t=>t.id));
 return {...data,tasks:data.tasks.filter(t=>!excludedTasks.has(t.id)),sessions:data.sessions.filter(s=>!excluded.has(courseOf(s,data)!)&&!excludedTasks.has(s.task_id!)),recurring:data.recurring.filter(e=>!excluded.has(e.course_id!))};
}

export function privateTaskView(task:Task,data:AppData):Task{
 const course=data.courses.find(c=>c.id===task.course_id&&isPrivateCourse(c,data));
 return course?{...task,area:'Privat',type:course.name,course_name:undefined}:task;
}
export function preservePrivateCourseTask(edited:Task,original:Task,data:AppData):Task{
 return privateCourseIds(data).has(original.course_id!)?{...edited,area:original.area,course_id:original.course_id,type:original.type}:edited;
}
