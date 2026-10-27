import { useEffect, useRef, useState } from 'react';
import { cloud, timerStorageKey } from './cloud';
import { api } from './api';
import { newTimer, stoppedTimer, timerSession, type ActiveTimer } from './timer';
const key='active-timer-v1';
const readLocal=():ActiveTimer|null=>{try{const value=JSON.parse(localStorage.getItem(timerStorageKey())||'null');return value?newTimer(value):null}catch{return null}};

export function useTimer(onError:(message:string)=>void,onSaved:()=>Promise<void>){
 const [timer,setState]=useState<ActiveTimer|null>(cloud?null:readLocal);
 const [busy,setBusy]=useState(false);
 const current=useRef(timer),raw=useRef('null'),locked=useRef(false),revision=useRef(0),ready=useRef(!cloud);
 const apply=(value:string)=>{raw.current=value;const next=JSON.parse(value) as ActiveTimer|null;current.current=next;setState(next);if(next)localStorage.setItem(timerStorageKey(),JSON.stringify(next));else localStorage.removeItem(timerStorageKey())};
 const sync=async()=>{
  if(!cloud||locked.current)return;
  const version=revision.current;
  const result=await cloud.from('settings').select('value').eq('key',key).maybeSingle();
  if(result.error)throw new Error(result.error.message);
  if(locked.current||version!==revision.current)return;
  if(!result.data){
   const local=readLocal();
   const inserted=await cloud.from('settings').upsert({key,value:JSON.stringify(local)},{onConflict:'user_id,key',ignoreDuplicates:true});
   if(inserted.error)throw new Error(inserted.error.message);
   // Read the winning value if another device initialized at the same time.
   return sync();
  }
  apply(result.data.value);ready.current=true;
 };
 useEffect(()=>{
  let active=true;
  const update=()=>{if(document.visibilityState==='visible')void sync().catch(e=>{if(active)onError(`Timer konnte nicht synchronisiert werden: ${e.message}`)})};
  update();const tick=setInterval(update,3000);
  const storage=(e:StorageEvent)=>{if(!cloud&&e.key===timerStorageKey())apply(e.newValue||'null')};
  window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);window.addEventListener('storage',storage);
  return()=>{active=false;clearInterval(tick);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);window.removeEventListener('storage',storage)};
 },[]);
 const write=async(next:ActiveTimer|null)=>{
  const value=JSON.stringify(next);
  if(cloud){
   const result=await cloud.from('settings').update({value}).eq('key',key).eq('value',raw.current).select('value');
   if(result.error)throw new Error(result.error.message);
   if(!result.data?.length)throw new Error('Der Timer wurde auf einem anderen Gerät geändert. Bitte kurz warten und erneut versuchen.');
  }
  apply(value);
 };
 const run=async(action:()=>Promise<void>)=>{
  if(locked.current)return;
  locked.current=true;revision.current++;setBusy(true);
  try{if(!ready.current)throw new Error('Timer wird noch synchronisiert. Bitte kurz warten.');await action()}
  catch(e){onError(e instanceof Error?e.message:'Timer konnte nicht gespeichert werden.')}
  finally{locked.current=false;setBusy(false);void sync().catch(()=>{})}
 };
 const setTimer=(next:(Omit<ActiveTimer,'id'>&{id?:number})|null)=>{void run(async()=>{
  if(current.current?.stoppedAt&&next)throw new Error('Bitte zuerst die angehaltene Zeit speichern.');
  await write(next?newTimer(next):null);
 })};
 const stopTimer=()=>run(async()=>{
  if(!current.current)return;
  const stopped=stoppedTimer(current.current);
  await write(stopped);
  await api('/sessions','POST',timerSession(stopped));
  await write(null);
  await onSaved();
 });
 return {timer,setTimer,stopTimer,busy};
}
