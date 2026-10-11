import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('API: persistence, validation, relationships and complete backup round-trip', async () => {
 const dir=await mkdtemp(join(tmpdir(),'planraum-test-'));
 const port=33000+Math.floor(Math.random()*10000);
 const child=spawn(process.execPath,['--import','tsx','server/index.ts'],{env:{...process.env,PORT:String(port),DATABASE_PATH:join(dir,'test.sqlite')},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d);
 const request=async(path:string,method='GET',body?:unknown)=>fetch(`http://127.0.0.1:${port}/api${path}`,{method,headers:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 try {
  let ready=false;for(let i=0;i<100;i++){try{if((await request('/data')).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,50))}assert.ok(ready,log);
  const c=await (await request('/courses','POST',{name:'Mathematik',code:'MA',semester:'WS',ects:6,hours_per_ects:25,color:'#123456',description:''})).json();
  const t=await (await request('/tasks','POST',{title:'Blatt',area:'Universität',type:'Hausaufgabe',course_id:c.id,estimate_minutes:0,tracking:0})).json();
  let data=await (await request('/data')).json();assert.equal(data.tasks[0].tracking,0);assert.equal(data.tasks[0].estimate_minutes,0);
  assert.equal((await request('/sessions','POST',{task_id:t.id,started_at:'2026-10-11T10:00:00Z',ended_at:'2026-10-11T09:00:00Z'})).status,400);
  assert.equal((await request('/sessions','POST',{task_id:99999,started_at:'2026-10-11T09:00:00Z',ended_at:'2026-10-11T10:00:00Z'})).status,400);
  const b=await (await request('/blocks','POST',{task_id:t.id,course_id:c.id,title:'Plan',starts_at:'2026-10-11T09:00',ends_at:'2026-10-11T10:00'})).json();
  await request(`/blocks/${b.id}`,'DELETE');data=await (await request('/data')).json();assert.equal(data.tasks.length,1);
  await request('/sessions','POST',{task_id:t.id,started_at:'2026-10-11T09:00Z',ended_at:'2026-10-11T10:00Z'});
  await request('/recurring','POST',{course_id:c.id,title:'Vorlesung',weekday:1,start_time:'09:00',end_time:'10:00',starts_on:'2026-10-01',ends_on:'2027-02-01',auto_track:1});
  data=await (await request('/data')).json();data.settings=[{key:'theme',value:'dark'}];data.courses[0].created_at='2025-01-01T12:00:00Z';
  assert.equal((await request('/import','POST',data)).status,200);
  assert.deepEqual(await (await request('/data')).json(),data);
  assert.equal((await request('/import','POST',{})).status,400);
  const bad=structuredClone(data);bad.sessions[0].task_id=999999;
  assert.equal((await request('/import','POST',bad)).status,400);assert.deepEqual(await (await request('/data')).json(),data);
  await request(`/courses/${c.id}`,'DELETE');data=await (await request('/data')).json();assert.equal(data.tasks[0].course_id,null);assert.equal(data.recurring.length,0);
  await request(`/tasks/${t.id}`,'DELETE');data=await (await request('/data')).json();assert.equal(data.sessions.length,0);
 } finally {child.kill();await new Promise<void>(resolve=>{if(child.exitCode!==null)resolve();else child.once('exit',()=>resolve())});await rm(dir,{recursive:true,force:true})}
});
