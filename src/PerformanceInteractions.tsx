import { HomeworkPointsFields } from './HomeworkPointsFields';
import {useRef,useState} from 'react';
import type {AppData} from './types';
import {entryKey,isSkipped,performanceQuestions,skippedKey,type PerformanceQuestion,type PerformanceEntry} from './requirements';
type Mutate=(path:string,method?:string,body?:any)=>Promise<any>;

type Pending={questions:PerformanceQuestion[];resolve:(entries:PerformanceEntry[]|null)=>void};
export function usePerformanceMutations(data:AppData,raw:Mutate){
 const [pending,setPending]=useState<Pending|null>(null);
 const busy=useRef(false);
 const mutate:Mutate=async(path,method='POST',body)=>{
  if(busy.current)throw new Error('Bitte zuerst die offene Leistungsabfrage abschließen.');
  const taskId=/^\/tasks\/(\d+)$/.exec(path)?.[1];
  const task=taskId?data.tasks.find(t=>t.id===Number(taskId)):undefined;
  const questions=performanceQuestions(data,path,method,body);
  if(questions.length){
   busy.current=true;
   try{
    const entries=await new Promise<PerformanceEntry[]|null>(resolve=>setPending({questions,resolve}));
    setPending(null);
    if(entries===null)throw new Error('Abgebrochen – der bisherige Stand bleibt erhalten.');
    for(const entry of entries)await raw(`/settings/${entryKey(entry.requirementId,entry.source)}`,'PUT',{value:JSON.stringify(entry)});
    if(task&&isSkipped(data,task.id))await raw(`/settings/${skippedKey(task.id)}`,'PUT',{value:'no'});
    return await raw(path,method,body);
   }finally{busy.current=false}
  }
  if(task&&method==='PUT'&&body?._skip){await raw(`/settings/${skippedKey(task.id)}`,'PUT',{value:'yes'});const {_skip,...record}=body;return raw(path,method,record)}
  if(task&&method==='PUT'&&isSkipped(data,task.id))await raw(`/settings/${skippedKey(task.id)}`,'PUT',{value:'no'});
  return raw(path,method,body);
 };
 return {mutate,performanceDialog:pending?<PerformanceDialog key={pending.questions.map(q=>q.source+q.requirement.id).join()} pending={pending}/>:null};
}
function PerformanceDialog({pending}:{pending:Pending}){
 const [values,setValues]=useState(pending.questions.map(q=>({amount:q.requirement.kind==='homework'?'':'1',possible:q.pointsMaximum===undefined?'':String(q.pointsMaximum),answer:''})));
 const needsAnswer=pending.questions.some((q,i)=>q.requirement.kind==='presentation'&&!values[i].answer);
 const valid=!needsAnswer&&values.every((v,i)=>pending.questions[i].requirement.kind!=='homework'||v.amount!==''&&v.possible!==''&&Number.isFinite(Number(v.amount))&&Number(v.amount)>=0&&Number(v.possible)>0&&Number(v.amount)<=Number(v.possible));
 return <div className="modal-backdrop"><form className="modal" onSubmit={e=>{e.preventDefault();if(valid)pending.resolve(pending.questions.map((q,i)=>({requirementId:q.requirement.id,source:q.source,label:q.label,date:q.date,amount:q.requirement.kind==='presentation'?(values[i].answer==='yes'?1:0):Number(values[i].amount),...(q.requirement.kind==='homework'?{possible:Number(values[i].possible)}:{})})))}}><div className="modal-head"><h2>Leistung eintragen</h2></div>{pending.questions.map((q,i)=><div className="requirement-form" key={q.requirement.id}><h3>{q.requirement.title}</h3><p>{q.label}</p>{q.requirement.kind==='homework'?<HomeworkPointsFields fixedMaximum={q.pointsMaximum} amount={values[i].amount} possible={values[i].possible} onChange={points=>setValues(v=>v.map((x,j)=>j===i?{...x,...points}:x))}/>:q.requirement.kind==='presentation'?<label>Hast du bei diesem Termin vorgerechnet?<select required value={values[i].answer} onChange={e=>setValues(v=>v.map((x,j)=>j===i?{...x,answer:e.target.value}:x))}><option value="">Bitte auswählen</option><option value="yes">Ja</option><option value="no">Nein</option></select></label>:<p>Diese Aufgabe zählt als eine erledigte Leistung.</p>}</div>)}<div className="modal-actions"><button type="button" className="secondary" onClick={()=>pending.resolve(null)}>Abbrechen</button><button className="primary" disabled={!valid}>Speichern & bestätigen</button></div></form></div>;
}
