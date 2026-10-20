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

export type TaskWeekGroup={key:string;title:string;range:string;count:number;days:TaskDayGroup[]};
export function groupTaskDaysByWeek(days:TaskDayGroup[],now=new Date()):TaskWeekGroup[]{
 const monday=(date:Date)=>{const d=new Date(date);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d};
 const current=monday(now),calendarTime=(d:Date)=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
 const weeks=new Map<string,TaskWeekGroup>();
 for(const day of days){
  const dated=/^\d{4}-\d{2}-\d{2}$/.test(day.key),start=dated?monday(new Date(`${day.key}T12:00`)):null;
  const key=start?dateKey(start):day.key;
  if(!weeks.has(key)){
   const offset=start?Math.round((calendarTime(start)-calendarTime(current))/604800000):0;
   const end=start?new Date(start):null;if(end)end.setDate(end.getDate()+6);
   const label=(d:Date)=>d.toLocaleDateString('de-DE',{day:'numeric',month:'short',...(d.getFullYear()!==now.getFullYear()?{year:'numeric'}:{})});
   weeks.set(key,{key,title:!start?'':offset===0?'Diese Woche':offset===1?'Nächste Woche':offset===2?'Übernächste Woche':offset===-1?'Letzte Woche':`Woche ab ${label(start)}`,range:start&&end?`${label(start)} – ${label(end)}`:'',count:0,days:[]});
  }
  const week=weeks.get(key)!;week.days.push(day);week.count+=day.tasks.length;
 }
 return [...weeks.values()];
}
