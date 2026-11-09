import { Check } from 'lucide-react';
import type {AppData,Course} from './types';
import {courseRequirements,examDateLabel,requirementProgress,type CourseRequirement} from './requirements';
import {courseRequirementSatisfied,evaluatePassingRule,examRuleStatus} from './passingRules';
const number=(value:number)=>value.toLocaleString('de-AT',{maximumFractionDigits:2});
export function examTaken(r:CourseRequirement){return !!r.examTaken||r.examResult==='passed'||r.examResult==='failed'||r.examEarned!==undefined||!!r.examGrade?.trim()}
export function PerformanceChecklist({data,course,onOpen}:{data:AppData;course:Course;onOpen?:()=>void}){
 const rows=courseRequirements(data,course.id),evaluation=evaluatePassingRule(data,course.id);
 return <section className="performance-checklist" aria-label={`Leistungen: ${course.name}`}><div className="passing-heading"><h3>{course.name}</h3>{onOpen&&<button className="text-btn" onClick={onOpen}>Details</button>}</div>
 <ul>{rows.map(r=>{
  const p=requirementProgress(data,r),fulfilled=courseRequirementSatisfied(data,course.id,r),taken=r.kind==='exam'&&examTaken(r),done=r.kind==='exam'?taken:fulfilled;
  const examStatus=examRuleStatus(data,course.id,r),component=evaluation&&!evaluation.error?evaluation.groups.find(x=>x.group.requirementIds.includes(r.id)):undefined;
  const minimum=component?.group.minimum!=null?`${number(component.group.minimum)} %`:`${number(r.target)} ${r.percentage?'%':r.unit}`;
  const detail=r.kind==='exam'?taken?(fulfilled?'Abgelegt · Mindestleistung erfüllt':examStatus==='unmet'||r.examResult==='failed'?'Abgelegt · Mindestleistung nicht erfüllt':'Abgelegt · Bewertung offen'):examDateLabel(r):r.kind==='homework'?`${fulfilled?'Mindestleistung erreicht':'Mindestleistung noch offen'} (mindestens ${minimum}) · ${r.percentage?`${number(p.value)} %`:`${number(p.amount)} ${r.unit}`}`:`${number(p.amount)} von ${number(r.target)} ${r.unit}`;
  return <li key={r.id}><span className={`performance-checkmark ${done?'done':''}`} aria-label={done?'Erledigt':'Noch offen'}>{done&&<Check size={15}/>}</span><div><strong>{r.title}</strong><small>{detail}</small></div></li>;
 })}
 {evaluation&&!evaluation.error&&evaluation.groups.filter(x=>x.group.minimum!==null&&x.members.length>1).map(x=><li key={`minimum-${x.group.id}`}><span className={`performance-checkmark ${x.status==='met'?'done':''}`} aria-label={x.status==='met'?'Erfüllt':'Noch offen'}>{x.status==='met'&&<Check size={15}/>}</span><div><strong>{x.group.title}: mindestens {number(x.group.minimum!)} %{x.group.examMode==='each'&&x.members.length>1&&x.members.every(r=>r.kind==='exam')?' je Klausur':''}</strong><small>{x.percentage===null?'Ergebnis noch offen':`Aktuell ${number(x.percentage)} %`}{x.group.weight!==null?` · Gewicht ${number(x.group.weight)} %`:''}</small></div></li>)}
 {evaluation&&!evaluation.error&&evaluation.rule.overallMinimum!==null&&<li><span className={`performance-checkmark ${evaluation.overall!==null&&evaluation.overall>=evaluation.rule.overallMinimum?'done':''}`} aria-label={evaluation.overall!==null&&evaluation.overall>=evaluation.rule.overallMinimum?'Erfüllt':'Noch offen'}>{evaluation.overall!==null&&evaluation.overall>=evaluation.rule.overallMinimum&&<Check size={15}/>}</span><div><strong>Gesamtergebnis: mindestens {number(evaluation.rule.overallMinimum)} %</strong><small>{evaluation.overall===null?'Ergebnis noch offen':`Aktuell ${number(evaluation.overall)} %`}</small></div></li>}
 </ul>{!rows.length&&<p className="muted">Noch keine Anforderungen eingetragen.</p>}{evaluation?.error&&<p className="save-error">Bestehensregel prüfen: {evaluation.error}</p>}
 </section>;
}
