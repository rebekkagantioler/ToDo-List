import { createClient } from '@supabase/supabase-js';
const env = import.meta.env as Record<string,string>;
export const cloud = env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY ? createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY) : null;
let timerOwner='local';
export const setTimerOwner=(id:string)=>{timerOwner=id};
export const timerStorageKey=()=>`planraum-timer-${timerOwner}`;
