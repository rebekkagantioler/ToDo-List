import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moveCourse,orderedCourses,courseOrderKey} from '../src/courseOrder';
import type {AppData,Course} from '../src/types';
test('Moves courses in both directions and leaves unknown drops alone',()=>{
 assert.deepEqual(moveCourse([1,2,3,4],1,3),[2,3,1,4]);
 assert.deepEqual(moveCourse([1,2,3,4],4,2),[1,4,2,3]);
 assert.deepEqual(moveCourse([1,2],9,2),[1,2]);
});
test('Saved course order survives reloads; deleted courses are ignored and new courses appended',()=>{
 const d={courses:[{id:1},{id:2},{id:3}] as Course[],settings:[{key:courseOrderKey,value:'[3,99,1]'}]} as AppData;
 assert.deepEqual(orderedCourses(d).map(c=>c.id),[3,1,2]);
 d.settings[0].value='broken';assert.deepEqual(orderedCourses(d).map(c=>c.id),[1,2,3]);
});
