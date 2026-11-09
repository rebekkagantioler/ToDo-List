import type {AppData,Course} from './types';
import {courseRequirements,type RequirementKind} from './requirements';
import {courseRequirementSatisfied,evaluatePassingRule} from './passingRules';
type Area=RequirementKind|'rule';
const areaLabels:Record<Area,string>={exam:'Prüfungen',homework:'Übungspunkte',reflection:'Texte & Feedback',presentation:'Vorrechnen',other:'Weitere',rule:'Bestehensregel'};
export function courseAchievementSteps(data:AppData,courseId:number){
 const steps:{id:string;title:string;area:Area;done:boolean}[]=courseRequirements(data,courseId).map(r=>({id:r.id,title:r.title,area:r.kind||'other',done:courseRequirementSatisfied(data,courseId,r)}));
 const evaluation=evaluatePassingRule(data,courseId);
 if(evaluation?.error)steps.push({id:'rule-error',title:'Bestehensregel prüfen',area:'rule',done:false});
 else if(evaluation){
  for(const item of evaluation.groups.filter(x=>x.group.minimum!==null&&x.members.length>1))steps.push({id:`minimum-${item.group.id}`,title:`${item.group.title}: Mindestleistung`,area:'rule',done:item.status==='met'});
  if(evaluation.rule.overallMinimum!==null)steps.push({id:'overall',title:'Gesamtschwelle',area:'rule',done:evaluation.overall!==null&&evaluation.overall+1e-9>=evaluation.rule.overallMinimum});
 }
 return steps;
}
export function CourseAchievementProgress({data,course}:{data:AppData;course:Course}){
 const steps=courseAchievementSteps(data,course.id),done=steps.filter(s=>s.done).length;
 if(!steps.length)return null;
 const areas=Array.from(new Set(steps.map(s=>s.area)));
 return <div className="course-achievement-progress"><div className="achievement-progress-label"><span>Fortschritt</span><strong>{done} von {steps.length} erfüllt</strong></div><div className="achievement-segments" role="progressbar" aria-label={`${course.name}: erfüllte Voraussetzungen`} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-valuetext={`${done} von ${steps.length} Voraussetzungen erfüllt`}>{steps.map(step=><span key={step.id} data-area={step.area} className={step.done?'complete':''} title={`${step.title}: ${step.done?'erfüllt':'noch offen'}`}/>)}</div>{areas.length>1&&<div className="achievement-legend">{areas.map(area=><span key={area}><i data-area={area}/>{areaLabels[area]}</span>)}</div>}</div>;
}
