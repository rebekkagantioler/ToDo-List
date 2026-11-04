import type {AppData,Course} from './types';
export type Semester={id:string;name:string;start:string;end:string;averageStart:string;aliases:string[]};
export const semestersKey='semesters';
const key=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const normalized=(s:string)=>s.trim().toLocaleLowerCase('de').replace(/\s+/g,' ');
export function validSemesterDate(value:string){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(`${value}T00:00`);return Number.isFinite(date.getTime())&&key(date)===value;
}
export function semesterForDate(now=new Date()):Semester{
 const year=now.getFullYear(),month=now.getMonth();
 const winter=month>=9||month<2,startYear=month<2?year-1:year;
 const start=winter?`${startYear}-10-01`:`${year}-03-01`;
 const end=winter?key(new Date(startYear+1,2,0)):`${year}-09-30`;
 const name=winter?`WS ${startYear}/${String(startYear+1).slice(-2)}`:`SS ${year}`;
 return {id:`${winter?'ws':'ss'}-${winter?startYear:year}`,name,start,end,averageStart:start==='2026-10-01'?'2026-10-05':start,aliases:[]};
}
function inferredSemester(label:string):Semester|null{
 const match=label.trim().match(/^(WS|SS|SoSe|WiSe|Wintersemester|Sommersemester)\s*(\d{4})(?:\s*[/–-]\s*\d{2,4})?$/i);
 if(!match)return null;
 const winter=/^(WS|WiSe|Wintersemester)$/i.test(match[1]);
 const semester=semesterForDate(new Date(Number(match[2]),winter?9:2,1));
 return {...semester,aliases:[label]};
}
export function semesterError(semester:Semester,others:Semester[]=[]):string{
 if(!semester.name.trim())return 'Bitte einen Semesternamen eingeben.';
 if(![semester.start,semester.end,semester.averageStart].every(validSemesterDate))return 'Bitte gültige Datumswerte eingeben.';
 if(semester.end<semester.start)return 'Das Semesterende muss am oder nach dem Beginn liegen.';
 if(semester.averageStart<semester.start||semester.averageStart>semester.end)return 'Der Beginn für den Durchschnitt muss im Semester liegen.';
 const rest=others.filter(s=>s.id!==semester.id);
 if(rest.some(s=>[s.name,...s.aliases].some(label=>normalized(label)===normalized(semester.name))))return 'Dieser Semestername wird bereits verwendet.';
 if(rest.some(s=>semester.start<=s.end&&semester.end>=s.start))return 'Semesterzeiträume dürfen sich nicht überschneiden.';
 return '';
}
export function semesters(data:AppData,now=new Date()):Semester[]{
 try{
  const parsed=JSON.parse(data.settings.find(s=>s.key===semestersKey)?.value||'null');
  if(Array.isArray(parsed)&&parsed.length){
   const result:Semester[]=[];
   for(const item of parsed){
    if(typeof item?.id!=='string'||!item.id||typeof item.name!=='string'||![item.start,item.end,item.averageStart].every(v=>typeof v==='string')||result.some(s=>s.id===item.id))throw new Error();
    const value={...item,aliases:Array.isArray(item.aliases)?item.aliases.filter((a:unknown)=>typeof a==='string'):[]};
    if(semesterError(value,result))throw new Error();result.push(value);
   }
   return result.sort((a,b)=>a.start.localeCompare(b.start));
  }
 }catch{}
 const inferred=new Map<string,Semester>();
 for(const course of data.courses){const semester=inferredSemester(course.semester);if(!semester)continue;const previous=inferred.get(semester.id);inferred.set(semester.id,{...semester,aliases:Array.from(new Set([...(previous?.aliases||[]),...semester.aliases]))})}
 // Preserve access to earlier statistics even when their courses were removed.
 for(const session of data.sessions){for(const timestamp of [session.started_at,session.ended_at]){const date=new Date(timestamp);if(!Number.isFinite(date.getTime()))continue;const period=semesterForDate(date);if(!inferred.has(period.id))inferred.set(period.id,period)}}
 const current=semesterForDate(now);if(!inferred.has(current.id))inferred.set(current.id,current);
 return [...inferred.values()].sort((a,b)=>a.start.localeCompare(b.start));
}
export function activeSemester(items:Semester[],now=new Date()){
 const today=key(now);
 return items.find(s=>s.start<=today&&s.end>=today)||items.filter(s=>s.start<=today).at(-1)||items[0];
}
export function semesterStatus(semester:Semester,now=new Date()){
 const today=key(now);return today<semester.start?'Geplant':today>semester.end?'Abgeschlossen':'Aktuell';
}
export function courseInSemester(course:Course,semester:Semester){return [semester.name,...semester.aliases].some(name=>normalized(name)===normalized(course.semester))}

export function updateSemester(items:Semester[],draft:Semester):Semester[]{
 const error=semesterError(draft,items);if(error)throw new Error(error);
 const previous=items.find(s=>s.id===draft.id);
 const saved={...draft,name:draft.name.trim(),aliases:Array.from(new Set([...draft.aliases,...(previous&&previous.name!==draft.name.trim()?[previous.name]:[])]))};
 return [...items.filter(s=>s.id!==saved.id),saved].sort((a,b)=>a.start.localeCompare(b.start));
}
