import type {AppData} from './types';
export const courseSheetPointsKey=(courseId:number)=>`course-sheet-points-${courseId}`;
export function courseSheetMaximum(data:AppData,courseId:number):number|undefined{
 const value=data.settings.find(s=>s.key===courseSheetPointsKey(courseId))?.value;
 const maximum=value===undefined||value.trim()===''?NaN:Number(value);
 return Number.isFinite(maximum)&&maximum>0?maximum:undefined;
}
