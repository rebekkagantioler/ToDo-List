import {test} from 'node:test';
import assert from 'node:assert/strict';
import {courseRequirements,requirementsKey,validRequirement} from '../src/requirements';
import type {AppData} from '../src/types';
const requirement={id:'a',title:'Übungsblätter',unit:'Punkte',target:60,current:62.5};
test('requirements survive settings serialization and stay scoped to their course',()=>{
 const data={settings:[{key:requirementsKey(1),value:JSON.stringify([requirement])}]} as AppData;
 assert.deepEqual(courseRequirements(data,1),[requirement]);
 assert.deepEqual(courseRequirements(data,2),[]);
 assert.equal(validRequirement(requirement),true);
});
test('invalid saved goals and broken settings do not break course details',()=>{
 for(const value of ['broken','null','{}',JSON.stringify([null,{...requirement,target:0},{...requirement,current:-1},{...requirement,title:' '}])]){
  assert.deepEqual(courseRequirements({settings:[{key:requirementsKey(1),value}]} as AppData,1),[]);
 }
 assert.equal(validRequirement({...requirement,current:NaN}),false);
 assert.equal(validRequirement({...requirement,target:Infinity}),false);
});
