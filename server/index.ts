import express from 'express';
import { db, allData } from './db.js';

const app = express();
app.use(express.json({ limit: '5mb' }));
const port = Number(process.env.PORT || 3001);
app.use('/api', (req, res, next) => {
 if (!['POST','PUT'].includes(req.method) || req.path === '/import') return next();
 const b=req.body;
 if (!b || typeof b !== 'object') { res.status(400).json({error:'Ungültige Eingabe'}); return; }
 const invalid = (req.path.startsWith('/tasks') && (!b.title?.trim() || !['Offen','In Bearbeitung','Erledigt'].includes(b.status || 'Offen') || !Number.isFinite(b.estimate_minutes) || b.estimate_minutes < 0)) || (req.path.startsWith('/courses') && (!b.name?.trim() || !b.semester?.trim() || !Number.isFinite(b.ects) || b.ects < 0 || !Number.isFinite(b.hours_per_ects) || b.hours_per_ects <= 0)) || ((req.path.startsWith('/sessions') || req.path.startsWith('/blocks')) && !(new Date(b.ended_at || b.ends_at).getTime() > new Date(b.started_at || b.starts_at).getTime()));
 if(invalid) { res.status(400).json({error:'Bitte Pflichtfelder, Zahlen und Zeitraum prüfen (Ende nach Beginn).'}); return; }
 next();
});
const clean = (value: unknown) => value === undefined ? null : value;

app.get('/api/data', (_req, res) => res.json(allData()));
app.post('/api/courses', (req, res) => { const b = req.body; const r = db.prepare('INSERT INTO courses (name,code,semester,ects,hours_per_ects,color,description) VALUES (?,?,?,?,?,?,?)').run(b.name,b.code||'',b.semester,b.ects,b.hours_per_ects||25,b.color||'#3b82f6',b.description||''); res.json({ id: r.lastInsertRowid, ...b }); });
app.put('/api/courses/:id', (req,res) => { const b=req.body; db.prepare('UPDATE courses SET name=?,code=?,semester=?,ects=?,hours_per_ects=?,color=?,description=? WHERE id=?').run(b.name,b.code||'',b.semester,b.ects,b.hours_per_ects,b.color,b.description||'',req.params.id); res.json({ok:true}); });
app.delete('/api/courses/:id', (req,res) => { db.prepare('DELETE FROM courses WHERE id=?').run(req.params.id); res.json({ok:true}); });
app.post('/api/tasks', (req,res) => { const b=req.body; const r=db.prepare('INSERT INTO tasks (id,title,description,area,type,course_id,deadline,estimate_minutes,priority,status,tracking,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(b.id??null,b.title,b.description||'',b.area,b.type,b.area==='Privat'?null:clean(b.course_id),b.deadline||null,b.estimate_minutes??60,b.priority||'Mittel',b.status||'Offen',b.tracking===false||b.tracking===0?0:1,b.status==='Erledigt'?new Date().toISOString():null); res.json({id:b.id??r.lastInsertRowid}); });
app.put('/api/tasks/:id', (req,res) => { const b=req.body; db.prepare('UPDATE tasks SET title=?,description=?,area=?,type=?,course_id=?,deadline=?,estimate_minutes=?,priority=?,status=?,tracking=?,completed_at=? WHERE id=?').run(b.title,b.description||'',b.area,b.type,b.area==='Privat'?null:clean(b.course_id),b.deadline||null,b.estimate_minutes,b.priority,b.status,b.tracking?1:0,b.status==='Erledigt'?(b.completed_at||new Date().toISOString()):null,req.params.id); res.json({ok:true}); });
app.delete('/api/tasks/:id', (req,res) => { db.prepare('DELETE FROM tasks WHERE id=?').run(req.params.id); res.json({ok:true}); });
app.post('/api/sessions', (req,res) => { const b=req.body; const r=db.prepare('INSERT INTO work_sessions (task_id,course_id,started_at,ended_at,kind,note) VALUES (?,?,?,?,?,?)').run(b.task_id??null,b.course_id??null,b.started_at,b.ended_at,b.kind||'Selbstlernen',b.note||''); res.json({id:r.lastInsertRowid}); });
app.put('/api/sessions/:id', (req,res) => { const b=req.body; db.prepare('UPDATE work_sessions SET task_id=?,course_id=?,started_at=?,ended_at=?,kind=?,note=? WHERE id=?').run(b.task_id??null,b.course_id??null,b.started_at,b.ended_at,b.kind,b.note||'',req.params.id); res.json({ok:true}); });
app.delete('/api/sessions/:id', (req,res) => { db.prepare('DELETE FROM work_sessions WHERE id=?').run(req.params.id); res.json({ok:true}); });
app.post('/api/blocks', (req,res) => { const b=req.body; const r=db.prepare('INSERT INTO planned_blocks (task_id,course_id,title,starts_at,ends_at,kind) VALUES (?,?,?,?,?,?)').run(clean(b.task_id),clean(b.course_id),b.title,b.starts_at,b.ends_at,b.kind||'Arbeit'); res.json({id:r.lastInsertRowid}); });
app.put('/api/blocks/:id', (req,res) => { const b=req.body; db.prepare('UPDATE planned_blocks SET task_id=?,course_id=?,title=?,starts_at=?,ends_at=?,kind=? WHERE id=?').run(clean(b.task_id),clean(b.course_id),b.title,b.starts_at,b.ends_at,b.kind,req.params.id); res.json({ok:true}); });
app.delete('/api/blocks/:id', (req,res) => { db.prepare('DELETE FROM planned_blocks WHERE id=?').run(req.params.id); res.json({ok:true}); });
app.put('/api/settings/:key', (req,res) => {
 if(typeof req.body.value!=='string'){res.status(400).json({error:'Ungültiger Einstellungswert'});return;}
 db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(req.params.key,req.body.value);
 res.json({key:req.params.key,value:req.body.value});
});
app.post('/api/recurring', (req,res) => { const b=req.body; const r=db.prepare('INSERT INTO recurring_events (course_id,title,weekday,start_time,end_time,starts_on,ends_on,auto_track) VALUES (?,?,?,?,?,?,?,?)').run(b.course_id,b.title,b.weekday,b.start_time,b.end_time,b.starts_on,b.ends_on||null,b.auto_track?1:0); res.json({id:r.lastInsertRowid}); });
app.delete('/api/recurring/:id', (req,res) => { db.prepare('DELETE FROM recurring_events WHERE id=?').run(req.params.id); res.json({ok:true}); });
app.post('/api/course-copy',(req,res)=>{
 const {course:c,events}=req.body;
 if(!c?.name?.trim()||!c.semester?.trim()||!Array.isArray(events)||!Number.isFinite(c.ects)||c.ects<0||!(c.hours_per_ects>0)){res.status(400).json({error:'Ungültige Kursvorlage'});return;}
 const result=db.transaction(()=>{
  const courseId=db.prepare('INSERT INTO courses(name,code,semester,ects,hours_per_ects,color,description) VALUES(?,?,?,?,?,?,?)').run(c.name,c.code||'',c.semester,c.ects,c.hours_per_ects,c.color||'#818cf8',c.description||'').lastInsertRowid;
  for(const e of events){
   if(!Number.isInteger(e.weekday)||e.weekday<0||e.weekday>6||!e.starts_on||!e.start_time||!e.end_time)throw new Error('Ungültiger Termin');
   const eventId=db.prepare('INSERT INTO recurring_events(course_id,title,weekday,start_time,end_time,starts_on,ends_on,auto_track) VALUES(?,?,?,?,?,?,?,?)').run(courseId,e.title,e.weekday,e.start_time,e.end_time,e.starts_on,e.ends_on||null,e.auto_track?1:0).lastInsertRowid;
   db.prepare('INSERT INTO settings(key,value) VALUES(?,?)').run(`lecture-exclusions-${eventId}`,JSON.stringify(e.excluded||[]));
  }
  return {id:Number(courseId)};
 })();res.json(result);
});
app.post('/api/import', (req,res) => { const data=req.body; if(!data || !['courses','tasks','sessions','blocks','recurring','settings'].every(k=>Array.isArray(data[k]))) { res.status(400).json({error:'Ungültige Sicherung: alle Datenlisten werden benötigt.'}); return; } const tx=db.transaction(() => { db.exec('DELETE FROM work_sessions; DELETE FROM planned_blocks; DELETE FROM tasks; DELETE FROM recurring_events; DELETE FROM courses; DELETE FROM settings;'); for(const c of data.courses||[]) db.prepare('INSERT INTO courses (id,name,code,semester,ects,hours_per_ects,color,description,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(c.id,c.name,c.code,c.semester,c.ects,c.hours_per_ects,c.color,c.description,c.created_at||new Date().toISOString()); for(const t of data.tasks||[]) db.prepare('INSERT INTO tasks (id,title,description,area,type,course_id,deadline,estimate_minutes,priority,status,tracking,created_at,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(t.id,t.title,t.description,t.area,t.type,t.course_id,t.deadline,t.estimate_minutes,t.priority,t.status,t.tracking,t.created_at,t.completed_at); for(const s of data.sessions||[]) db.prepare('INSERT INTO work_sessions (id,task_id,course_id,started_at,ended_at,kind,note) VALUES (?,?,?,?,?,?,?)').run(s.id,s.task_id??null,s.course_id??null,s.started_at,s.ended_at,s.kind,s.note); for(const b of data.blocks||[]) db.prepare('INSERT INTO planned_blocks (id,task_id,course_id,title,starts_at,ends_at,kind) VALUES (?,?,?,?,?,?)').run(b.id,b.task_id,b.course_id,b.title,b.starts_at,b.ends_at,b.kind); for(const e of data.recurring) db.prepare('INSERT INTO recurring_events (id,course_id,title,weekday,start_time,end_time,starts_on,ends_on,auto_track) VALUES (?,?,?,?,?,?,?,?,?)').run(e.id,e.course_id,e.title,e.weekday,e.start_time,e.end_time,e.starts_on,e.ends_on,e.auto_track); for(const x of data.settings) db.prepare('INSERT INTO settings (key,value) VALUES (?,?)').run(x.key,x.value); }); tx(); res.json({ok:true}); });
app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => { console.error(error.message); res.status(400).json({error:'Die Eingabe konnte nicht gespeichert werden. Bitte Beziehungen und Pflichtfelder prüfen.'}); });
app.listen(port, '127.0.0.1', () => console.log(`Planraum API läuft auf http://localhost:${port}`));
