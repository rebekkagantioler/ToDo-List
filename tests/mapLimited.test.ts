import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mapLimited} from '../src/mapLimited';

test('independent writes overlap up to the limit and results preserve task order',async()=>{
 let active=0,peak=0;
 const release:Array<()=>void>=[];
 const pending=mapLimited([0,1,2,3,4],2,async item=>{
  active++;peak=Math.max(peak,active);
  await new Promise<void>(resolve=>release.push(resolve));active--;return item*10;
 });
 assert.equal(active,2);
 while(release.length){release.shift()!();await new Promise(resolve=>setImmediate(resolve));}
 assert.deepEqual(await pending,[0,10,20,30,40]);assert.equal(peak,2);assert.equal(active,0);
});
test('failure waits for active writes and prevents queued writes from starting before retry',async()=>{
 const started:number[]=[];let finish!:()=>void,settled=false;
 const failure=new Error('connection');
 const pending=mapLimited([0,1,2,3],2,async item=>{
  started.push(item);if(item===0)throw failure;
  await new Promise<void>(resolve=>{finish=resolve});return item;
 });
 const checked=assert.rejects(pending,error=>error===failure).then(()=>{settled=true});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(settled,false);assert.deepEqual(started,[0,1]);
 finish();await checked;assert.equal(settled,true);assert.deepEqual(started,[0,1]);
 assert.deepEqual(await mapLimited([2,3],2,async item=>item),[2,3]);
});
test('empty batches need no requests and invalid concurrency is rejected',async()=>{
 assert.deepEqual(await mapLimited([],4,async()=>{throw new Error('unexpected request')}),[]);
 await assert.rejects(mapLimited([1],0,async value=>value));
});
