import {useEffect,useRef,useState} from 'react';
import {Gift,Copy,Trash2,Plus,Check} from 'lucide-react';
import {cloud} from './cloud';
import {wichtelInputError,wichtelNames,wichtelLink,type WichtelRound} from './wichtel';
import {deleteWichtelRound,drawWichtel,listWichtelRounds} from './wichtelApi';
import './wichtel.css';

export function useWichtelAccess(){
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{let active=true;
  if(!cloud)return;
  void (async()=>{
   const session=await cloud.auth.getSession();
   const email=session.data.session?.user.email?.toLowerCase();
   const legacyName=(import.meta.env.VITE_LOGIN_USERNAME||'').trim().toLowerCase();
   const legacyEmail=(import.meta.env.VITE_LOGIN_EMAIL||'').trim().toLowerCase();
   const setupOwner=legacyName==='rebekka'&&!!email&&email===legacyEmail;
   const result=await cloud.rpc('wichtel_is_admin');
   if(active)setAllowed(result.error?setupOwner:result.data===true);
  })().catch(()=>{});
  return()=>{active=false};
 },[]);
 return allowed;
}

export function Wichtel(){
 const [rounds,setRounds]=useState<WichtelRound[]>([]),[loading,setLoading]=useState(true),[title,setTitle]=useState('Weihnachtswichteln '+new Date().getFullYear()),[text,setText]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[confirmDelete,setConfirmDelete]=useState<string|null>(null),[copied,setCopied]=useState('');
 const lock=useRef(false),request=useRef<{signature:string;id:string}|null>(null);
 const names=wichtelNames(text),inputError=wichtelInputError(title,names);
 useEffect(()=>{let active=true;void listWichtelRounds().then(value=>{if(active)setRounds(value)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await action()}catch(e){setError(e instanceof Error?e.message:'Das hat gerade nicht funktioniert. Bitte noch einmal versuchen.')}finally{setBusy(false);lock.current=false}}
 async function create(){
  if(inputError){setError(inputError);return;}
  await run(async()=>{
   const signature=JSON.stringify([title.trim(),names]);
   if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
   await drawWichtel(request.current.id,title.trim(),names);
   setRounds(await listWichtelRounds());request.current=null;setText('');setNotice('Ausgelost! Jetzt kannst du die persönlichen Links einzeln weitergeben.');
  });
 }
 async function copy(id:string,link:string){try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(link);setCopied(id);setNotice('Persönlicher Link kopiert.')}catch{setNotice('Tippe auf das Linkfeld, um den Link zu markieren und manuell zu kopieren.')}}
 return <section className="wichtel-admin"><div className="page-heading"><div><p className="eyebrow">Nur für dich</p><h1><Gift size={30}/>Weihnachtswichteln</h1><p className="muted">Namen eintragen, auslosen und jeder Person ihren eigenen Link schicken.</p></div></div>
  {error&&<p className="save-error" role="alert">{error}</p>}{notice&&<p className="wichtel-notice" role="status">{notice}</p>}
  <form className="wichtel-create panel" onSubmit={e=>{e.preventDefault();void create()}}><h2>Eine neue Wichtelrunde</h2><fieldset disabled={busy||loading}><label htmlFor="wichtel-title">Name der Runde</label><input id="wichtel-title" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/><label htmlFor="wichtel-names">Wer macht mit?</label><textarea id="wichtel-names" rows={6} value={text} onChange={e=>setText(e.target.value)} placeholder={'Anna\nBen\nClara'} aria-describedby="wichtel-names-help"/><p className="muted" id="wichtel-names-help">Eine Person pro Zeile · mindestens 2 · bei gleichen Vornamen einen Zusatz verwenden.</p>{names.length>0&&<p className="wichtel-count">{names.length} {names.length===1?'Person':'Personen'}{inputError&&' · '+inputError}</p>}<button className="primary" type="submit" disabled={busy||loading||!!inputError}><Gift size={17}/>{busy?'Bitte warten …':'Auslosen & Links erstellen'}</button></fieldset><p className="wichtel-promise">Jede Person bekommt genau eine andere Person. Die Auslosung bleibt danach fest.</p></form>
  {loading&&<p className="muted" role="status">Deine Wichtelrunden werden geladen …</p>}
  <div className="wichtel-rounds">{rounds.map(round=><article key={round.id} className="wichtel-round panel"><header><div><h2>{round.title}</h2><p className="muted">{round.people.length} Personen · ausgelost am {new Date(round.created_at).toLocaleDateString('de-AT',{timeZone:'Europe/Vienna'})}</p></div><button className="icon-btn" title="Auslosung löschen" aria-label={round.title+': Auslosung löschen'} disabled={busy} onClick={()=>setConfirmDelete(round.id)}><Trash2 size={18}/></button></header><p className="muted">Gib jeder Person nur ihren eigenen Link. Zum Öffnen braucht sie kein Planraum-Konto.</p><ul className="wichtel-links">{round.people.map(person=>{const link=wichtelLink(person.token,window.location.href);return <li key={person.id}><label htmlFor={'wichtel-link-'+person.id}>{person.name}</label><div><input id={'wichtel-link-'+person.id} readOnly value={link} onFocus={e=>e.currentTarget.select()} aria-label={'Persönlicher Wichtellink für '+person.name}/><button type="button" className="secondary" onClick={()=>void copy(person.id,link)} aria-label={'Link für '+person.name+' kopieren'}>{copied===person.id?<Check size={16}/>:<Copy size={16}/>}<span>{copied===person.id?'Kopiert':'Kopieren'}</span></button></div></li>})}</ul>{confirmDelete===round.id&&<div className="wichtel-delete"><p>„{round.title}“ löschen? Alle persönlichen Links dieser Runde werden damit ungültig.</p><div className="modal-actions"><button className="secondary" disabled={busy} onClick={()=>setConfirmDelete(null)}>Abbrechen</button><button className="danger" disabled={busy} onClick={()=>void run(async()=>{await deleteWichtelRound(round.id);setRounds(await listWichtelRounds());setConfirmDelete(null);setNotice('Die Runde wurde gelöscht. Ihre Links sind jetzt ungültig.')})}>Runde endgültig löschen</button></div></div>}</article>)}</div>
  {!loading&&!error&&!rounds.length&&<p className="wichtel-empty"><Plus size={18}/>Deine erste Runde beginnt mit den Namen oben.</p>}
 </section>;
}
