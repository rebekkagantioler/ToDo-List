import { useEffect, useState, type ReactNode } from 'react';
import { cloud, setTimerOwner } from './cloud';
export function Auth({children}:{children:ReactNode}) {
 const [ready,setReady]=useState(!cloud),[signedIn,setSignedIn]=useState(false),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!cloud)return;cloud.auth.getSession().then(({data,error})=>{setTimerOwner(data.session?.user.id||'local');setSignedIn(!!data.session);setReady(true);if(error)setMessage(error.message)});const {data}=cloud.auth.onAuthStateChange((_event,session)=>{setTimerOwner(session?.user.id||'local');setSignedIn(!!session);setReady(true)});return()=>data.subscription.unsubscribe()},[]);
 if(!cloud)return children;
 if(!ready)return <div className="loading">Anmeldung prüfen …</div>;
 if(signedIn)return <><button className="cloud-signout secondary" onClick={()=>cloud!.auth.signOut()}>Abmelden</button>{children}</>;
 async function submit(register:boolean){setBusy(true);try {const result=register?await cloud!.auth.signUp({email,password}):await cloud!.auth.signInWithPassword({email,password});setMessage(result.error?.message || (register?'Bitte bestätige gegebenenfalls deine E-Mail-Adresse.':''));}finally{setBusy(false)}}
 return <div className="loading"><form className="modal" onSubmit={e=>{e.preventDefault();void submit(false)}}><h1>Planraum</h1><p>Melde dich an, um deine persönlichen Daten zu öffnen.</p><div className="form-grid"><label className="full">E-Mail<input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label><label className="full">Passwort<input required minLength={8} type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label></div>{message&&<p role="alert">{message}</p>}<div className="modal-actions"><button disabled={busy} type="button" className="secondary" onClick={()=>void submit(true)}>Konto erstellen</button><button disabled={busy} className="primary">Anmelden</button></div></form></div>;
}
