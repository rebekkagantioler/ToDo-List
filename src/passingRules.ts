import type { AppData } from './types';
import { courseRequirements, requirementProgress, missingHomeworkResults, type CourseRequirement } from './requirements';

export type PassingGroup = {
 id:string;
 title:string;
 requirementIds:string[];
 weight:number|null;
 minimum:number|null;
 mustFulfill:boolean;
 examMode:'each'|'combined';
 aggregation:'points'|'average';
};
export type PassingRule = {
 groups:PassingGroup[];
 overallMinimum:number|null;
 gradeScale:{grade:string;percentage:number}[];
};
export const passingRuleKey=(courseId:number)=>`course-passing-rule-${courseId}`;
export const emptyPassingRule=():PassingRule=>({groups:[],overallMinimum:null,gradeScale:[]});
const percent=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=100;
const normalizeGrade=(value:string)=>value.trim().toLocaleLowerCase('de-AT');
export function validPassingRule(value:unknown):value is PassingRule{
 const r=value as PassingRule|null;
 return !!r&&Array.isArray(r.groups)&&(r.overallMinimum===null||percent(r.overallMinimum))&&Array.isArray(r.gradeScale)
  &&r.gradeScale.every(x=>x&&typeof x.grade==='string'&&!!x.grade.trim()&&percent(x.percentage))
  &&r.groups.every(g=>g&&typeof g.id==='string'&&!!g.id&&typeof g.title==='string'&&!!g.title.trim()&&Array.isArray(g.requirementIds)&&g.requirementIds.every(id=>typeof id==='string')&&(g.weight===null||percent(g.weight))&&(g.minimum===null||percent(g.minimum))&&typeof g.mustFulfill==='boolean'&&['each','combined'].includes(g.examMode)&&['points','average'].includes(g.aggregation));
}
export function coursePassingRule(data:AppData,courseId:number):PassingRule|null{
 try{const r=JSON.parse(data.settings.find(s=>s.key===passingRuleKey(courseId))?.value||'null');return validPassingRule(r)?r:null}catch{return null}
}
export function passingRuleError(rule:PassingRule,requirements:CourseRequirement[]):string{
 if(!validPassingRule(rule))return 'Bitte gültige Bezeichnungen und Prozentwerte zwischen 0 und 100 eingeben.';
 if(new Set(rule.groups.map(g=>g.id)).size!==rule.groups.length)return 'Jeder Bestandteil braucht eine eigene Kennung.';
 const assigned=new Set<string>();
 for(const group of rule.groups){
  if(!group.requirementIds.length)return `Bitte für „${group.title}“ mindestens eine Anforderung auswählen.`;
  for(const id of group.requirementIds){
   if(!requirements.some(r=>r.id===id))return `Eine Anforderung in „${group.title}“ wurde entfernt. Bitte die Regel aktualisieren.`;
   if(assigned.has(id))return 'Jede Anforderung darf nur einem Bestandteil zugeordnet sein.';
   assigned.add(id);
  }
  if(group.examMode==='combined'&&group.mustFulfill&&group.minimum===null)return `Für „${group.title}“ bitte eine gemeinsame Mindestleistung eintragen oder die zusätzliche Pflicht deaktivieren.`;
  if(group.examMode==='combined'&&!group.requirementIds.every(id=>requirements.find(r=>r.id===id)?.kind==='exam'))return 'Nur Klausuren können zu einem gemeinsamen Prüfungsergebnis zusammengefasst werden.';
 }
 const weights=rule.groups.filter(g=>g.weight!==null);
 if(weights.length&&Math.abs(weights.reduce((sum,g)=>sum+g.weight!,0)-100)>0.000001)return 'Die eingetragenen Gewichtungen müssen zusammen 100 % ergeben. Nicht gewichtete Voraussetzungen können leer bleiben.';
 if(rule.overallMinimum!==null&&!weights.length)return 'Für eine Gesamtschwelle bitte Gewichtungen eintragen (zusammen 100 %).';
 const grades=rule.gradeScale.map(x=>normalizeGrade(x.grade));
 if(new Set(grades).size!==grades.length)return 'Jede Note darf im Bewertungsschlüssel nur einmal vorkommen.';
 return '';
}
export type RequirementScore={percentage:number|null;earned:number|null;possible:number|null};
export function requirementScore(data:AppData,r:CourseRequirement,rule:PassingRule):RequirementScore{
 if(r.kind==='exam'){
  if(r.examScoreType==='grade'){
   const mapped=rule.gradeScale.find(x=>normalizeGrade(x.grade)===normalizeGrade(r.examGrade||''));
   return {percentage:mapped?.percentage??null,earned:null,possible:null};
  }
  const earned=r.examEarned,possible=r.examPossible;
  return typeof earned==='number'&&Number.isFinite(earned)&&earned>=0&&typeof possible==='number'&&Number.isFinite(possible)&&possible>0&&earned<=possible
   ?{percentage:earned/possible*100,earned,possible}:{percentage:null,earned:null,possible:null};
 }
 const progress=requirementProgress(data,r);
 if(r.kind==='homework'){
  const complete=progress.possible>0&&r.current===0&&progress.entries.every(e=>e.possible!==undefined)&&!missingHomeworkResults(data,r).length;
  return complete?{percentage:progress.amount/progress.possible*100,earned:progress.amount,possible:progress.possible}:{percentage:null,earned:null,possible:null};
 }
 return {percentage:Math.min(100,progress.amount/r.target*100),earned:null,possible:null};
}
export type PassingStatus='met'|'unmet'|'pending';
export function evaluatePassingRule(data:AppData,courseId:number){
 const rule=coursePassingRule(data,courseId),requirements=courseRequirements(data,courseId);
 if(!rule)return null;
 const error=passingRuleError(rule,requirements);
 const groups=rule.groups.map(group=>{
  const members=group.requirementIds.flatMap(id=>{const r=requirements.find(r=>r.id===id);return r?[r]:[]});
  const scores=members.map(r=>requirementScore(data,r,rule));
  const allKnown=members.length>0&&scores.every(s=>s.percentage!==null);
  const totalPossible=scores.reduce((sum,s)=>sum+(s.possible||0),0);
  const allPointScores=allKnown&&scores.every(s=>s.possible!==null);
  const percentage=!allKnown?null:group.aggregation==='points'&&members.length>1
   ?allPointScores?scores.reduce((sum,s)=>sum+s.earned!,0)/totalPossible*100:null
   :scores.reduce((sum,s)=>sum+s.percentage!,0)/scores.length;
  const checks:PassingStatus[]=[];
  if(group.minimum!==null){
   if(group.examMode==='each'&&members.every(r=>r.kind==='exam'))checks.push(...scores.map(s=>s.percentage===null?'pending' as const:s.percentage+1e-9>=group.minimum!?'met' as const:'unmet' as const));
   else checks.push(percentage===null?'pending':percentage+1e-9>=group.minimum?'met':'unmet');
  }
  if(group.mustFulfill){
   if(group.examMode==='combined'){
    // A pooled exam result is judged by its explicit minimum, never by individual pass flags.
    if(group.minimum===null)checks.push('pending');
   }else checks.push(...members.map(r=>{
    if(r.kind==='exam'&&group.minimum!==null)return 'met' as const; // already checked from its score
    return requirementProgress(data,r).fulfilled?'met' as const:r.kind==='exam'&&r.examResult!=='failed'?'pending' as const:'unmet' as const;
   }));
  }
  const status:PassingStatus=checks.includes('unmet')?'unmet':checks.includes('pending')?'pending':'met';
  return {group,members,scores,percentage,status};
 });
 const weighted=groups.filter(x=>x.group.weight!==null&&x.group.weight>0);
 const overall=weighted.length&&weighted.every(x=>x.percentage!==null)?weighted.reduce((sum,x)=>sum+x.percentage!*x.group.weight!/100,0):null;
 const assigned=new Set(rule.groups.flatMap(g=>g.requirementIds));
 const additional=requirements.filter(r=>!assigned.has(r.id)).map(requirement=>({requirement,fulfilled:requirementProgress(data,requirement).fulfilled}));
 const hasConditions=groups.some(x=>x.group.minimum!==null||x.group.mustFulfill)||additional.length>0||rule.overallMinimum!==null;
 const unmet=groups.some(g=>g.status==='unmet')||additional.some(x=>!x.fulfilled)||(rule.overallMinimum!==null&&overall!==null&&overall+1e-9<rule.overallMinimum);
 const pending=groups.some(g=>g.status==='pending')||(rule.overallMinimum!==null&&overall===null);
 const status:PassingStatus=unmet?'unmet':pending?'pending':'met';
 return {rule,error,groups,additional,overall,status,hasConditions};
}

export function examRuleStatus(data:AppData,courseId:number,requirement:CourseRequirement):PassingStatus|null{
 if(requirement.kind!=='exam')return null;
 const result=evaluatePassingRule(data,courseId);
 if(!result||result.error)return null;
 const component=result.groups.find(x=>x.group.requirementIds.includes(requirement.id));
 if(!component||component.group.minimum===null)return null;
 const percentage=component.group.examMode==='combined'?component.percentage:requirementScore(data,requirement,result.rule).percentage;
 return percentage===null?'pending':percentage+1e-9>=component.group.minimum?'met':'unmet';
}
export function courseRequirementSatisfied(data:AppData,courseId:number,requirement:CourseRequirement):boolean{
 const status=examRuleStatus(data,courseId,requirement);
 if(status!==null)return status==='met';
 const fulfilled=requirementProgress(data,requirement).fulfilled;
 if(requirement.kind==='exam')return fulfilled;
 const result=evaluatePassingRule(data,courseId);
 if(!result||result.error)return fulfilled;
 const component=result.groups.find(x=>x.group.requirementIds.includes(requirement.id));
 if(!component||component.group.minimum===null)return fulfilled;
 return component.status==='met'&&(!component.group.mustFulfill||fulfilled);
}
