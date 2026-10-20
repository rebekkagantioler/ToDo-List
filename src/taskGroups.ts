import type {Task} from './types';
export type TaskDayGroup={key:string;title:string;detail:string;tone:'overdue'|'today'|'future'|'none';tasks:Task[]};
const dateKey=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function groupTasksByDay(tasks:Task[],now=new Date()):TaskDayGroup[]{
 const today=dateKey(now),tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);
 const todayUTC=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
 const groups=new Map<string,TaskDayGroup>();
 for(const task of tasks){
  const due=task.deadline?new Date(task.deadline):null;
  const date=due&&Number.isFinite(due.getTime())?dateKey(due):null;
  const overdue=!!date&&date<today&&task.status!=='Erledigt';
  const key=overdue?'overdue':date||'none';
  if(!groups.has(key)){
   const days=due?Math.round((Date.UTC(due.getFullYear(),due.getMonth(),due.getDate())-todayUTC)/86400000):0;
   const label=due?due.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'short',...(due.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})}):'';
   groups.set(key,{key,title:overdue?'Überfällig':date===today?'Heute':date===dateKey(tomorrow)?'Morgen':label||'Ohne Deadline',detail:overdue?'Noch offen':date===today||date===dateKey(tomorrow)?label:date&&days>0?`In ${days} Tagen`:'',tone:overdue?'overdue':date===today?'today':date?'future':'none',tasks:[]});
  }
  groups.get(key)!.tasks.push(task);
 }
 return [...groups.values()].sort((a,b)=>a.key==='overdue'?-1:b.key==='overdue'?1:a.key==='none'?1:b.key==='none'?-1:a.key.localeCompare(b.key));
}
