import {useEffect,useRef,useState} from 'react';
import {Gift,Trash2,Plus,Tag,Users,UserRound,X,LockKeyhole,Sparkles} from 'lucide-react';
import {cloud} from './cloud';
import {wichtelInputError,wichtelNames,engilaRoundTitle,type WichtelRound} from './wichtel';
import {deleteWichtelRound,drawWichtel,listWichtelRounds} from './wichtelApi';
import {WichtelRoundLinks} from './WichtelRoundLinks';
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
 const [rounds,setRounds]=useState<WichtelRound[]>([]),[loading,setLoading]=useState(true),[title,setTitle]=useState('Engila Bengila '+new Date().getFullYear()),[people,setPeople]=useState<string[]>([]),[draft,setDraft]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[confirmDelete,setConfirmDelete]=useState<string|null>(null),[copied,setCopied]=useState('');
 const lock=useRef(false),request=useRef<{signature:string;id:string}|null>(null);
 const names=people,inputError=wichtelInputError(title,names);
 useEffect(()=>{let active=true;void listWichtelRounds().then(value=>{if(active)setRounds(value)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[]);
 async function run(action:()=>Promise<void>){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{await action()}catch(e){setError(e instanceof Error?e.message:'Das hat gerade nicht funktioniert. Bitte noch einmal versuchen.')}finally{setBusy(false);lock.current=false}}
 async function create(){
  if(inputError){setError(inputError);return;}
  await run(async()=>{
   const signature=JSON.stringify([title.trim(),names]);
   if(request.current?.signature!==signature)request.current={signature,id:crypto.randomUUID()};
   await drawWichtel(request.current.id,title.trim(),names);
   setRounds(await listWichtelRounds());request.current=null;setPeople([]);setDraft('');setNotice('Ausgelost! Jetzt kannst du die persönlichen Links einzeln weitergeben.');
  });
 }
 function addPeople(value:string){const next=wichtelNames(value);if(!next.length)return;setPeople(current=>[...current,...next]);setDraft('')}
 function addDraft(){addPeople(draft)}
 async function copy(id:string,link:string){try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(link);setCopied(id);setNotice('Persönlicher Link kopiert.')}catch{setNotice('Tippe auf das Linkfeld, um den Link zu markieren und manuell zu kopieren.')}}
 return <section className="wichtel-admin"><div className="wichtel-hero"><p className="wichtel-admin-badge"><LockKeyhole size={14}/> Nur für dich</p><h1><Gift size={33}/>Engila Bengila</h1><div className="wichtel-snowline"><span/><Sparkles size={18}/><span/></div><p>Namen eintragen, auslosen und die persönlichen Links verschicken.<br/>Du kannst dich selbst eintragen und mitspielen.</p></div>
  {error&&<p className="save-error" role="alert">{error}</p>}{notice&&<p className="wichtel-notice" role="status">{notice}</p>}
  <form className="wichtel-create panel" onSubmit={e=>{e.preventDefault();void create()}}><div className="wichtel-create-title"><Sparkles size={22}/><h2>Eine neue Runde</h2></div><fieldset disabled={busy||loading}><label htmlFor="wichtel-title"><Tag size={16}/>Name der Runde</label><input id="wichtel-title" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/><label className="wichtel-people-label" htmlFor="wichtel-person"><Users size={22}/>Wer macht mit?</label><div className="wichtel-chipbox" aria-describedby="wichtel-names-help">{people.map((person,index)=><span className="wichtel-chip" key={person+'-'+index}><UserRound size={15}/>{person}<button type="button" aria-label={person+' entfernen'} onClick={()=>setPeople(current=>current.filter((_,i)=>i!==index))}><X size={14}/></button></span>)}<input id="wichtel-person" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addDraft()}}} onPaste={e=>{const pasted=e.clipboardData.getData('text');if(/[\r\n,;]/.test(pasted)){e.preventDefault();addPeople(pasted)}}} placeholder={people.length?'Weitere Person …':'Name eingeben …'}/><button type="button" className="wichtel-add-person" onClick={addDraft} aria-label="Person hinzufügen"><Plus size={17}/><span>Person hinzufügen</span></button></div><p className="muted" id="wichtel-names-help">Name eingeben und Enter drücken · mehrere Namen kannst du einfach einfügen · mindestens 2 Personen.</p>{names.length>0&&<p className="wichtel-count">{names.length} {names.length===1?'Person':'Personen'}{inputError&&' · '+inputError}</p>}<button className="primary wichtel-draw" type="submit" disabled={busy||loading||!!inputError}><Gift size={19}/>{busy?'Bitte warten …':'Auslosen & Links erstellen'}</button></fieldset><p className="wichtel-promise"><LockKeyhole size={15}/>Jede Person bekommt genau eine andere Person. Die Auslosung bleibt danach fest.</p></form>
  {loading&&<p className="muted" role="status">Deine Engila-Bengila-Runden werden geladen …</p>}
  <div className="wichtel-rounds">{rounds.map(round=><article key={round.id} className="wichtel-round panel"><header><div><h2>{engilaRoundTitle(round.title)}</h2><p className="muted">{round.people.length} Personen · ausgelost am {new Date(round.created_at).toLocaleDateString('de-AT',{timeZone:'Europe/Vienna'})}</p></div><button className="icon-btn" title="Auslosung löschen" aria-label={engilaRoundTitle(round.title)+': Auslosung löschen'} disabled={busy} onClick={()=>setConfirmDelete(round.id)}><Trash2 size={18}/></button></header><p className="muted">Hier siehst du nur die Namen und persönlichen Links, keine Zuordnungen. Gib jeder Person ihren Link. Dein eigenes Los öffnest du über deinen eigenen Link.</p><WichtelRoundLinks round={round} base={window.location.href} copied={copied} onCopy={(id,link)=>void copy(id,link)}/>{confirmDelete===round.id&&<div className="wichtel-delete"><p>„{engilaRoundTitle(round.title)}“ löschen? Alle persönlichen Links dieser Runde werden damit ungültig.</p><div className="modal-actions"><button className="secondary" disabled={busy} onClick={()=>setConfirmDelete(null)}>Abbrechen</button><button className="danger" disabled={busy} onClick={()=>void run(async()=>{await deleteWichtelRound(round.id);setRounds(await listWichtelRounds());setConfirmDelete(null);setNotice('Die Runde wurde gelöscht. Ihre Links sind jetzt ungültig.')})}>Runde endgültig löschen</button></div></div>}</article>)}</div>
  {!loading&&!error&&!rounds.length&&<p className="wichtel-empty"><Plus size={18}/>Deine erste Runde beginnt mit den Namen oben.</p>}
 </section>;
}
