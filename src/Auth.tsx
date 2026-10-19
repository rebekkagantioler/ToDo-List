import { useEffect, useState, type ReactNode } from 'react';
import { cloud, setTimerOwner } from './cloud';
import { credentialsEmail } from './credentials';
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
  let email:string;
  try{email=credentialsEmail(username,register,loginName,loginEmail)}catch(error){setMessage((error as Error).message);return;}
  setBusy(true);
  try {
   const {data,error}=register?await cloud!.auth.signUp({email,password,options:{data:{username:username.trim()}}}):await cloud!.auth.signInWithPassword({email,password});
   if(!error&&register&&!data.session)setMessage('Die Registrierung benötigt noch eine Einstellung: In Supabase muss die E-Mail-Bestätigung deaktiviert werden.');
   if(error){
    const code=error.code;
    if(code==='email_not_confirmed')setMessage('Die Anmeldung benötigt noch eine Einstellung: In Supabase muss die E-Mail-Bestätigung deaktiviert werden.');
    else if(code==='user_already_exists'||code==='email_exists')setMessage('Dieser Benutzername ist bereits vergeben.');
    else if(code==='signup_disabled')setMessage('Die Registrierung ist in Supabase noch nicht freigeschaltet.');
    else if(code==='invalid_credentials')setMessage('Benutzername oder Passwort stimmt nicht.');
    else if(error.status===429)setMessage('Zu viele Anmeldeversuche. Bitte warte einige Minuten.');
    else setMessage(`Anmeldung fehlgeschlagen: ${error.message} (${code||'HTTP '+error.status}).`);
   }
  }catch{setMessage('Verbindung fehlgeschlagen. Bitte versuche es erneut.');}finally{setBusy(false)}
 }
 return <div className="loading"><form className="modal" onSubmit={e=>{e.preventDefault();void submit()}}><h1>{register?'Konto erstellen':'Willkommen bei Planraum'}</h1><p>Dein persönlicher Uni- und Privatplaner.</p><div className="form-grid"><label className="full">Benutzername<input required type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e=>setUsername(e.target.value)}/></label><label className="full">Passwort<input required type="password" minLength={register?8:1} autoComplete={register?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)}/></label></div>{message&&<p role="alert">{message}</p>}<div className="modal-actions"><button disabled={busy} className="primary">{busy?'Bitte warten …':register?'Registrieren':'Anmelden'}</button><button type="button" className="text-btn" disabled={busy} onClick={()=>{setRegister(!register);setMessage('')}}>{register?'Bereits ein Konto? Anmelden':'Neues Konto erstellen'}</button></div></form></div>;
}
