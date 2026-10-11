-- Im Supabase SQL Editor ausführen. Benutzer werden über Supabase Auth angelegt.
begin;
CREATE TABLE IF NOT EXISTS public.courses (id BIGINT NOT NULL DEFAULT (floor(random()*9000000000000000)::bigint), name TEXT NOT NULL, code TEXT DEFAULT '', semester TEXT NOT NULL, ects DOUBLE PRECISION NOT NULL DEFAULT 5, hours_per_ects DOUBLE PRECISION NOT NULL DEFAULT 25, color TEXT NOT NULL DEFAULT '#3b82f6', description TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE, PRIMARY KEY (user_id,id), CHECK (ects >= 0 AND hours_per_ects > 0));
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON public.courses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.courses TO authenticated;
CREATE TABLE IF NOT EXISTS public.tasks (id BIGINT NOT NULL DEFAULT (floor(random()*9000000000000000)::bigint), title TEXT NOT NULL, description TEXT DEFAULT '', area TEXT NOT NULL CHECK(area IN ('Universität','Privat')), type TEXT NOT NULL, course_id BIGINT, deadline TEXT, estimate_minutes INTEGER NOT NULL DEFAULT 60, priority TEXT NOT NULL DEFAULT 'Mittel', status TEXT NOT NULL DEFAULT 'Offen', tracking INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TEXT, user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE, PRIMARY KEY (user_id,id), CHECK (estimate_minutes >= 0), CHECK (status IN ('Offen','In Bearbeitung','Erledigt')), FOREIGN KEY (user_id,course_id) REFERENCES courses(user_id,id));
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON public.tasks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
CREATE TABLE IF NOT EXISTS public.work_sessions (id BIGINT NOT NULL DEFAULT (floor(random()*9000000000000000)::bigint), task_id BIGINT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'Selbstlernen', note TEXT DEFAULT '', user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE, PRIMARY KEY (user_id,id), CHECK (ended_at::timestamptz > started_at::timestamptz), FOREIGN KEY (user_id,task_id) REFERENCES tasks(user_id,id) ON DELETE CASCADE);
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON public.work_sessions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_sessions TO authenticated;
CREATE TABLE IF NOT EXISTS public.planned_blocks (id BIGINT NOT NULL DEFAULT (floor(random()*9000000000000000)::bigint), task_id BIGINT, course_id BIGINT, title TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'Arbeit', user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE, PRIMARY KEY (user_id,id), CHECK (ends_at::timestamptz > starts_at::timestamptz), FOREIGN KEY (user_id,task_id) REFERENCES tasks(user_id,id) ON DELETE CASCADE, FOREIGN KEY (user_id,course_id) REFERENCES courses(user_id,id));
ALTER TABLE public.planned_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON public.planned_blocks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planned_blocks TO authenticated;
CREATE TABLE IF NOT EXISTS public.recurring_events (id BIGINT NOT NULL DEFAULT (floor(random()*9000000000000000)::bigint), course_id BIGINT, title TEXT NOT NULL, weekday INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, starts_on TEXT NOT NULL, ends_on TEXT, auto_track INTEGER NOT NULL DEFAULT 0, user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE, PRIMARY KEY (user_id,id), CHECK (weekday BETWEEN 0 AND 6), FOREIGN KEY (user_id,course_id) REFERENCES courses(user_id,id) ON DELETE CASCADE);
ALTER TABLE public.recurring_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON public.recurring_events FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_events TO authenticated;
CREATE TABLE IF NOT EXISTS public.settings (key TEXT NOT NULL, value TEXT NOT NULL, user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE, PRIMARY KEY (user_id,key));
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_rows ON public.settings FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
CREATE OR REPLACE FUNCTION public.import_backup(backup jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE row jsonb; uid uuid := auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich'; END IF;
 IF NOT (backup ?& ARRAY['courses','tasks','sessions','blocks','recurring','settings']) THEN RAISE EXCEPTION 'Unvollständige Sicherung'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_each(backup) x WHERE x.key IN ('courses','tasks','sessions','blocks','recurring','settings') AND jsonb_typeof(x.value) <> 'array') THEN RAISE EXCEPTION 'Ungültige Datenlisten'; END IF;
 DELETE FROM work_sessions WHERE user_id=uid;
 DELETE FROM planned_blocks WHERE user_id=uid;
 DELETE FROM recurring_events WHERE user_id=uid;
 DELETE FROM tasks WHERE user_id=uid;
 DELETE FROM courses WHERE user_id=uid;
 DELETE FROM settings WHERE user_id=uid;
 FOR row IN SELECT value FROM jsonb_array_elements(backup->'courses') LOOP
 INSERT INTO courses SELECT * FROM jsonb_populate_record(NULL::courses, row || jsonb_build_object('user_id',uid, 'created_at',COALESCE(row->>'created_at',now()::text)));
 END LOOP;
 FOR row IN SELECT value FROM jsonb_array_elements(backup->'tasks') LOOP
 INSERT INTO tasks SELECT * FROM jsonb_populate_record(NULL::tasks, row || jsonb_build_object('user_id',uid, 'created_at',COALESCE(row->>'created_at',now()::text)));
 END LOOP;
 FOR row IN SELECT value FROM jsonb_array_elements(backup->'sessions') LOOP
 INSERT INTO work_sessions SELECT * FROM jsonb_populate_record(NULL::work_sessions, row || jsonb_build_object('user_id',uid));
 END LOOP;
 FOR row IN SELECT value FROM jsonb_array_elements(backup->'blocks') LOOP
 INSERT INTO planned_blocks SELECT * FROM jsonb_populate_record(NULL::planned_blocks, row || jsonb_build_object('user_id',uid));
 END LOOP;
 FOR row IN SELECT value FROM jsonb_array_elements(backup->'recurring') LOOP
 INSERT INTO recurring_events SELECT * FROM jsonb_populate_record(NULL::recurring_events, row || jsonb_build_object('user_id',uid));
 END LOOP;
 FOR row IN SELECT value FROM jsonb_array_elements(backup->'settings') LOOP
 INSERT INTO settings SELECT * FROM jsonb_populate_record(NULL::settings, row || jsonb_build_object('user_id',uid));
 END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.import_backup(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_backup(jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.detach_course() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 UPDATE tasks SET course_id=NULL WHERE user_id=OLD.user_id AND course_id=OLD.id;
 UPDATE planned_blocks SET course_id=NULL WHERE user_id=OLD.user_id AND course_id=OLD.id;
 RETURN OLD;
END; $$;
CREATE TRIGGER detach_course_before_delete BEFORE DELETE ON public.courses FOR EACH ROW EXECUTE FUNCTION public.detach_course();
commit;

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
