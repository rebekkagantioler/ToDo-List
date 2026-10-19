-- Auf vorhandenen Projekten einmal im Supabase SQL Editor ausführen.
begin;
CREATE TABLE IF NOT EXISTS public.course_templates (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
 source_course_id bigint NOT NULL,
 name text NOT NULL,
 payload jsonb NOT NULL,
 UNIQUE(user_id,source_course_id)
);
ALTER TABLE public.course_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS read_templates ON public.course_templates;
CREATE POLICY read_templates ON public.course_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS manage_templates ON public.course_templates;
CREATE POLICY manage_templates ON public.course_templates FOR ALL TO authenticated USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.course_templates TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.course_templates_id_seq TO authenticated;
CREATE OR REPLACE FUNCTION public.copy_course_template(template jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c jsonb:=template->'course'; e jsonb; course_id bigint; event_id bigint;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich'; END IF;
 IF coalesce(trim(c->>'name'),'')='' OR coalesce(trim(c->>'semester'),'')='' OR jsonb_typeof(template->'events') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ungültige Kursvorlage'; END IF;
 INSERT INTO courses(name,code,semester,ects,hours_per_ects,color,description) VALUES(c->>'name',coalesce(c->>'code',''),c->>'semester',(c->>'ects')::float,(c->>'hours_per_ects')::float,coalesce(c->>'color','#818cf8'),coalesce(c->>'description','')) RETURNING id INTO course_id;
 FOR e IN SELECT value FROM jsonb_array_elements(template->'events') LOOP
 INSERT INTO recurring_events(course_id,title,weekday,start_time,end_time,starts_on,ends_on,auto_track) VALUES(course_id,e->>'title',(e->>'weekday')::int,e->>'start_time',e->>'end_time',e->>'starts_on',e->>'ends_on',coalesce((e->>'auto_track')::int,0)) RETURNING id INTO event_id;
 INSERT INTO settings(key,value) VALUES('lecture-exclusions-'||event_id,coalesce(e->'excluded','[]'::jsonb)::text);
 END LOOP;
 RETURN jsonb_build_object('id',course_id);
END; $$;
REVOKE ALL ON FUNCTION public.copy_course_template(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.copy_course_template(jsonb) TO authenticated;
commit;
