import type {AppData, Course} from './types';
export const courseOrderKey='course-display-order';
export function orderedCourses(data:AppData):Course[]{
 let ids:unknown=[];try{ids=JSON.parse(data.settings.find(s=>s.key===courseOrderKey)?.value||'[]')}catch{}
 const order=Array.isArray(ids)?ids.filter((id):id is number=>typeof id==='number'):[];
 const rank=new Map(order.map((id,index)=>[id,index]));
 return [...data.courses].sort((a,b)=>(rank.get(a.id)??Infinity)-(rank.get(b.id)??Infinity));
}
export function moveCourse(ids:number[],source:number,target:number):number[]{
 if(source===target||!ids.includes(source)||!ids.includes(target))return ids;
 const next=ids.filter(id=>id!==source);next.splice(ids.indexOf(target),0,source);return next;
}
