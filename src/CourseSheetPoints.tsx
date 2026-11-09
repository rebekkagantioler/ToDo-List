import {DirectLabel} from './DirectLabel';
import {useState,useRef} from 'react';
import type {AppData,Course} from './types';
import {courseSheetMaximum,courseSheetPointsKey} from './sheetPoints';
export function CourseSheetPoints({data,course,mutate}:{data:AppData;course:Course;mutate:(path:string,method:string,body:unknown)=>Promise<unknown>}){
 const maximum=courseSheetMaximum(data,course.id),[value,setValue]=useState(maximum===undefined?'':String(maximum)),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);
 return <details className="course-sheet-points"><summary>Punkte pro Übungsblatt <strong>{maximum===undefined?'Festlegen':`${maximum} Punkte`}</strong></summary><form onSubmit={async e=>{e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');const form=e.currentTarget;try{await mutate(`/settings/${courseSheetPointsKey(course.id)}`,'PUT',{value});form.closest('details')!.open=false}catch(e){setError(e instanceof Error?e.message:'Speichern fehlgeschlagen.')}finally{lock.current=false;setBusy(false)}}}><DirectLabel>Für alle Übungsblätter in diesem Kurs<input type="number" required min="0.0001" step="any" value={value} placeholder="z. B. 6" disabled={busy} onChange={e=>setValue(e.target.value)}/></DirectLabel><p className="muted">Einmal festlegen, danach nur noch die erreichten Punkte auswählen. Bereits gespeicherte Ergebnisse behalten ihr damaliges Maximum.</p><button className="secondary" disabled={busy}>{busy?'Speichern …':'Für den Kurs speichern'}</button>{error&&<p role="alert" className="save-error">{error}</p>}</form></details>;
}
