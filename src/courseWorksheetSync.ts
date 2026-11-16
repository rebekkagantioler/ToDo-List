import type {AppData} from './types';
import type {CourseOrigin,CourseTemplate} from './catalog';
import {referenceTaskId,homeworkPlan,homeworkSeries} from './homework';

const schedule=(sheets:NonNullable<import('./homework').HomeworkSeries['reference']>)=>JSON.stringify(sheets.map(({key,date,title,deadline})=>({...(key?{key}:{}),date,title,deadline})).sort((a,b)=>a.date.localeCompare(b.date)||a.title.localeCompare(b.title)));
export function courseNeedsWorksheetSync(data:AppData,courseId:number,source:CourseTemplate,origin:CourseOrigin|null,now=new Date()){
 const worksheets=(source.homework||[]).filter(h=>h.sheets?.length);
 if(!worksheets.length)return false;
 const localSeries=homeworkSeries(data);
 for(const worksheet of worksheets){
  const local=localSeries.find(s=>s.id===origin?.homework_map?.[worksheet.source_key]&&s.task.course_id===courseId&&!s.deleted&&!s.stopped);
  if(!local?.reference||schedule(local.reference)!==schedule(worksheet.sheets!))return true;
  if(worksheet.sheets!.some(sheet=>sheet.visible&&!data.tasks.some(t=>t.id===referenceTaskId(local,sheet)&&t.course_id===courseId)))return true;
 }
 const plan=homeworkPlan(data,now);
 return [...plan.create,...plan.update,...plan.remove].some(task=>task.course_id===courseId);
}
