import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pairCoursesByHeight} from '../src/useCourseCardLayout';
import type {Course} from '../src/types';
const courses=[1,2,3,4,5,6].map(id=>({id,name:`Kurs ${id}`} as Course));
test('courses of similar measured height become neighbors instead of leaving large row gaps',()=>{
 const heights=new Map([[1,240],[2,490],[3,255],[4,475],[5,350],[6,365]]);
 const next=pairCoursesByHeight(courses,heights);assert.deepEqual(next.map(c=>c.id),[2,4,6,5,3,1]);
 const gaps=(rows:Course[])=>rows.reduce((sum,course,index)=>index%2||!rows[index+1]?sum:sum+Math.abs(heights.get(course.id)!-heights.get(rows[index+1].id)!),0);
 assert.ok(gaps(next)<gaps(courses));assert.deepEqual(courses.map(c=>c.id),[1,2,3,4,5,6]);
});
test('equal heights preserve the existing course order and changing heights updates the pairing',()=>{
 const heights=new Map(courses.map(c=>[c.id,300]));assert.deepEqual(pairCoursesByHeight(courses,heights),courses);
 heights.set(5,500);heights.set(3,495);assert.deepEqual(pairCoursesByHeight(courses,heights).slice(0,2).map(c=>c.id),[5,3]);
});
test('missing measurements retain all courses and odd course counts never duplicate or drop cards',()=>{
 assert.deepEqual(pairCoursesByHeight(courses,new Map([[1,250]])),courses);
 const odd=courses.slice(0,5),result=pairCoursesByHeight(odd,new Map(odd.map(c=>[c.id,c.id*100])));assert.equal(result.length,5);assert.equal(new Set(result.map(c=>c.id)).size,5);
});
