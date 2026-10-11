-- Einmal im Supabase SQL Editor ausführen; vorhandene Zeiten bleiben erhalten.
begin;
ALTER TABLE public.work_sessions ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE public.work_sessions ADD COLUMN IF NOT EXISTS course_id BIGINT;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='work_sessions_course_owner_fk' AND conrelid='public.work_sessions'::regclass) THEN
 ALTER TABLE public.work_sessions ADD CONSTRAINT work_sessions_course_owner_fk FOREIGN KEY (user_id,course_id) REFERENCES public.courses(user_id,id);
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.detach_course() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 UPDATE tasks SET course_id=NULL WHERE user_id=OLD.user_id AND course_id=OLD.id;
 UPDATE planned_blocks SET course_id=NULL WHERE user_id=OLD.user_id AND course_id=OLD.id;
 UPDATE work_sessions SET course_id=NULL WHERE user_id=OLD.user_id AND course_id=OLD.id;
 RETURN OLD;
END; $$;
commit;
