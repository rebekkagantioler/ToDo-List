import type {AppData} from './types';
import type {PerformanceEntry} from './requirements';
const naturalOrder=new Intl.Collator('de-AT',{numeric:true,sensitivity:'base'});
export function orderedPerformanceEntries(data:AppData,entries:PerformanceEntry[]):PerformanceEntry[]{
 const date=(entry:PerformanceEntry)=>{
  const task=entry.source.startsWith('task-')?data.tasks.find(t=>t.id===Number(entry.source.slice(5))):undefined;
  for(const value of [entry.date,task?.deadline,task?.completed_at,task?.created_at]){
   if(typeof value==='string'&&Number.isFinite(Date.parse(value)))return Date.parse(value);
  }
  return null;
 };
 const rows=entries.map(entry=>({entry,date:date(entry)}));
 rows.sort((a,b)=>{
  if(a.date!==null&&b.date!==null&&a.date!==b.date)return b.date-a.date;
  if(a.date!==null&&b.date===null)return -1;
  if(a.date===null&&b.date!==null)return 1;
  return naturalOrder.compare(b.entry.label,a.entry.label)||a.entry.source.localeCompare(b.entry.source);
 });
 return rows.map(row=>row.entry);
}
