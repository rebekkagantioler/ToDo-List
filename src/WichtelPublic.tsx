import {useEffect,useRef,useState} from 'react';
import {WichtelGiftCard} from './WichtelGiftCard';
import {validWichtelToken,type WichtelResult} from './wichtel';
import {revealWichtel} from './wichtelApi';
import './wichtel.css';

export default function WichtelPublic({token}:{token:string}){
 const [result,setResult]=useState<WichtelResult|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[missing,setMissing]=useState(!validWichtelToken(token));
 const lock=useRef(false);
 useEffect(()=>{const previous=document.title;document.title='Dein Engila-Bengila-Los · Planraum';return()=>{document.title=previous}},[]);
 async function reveal(){if(lock.current||!validWichtelToken(token))return;lock.current=true;setBusy(true);setError('');try{const value=await revealWichtel(token);setResult(value);setMissing(!value)}catch(e){setError(e instanceof Error?e.message:'Dein Los konnte gerade nicht geöffnet werden. Bitte noch einmal versuchen.')}finally{setBusy(false);lock.current=false}}
 return <WichtelGiftCard result={result} missing={missing} busy={busy} error={error} onReveal={()=>void reveal()}/>;
}
