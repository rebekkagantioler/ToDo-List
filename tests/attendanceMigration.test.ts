import {test} from 'node:test';
import assert from 'node:assert/strict';
import {migrateLegacyCancellations,attendanceMigrationKey} from '../src/attendanceMigration';
import {canceledDates,unplannedDates} from '../src/statistics';
import type {AppData} from '../src/types';
function fixture():AppData{return {courses:[],tasks:[],sessions:[],blocks:[],recurring:[{id:1,course_id:1,title:'UE',weekday:1,start_time:'09:00',end_time:'10:00',starts_on:'2026-10-05',ends_on:'2026-10-26',auto_track:1}],settings:[{key:'lecture-exclusions-1',value:'["2026-10-12"]'},{key:'lecture-unplanned-1',value:'["2026-10-19"]'}]}}
test('Existing cancellations become never scheduled once; future cancellations stay cancellations',async()=>{
 const writes:string[]=[];
 const d=await migrateLegacyCancellations(fixture(),async(key)=>{writes.push(key)});
 assert.deepEqual(canceledDates(d,1),[]);assert.deepEqual(unplannedDates(d,1),['2026-10-19','2026-10-12']);
 assert.deepEqual(writes,['lecture-unplanned-1','lecture-exclusions-1',attendanceMigrationKey]);
 d.settings.find(s=>s.key==='lecture-exclusions-1')!.value='["2026-10-26"]';
 await migrateLegacyCancellations(d,async()=>{assert.fail('Migration must not run twice')});
 assert.deepEqual(canceledDates(d,1),['2026-10-26']);
});
test('Migration can retry a partial write without losing dates',async()=>{
 const stored=fixture();let calls=0;
 const save=async(key:string,value:string)=>{if(++calls===2)throw new Error('offline');const row=stored.settings.find(s=>s.key===key);if(row)row.value=value;else stored.settings.push({key,value})};
 await assert.rejects(migrateLegacyCancellations(stored,save));
 assert.deepEqual(canceledDates(stored,1),['2026-10-12']);
 const retried=await migrateLegacyCancellations(stored,save);
 assert.deepEqual(unplannedDates(retried,1),['2026-10-19','2026-10-12']);assert.deepEqual(canceledDates(retried,1),[]);
});
