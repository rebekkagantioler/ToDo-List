import type { AppData, Task } from './types';

export function enrichData(data: AppData): AppData {
 const tasks=data.tasks.map(task=>{
  const course=data.courses.find(c=>c.id===task.course_id);
  return {...task,course_name:course?.name,course_color:course?.color};
 });
 const blocks=data.blocks.map(block=>{
  const task=tasks.find(t=>t.id===block.task_id);
  const course=data.courses.find(c=>c.id===(task?.course_id??block.course_id));
  return {...block,task_title:task?.title,course_name:course?.name,course_color:course?.color};
 });
 return {...data,tasks,blocks};
}

export function applySavedRecord(data:AppData, path:string, method:string, body:unknown, result:any):AppData {
 const [resource,id]=path.slice(1).split('/');
 const key=resource as keyof AppData;
 const rows=data[key] as any[];
 if(!Array.isArray(rows))return data;
 const record={...(body as object),...result,id:id?Number(id):result.id};
 if(resource==='tasks'){
  record.tracking=record.tracking?1:0;
  record.course_id=record.area==='Privat'?null:record.course_id||null;
  record.deadline=record.deadline||null;
  record.created_at=record.created_at||new Date().toISOString();
  record.completed_at=record.status==='Erledigt'?(record.completed_at||new Date().toISOString()):null;
 }
 let updated=data;
 if(method==='DELETE'&&resource==='courses'){
  const detach=(row:any)=>row.course_id===Number(id)?{...row,course_id:null}:row;
  updated={...data,tasks:data.tasks.map(detach),sessions:data.sessions.map(detach),blocks:data.blocks.map(detach),recurring:data.recurring.filter(row=>row.course_id!==Number(id))};
 }
 if(method==='DELETE'&&resource==='tasks')updated={...data,sessions:data.sessions.filter(row=>row.task_id!==Number(id)),blocks:data.blocks.filter(row=>row.task_id!==Number(id))};
 return enrichData({...updated,[key]:method==='DELETE'?rows.filter(row=>row.id!==Number(id)):method==='PUT'?rows.map(row=>row.id===Number(id)?{...row,...record}:row):[...rows,record]});
}

export function byDeadline(a:Task,b:Task){
 return (a.deadline||'9999').localeCompare(b.deadline||'9999')||a.title.localeCompare(b.title,'de');
}
