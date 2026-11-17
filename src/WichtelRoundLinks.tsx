import {Copy,Check} from 'lucide-react';
import {wichtelLink,type WichtelRound} from './wichtel';

// Administration receives no assignments and never opens participants' links.
export function WichtelRoundLinks({round,base,copied,onCopy}:{round:WichtelRound;base:string;copied:string;onCopy:(id:string,link:string)=>void}){
 return <ul className="wichtel-links">{round.people.map(person=>{
  const link=wichtelLink(person.token,base);
  return <li key={person.id}><label htmlFor={'wichtel-link-'+person.id}>{person.name}</label><div><input id={'wichtel-link-'+person.id} readOnly value={link} onFocus={e=>e.currentTarget.select()} aria-label={'Persönlicher Engila-Bengila-Link für '+person.name}/><button type="button" className="secondary" onClick={()=>onCopy(person.id,link)} aria-label={'Link für '+person.name+' kopieren'}>{copied===person.id?<Check size={16}/>:<Copy size={16}/>}<span>{copied===person.id?'Kopiert':'Kopieren'}</span></button></div></li>;
 })}</ul>;
}
