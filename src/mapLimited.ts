// Finish active requests before rejecting, so retries cannot overlap their writes.
export async function mapLimited<T,R>(items:readonly T[],limit:number,work:(item:T)=>Promise<R>):Promise<R[]>{
 if(!Number.isInteger(limit)||limit<1)throw new Error('Ungültige Parallelität');
 const results:R[]=new Array(items.length);
 let index=0,failed=false,error:unknown;
 await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{
  while(!failed&&index<items.length){
   const current=index++;
   try{results[current]=await work(items[current])}catch(reason){failed=true;error??=reason}
  }
 }));
 if(failed)throw error;
 return results;
}
