import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newTimer, timerDuration, stoppedTimer, timerSession } from '../src/timer';

test('timer duration uses shared timestamps and excludes pauses',()=>{
 const timer=newTimer({startedAt:'2026-10-27T10:00:00Z',accumulatedMs:60000});
 const now=Date.parse('2026-10-27T10:02:00Z');
 assert.equal(timerDuration(timer,now),180000);
 assert.equal(timerDuration({...timer,paused:true},now),60000);
 assert.equal(newTimer(timer).id,timer.id);
});
test('stopping on another device and retrying saves the same session identity and duration',()=>{
 const timer=newTimer({courseId:7,startedAt:'2026-10-27T10:00:00Z',accumulatedMs:60000});
 const stopped=stoppedTimer(timer,Date.parse('2026-10-27T10:02:00Z'));
 const retry=stoppedTimer(JSON.parse(JSON.stringify(stopped)),Date.parse('2026-10-27T11:00:00Z'));
 assert.deepEqual(timerSession(retry),timerSession(stopped));
 assert.deepEqual(timerSession(stopped),{id:timer.id,task_id:null,course_id:7,kind:'Selbstlernen',note:'',started_at:'2026-10-27T09:59:00.000Z',ended_at:'2026-10-27T10:02:00.000Z'});
});

test('elapsed display starts at zero and counts upward through minutes and hours',async()=>{
 const { elapsedLabel }=await import('../src/timer');
 assert.equal(elapsedLabel(0),'0:00');
 assert.equal(elapsedLabel(59000),'0:59');
 assert.equal(elapsedLabel(60000),'1:00');
 assert.equal(elapsedLabel(25*60000),'25:00');
 assert.equal(elapsedLabel(3600000),'1:00:00');
});
test('stopping freezes elapsed time while the save or discard decision is open',()=>{
 const timer=newTimer({startedAt:'2026-10-28T10:00:00Z'});
 const stopped=stoppedTimer(timer,Date.parse('2026-10-28T10:03:00Z'));
 assert.equal(timerDuration(stopped,Date.parse('2026-10-28T10:20:00Z')),180000);
 const {stoppedAt,...paused}=stopped;
 const resumed={...paused,paused:false,startedAt:'2026-10-28T10:20:00Z'};
 assert.equal(timerDuration(resumed,Date.parse('2026-10-28T10:21:00Z')),240000);
});
