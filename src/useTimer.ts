import { useEffect, useRef, useState } from 'react';
import { cloud, timerStorageKey } from './cloud';
import { api, isConnectionError } from './api';
import { newTimer, stoppedTimer, timerSession, waitForTimerCloud, type ActiveTimer } from './timer';
const key='active-timer-v1';
const timerTimeout=4000;
const readLocal=():ActiveTimer|null=>{try{const value=JSON.parse(localStorage.getItem(timerStorageKey())||'null');return value?newTimer(value):null}catch{return null}};

export function useTimer(onError:(message:string)=>void,onSaved:(session:ReturnType<typeof timerSession>,saved:unknown)=>void){
 const [timer,setState]=useState<ActiveTimer|null>(cloud?null:readLocal);
 const [busy,setBusy]=useState(false);
 const current=useRef(timer),raw=useRef('null'),locked=useRef(false),revision=useRef(0),ready=useRef(!cloud);
 const show=(next:ActiveTimer|null)=>{current.current=next;setState(next)};
 const apply=(value:string)=>{raw.current=value;const next=JSON.parse(value) as ActiveTimer|null;show(next);if(next)localStorage.setItem(timerStorageKey(),value);else localStorage.removeItem(timerStorageKey())};
 const polling=useRef(false);
 const readCloudTimer=async(signal:AbortSignal)=>{
  const client=cloud;
  if(!client)return 'null';
  const read=()=>client.from('settings').select('value').eq('key',key).abortSignal(signal).maybeSingle();
  const result=await waitForTimerCloud(read(),signal);
  if(result.error)throw new Error(result.error.message);
  if(result.data)return result.data.value as string;
  const inserted=await waitForTimerCloud(client.from('settings')
   .upsert({key,value:JSON.stringify(readLocal())},{onConflict:'user_id,key',ignoreDuplicates:true})
   .select('value').abortSignal(signal).maybeSingle(),signal);
  if(inserted.error)throw new Error(inserted.error.message);
  if(inserted.data)return inserted.data.value as string;
  const winner=await waitForTimerCloud(read(),signal);
  if(winner.error)throw new Error(winner.error.message);
  return winner.data?.value as string|undefined;
 };
 const sync=async()=>{
  if(!cloud||locked.current||polling.current)return;
  const version=revision.current;
  polling.current=true;
  try{
   const value=await readCloudTimer(AbortSignal.timeout(timerTimeout));
   if(value===undefined||locked.current||version!==revision.current)return;
   if(!ready.current||value!==raw.current)apply(value);
   ready.current=true;
  }finally{polling.current=false}
 };
 useEffect(()=>{
  let active=true;
  const update=()=>{if(document.visibilityState==='visible'&&navigator.onLine)void sync().catch(e=>{if(active&&!ready.current&&!isConnectionError(e.message)&&!e.message.startsWith('Die Cloud antwortet'))onError(`Timer konnte nicht synchronisiert werden: ${e.message}`)})};
  update();const tick=setInterval(update,3000);
  const storage=(e:StorageEvent)=>{if(!cloud&&e.key===timerStorageKey())apply(e.newValue||'null')};
  window.addEventListener('focus',update);window.addEventListener('online',update);document.addEventListener('visibilitychange',update);window.addEventListener('storage',storage);
  return()=>{active=false;clearInterval(tick);window.removeEventListener('focus',update);window.removeEventListener('online',update);document.removeEventListener('visibilitychange',update);window.removeEventListener('storage',storage)};
 },[]);
 const write=async(next:ActiveTimer|null,signal=AbortSignal.timeout(timerTimeout))=>{
  const value=JSON.stringify(next);
  if(cloud){
   const result=await waitForTimerCloud(cloud.from('settings').update({value}).eq('key',key).eq('value',raw.current).select('value').abortSignal(signal),signal);
   if(result.error)throw new Error(result.error.message);
   if(!result.data?.length)throw new Error('Der Timer wurde auf einem anderen Gerät geändert. Bitte kurz warten und erneut versuchen.');
  }
  apply(value);
 };
 const run=async(action:()=>Promise<void>)=>{
  if(locked.current)return;
  locked.current=true;revision.current++;setBusy(true);
  try{await action()}
  catch(e){
   const message=e instanceof Error?e.message:'Timer konnte nicht gespeichert werden.';
   onError(isConnectionError(message)?'Die Cloud antwortet gerade nicht. Der Timerstatus wird abgeglichen.':message);
  }
  finally{locked.current=false;setBusy(false);void sync().catch(()=>{})}
 };
 const writeVisible=async(next:ActiveTimer|null,signal?:AbortSignal)=>{
  const previous=current.current;
  show(next);
  try{await write(next,signal)}catch(error){show(previous);throw error}
 };
 const setTimer=async(next:(Omit<ActiveTimer,'id'>&{id?:number})|null)=>{
  let saved=false;
  await run(async()=>{
   const signal=AbortSignal.timeout(timerTimeout);
   const starting=!!(next&&!next.id);
   const proposed=next?newTimer(next):null;
   let previous=current.current;
   if(starting&&!previous)show(proposed);
   try{
    if(!ready.current){
     const value=await readCloudTimer(signal);
     if(value===undefined)throw new Error('Timer konnte nicht synchronisiert werden. Bitte erneut versuchen.');
     apply(value);
     ready.current=true;
     previous=current.current;
    }
    if(previous?.stoppedAt&&next)throw new Error('Bitte zuerst die angehaltene Zeit speichern.');
    if(previous&&starting)throw new Error('Es läuft bereits ein Timer. Bitte diesen zuerst stoppen.');
    if(next?.id&&previous?.id!==next.id)throw new Error('Dieser Timer wurde inzwischen auf einem anderen Gerät geändert.');
    await writeVisible(proposed,signal);
    saved=true;
   }catch(error){
    if(starting)show(previous);
    if(signal.aborted&&cloud)throw new Error('Die Cloud antwortet gerade nicht. Der Timerstatus wird abgeglichen.');
    throw error;
   }
  });
  return saved;
 };
 const stopTimer=()=>run(async()=>{
  if(!current.current)return;
  const stopped=stoppedTimer(current.current);
  const session=timerSession(stopped);
  const signal=AbortSignal.timeout(timerTimeout);
  let saved;
  try{
   if(cloud){
    const result=await waitForTimerCloud(cloud.rpc('finish_timer',{expected_value:raw.current,session_data:session}).abortSignal(signal),signal);
    if(!result.error){
     apply('null');
     onSaved(session,result.data);
     return;
    }
    // Older installations still support saving while the SQL update is pending.
    if(result.error.code!=='PGRST202')throw new Error(result.error.message);
    if(raw.current!==JSON.stringify(stopped))await write(stopped,signal);
    const inserted=await waitForTimerCloud(cloud.from('work_sessions')
     .upsert(session,{onConflict:'user_id,id',ignoreDuplicates:true})
     .select('*').abortSignal(signal).maybeSingle(),signal);
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
  await writeVisible({...paused,paused:true});
 });
 return {timer,setTimer,stopTimer,requestStop,cancelStop,busy};
}
