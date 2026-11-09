import {useState} from 'react';
export function pointOptions(maximum:number):number[]|null{
 return Number.isInteger(maximum)&&maximum>0&&maximum<=200?Array.from({length:maximum+1},(_,i)=>i):null;
}
export function HomeworkPointsFields({amount,possible,onChange}:{amount:string;possible:string;onChange:(value:{amount:string;possible:string})=>void}){
 const [custom,setCustom]=useState(false),options=pointOptions(Number(possible));
 const select=options!==null&&!custom&&(amount===''||options.includes(Number(amount)));
 return <div className="form-grid"><label>Erreichte Punkte{select?<select required value={amount} onChange={e=>{if(e.target.value==='custom')setCustom(true);else onChange({amount:e.target.value,possible})}}><option value="">Punkte auswählen</option>{options.map(n=><option value={n} key={n}>{n} von {possible}</option>)}<option value="custom">Anderen Punktwert eingeben …</option></select>:<><input required aria-label="Erreichte Punkte" type="number" min="0" max={possible!==''?Number(possible):undefined} step="any" value={amount} onChange={e=>onChange({amount:e.target.value,possible})}/>{options!==null&&<button type="button" className="text-btn" onClick={()=>{setCustom(false);if(!options.includes(Number(amount)))onChange({amount:'',possible})}}>Punkte auswählen</button>}</>}</label><label>Maximale Punkte für dieses Blatt<input required type="number" min="0.0001" step="any" value={possible} onChange={e=>onChange({amount,possible:e.target.value})}/></label></div>;
}
