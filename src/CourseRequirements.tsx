import { useRef, useState } from 'react';
import type { AppData, Course } from './types';
import { courseRequirements, requirementsKey, validRequirement, type CourseRequirement } from './requirements';

type Props={data:AppData;course:Course;mutate:(path:string,method:string,body:unknown)=>Promise<unknown>};
const number=(n:number)=>n.toLocaleString('de-DE',{maximumFractionDigits:4});
export function CourseRequirements({data,course,mutate}:Props){
 const rows=courseRequirements(data,course.id);
 const [draft,setDraft]=useState<CourseRequirement|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[removing,setRemoving]=useState<string|null>(null);
 const lock=useRef(false);
 async function save(next:CourseRequirement[]){
  if(lock.current)return;
  lock.current=true;setBusy(true);setError('');
  try{await mutate(`/settings/${requirementsKey(course.id)}`,'PUT',{value:JSON.stringify(next)});setDraft(null);setRemoving(null)}catch(e){setError(e instanceof Error?e.message:'Speichern fehlgeschlagen.')}finally{lock.current=false;setBusy(false)}
 }
 const fulfilled=rows.filter(r=>r.current>=r.target).length;
 return <section className="course-requirements"><div className="page-heading"><div><h2>Anforderungen</h2><p className="muted">Was brauchst du für diesen Kurs? Halte Prüfungen, Abgaben und benötigte Punkte fest.</p></div><button className="secondary" disabled={busy} onClick={()=>{setRemoving(null);setDraft({id:crypto.randomUUID(),title:'',unit:'Klausuren',target:1,current:0})}}>Anforderung hinzufügen</button></div>
 {rows.length>0&&<p>{fulfilled} von {rows.length} Anforderungen erfüllt</p>}
 <div className="requirement-list">{rows.map(r=><article className="requirement-card" key={r.id}><div className="requirement-heading"><h3>{r.title}</h3><span>{r.current>=r.target?'Erfüllt':'Noch offen'}</span></div><p><strong>{number(r.current)} / {number(r.target)}</strong> {r.unit}</p><progress aria-label={`${r.title}: ${number(r.current)} von ${number(r.target)} ${r.unit}`} max={r.target} value={Math.min(r.current,r.target)}/><div className="setting-actions"><button className="text-btn" disabled={busy} onClick={()=>{setRemoving(null);setDraft({...r})}}>Fortschritt / Bearbeiten</button><button className="text-btn" disabled={busy} onClick={()=>{setDraft(null);setRemoving(r.id)}}>Entfernen</button></div>{removing===r.id&&<div><p>Anforderung „{r.title}“ entfernen?</p><div className="setting-actions"><button className="secondary" disabled={busy} onClick={()=>setRemoving(null)}>Abbrechen</button><button className="secondary" disabled={busy} onClick={()=>void save(rows.filter(x=>x.id!==r.id))}>Entfernen bestätigen</button></div></div>}</article>)}</div>
 {!rows.length&&!draft&&<p className="muted">Noch keine Anforderungen. Zum Beispiel: 2 Klausuren bestehen, 5 Texte reflektieren oder 60 Punkte aus Übungsblättern sammeln.</p>}
 {draft&&<form className="requirement-form" onSubmit={e=>{e.preventDefault();if(!validRequirement(draft))return;void save([...rows.filter(r=>r.id!==draft.id),{...draft,title:draft.title.trim(),unit:draft.unit.trim()}])}}><h3>{rows.some(r=>r.id===draft.id)?'Anforderung bearbeiten':'Neue Anforderung'}</h3><fieldset disabled={busy}><label>Bezeichnung<input required maxLength={200} placeholder="z. B. Texte reflektieren" value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label><label>Einheit<input list="requirement-units" required maxLength={60} value={draft.unit} onChange={e=>setDraft({...draft,unit:e.target.value})}/><datalist id="requirement-units">{['Klausuren','Texte','Punkte','Abgaben','Präsentationen'].map(u=><option key={u} value={u}/>)}</datalist></label><label>Ziel<input type="number" required min="0.0001" step="any" value={draft.target} onChange={e=>setDraft({...draft,target:e.target.valueAsNumber})}/></label><label>Bereits erreicht<input type="number" required min="0" step="any" value={draft.current} onChange={e=>setDraft({...draft,current:e.target.valueAsNumber})}/></label></fieldset><p className="muted">Trage hier bestandene Klausuren, erledigte Texte oder erreichte Punkte ein. Der Stand wird manuell gepflegt.</p><div className="setting-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setDraft(null)}>Abbrechen</button><button className="primary" disabled={busy||!validRequirement(draft)||!draft.unit.trim()}>{busy?'Wird gespeichert …':'Speichern'}</button></div></form>}
 {error&&<p role="alert" className="save-error">{error}</p>}
 </section>;
}
