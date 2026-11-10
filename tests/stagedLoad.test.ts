import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stagedLoad} from '../src/stagedLoad';

test('saved data is available before slow automatic writes finish and is isolated from them',async()=>{
 let finish!:()=>void;
 const flight=stagedLoad(async()=>({tasks:['existing']}),async data=>{
  data.tasks.push('generated');await new Promise<void>(resolve=>{finish=resolve});return data;
 });
 const saved=await flight.stored;
 assert.deepEqual(saved.tasks,['existing']);
 let completed=false;void flight.complete.then(()=>{completed=true});
 await new Promise(resolve=>setImmediate(resolve));assert.equal(completed,false);
 finish();assert.deepEqual((await flight.complete).tasks,['existing','generated']);
 assert.deepEqual(saved.tasks,['existing']);
});
test('background update failure preserves the successfully loaded snapshot',async()=>{
 const failure=new Error('AbortError: Fetch is aborted');
 const flight=stagedLoad(async()=>({tasks:['saved']}),async()=>{throw failure});
 const checked=assert.rejects(flight.complete,error=>error===failure);
 assert.deepEqual(await flight.stored,{tasks:['saved']});await checked;
});
test('read failure does not start automatic writes or expose empty data as a successful load',async()=>{
 let prepared=false;const failure=new Error('settings: connection interrupted');
 const flight=stagedLoad(async():Promise<object>=>{throw failure},async data=>{prepared=true;return data});
 await Promise.all([assert.rejects(flight.stored,error=>error===failure),assert.rejects(flight.complete,error=>error===failure)]);
 assert.equal(prepared,false);
});
