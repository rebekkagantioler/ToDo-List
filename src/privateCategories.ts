import type { AppData } from './types';
export type PrivateCategory={name:string;includeInStatistics:boolean};
export const privateCategoriesKey='private-categories';
export const defaultPrivateCategories:PrivateCategory[]=[...['Haushalt','Einkaufen','Sport','Termin','Sonstiges'].map(name=>({name,includeInStatistics:true})),{name:'Kapellmeisterkurs',includeInStatistics:false}];
export function privateCategories(data:AppData):PrivateCategory[]{
 try{
  const raw=data.settings.find(s=>s.key===privateCategoriesKey)?.value;
  if(!raw)return defaultPrivateCategories.map(c=>({...c}));
  const parsed=JSON.parse(raw);
  if(!Array.isArray(parsed))throw new Error();
  const seen=new Set<string>();
  return parsed.filter(c=>typeof c?.name==='string'&&c.name.trim()&&typeof c.includeInStatistics==='boolean').flatMap(c=>{const name=c.name.trim(),key=name.toLocaleLowerCase('de');if(seen.has(key))return [];seen.add(key);return [{name,includeInStatistics:c.includeInStatistics}]});
 }catch{return defaultPrivateCategories.map(c=>({...c}))}
}
export function categoryCounts(data:AppData,name:string){
 return privateCategories(data).find(c=>c.name.toLocaleLowerCase('de')===name.toLocaleLowerCase('de'))?.includeInStatistics??!name.toLocaleLowerCase('de').replace(/[\s-]+/g,'').includes('kapellmeisterkurs');
}
