import {Gift,LockKeyhole} from 'lucide-react';
import type {CSSProperties} from 'react';
import type {WichtelResult} from './wichtel';

export function WichtelGiftCard({result,missing,busy,error,onReveal}:{result:WichtelResult|null;missing:boolean;busy:boolean;error:string;onReveal:()=>void}){
 const length=Array.from(result?.recipient??'').length;
 const nameSize=length<=10?15:length<=18?12:length<=30?9:length<=50?6:3.5;
 return <main className="wichtel-gift-page"><section className="wichtel-gift-card engila-scene" aria-label={result?'Persönliches Engila-Bengila-Los für '+result.giver:'Dein Engila-Bengila-Los'}><h1 className="engila-heading">Engila Bengila <Gift aria-hidden="true"/></h1><div className="engila-divider" aria-hidden="true"><span/>❄<span/></div><div className="engila-frame" data-state={missing?'missing':result?'open':'closed'} aria-live="polite">{missing?<><h2>Dieser Link ist nicht mehr gültig.</h2><p>Die Runde wurde gelöscht oder der Link ist unvollständig. Bitte frag die Organisatorin.</p></>:result?<><h2 className="engila-drawn-intro">Du hast</h2><strong className="wichtel-recipient" style={{'--engila-name-size':nameSize+'cqw'} as CSSProperties}>{result.recipient}</strong><p className="engila-drawn-end">gezogen!</p></>:<><h2>Dein Los wartet auf dich.</h2><p>Wer ist dein Bengila?</p><button className="wichtel-open" disabled={busy} onClick={onReveal}><Gift size={18} aria-hidden="true"/>{busy?'Dein Los wird geöffnet …':'Mein Los öffnen'}</button></>}</div><p className="engila-secret"><LockKeyhole aria-hidden="true"/><span>Psst! Behalte es für dich!</span><span aria-hidden="true">🤫</span></p></section>{error&&<p className="wichtel-gift-error" role="alert">{error}</p>}<span className="wichtel-gift-brand">Engila Bengila · Planraum</span></main>;
}
