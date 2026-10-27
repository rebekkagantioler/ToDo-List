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
