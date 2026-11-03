import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateCategories, privateCategoriesKey, categoryCounts } from '../src/privateCategories';
import type { AppData } from '../src/types';
const data=(value?:string):AppData=>({courses:[],tasks:[],sessions:[],recurring:[],blocks:[],settings:value?[{key:privateCategoriesKey,value}]:[]});
test('Private categories default to household included and Kapellmeister excluded',()=>{
 assert.ok(privateCategories(data()).some(c=>c.name==='Kapellmeisterkurs'));
 assert.equal(categoryCounts(data(),'Haushalt'),true);assert.equal(categoryCounts(data(),'Kapellmeisterkurs'),false);
 assert.equal(categoryCounts(data('broken'),'Kapellmeisterkurs'),false);
});
test('Saved private categories accept custom categories and reject malformed or duplicated entries',()=>{
 const d=data(JSON.stringify([{name:' Musik ',includeInStatistics:false},{name:'musik',includeInStatistics:true},{name:'',includeInStatistics:true},{name:'Bad',includeInStatistics:'false'}]));
 assert.deepEqual(privateCategories(d),[{name:'Musik',includeInStatistics:false}]);
 assert.equal(categoryCounts(d,'Musik'),false);
});
