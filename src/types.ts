export type Course = { id:number; name:string; code:string; semester:string; ects:number; hours_per_ects:number; color:string; description:string };
export type Task = { id:number; title:string; description:string; area:'Universität'|'Privat'; type:string; course_id:number|null; course_name?:string; course_color?:string; deadline:string|null; estimate_minutes:number; priority:string; status:'Offen'|'In Bearbeitung'|'Erledigt'; tracking:number; created_at:string; completed_at:string|null };
export type Session = { id:number; task_id:number|null; course_id:number|null; started_at:string; ended_at:string; kind:string; note:string };
export type Block = { id:number; task_id:number|null; course_id:number|null; title:string; starts_at:string; ends_at:string; kind:string; task_title?:string; course_name?:string; course_color?:string };
export type RecurringEvent = { id:number; course_id:number|null; title:string; weekday:number; start_time:string; end_time:string; starts_on:string; ends_on:string|null; auto_track:number };
export type AppData = { courses:Course[]; tasks:Task[]; sessions:Session[]; blocks:Block[]; recurring:RecurringEvent[]; settings:any[] };
