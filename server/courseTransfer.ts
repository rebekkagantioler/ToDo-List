import type Database from 'better-sqlite3';
import type {CourseOrigin,CourseTemplate} from '../src/catalog';
export function transferCourse(db:Database.Database,template:CourseTemplate,target?:number){
 return db.transaction(()=>{
  const c=template.course;if(!c?.name?.trim()||!c.semester?.trim()||!Array.isArray(template.events)||!Number.isFinite(c.ects)||c.ects<0||!(c.hours_per_ects>0))throw new Error('Ungültige Kursvorlage');
  const setting=(key:string,value:unknown)=>db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));
  let id=target;
  if(id&&!db.prepare('SELECT id FROM courses WHERE id=?').get(id))throw new Error('Kurs nicht gefunden');
  if(!id)id=Number(db.prepare('INSERT INTO courses(name,code,semester,ects,hours_per_ects,color,description) VALUES(?,?,?,?,?,?,?)').run(c.name,c.code||'',c.semester,c.ects,c.hours_per_ects,c.color||'#818cf8','').lastInsertRowid);
  else if(template.update_course)db.prepare('UPDATE courses SET name=?,code=?,semester=?,ects=?,hours_per_ects=? WHERE id=?').run(c.name,c.code||'',c.semester,c.ects,c.hours_per_ects,id);
  const previous=db.prepare('SELECT value FROM settings WHERE key=?').get(`course-origin-${id}`) as {value:string}|undefined;
  const origin:CourseOrigin=previous?JSON.parse(previous.value):{source_key:template.source_key||'',revision:'',event_map:{},homework_map:{},snapshot:template};
  for(const key of template.remove_homework||[]){const local=origin.homework_map[key];if(local){const row=db.prepare('SELECT value FROM settings WHERE key=?').get(`homework-series-${local}`) as {value:string}|undefined;if(row)setting(`homework-series-${local}`,{...JSON.parse(row.value),stopped:true,deleted:true});delete origin.homework_map[key];}}
  for(const key of template.remove_events||[]){const local=origin.event_map[key];if(local){db.prepare('DELETE FROM recurring_events WHERE id=? AND course_id=?').run(local,id);delete origin.event_map[key];}}
  for(const [index,e] of template.events.entries()){
   if(!Number.isInteger(e.weekday)||e.weekday<0||e.weekday>6||!e.starts_on||!e.start_time||!e.end_time)throw new Error('Ungültiger Termin');
   const key=e.source_key||String(index),mapped=origin.event_map[key];
   const existing=mapped&&db.prepare('SELECT id FROM recurring_events WHERE id=? AND course_id=?').get(mapped,id);
   // A locally removed event stays removed; new source events can be selected explicitly.
   if(mapped&&!existing)continue;
   const values=[e.title,e.weekday,e.start_time,e.end_time,e.starts_on,e.ends_on||null,e.auto_track?1:0];
   const eventId=mapped||Number(db.prepare('INSERT INTO recurring_events(course_id,title,weekday,start_time,end_time,starts_on,ends_on,auto_track) VALUES(?,?,?,?,?,?,?,?)').run(id,...values).lastInsertRowid);
   if(mapped)db.prepare('UPDATE recurring_events SET title=?,weekday=?,start_time=?,end_time=?,starts_on=?,ends_on=?,auto_track=? WHERE id=? AND course_id=?').run(...values,eventId,id);
   origin.event_map[key]=eventId;setting(`lecture-exclusions-${eventId}`,e.excluded||[]);
  }
  for(const h of template.homework||[]){
   const eventId=origin.event_map[h.event_key];if(!eventId)throw new Error('Aufgabenserie benötigt eine ausgewählte Einheit');
   let local=origin.homework_map[h.source_key];const row=local?db.prepare('SELECT value FROM settings WHERE key=?').get(`homework-series-${local}`) as {value:string}|undefined:undefined;
   const existing=row?JSON.parse(row.value):null;if(local&&(!existing||existing.deleted||existing.stopped))continue;
   local=local||crypto.randomUUID();
   const start=existing?.starts_on||h.starts_on;
   const series={...existing,id:local,event_id:eventId,starts_on:start,skipped:existing?.skipped||[],task:{...existing?.task,title:h.title,description:existing?.task?.description||'',area:'Universität',type:h.type||'Hausaufgabe',course_id:id,deadline:null,estimate_minutes:h.estimate_minutes??60,priority:h.priority||'Mittel',status:'Offen',tracking:h.tracking?1:0},numbering:h.numbering,submission:h.submission};
   setting(`homework-series-${local}`,series);origin.homework_map[h.source_key]=local;
  }
  if(template.source_key){origin.source_key=template.source_key;origin.revision=template.revision||'';origin.snapshot=template.source_snapshot||template;setting(`course-origin-${id}`,origin);}
  return {id};
 })();
}
