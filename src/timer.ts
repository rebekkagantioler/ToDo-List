export type ActiveTimer = {id:number;taskId?:number|null;courseId?:number|null;startedAt:string;accumulatedMs?:number;paused?:boolean;stoppedAt?:string};
export const timerDuration=(timer:ActiveTimer,now=Date.now())=>(timer.accumulatedMs||0)+(timer.paused?0:Math.max(0,now-new Date(timer.startedAt).getTime()));
export const newTimer=(timer:Omit<ActiveTimer,'id'>&{id?:number}):ActiveTimer=>({...timer,id:timer.id??Math.floor(Math.random()*3500000000000000)+1});
export function stoppedTimer(timer:ActiveTimer,now=Date.now()):ActiveTimer{
 return timer.stoppedAt?timer:{...timer,paused:true,accumulatedMs:timerDuration(timer,now),stoppedAt:new Date(now).toISOString()};
}
export function timerSession(timer:ActiveTimer){
 const ended_at=timer.stoppedAt!;
 return {id:timer.id,task_id:timer.taskId??null,course_id:timer.courseId??null,kind:'Selbstlernen',note:'',started_at:new Date(new Date(ended_at).getTime()-(timer.accumulatedMs||0)).toISOString(),ended_at};
}
