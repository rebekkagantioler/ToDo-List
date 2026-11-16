import {test} from 'node:test';
import assert from 'node:assert/strict';
import {catalogEntries,searchCatalog,courseVisibilityKey,courseIsVisible,selectCourseContents} from '../src/catalog';
import {homeworkPlan,homeworkTitle} from '../src/homework';
import type {AppData} from '../src/types';
test('Catalog exports only course metadata and meetings, never private course descriptions or other records',()=>{
 const data:AppData={courses:[{id:4,name:'Übung Analysis',code:'UE AN',semester:'WS 2026/27',ects:2.5,hours_per_ects:25,color:'#123456',description:'PRIVATE'}],tasks:[],blocks:[],sessions:[],recurring:[{id:2,course_id:4,title:'UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-01',ends_on:'2026-12-01',auto_track:1}],settings:[{key:courseVisibilityKey(4),value:'true'},{key:'lecture-exclusions-2',value:'["2026-10-26"]'},{key:'private',value:'PRIVATE'}]};
 const entries=catalogEntries(data);assert.equal(entries.length,1);assert.equal(entries[0].payload.course.description,'');assert.deepEqual(entries[0].payload.events[0].excluded,['2026-10-26']);assert.ok(!JSON.stringify(entries).includes('PRIVATE'));
 for(const query of ['analysis','UBUNG','ue an','WS 2026','Analysis WS'])assert.equal(searchCatalog(entries,query).length,1);
 assert.equal(searchCatalog(entries,'geometrie').length,0);assert.equal(searchCatalog(entries,'').length,1);
 data.settings=data.settings.filter(s=>s.key!==courseVisibilityKey(4));assert.equal(catalogEntries(data).length,0);assert.equal(courseIsVisible(data,4),false);data.settings.push({key:courseVisibilityKey(4),value:'false'});assert.equal(catalogEntries(data).length,0);
});

test('Course catalog preserves the distinction between canceled and never scheduled dates',()=>{
 const data:AppData={courses:[{id:4,name:'UE Analysis',code:'UE',semester:'WS',ects:3,hours_per_ects:25,color:'#123456',description:''}],tasks:[],blocks:[],sessions:[],recurring:[{id:2,course_id:4,title:'UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-01',ends_on:'2026-12-01',auto_track:1}],settings:[{key:courseVisibilityKey(4),value:'true'},{key:'lecture-exclusions-2',value:'["2026-10-26"]'},{key:'lecture-unplanned-2',value:'["2026-11-02"]'}]};
 const event=catalogEntries(data)[0].payload.events[0];
 assert.deepEqual(event.excluded,['2026-10-26']);assert.deepEqual(event.unplanned,['2026-11-02']);
});


test('Joining mid-semester preserves original sheet dates and numbering',()=>{
 const selected=selectCourseContents({course:{name:'UE',code:'UE',semester:'WS',ects:3,hours_per_ects:25,color:'#123456',description:''},events:[{source_key:'ue',title:'UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-05',ends_on:'2026-11-30',auto_track:1,excluded:['2026-10-12'],unplanned:['2026-10-26']}],homework:[{source_key:'sheet',event_key:'ue',title:'Blatt',type:'Hausaufgabe',starts_on:'2026-10-05',estimate_minutes:60,priority:'Mittel',tracking:1,numbering:{start:1,from:'2026-10-05'}}]},['ue'],['sheet'],'2026-11-05');
 assert.equal(selected.homework?.[0].starts_on,'2026-10-05');
 assert.deepEqual(selected.homework?.[0].numbering,{start:1,from:'2026-10-05'});
 assert.deepEqual(selected.events[0].excluded,['2026-10-12']);
 assert.deepEqual(selected.events[0].unplanned,['2026-10-26']);
});

test('A late join creates past worksheets with original dates and keeps future releases weekly',()=>{
 const data:AppData={courses:[],tasks:[],blocks:[],sessions:[],recurring:[{id:1,course_id:4,title:'UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-05',ends_on:'2026-11-30',auto_track:0}],settings:[]};
 const series={id:'copy',event_id:1,starts_on:'2026-10-05',skipped:[],numbering:{start:1,from:'2026-10-05'},task:{title:'Blatt',description:'',area:'Universität',type:'Hausaufgabe',course_id:4,deadline:null,estimate_minutes:60,priority:'Mittel',status:'Offen',tracking:1}};
 data.settings.push({key:'homework-series-copy',value:JSON.stringify(series)});
 const plan=homeworkPlan(data,new Date('2026-10-22T12:00:00'));
 assert.equal(homeworkTitle(data,series,'2026-10-05'),'Blatt 1');
 assert.deepEqual(plan.create.map(t=>[t.title,t.deadline]),[['Blatt 1','2026-10-05T10:00'],['Blatt 2','2026-10-12T10:00'],['Blatt 3','2026-10-19T10:00'],['Blatt 4','2026-10-26T10:00']]);
});

test('Task selection includes only selected series and excludes unrelated individual tasks',()=>{
 const template:any={course:{name:'UE',code:'UE',semester:'WS',ects:3,hours_per_ects:25,color:'#123456',description:''},events:[{source_key:'event',title:'UE',weekday:1,start_time:'10:00',end_time:'11:00',starts_on:'2026-10-05',ends_on:'2026-11-30',auto_track:0,excluded:[]}],homework:[{source_key:'series',event_key:'event',title:'Blatt',type:'Hausaufgabe',starts_on:'2026-10-05',estimate_minutes:60,priority:'Mittel',tracking:1}],tasks:[{source_key:'old',title:'Frühere Einzelaufgabe',type:'Lernen',deadline:'2026-10-01T10:00',estimate_minutes:60,priority:'Mittel',tracking:1},{source_key:'sheet',title:'Blatt 1',type:'Hausaufgabe',deadline:'2026-10-05T10:00',estimate_minutes:60,priority:'Mittel',tracking:1,homework_key:'series',occurrence_on:'2026-10-05'}]};
 assert.deepEqual(selectCourseContents(template,['event'],['series']).tasks?.map(t=>t.source_key),['sheet']);
 assert.deepEqual(selectCourseContents(template,[],[]).tasks,[]);
});
