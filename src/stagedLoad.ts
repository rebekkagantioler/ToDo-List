// Share one read and one preparation pass. Preparation works on a copy so the
// already visible saved data cannot be changed by unfinished background work.
export function stagedLoad<T>(read:()=>Promise<T>,prepare:(snapshot:T)=>Promise<T>){
 const stored=read();
 const complete=stored.then(snapshot=>prepare(structuredClone(snapshot)));
 return {stored,complete};
}
