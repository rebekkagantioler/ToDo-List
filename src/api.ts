import type { AppData } from './types';
import { cloud, timerStorageKey } from './cloud';
import { mapLimited } from './mapLimited';
import { enrichData } from './data';
import { catalogEntries, type CourseCatalogEntry, type CourseTemplate } from './catalog';
import { migrateLegacyCancellations } from './attendanceMigration';
import { attendanceKey } from './statistics';
import { homeworkPlan } from './homework';
const tables:Record<string,string>={courses:'courses',tasks:'tasks',sessions:'work_sessions',blocks:'planned_blocks',recurring:'recurring_events',settings:'settings'};
const columns:Record<string,string[]>={courses:['name','code','semester','ects','hours_per_ects','color','description'],tasks:['title','description','area','type','course_id','deadline','estimate_minutes','priority','status','tracking','completed_at'],sessions:['task_id','course_id','started_at','ended_at','kind','note'],blocks:['task_id','course_id','title','starts_at','ends_at','kind'],recurring:['course_id','title','weekday','start_time','end_time','starts_on','ends_on','auto_track'],settings:['key','value']};
async function readData(): Promise<AppData> {
 if(!cloud){const r=await fetch('/api/data',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Backend nicht erreichbar');return enrichData(await r.json())}
 const data:Record<string,any>={};
 await Promise.all(Object.entries(tables).map(async([key,table])=>{const r=await cloud!.from(table).select('*').abortSignal(AbortSignal.timeout(15000));if(r.error)throw new Error(r.error.message);data[key]=r.data}));
 return enrichData(data as AppData);
}
const loadingData=new Map<string,Promise<AppData>>();
export function loadData():Promise<AppData>{
 const owner=timerStorageKey();
 const existing=loadingData.get(owner);if(existing)return existing;
 const pending=loadAndPrepareData().finally(()=>{if(loadingData.get(owner)===pending)loadingData.delete(owner)});
 loadingData.set(owner,pending);return pending;
}
async function loadAndPrepareData():Promise<AppData>{
 const data=await migrateLegacyCancellations(await readData(),(key,value)=>api(`/settings/${key}`,'PUT',{value}));for(const event of data.recurring){for(const setting of data.settings){const prefix=`lecture-attendance-${event.id}-`;if(!setting.key.startsWith(prefix))continue;const date=setting.key.slice(prefix.length);if(setting.key===attendanceKey(event.id,date)&&setting.value==='no'&&new Date(`${date}T${event.start_time}`)>new Date()){await api(`/settings/${setting.key}`,'PUT',{value:'planned-no'});setting.value='planned-no';}}}const plan=homeworkPlan(data);
 const created=await mapLimited(plan.create,4,async task=>({...task,...await api('/tasks','POST',task)}));
 data.tasks.push(...created);
 await mapLimited(plan.update,4,task=>api(`/tasks/${task.id}`,'PUT',task));
 const updated=new Map(plan.update.map(task=>[task.id,task]));
 data.tasks=data.tasks.map(task=>updated.get(task.id)??task);
 await mapLimited(plan.remove,4,task=>api(`/tasks/${task.id}`,'DELETE'));
 const removed=new Set(plan.remove.map(task=>task.id));
 data.tasks=data.tasks.filter(task=>!removed.has(task.id));data.blocks=data.blocks.filter(block=>!removed.has(block.task_id!));
 return enrichData(data);
}
async function request(path:string,method='POST',body?:unknown) {
 if(!cloud){const r=await fetch('/api'+path,{method,signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok){const msg=await r.json().catch(()=>({error:'Speichern fehlgeschlagen'}));throw new Error(msg.error)}return r.json()}
 if(path.startsWith('/course-update/')){const r=await cloud.rpc('apply_course_update',{target_course:Number(path.split('/')[2]),template:body});if(r.error)throw new Error(r.error.message);return r.data}
 if(path==='/course-copy'){const r=await cloud.rpc('copy_course_template',{template:body});if(r.error)throw new Error(r.error.message);return r.data}
 if(path==='/import'){const r=await cloud.rpc('import_backup',{backup:body});if(r.error)throw new Error(r.error.message);return {ok:true}}
 const [resource,id]=path.slice(1).split('/');const table=tables[resource];if(!table)throw new Error('Unbekannte Datenart');
 const b=(body||{}) as Record<string,any>;const row=Object.fromEntries([...(method==='POST'?['id']:[]),...columns[resource]].filter(k=>b[k]!==undefined).map(k=>[k,b[k]]));
 if(resource==='tasks'){row.tracking=b.tracking?1:0;row.course_id=b.area==='Privat'?null:b.course_id||null;row.deadline=b.deadline||null;row.completed_at=b.status==='Erledigt'?(b.completed_at||new Date().toISOString()):null}
 if(resource==='settings'&&method==='PUT'){const r=await cloud.from(table).upsert({key:decodeURIComponent(id),value:b.value},{onConflict:'user_id,key'}).select('*').abortSignal(AbortSignal.timeout(15000)).single();if(r.error)throw new Error(r.error.message);return r.data}
 const query=method==='DELETE'?cloud.from(table).delete().eq('id',id):method==='PUT'?cloud.from(table).update(row).eq('id',id).select('*'):(row.id?cloud.from(table).upsert(row,{onConflict:'user_id,id',ignoreDuplicates:true}):cloud.from(table).insert(row)).select('*');
 const bounded=query.abortSignal(AbortSignal.timeout(15000));
 const r=await (method==='DELETE'?bounded:method==='PUT'?bounded.single():bounded.maybeSingle());
 if(r.error){if(resource==='sessions'&&(r.error.message.includes('course_id')||r.error.message.includes('task_id')&&r.error.message.includes('null')))throw new Error('Die Datenbank benötigt das Zeit-Update: supabase/optional-task-time.sql im Supabase SQL Editor ausführen. Die laufende Zeit bleibt erhalten.');throw new Error(r.error.message)}return r.data||(row.id?row:{ok:true});
}

let activeRequests=0;
export const pendingApiRequests=()=>activeRequests;
export async function api(path:string,method='POST',body?:unknown):Promise<any>{
 activeRequests++;
 try{return await performApi(path,method,body)}finally{activeRequests--}
}

async function performApi(path:string,method='POST',body?:unknown):Promise<any>{
 const stableBody=cloud&&method==='POST'&&!['/import','/course-copy'].includes(path)&&!path.startsWith('/course-update/')?{...(body as object),id:(body as any)?.id??Math.floor(Math.random()*3500000000000000)+1}:body;
 for(let attempt=0;;attempt++){
  try{return await request(path,method,stableBody)}catch(error){
   const message=error instanceof Error?error.message:String(error);
   const network=/load failed|failed to fetch|fetch failed|network|networkerror/i.test(message);
   if(!network)throw error;
   if(attempt>=2||(!cloud&&method==='POST')||(['/import','/course-copy'].includes(path)||path.startsWith('/course-update/')))throw new Error('Die Verbindung wurde unterbrochen. Bitte prüfe, ob der Eintrag gespeichert wurde, bevor du es erneut versuchst.');
   await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));
  }
 }
}

export async function loadCourseCatalog():Promise<CourseCatalogEntry[]>{
 if(!cloud)return catalogEntries(await readData());
 const ready=await cloud.rpc('course_catalog_transfer_ready');if(ready.error||!ready.data)throw new Error('Bitte die aktuelle Datei supabase/course-templates.sql in Supabase ausführen, um Übernahmeoptionen zu aktivieren.');
 const {data,error}=await cloud.rpc('list_course_catalog');
 if(error)throw new Error('Der Kurskatalog ist noch nicht eingerichtet. Bitte die aktuelle Datei supabase/course-templates.sql in Supabase ausführen.');
 return (data||[]) as CourseCatalogEntry[];
}

export async function loadCourseSource(sourceKey:string):Promise<CourseTemplate|null>{
 if(!cloud){const r=await fetch(`/api/course-source/${encodeURIComponent(sourceKey)}`);if(!r.ok)throw new Error('Vorlage konnte nicht geprüft werden');return r.json()}
 const {data,error}=await cloud.rpc('get_course_catalog_entry',{source_key:sourceKey});if(error)throw new Error('Kursupdates benötigen die aktuelle Datei supabase/course-templates.sql.');return data;
}
