import type { AppData } from './types';
import { cloud } from './cloud';
const tables:Record<string,string>={courses:'courses',tasks:'tasks',sessions:'work_sessions',blocks:'planned_blocks',recurring:'recurring_events',settings:'settings'};
const columns:Record<string,string[]>={courses:['name','code','semester','ects','hours_per_ects','color','description'],tasks:['title','description','area','type','course_id','deadline','estimate_minutes','priority','status','tracking','completed_at'],sessions:['task_id','course_id','started_at','ended_at','kind','note'],blocks:['task_id','course_id','title','starts_at','ends_at','kind'],recurring:['course_id','title','weekday','start_time','end_time','starts_on','ends_on','auto_track'],settings:['key','value']};
export async function loadData(): Promise<AppData> {
 if(!cloud){const r=await fetch('/api/data');if(!r.ok)throw new Error('Backend nicht erreichbar');return r.json()}
 const data:Record<string,any>={};
 await Promise.all(Object.entries(tables).map(async([key,table])=>{const r=await cloud!.from(table).select('*');if(r.error)throw new Error(r.error.message);data[key]=r.data}));
 data.tasks=data.tasks.map((t:any)=>{const c=data.courses.find((c:any)=>c.id===t.course_id);return {...t,course_name:c?.name,course_color:c?.color}});
 data.blocks=data.blocks.map((b:any)=>{const task=data.tasks.find((t:any)=>t.id===b.task_id);const c=data.courses.find((c:any)=>c.id===(task?.course_id||b.course_id));return {...b,task_title:task?.title,course_name:c?.name,course_color:c?.color}});
 return data as AppData;
}
export async function api(path:string,method='POST',body?:unknown) {
 if(!cloud){const r=await fetch('/api'+path,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok){const msg=await r.json().catch(()=>({error:'Speichern fehlgeschlagen'}));throw new Error(msg.error)}return r.json()}
 if(path==='/import'){const r=await cloud.rpc('import_backup',{backup:body});if(r.error)throw new Error(r.error.message);return {ok:true}}
 const [resource,id]=path.slice(1).split('/');const table=tables[resource];if(!table)throw new Error('Unbekannte Datenart');
 const b=(body||{}) as Record<string,any>;const row=Object.fromEntries(columns[resource].filter(k=>b[k]!==undefined).map(k=>[k,b[k]]));
 if(resource==='tasks'){row.tracking=b.tracking?1:0;row.course_id=b.area==='Privat'?null:b.course_id||null;row.deadline=b.deadline||null;row.completed_at=b.status==='Erledigt'?(b.completed_at||new Date().toISOString()):null}
 const r=method==='DELETE'?await cloud.from(table).delete().eq('id',id):method==='PUT'?await cloud.from(table).update(row).eq('id',id):await cloud.from(table).insert(row).select('id').single();
 if(r.error)throw new Error(r.error.message);return r.data||{ok:true};
}
