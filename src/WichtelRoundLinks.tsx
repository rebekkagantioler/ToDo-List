import {Copy,Check} from 'lucide-react';
import {wichtelLink,type WichtelRound} from './wichtel';

// Administration receives no assignments and never opens participants' links.
export function WichtelRoundLinks({round,base,copied,onCopy}:{round:WichtelRound;base:string;copied:string;onCopy:(id:string,link:string)=>void}){
 return <ul className="wichtel-links">{round.people.map(person=>{
  const link=wichtelLink(person.token,base);
  const initial=Array.from(person.name.trim())[0]?.toLocaleUpperCase('de-AT')||'?';
  return <li key={person.id} className={copied===person.id?'is-copied':''}><div className="wichtel-person"><span className="wichtel-avatar" aria-hidden="true">{initial}</span><div><label htmlFor={'wichtel-link-'+person.id}>{person.name}</label><span>Persönlicher Engila-Bengila-Link</span></div></div><div className="wichtel-link-action"><input id={'wichtel-link-'+person.id} readOnly value={link} onFocus={e=>e.currentTarget.select()} aria-label={'Persönlicher Engila-Bengila-Link für '+person.name}/><button type="button" className="secondary" onClick={()=>onCopy(person.id,link)} aria-label={'Link für '+person.name+' kopieren'}>{copied===person.id?<Check size={16}/>:<Copy size={16}/>}<span>{copied===person.id?'Kopiert':'Link kopieren'}</span></button></div></li>;
 })}</ul>;
}
