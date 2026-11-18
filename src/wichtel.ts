export type WichtelPerson={id:string;name:string;token:string;revealed_at:string|null};
export type WichtelRound={id:string;title:string;created_at:string;people:WichtelPerson[]};
export type WichtelResult={title:string;giver:string;recipient:string};
export const validWichtelToken=(token:string)=>/^[a-f0-9]{64}$/.test(token);
export function wichtelToken(hash:string):string|null{return new URLSearchParams(hash.replace(/^#/,'')).get('engila')??new URLSearchParams(hash.replace(/^#/, '')).get('wichteln')}
export function wichtelLink(token:string,base:string){
 if(!validWichtelToken(token))throw new Error('Ungültiger persönlicher Link.');
 const url=new URL(base);url.search='';url.hash=`engila=${token}`;return url.toString();
}
export function wichtelNames(text:string){return text.split(/\r?\n/).map(name=>name.trim().normalize('NFC')).filter(Boolean)}
export function wichtelInputError(title:string,names:string[]){
 if(!title.trim()||title.trim().length>120)return 'Bitte einen Titel mit höchstens 120 Zeichen eingeben.';
 if(names.length<2||names.length>100)return 'Bitte 2 bis 100 Personen eintragen, jeweils eine pro Zeile.';
 if(names.some(name=>!name.trim()||name.length>80))return 'Jeder Name muss 1 bis 80 Zeichen lang sein.';
 if(new Set(names.map(name=>name.toLocaleLowerCase('de-AT'))).size!==names.length)return 'Bitte jede Person eindeutig benennen, bei gleichen Vornamen mit einem Zusatz.';
 return '';
}

export function engilaRoundTitle(title:string){return title.replace(/^Weihnachtswichteln(?= |$)/,'Engila Bengila')}
