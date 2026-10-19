import type { AppData } from './types';
import { cloud } from './cloud';
import { enrichData } from './data';
import { homeworkPlan } from './homework';
const tables:Record<string,string>={courses:'courses',tasks:'tasks',sessions:'work_sessions',blocks:'planned_blocks',recurring:'recurring_events',settings:'settings'};
const columns:Record<string,string[]>={courses:['name','code','semester','ects','hours_per_ects','color','description'],tasks:['title','description','area','type','course_id','deadline','estimate_minutes','priority','status','tracking','completed_at'],sessions:['task_id','course_id','started_at','ended_at','kind','note'],blocks:['task_id','course_id','title','starts_at','ends_at','kind'],recurring:['course_id','title','weekday','start_time','end_time','starts_on','ends_on','auto_track'],settings:['key','value']};
async function readData(): Promise<AppData> {
 if(!cloud){const r=await fetch('/api/data');if(!r.ok)throw new Error('Backend nicht erreichbar');return enrichData(await r.json())}
 const data:Record<string,any>={};
 await Promise.all(Object.entries(tables).map(async([key,table])=>{const r=await cloud!.from(table).select('*');if(r.error)throw new Error(r.error.message);data[key]=r.data}));
 return enrichData(data as AppData);
}
export async function loadData():Promise<AppData>{
 const data=await readData();const plan=homeworkPlan(data);
 for(const task of plan.create){const saved=await api('/tasks','POST',task);data.tasks.push({...task,...saved});}
 for(const task of plan.remove){await api(`/tasks/${task.id}`,'DELETE');data.tasks=data.tasks.filter(t=>t.id!==task.id);data.blocks=data.blocks.filter(b=>b.task_id!==task.id);}
 return enrichData(data);
}
async function request(path:string,method='POST',body?:unknown) {
 if(!cloud){const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok){const msg=await r.json().catch(()=>({error:'Speichern fehlgeschlagen'}));throw new Error(msg.error)}return r.json()}
 if(path==='/course-copy'){const r=await cloud.rpc('copy_course_template',{template:body});if(r.error)throw new Error(r.error.message);return r.data}
 if(path==='/import'){const r=await cloud.rpc('import_backup',{backup:body});if(r.error)throw new Error(r.error.message);return {ok:true}}
 const [resource,id]=path.slice(1).split('/');const table=tables[resource];if(!table)throw new Error('Unbekannte Datenart');
 const b=(body||{}) as Record<string,any>;const row=Object.fromEntries([...(method==='POST'?['id']:[]),...columns[resource]].filter(k=>b[k]!==undefined).map(k=>[k,b[k]]));
 if(resource==='tasks'){row.tracking=b.tracking?1:0;row.course_id=b.area==='Privat'?null:b.course_id||null;row.deadline=b.deadline||null;row.completed_at=b.status==='Erledigt'?(b.completed_at||new Date().toISOString()):null}
 if(resource==='settings'&&method==='PUT'){const r=await cloud.from(table).upsert({key:decodeURIComponent(id),value:b.value},{onConflict:'user_id,key'}).select('*').single();if(r.error)throw new Error(r.error.message);return r.data}
 const r=method==='DELETE'?await cloud.from(table).delete().eq('id',id):method==='PUT'?await cloud.from(table).update(row).eq('id',id).select('*').single():await (row.id?cloud.from(table).upsert(row,{onConflict:'user_id,id',ignoreDuplicates:true}):cloud.from(table).insert(row)).select('*').maybeSingle();
 if(r.error){if(resource==='sessions'&&(r.error.message.includes('course_id')||r.error.message.includes('task_id')&&r.error.message.includes('null')))throw new Error('Die Datenbank benötigt das Zeit-Update: supabase/optional-task-time.sql im Supabase SQL Editor ausführen. Die laufende Zeit bleibt erhalten.');throw new Error(r.error.message)}return r.data||(row.id?row:{ok:true});
}

export async function api(path:string,method='POST',body?:unknown):Promise<any>{
 const stableBody=cloud&&method==='POST'&&!['/import','/course-copy'].includes(path)?{...(body as object),id:(body as any)?.id??Math.floor(Math.random()*3500000000000000)+1}:body;
 for(let attempt=0;;attempt++){
  try{return await request(path,method,stableBody)}catch(error){
   const message=error instanceof Error?error.message:String(error);
   const network=/load failed|failed to fetch|fetch failed|network|networkerror/i.test(message);
   if(!network)throw error;
   if(attempt>=2||(!cloud&&method==='POST')||['/import','/course-copy'].includes(path))throw new Error('Die Verbindung wurde unterbrochen. Bitte prüfe, ob der Eintrag gespeichert wurde, bevor du es erneut versuchst.');
   await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
  }
 }
}
