import { useEffect, useState, type ReactNode } from 'react';
import { cloud, setTimerOwner } from './cloud';
export function Auth({children}:{children:ReactNode}) {
 const [ready,setReady]=useState(!cloud),[signedIn,setSignedIn]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[register,setRegister]=useState(false);
 useEffect(()=>{if(!cloud)return;cloud.auth.getSession().then(({data,error})=>{setTimerOwner(data.session?.user.id||'local');setSignedIn(!!data.session);setReady(true);if(error)setMessage(error.message)});const {data}=cloud.auth.onAuthStateChange((_event,session)=>{setTimerOwner(session?.user.id||'local');setSignedIn(!!session);setReady(true)});return()=>data.subscription.unsubscribe()},[]);
 if(!cloud)return children;
 if(!ready)return <div className="loading">Anmeldung prüfen …</div>;
 if(signedIn)return <><button className="cloud-signout secondary" onClick={()=>cloud!.auth.signOut()}>Abmelden</button>{children}</>;
 const loginName=(import.meta.env.VITE_LOGIN_USERNAME||'').trim();
 const loginEmail=(import.meta.env.VITE_LOGIN_EMAIL||'').trim();
 async function submit(){
  setMessage('');
  const email=!register&&loginName&&username.trim().toLocaleLowerCase('de-DE')===loginName.toLocaleLowerCase('de-DE')?loginEmail:username.trim();
  if(!email.includes('@')){setMessage('Bitte gib deine E-Mail-Adresse ein.');return;}
  setBusy(true);
  try {
   const {error}=register?await cloud!.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin+window.location.pathname}}):await cloud!.auth.signInWithPassword({email,password});
   if(!error&&register)setMessage('Konto erstellt. Bitte bestätige deine E-Mail-Adresse, falls eine Bestätigung angefordert wird.');
   if(error){
    const code=error.code;
    if(code==='email_not_confirmed')setMessage('Bitte bestätige zuerst deine E-Mail-Adresse.');
    else if(code==='invalid_credentials')setMessage('Benutzername oder Passwort stimmt nicht.');
    else if(error.status===429)setMessage('Zu viele Anmeldeversuche. Bitte warte einige Minuten.');
    else setMessage(`Anmeldung fehlgeschlagen: ${error.message} (${code||'HTTP '+error.status}).`);
   }
  }catch{setMessage('Verbindung fehlgeschlagen. Bitte versuche es erneut.');}finally{setBusy(false)}
 }
 return <div className="loading"><form className="modal" onSubmit={e=>{e.preventDefault();void submit()}}><h1>{register?'Konto erstellen':'Willkommen bei Planraum'}</h1><p>Dein persönlicher Uni- und Privatplaner.</p><div className="form-grid"><label className="full">{register?'E-Mail-Adresse':'E-Mail oder bisheriger Benutzername'}<input required type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e=>setUsername(e.target.value)}/></label><label className="full">Passwort<input required type="password" minLength={register?8:1} autoComplete={register?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label></div>{message&&<p role="alert">{message}</p>}<div className="modal-actions"><button disabled={busy} className="primary">{busy?'Bitte warten …':register?'Registrieren':'Anmelden'}</button><button type="button" className="text-btn" disabled={busy} onClick={()=>{setRegister(!register);setMessage('')}}>{register?'Bereits ein Konto? Anmelden':'Neues Konto erstellen'}</button></div></form></div>;
}
