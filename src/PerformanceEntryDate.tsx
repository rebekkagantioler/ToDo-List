import type {AppData} from './types';
import type {CourseRequirement,PerformanceEntry} from './requirements';
import {homeworkOwner} from './homework';
import {FieldInfo} from './FieldInfo';
export function linkedEntryDate(data:AppData,entry:PerformanceEntry):{label:string;date:string|undefined}|null{
 if(entry.source.startsWith('task-')){
  const task=data.tasks.find(t=>t.id===Number(entry.source.slice(5)));
  const owner=homeworkOwner(data,Number(entry.source.slice(5)));
  return owner?{label:'Zugehöriger Übungstermin',date:owner.date}:{label:'Fälligkeit der verknüpften Aufgabe',date:task?.deadline?.slice(0,10)};
 }
 const attendance=/^lecture-attendance-\d+-(\d{4}-\d{2}-\d{2})$/.exec(entry.source);
 return attendance?{label:'Zugehöriger Übungstermin',date:attendance[1]}:null;
}
export function PerformanceEntryDate({data,entry,requirement,onChange}:{data:AppData;entry:PerformanceEntry;requirement:CourseRequirement;onChange:(date:string)=>void}){
 const linked=linkedEntryDate(data,entry);
 if(linked)return <div className="performance-linked-date"><span>{linked.label}</span><strong>{linked.date?new Date(linked.date+'T12:00').toLocaleDateString('de-AT',{weekday:'short',day:'2-digit',month:'2-digit',year:'numeric'}):'Bei der Aufgabe noch nicht festgelegt'}</strong></div>;
 return <label><span className="field-info-caption">{requirement.kind==='homework'?'Datum der Übung (optional)':'Datum der Leistung (optional)'}<FieldInfo label="Welches Datum?">Der Tag, zu dem diese Leistung gehört – nicht der Tag, an dem du sie nachträgst. Bei Übungsblättern ist das der zugehörige Übungstermin. Das Datum dient der Sortierung und gegebenenfalls dem Abgleich mit der Anwesenheit.</FieldInfo></span><input type="date" value={entry.date||''} onChange={e=>onChange(e.target.value)}/></label>;
}
