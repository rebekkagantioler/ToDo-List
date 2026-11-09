import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {Info} from 'lucide-react';
export function FieldInfo({label,children}:{label:string;children:ReactNode}){
 const [open,setOpen]=useState(false),id=useId(),root=useRef<HTMLSpanElement>(null),button=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false)};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);button.current?.focus()}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
 },[open]);
 return <span className="field-info" ref={root}><button ref={button} type="button" aria-label={`Info: ${label}`} aria-expanded={open} aria-controls={open?id:undefined} onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(value=>!value)}}><Info size={15}/></button>{open&&<span className="field-info-box" id={id} role="note" aria-live="polite"><strong>{label}</strong><span>{children}</span></span>}</span>;
}
