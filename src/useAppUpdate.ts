import {useEffect, useRef} from 'react';
import {pendingApiRequests} from './api';

declare const __APP_BUILD__:string;

// Wait for a quiet moment before navigating away from the current document.
export function useAppUpdate(blocked:boolean){
 const blockedRef=useRef(blocked);blockedRef.current=blocked;
 useEffect(()=>{
  if(import.meta.env.DEV)return;
  let active=true,checking=false,latest='',lastActivity=Date.now(),navigating=false;
  const activity=()=>{lastActivity=Date.now()};
  const apply=()=>{
   if(!active||!latest||navigating||document.visibilityState!=='visible'||blockedRef.current||pendingApiRequests()>0||Date.now()-lastActivity<30000)return;
   if(document.querySelector('.modal-backdrop,[role="dialog"],form')||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return;
   // A version is attempted once per tab, even if a CDN temporarily serves old HTML.
   try{if(sessionStorage.getItem('planraum-auto-update')===latest)return;sessionStorage.setItem('planraum-auto-update',latest)}catch{return}
   navigating=true;
   const url=new URL(window.location.href);url.searchParams.delete('update-check');url.searchParams.set('app-update',latest);
   window.location.replace(url.href);
  };
  const check=async()=>{
   if(!active||checking||document.visibilityState!=='visible'||!navigator.onLine)return;
   checking=true;
   try{
    const url=new URL(window.location.href);url.hash='';url.searchParams.set('update-check',String(Date.now()));
    const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)return;
    const html=new DOMParser().parseFromString(await response.text(),'text/html');
    const build=html.querySelector('meta[name="app-build"]')?.getAttribute('content');
    if(active&&build&&Date.parse(build)>Date.parse(__APP_BUILD__)){latest=build;apply()}
   }catch{/* Retry on the next check; offline use continues normally. */}
   finally{checking=false}
  };
  const resume=()=>{void check()};
  const inputs=['pointerdown','keydown','input','wheel','touchstart'] as const;
  inputs.forEach(event=>document.addEventListener(event,activity,{passive:true}));
  window.addEventListener('focus',resume);window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
  const checks=setInterval(resume,60000),idle=setInterval(apply,5000);resume();
  return()=>{active=false;clearInterval(checks);clearInterval(idle);inputs.forEach(event=>document.removeEventListener(event,activity));window.removeEventListener('focus',resume);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume)};
 },[]);
}
