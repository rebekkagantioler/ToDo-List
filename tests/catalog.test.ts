import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogEntries,searchCatalog,courseVisibilityKey,courseIsVisible} from '../src/catalog';
import type {AppData} from '../src/types';
test('Catalog exports only course metadata and meetings, never private course descriptions or other records',()=>{
 const data:AppData={courses:[{id:4,name:'Übung Analysis',code:'UE AN',semester:'WS 2026/27',ects:2.5,hours_per_ects:25,color:'#123456',description:'PRIVATE'}],tasks:[],blocks:[],sessions:[],recurring:[{id:2,course_id:4,title:'UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-01',ends_on:'2026-12-01',auto_track:1}],settings:[{key:courseVisibilityKey(4),value:'true'},{key:'lecture-exclusions-2',value:'["2026-10-26"]'},{key:'private',value:'PRIVATE'}]};
 const entries=catalogEntries(data);assert.equal(entries.length,1);assert.equal(entries[0].payload.course.description,'');assert.deepEqual(entries[0].payload.events[0].excluded,['2026-10-26']);assert.ok(!JSON.stringify(entries).includes('PRIVATE'));
 for(const query of ['analysis','UBUNG','ue an','WS 2026','Analysis WS'])assert.equal(searchCatalog(entries,query).length,1);
 assert.equal(searchCatalog(entries,'geometrie').length,0);assert.equal(searchCatalog(entries,'').length,1);
 data.settings=data.settings.filter(s=>s.key!==courseVisibilityKey(4));assert.equal(catalogEntries(data).length,0);assert.equal(courseIsVisible(data,4),false);data.settings.push({key:courseVisibilityKey(4),value:'false'});assert.equal(catalogEntries(data).length,0);
});
