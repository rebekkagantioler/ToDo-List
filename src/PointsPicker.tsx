import {DirectLabel} from './DirectLabel';
import {useId,useState} from 'react';
export function pointOptions(maximum:number):number[]|null{
 return Number.isInteger(maximum)&&maximum>0&&maximum<=200?Array.from({length:maximum+1},(_,i)=>i):null;
}
export function PointsPicker({amount,maximum,onChange}:{amount:string;maximum:number|undefined;onChange:(amount:string)=>void}){
 const groupId=useId(),[custom,setCustom]=useState(false),options=pointOptions(maximum??NaN);
 const boxes=options!==null&&!custom&&(amount===''||options.includes(Number(amount)));
 return <fieldset className="sheet-points-picker"><legend>Erreichte Punkte</legend>{boxes?<><div>{options.map(n=><DirectLabel key={n}><input type="radio" name={groupId} required value={n} checked={amount!==''&&Number(amount)===n} onChange={()=>onChange(String(n))}/><span>{n}</span></DirectLabel>)}</div><button type="button" className="text-btn" onClick={()=>setCustom(true)}>Zwischenwert eingeben</button></>:<><input aria-label="Erreichte Punkte" required type="number" min="0" max={maximum} step="any" value={amount} onChange={e=>onChange(e.target.value)}/>{options!==null&&<button type="button" className="text-btn" onClick={()=>{setCustom(false);if(amount!==''&&!options.includes(Number(amount)))onChange('')}}>Punkte als Kästchen auswählen</button>}</>}{maximum!==undefined&&<small>von {maximum} möglichen Punkten</small>}</fieldset>;
}
