import {examTaken} from './PerformanceChecklist';
import type {AppData,Course} from './types';
import {courseRequirements,requirementProgress,type RequirementKind} from './requirements';
import {courseRequirementSatisfied,evaluatePassingRule} from './passingRules';
type Area=RequirementKind|'rule';
const areaLabels:Record<Area,string>={exam:'Prüfungen',homework:'Übungspunkte',reflection:'Texte & Feedback',presentation:'Vorrechnen',other:'Weitere',rule:'Bestehensregel'};
export function courseAchievementSteps(data:AppData,courseId:number){
 const steps:{id:string;title:string;area:Area;done:boolean;progress:number|null}[]=courseRequirements(data,courseId).map(r=>{
  const p=requirementProgress(data,r),maximum=p.worksheet?.maximum??r.maximumPoints;
  const progress=r.kind==='exam'?(examTaken(r)?1:0):r.kind==='homework'?(maximum? p.amount/maximum:null):p.amount/r.target;
  return {id:r.id,title:r.title,area:r.kind||'other',done:courseRequirementSatisfied(data,courseId,r),progress:progress===null?null:Math.max(0,Math.min(1,progress))};
 });
 const evaluation=evaluatePassingRule(data,courseId);
 if(evaluation?.error)steps.push({id:'rule-error',title:'Bestehensregel prüfen',area:'rule',done:false,progress:0});
 else if(evaluation){
  for(const item of evaluation.groups.filter(x=>x.group.minimum!==null&&x.members.length>1))steps.push({id:`minimum-${item.group.id}`,title:`${item.group.title}: Mindestleistung`,area:'rule',done:item.status==='met',progress:item.status==='met'?1:0});
  if(evaluation.rule.overallMinimum!==null)steps.push({id:'overall',title:'Gesamtschwelle',area:'rule',done:evaluation.overall!==null&&evaluation.overall+1e-9>=evaluation.rule.overallMinimum,progress:evaluation.overall!==null&&evaluation.overall+1e-9>=evaluation.rule.overallMinimum?1:0});
 }
 return steps;
}
export function CourseAchievementProgress({data,course}:{data:AppData;course:Course}){
 const steps=courseAchievementSteps(data,course.id),done=steps.filter(s=>s.done).length;
 if(!steps.length)return null;
 const percentage=steps.some(s=>s.progress===null)?null:Math.round(steps.reduce((sum,s)=>sum+(s.progress??0),0)/steps.length*100);
 const pointsOnly=steps.every(s=>s.area==='homework'),label=pointsOnly?'Punktefortschritt':'Leistungsfortschritt';
 const areas=Array.from(new Set(steps.map(s=>s.area)));
 return <div className="course-achievement-progress"><div className="achievement-progress-label"><span>{label}</span><strong>{percentage===null?'–':`${percentage} %`}</strong></div>{percentage===null?<p className="muted">Gesamtpunkte noch nicht festgelegt</p>:<div className="achievement-segments" role="progressbar" aria-label={`${course.name}: ${label}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} aria-valuetext={`${percentage} Prozent${pointsOnly?' der möglichen Punkte':''}; ${done} von ${steps.length} Voraussetzungen erfüllt`}>{steps.map(step=><span key={step.id} data-area={step.area} title={`${step.title}: ${Math.round((step.progress??0)*100)} %${step.area==='homework'?' der möglichen Punkte':''}${step.done?' · Mindestleistung erfüllt':''}`}><i style={{width:`${(step.progress??0)*100}%`}}/></span>)}</div>}<p className="achievement-fulfilled-count">{done} von {steps.length} Voraussetzungen erfüllt</p>{areas.length>1&&<div className="achievement-legend">{areas.map(area=><span key={area}><i data-area={area}/>{areaLabels[area]}</span>)}</div>}</div>;
}
