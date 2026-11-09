import {DirectLabel} from './DirectLabel';
import {PointsPicker} from './PointsPicker';
export {pointOptions} from './PointsPicker';
export function HomeworkPointsFields({amount,possible,onChange,fixedMaximum}:{amount:string;possible:string;fixedMaximum?:number;onChange:(value:{amount:string;possible:string})=>void}){
 const maximum=fixedMaximum??(possible!==''&&Number(possible)>0?Number(possible):undefined);
 return <div className="points-fields">{fixedMaximum===undefined&&<DirectLabel>Maximale Punkte für dieses Blatt<input required type="number" min="0.0001" step="any" value={possible} onChange={e=>onChange({amount,possible:e.target.value})}/></DirectLabel>}<PointsPicker amount={amount} maximum={maximum} onChange={earned=>onChange({amount:earned,possible:maximum===undefined?possible:String(maximum)})}/></div>;
}
