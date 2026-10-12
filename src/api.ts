import type { AppData } from './types';
import { cloud } from './cloud';
import { enrichData } from './data';
const tables:Record<string,string>={courses:'courses',tasks:'tasks',sessions:'work_sessions',blocks:'planned_blocks',recurring:'recurring_events',settings:'settings'};
const columns:Record<string,string[]>={courses:['name','code','semester','ects','hours_per_ects','color','description'],tasks:['title','description','area','type','course_id','deadline','estimate_minutes','priority','status','tracking','completed_at'],sessions:['task_id','course_id','started_at','ended_at','kind','note'],blocks:['task_id','course_id','title','starts_at','ends_at','kind'],recurring:['course_id','title','weekday','start_time','end_time','starts_on','ends_on','auto_track'],settings:['key','value']};
export async function loadData(): Promise<AppData> {
 if(!cloud){const r=await fetch('/api/data');if(!r.ok)throw new Error('Backend nicht erreichbar');return r.json()}
 const data:Record<string,any>={};
 await Promise.all(Object.entries(tables).map(async([key,table])=>{const r=await cloud!.from(table).select('*');if(r.error)throw new Error(r.error.message);data[key]=r.data}));
 return enrichData(data as AppData);
}
export async function api(path:string,method='POST',body?:unknown) {
 if(!cloud){const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok){const msg=await r.json().catch(()=>({error:'Speichern fehlgeschlagen'}));throw new Error(msg.error)}return r.json()}
 if(path==='/import'){const r=await cloud.rpc('import_backup',{backup:body});if(r.error)throw new Error(r.error.message);return {ok:true}}
 const [resource,id]=path.slice(1).split('/');const table=tables[resource];if(!table)throw new Error('Unbekannte Datenart');
 const b=(body||{}) as Record<string,any>;const row=Object.fromEntries(columns[resource].filter(k=>b[k]!==undefined).map(k=>[k,b[k]]));
 if(resource==='tasks'){row.tracking=b.tracking?1:0;row.course_id=b.area==='Privat'?null:b.course_id||null;row.deadline=b.deadline||null;row.completed_at=b.status==='Erledigt'?(b.completed_at||new Date().toISOString()):null}
 const r=method==='DELETE'?await cloud.from(table).delete().eq('id',id):method==='PUT'?await cloud.from(table).update(row).eq('id',id).select('*').single():await cloud.from(table).insert(row).select('*').single();
 if(r.error){if(resource==='sessions'&&(r.error.message.includes('course_id')||r.error.message.includes('task_id')&&r.error.message.includes('null')))throw new Error('Die Datenbank benötigt das Zeit-Update: supabase/optional-task-time.sql im Supabase SQL Editor ausführen. Die laufende Zeit bleibt erhalten.');throw new Error(r.error.message)}return r.data||{ok:true};
}
