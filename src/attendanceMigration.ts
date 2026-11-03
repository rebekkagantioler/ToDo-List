import type {AppData} from './types';
import {canceledDates,unplannedDates,exclusionKey,unplannedKey} from './statistics';
export const attendanceMigrationKey='attendance-legacy-cancellations-to-unplanned-v1';
// Copy before clearing; retries preserve all dates if a connection fails halfway.
export async function migrateLegacyCancellations(data:AppData,save:(key:string,value:string)=>Promise<unknown>):Promise<AppData>{
 if(data.settings.some(s=>s.key===attendanceMigrationKey&&s.value==='done'))return data;
 const settings=data.settings.map(s=>({...s}));
 const write=async(key:string,value:string)=>{await save(key,value);const setting=settings.find(s=>s.key===key);if(setting)setting.value=value;else settings.push({key,value})};
 for(const event of data.recurring){
  const dates=canceledDates(data,event.id);if(!dates.length)continue;
  await write(unplannedKey(event.id),JSON.stringify(Array.from(new Set([...unplannedDates(data,event.id),...dates]))));
  await write(exclusionKey(event.id),'[]');
 }
 await write(attendanceMigrationKey,'done');
 return {...data,settings};
}
