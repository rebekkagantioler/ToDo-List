import type { AppData } from './types';

export type CourseRequirement = { id:string; title:string; unit:string; target:number; current:number };
export const requirementsKey=(courseId:number)=>`course-requirements-${courseId}`;
export function validRequirement(value:unknown):value is CourseRequirement {
 const r=value as CourseRequirement|null;
 return !!r&&typeof r.id==='string'&&!!r.id&&typeof r.title==='string'&&!!r.title.trim()&&typeof r.unit==='string'&&Number.isFinite(r.target)&&r.target>0&&Number.isFinite(r.current)&&r.current>=0;
}
export function courseRequirements(data:AppData,courseId:number):CourseRequirement[]{
 try{
  const value=JSON.parse(data.settings.find(s=>s.key===requirementsKey(courseId))?.value||'[]');
  return Array.isArray(value)?value.filter(validRequirement):[];
 }catch{return []}
}
