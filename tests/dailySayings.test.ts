import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailySayings, dailySaying } from '../src/dailySayings';

test('365 nonempty unique daily sayings and no repeats in a full cycle',()=>{
 assert.equal(dailySayings.length,365);
 assert.equal(new Set(dailySayings).size,365);
 assert.ok(dailySayings.every(s=>s.trim().length>10));
 const texts=Array.from({length:365},(_,i)=>dailySaying(new Date(Date.UTC(2027,5,1+i,12))).text);
 assert.equal(new Set(texts).size,365);
});
test('daily saying switches at Vienna midnight and stays stable during the day',()=>{
 assert.equal(dailySaying(new Date('2026-10-28T00:00:00+01:00')).text,dailySaying(new Date('2026-10-28T23:59:59+01:00')).text);
 assert.notEqual(dailySaying(new Date('2026-10-28T22:59:59Z')).text,dailySaying(new Date('2026-10-28T23:00:00Z')).text);
 // DST and leap day still advance by exactly one saying each day.
 for(const [a,b] of [['2028-02-28','2028-02-29'],['2028-02-29','2028-03-01'],['2026-03-28','2026-03-29'],['2026-10-24','2026-10-25']]){
  assert.equal((dailySaying(new Date(b+'T12:00Z')).index-dailySaying(new Date(a+'T12:00Z')).index+365)%365,1);
 }
});
