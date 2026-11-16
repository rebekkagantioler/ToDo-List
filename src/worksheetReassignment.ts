import type {AppData} from './types';

// Move personal records before removing duplicate worksheets. Every write can be
// retried after an interrupted sync without losing times or recreating entries.
export function worksheetReassignment(data:AppData,changes:{from:number;to:number|null}[]){
 const targets=new Map(changes.map(c=>[c.from,c.to]));
 const sessions=data.sessions.filter(s=>s.task_id!==null&&targets.has(s.task_id)).map(s=>({...s,task_id:targets.get(s.task_id!)!}));
 const blocks=data.blocks.filter(b=>b.task_id!==null&&targets.has(b.task_id)).map(b=>({...b,task_id:targets.get(b.task_id!)!}));
 const settings=new Map<string,string>();
 for(const setting of data.settings){
  if(setting.key.startsWith('course-requirements-')){
   try{const requirements=JSON.parse(setting.value);if(!Array.isArray(requirements))continue;let changed=false;
    for(const r of requirements)if(Array.isArray(r.taskIds)){const ids=r.taskIds.flatMap((id:number)=>targets.has(id)?targets.get(id)===null?[]:[targets.get(id)]:[id]);if(JSON.stringify(ids)!==JSON.stringify(r.taskIds)){r.taskIds=[...new Set(ids)];changed=true}}
    if(changed)settings.set(setting.key,JSON.stringify(requirements));
   }catch{/* Ignore unrelated malformed settings. */}
  }
  if(setting.key.startsWith('performance-entry-')){
   try{const entry=JSON.parse(setting.value);if(typeof entry.source!=='string'||!entry.source.startsWith('task-'))continue;
    const old=Number(entry.source.slice(5));if(!targets.has(old))continue;
    const target=targets.get(old);
    if(target!==null){const source=`task-${target}`,key=`performance-entry-${entry.requirementId}-${source}`;const existing=data.settings.find(s=>s.key===key);
     if(!settings.has(key)&&(!existing||existing.value==='{}'))settings.set(key,JSON.stringify({...entry,source}));
    }
    settings.set(setting.key,'{}');
   }catch{/* Ignore unrelated malformed settings. */}
  }
 }
 return {sessions,blocks,settings:[...settings].map(([key,value])=>({key,value}))};
}
