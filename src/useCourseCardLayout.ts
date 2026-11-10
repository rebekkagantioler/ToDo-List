import {useLayoutEffect,useRef,useState} from 'react';
import type {Course} from './types';

export function pairCoursesByHeight(courses:Course[],heights:ReadonlyMap<number,number>):Course[]{
 if(courses.some(course=>{const height=heights.get(course.id);return height===undefined||!Number.isFinite(height)||height<=0}))return [...courses];
 return courses.map((course,index)=>({course,index})).sort((a,b)=>heights.get(b.course.id)!-heights.get(a.course.id)!||a.index-b.index).map(row=>row.course);
}

export function useCourseCardLayout(courses:Course[],enabled:boolean){
 const gridRef=useRef<HTMLDivElement>(null),[order,setOrder]=useState<number[]>([]);
 const ids=courses.map(course=>course.id).join(',');
 const currentCourses=useRef(courses);currentCourses.current=courses;
 useLayoutEffect(()=>{
  const grid=gridRef.current;
  if(!enabled||!grid)return;
  let frame=0;
  const measure=()=>{
   const source=currentCourses.current;
   const columns=getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
   const heights=new Map(Array.from(grid.querySelectorAll<HTMLElement>(':scope > [data-performance-course]')).map(card=>[Number(card.dataset.performanceCourse),card.getBoundingClientRect().height]));
   const next=(columns>1?pairCoursesByHeight(source,heights):source).map(course=>course.id);
   setOrder(previous=>previous.length===next.length&&previous.every((id,index)=>id===next[index])?previous:next);
  };
  const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(measure)};
  const observer=new ResizeObserver(schedule);
  observer.observe(grid);
  grid.querySelectorAll<HTMLElement>(':scope > [data-performance-course]').forEach(card=>observer.observe(card));
  schedule();
  return()=>{cancelAnimationFrame(frame);observer.disconnect()};
 },[ids,enabled]);
 const ranked=order.flatMap(id=>{const course=courses.find(course=>course.id===id);return course?[course]:[]});
 const shownCourses=[...ranked,...courses.filter(course=>!order.includes(course.id))];
 return {gridRef,shownCourses};
}
