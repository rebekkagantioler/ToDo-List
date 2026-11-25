import { useEffect, useRef, useState } from 'react';
import { cloud, timerStorageKey } from './cloud';
import { api } from './api';
import { newTimer, stoppedTimer, timerSession, type ActiveTimer } from './timer';
const key='active-timer-v1';
const timerTimeout=8000;
const readLocal=():ActiveTimer|null=>{try{const value=JSON.parse(localStorage.getItem(timerStorageKey())||'null');return value?newTimer(value):null}catch{return null}};

export function useTimer(onError:(message:string)=>void,onSaved:(session:ReturnType<typeof timerSession>,saved:unknown)=>void){
 const [timer,setState]=useState<ActiveTimer|null>(cloud?null:readLocal);
 const [busy,setBusy]=useState(false);
 const current=useRef(timer),raw=useRef('null'),locked=useRef(false),revision=useRef(0),ready=useRef(!cloud);
 const show=(next:ActiveTimer|null)=>{current.current=next;setState(next)};
 const apply=(value:string)=>{raw.current=value;const next=JSON.parse(value) as ActiveTimer|null;show(next);if(next)localStorage.setItem(timerStorageKey(),value);else localStorage.removeItem(timerStorageKey())};
 const sync=async()=>{
  if(!cloud||locked.current)return;
  const version=revision.current;
  const result=await cloud.from('settings').select('value').eq('key',key).abortSignal(AbortSignal.timeout(timerTimeout)).maybeSingle();
  if(result.error)throw new Error(result.error.message);
  if(locked.current||version!==revision.current)return;
  if(!result.data){
   const local=readLocal();
   const inserted=await cloud.from('settings').upsert({key,value:JSON.stringify(local)},{onConflict:'user_id,key',ignoreDuplicates:true}).abortSignal(AbortSignal.timeout(timerTimeout));
   if(inserted.error)throw new Error(inserted.error.message);
   // Read the winning value if another device initialized at the same time.
   return sync();
  }
  if(!ready.current||result.data.value!==raw.current)apply(result.data.value);
  ready.current=true;
 };
 useEffect(()=>{
  let active=true;
  const update=()=>{if(document.visibilityState==='visible')void sync().catch(e=>{if(active)onError(`Timer konnte nicht synchronisiert werden: ${e.message}`)})};
  update();const tick=setInterval(update,3000);
  const storage=(e:StorageEvent)=>{if(!cloud&&e.key===timerStorageKey())apply(e.newValue||'null')};
  window.addEventListener('focus',update);document.addEventListener('visibilitychange',update);window.addEventListener('storage',storage);
  return()=>{active=false;clearInterval(tick);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);window.removeEventListener('storage',storage)};
 },[]);
 const write=async(next:ActiveTimer|null,signal=AbortSignal.timeout(timerTimeout))=>{
  const value=JSON.stringify(next);
  if(cloud){
   const result=await cloud.from('settings').update({value}).eq('key',key).eq('value',raw.current).select('value').abortSignal(signal);
   if(result.error)throw new Error(result.error.message);
   if(!result.data?.length)throw new Error('Der Timer wurde auf einem anderen Gerät geändert. Bitte kurz warten und erneut versuchen.');
  }
  apply(value);
 };
 const run=async(action:()=>Promise<void>)=>{
  if(locked.current)return;
  locked.current=true;revision.current++;setBusy(true);
  try{if(!ready.current)throw new Error('Timer wird noch synchronisiert. Bitte kurz warten und erneut starten.');await action()}
  catch(e){onError(e instanceof Error?e.message:'Timer konnte nicht gespeichert werden.')}
  finally{locked.current=false;setBusy(false);void sync().catch(()=>{})}
 };
 const setTimer=async(next:(Omit<ActiveTimer,'id'>&{id?:number})|null)=>{if(!ready.current){try{await sync()}catch(e){onError(e instanceof Error?e.message:'Timer konnte nicht synchronisiert werden.');return false}}let saved=false;await run(async()=>{
  if(current.current?.stoppedAt&&next)throw new Error('Bitte zuerst die angehaltene Zeit speichern.');
  if(current.current&&next&&!next.id)throw new Error('Es läuft bereits ein Timer. Bitte diesen zuerst stoppen.');
  await write(next?newTimer(next):null);saved=true;
 });return saved};
 const stopTimer=()=>run(async()=>{
  if(!current.current)return;
  const stopped=stoppedTimer(current.current);
  const session=timerSession(stopped);
  const signal=AbortSignal.timeout(timerTimeout);
  let saved;
  try{
   if(cloud){
    const result=await cloud.rpc('finish_timer',{expected_value:raw.current,session_data:session}).abortSignal(signal);
    if(!result.error){
     apply('null');
     onSaved(session,result.data);
     return;
    }
    // Older installations still support saving while the SQL update is pending.
    if(result.error.code!=='PGRST202')throw new Error(result.error.message);
    if(raw.current!==JSON.stringify(stopped))await write(stopped,signal);
    const inserted=await cloud.from('work_sessions')
     .upsert(session,{onConflict:'user_id,id',ignoreDuplicates:true})
     .select('*').abortSignal(signal).maybeSingle();
    if(inserted.error)throw new Error(inserted.error.message);
    saved=inserted.data??session;
    onSaved(session,saved);
    await write(null,signal);
    return;
   }
   saved=await api('/sessions','POST',session);
   await write(null);
   onSaved(session,saved);
  }catch(error){
   if(signal.aborted&&cloud)throw new Error('Die Cloud antwortet gerade nicht. Der Timer wird abgeglichen. Bitte versuche es bei Bedarf erneut.');
   throw error;
  }
 });
 const requestStop=async()=>{
  if(locked.current||!current.current)return;
  show(stoppedTimer(current.current));
 };
 const cancelStop=()=>run(async()=>{
  if(!current.current?.stoppedAt)return;
  const {stoppedAt,...paused}=current.current;
  await write({...paused,paused:true});
 });
 return {timer,setTimer,stopTimer,requestStop,cancelStop,busy};
}
