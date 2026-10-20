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

-- Katalog: zeigt ausschließlich ausdrücklich freigegebene Kurse. Ohne Einstellung bleibt ein Kurs privat.
-- Nur die unten explizit ausgewählten Kurs-/Terminfelder werden geteilt.
begin;
CREATE OR REPLACE FUNCTION public.catalog_exclusions(value text) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE parsed jsonb;
BEGIN
 parsed:=value::jsonb;
 IF jsonb_typeof(parsed)='array' THEN RETURN parsed; END IF;
 RETURN '[]'::jsonb;
EXCEPTION WHEN invalid_text_representation THEN RETURN '[]'::jsonb;
END; $$;
REVOKE ALL ON FUNCTION public.catalog_exclusions(text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.list_course_catalog() RETURNS TABLE(id text,name text,payload jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT DISTINCT md5(entry.payload::text),entry.name,entry.payload FROM (
  SELECT c.name,jsonb_build_object(
   'course',jsonb_build_object('name',c.name,'code',c.code,'semester',c.semester,'ects',c.ects,'hours_per_ects',c.hours_per_ects,'color',c.color,'description',''),
   'events',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'title',e.title,'weekday',e.weekday,'start_time',e.start_time,'end_time',e.end_time,'starts_on',e.starts_on,'ends_on',e.ends_on,'auto_track',e.auto_track,
    'excluded',public.catalog_exclusions(s.value)
   ) ORDER BY e.starts_on,e.weekday,e.start_time,e.title,e.id)
   FROM public.recurring_events e LEFT JOIN public.settings s ON s.user_id=e.user_id AND s.key='lecture-exclusions-'||e.id
   WHERE e.user_id=c.user_id AND e.course_id=c.id),'[]'::jsonb)
  ) AS payload FROM public.courses c WHERE auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.settings visibility WHERE visibility.user_id=c.user_id AND visibility.key='course-catalog-visible-'||c.id AND visibility.value='true')
 ) entry ORDER BY entry.name,entry.payload;
$$;
REVOKE ALL ON FUNCTION public.list_course_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_course_catalog() TO authenticated;
CREATE OR REPLACE FUNCTION public.course_catalog_visibility_ready() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.course_catalog_visibility_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_catalog_visibility_ready() TO authenticated;
-- Die frühere manuelle Vorlagentabelle wird nicht mehr direkt veröffentlicht.
REVOKE ALL ON public.course_templates FROM authenticated;
REVOKE ALL ON SEQUENCE public.course_templates_id_seq FROM authenticated;
COMMENT ON FUNCTION public.list_course_catalog() IS 'Authenticated course catalog; excludes user IDs, descriptions, tasks, sessions, planned blocks and private settings. Copies are independent.';
commit;

-- Auswahl bei Übernahmen und bewusst bestätigte Updates bestehender Kopien.
begin;
CREATE OR REPLACE FUNCTION public.catalog_object(value text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE parsed jsonb;
BEGIN parsed:=value::jsonb;IF jsonb_typeof(parsed)='object' THEN RETURN parsed;END IF;RETURN '{}'::jsonb;
EXCEPTION WHEN invalid_text_representation THEN RETURN '{}'::jsonb;END; $$;
REVOKE ALL ON FUNCTION public.catalog_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_object(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.course_catalog_payload(owner_id uuid,course_id bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object(
 'course',jsonb_build_object('name',c.name,'code',c.code,'semester',c.semester,'ects',c.ects,'hours_per_ects',c.hours_per_ects,'color',c.color,'description',''),
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('source_key',md5(e.user_id::text||':'||e.id),'title',e.title,'weekday',e.weekday,'start_time',e.start_time,'end_time',e.end_time,'starts_on',e.starts_on,'ends_on',e.ends_on,'auto_track',e.auto_track,'excluded',public.catalog_exclusions(s.value)) ORDER BY e.starts_on,e.weekday,e.start_time,e.title,e.id)
 FROM recurring_events e LEFT JOIN settings s ON s.user_id=e.user_id AND s.key='lecture-exclusions-'||e.id WHERE e.user_id=c.user_id AND e.course_id=c.id),'[]'::jsonb),
 'homework',coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('source_key',md5(s.user_id::text||':'||s.key),'event_key',md5(e.user_id::text||':'||e.id),'title',v.obj->'task'->>'title','type',v.obj->'task'->>'type','starts_on',v.obj->>'starts_on','estimate_minutes',v.obj->'task'->'estimate_minutes','priority',v.obj->'task'->>'priority','tracking',v.obj->'task'->'tracking','numbering',v.obj->'numbering','submission',v.obj->'submission')) ORDER BY s.key)
 FROM settings s CROSS JOIN LATERAL (SELECT public.catalog_object(s.value) AS obj) v JOIN recurring_events e ON e.user_id=s.user_id AND e.id::text=v.obj->>'event_id' AND e.course_id=c.id
 WHERE s.user_id=c.user_id AND s.key LIKE 'homework-series-%' AND v.obj->'task'->>'course_id'=c.id::text AND coalesce(v.obj->>'deleted','false')<>'true' AND coalesce(v.obj->>'stopped','false')<>'true'),'[]'::jsonb))
 FROM courses c WHERE c.user_id=owner_id AND c.id=course_id;
$$;
REVOKE ALL ON FUNCTION public.course_catalog_payload(uuid,bigint) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.list_course_catalog() RETURNS TABLE(id text,name text,payload jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT DISTINCT ON (jsonb_build_object('course',x.base->'course','events',(SELECT coalesce(jsonb_agg(v-'source_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'events') v),'homework',(SELECT coalesce(jsonb_agg(v-'source_key'-'event_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'homework') v))::text) x.source_key,x.name,x.base||jsonb_build_object('source_key',x.source_key,'revision',md5(x.base::text)) FROM (
 SELECT c.name,md5(c.user_id::text||':'||c.id) AS source_key,public.course_catalog_payload(c.user_id,c.id) AS base
 FROM courses c WHERE auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM settings s WHERE s.user_id=c.user_id AND s.key='course-catalog-visible-'||c.id AND s.value='true')
 ) x ORDER BY jsonb_build_object('course',x.base->'course','events',(SELECT coalesce(jsonb_agg(v-'source_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'events') v),'homework',(SELECT coalesce(jsonb_agg(v-'source_key'-'event_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'homework') v))::text,x.source_key;
$$;
CREATE OR REPLACE FUNCTION public.get_course_catalog_entry(source_key text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.base||jsonb_build_object('source_key',source_key,'revision',md5(p.base::text)) FROM courses c CROSS JOIN LATERAL (SELECT public.course_catalog_payload(c.user_id,c.id) AS base) p
 WHERE auth.uid() IS NOT NULL AND md5(c.user_id::text||':'||c.id)=source_key AND EXISTS(SELECT 1 FROM settings s WHERE s.user_id=c.user_id AND s.key='course-catalog-visible-'||c.id AND s.value='true');
$$;
REVOKE ALL ON FUNCTION public.get_course_catalog_entry(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_course_catalog_entry(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.apply_course_update(target_course bigint,template jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); cid bigint:=target_course; c jsonb:=template->'course'; e jsonb; h jsonb; origin jsonb; ekey text; hid text; eid bigint; idx int:=0; previous jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Anmeldung erforderlich';END IF;
 IF coalesce(trim(c->>'name'),'')='' OR coalesce(trim(c->>'semester'),'')='' OR jsonb_typeof(template->'events') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ungültige Kursvorlage'; END IF;
 IF cid IS NULL THEN
 INSERT INTO courses(name,code,semester,ects,hours_per_ects,color,description) VALUES(c->>'name',coalesce(c->>'code',''),c->>'semester',(c->>'ects')::float,(c->>'hours_per_ects')::float,coalesce(c->>'color','#818cf8'),'') RETURNING id INTO cid;
 ELSE
 IF NOT EXISTS(SELECT 1 FROM courses WHERE user_id=uid AND id=cid) THEN RAISE EXCEPTION 'Kurs nicht gefunden';END IF;
 IF coalesce((template->>'update_course')::boolean,false) THEN UPDATE courses SET name=c->>'name',code=coalesce(c->>'code',''),semester=c->>'semester',ects=(c->>'ects')::float,hours_per_ects=(c->>'hours_per_ects')::float WHERE user_id=uid AND id=cid;END IF;
 END IF;
 SELECT public.catalog_object(value) INTO origin FROM settings WHERE user_id=uid AND key='course-origin-'||cid;
 origin:=coalesce(origin,jsonb_build_object('event_map','{}'::jsonb,'homework_map','{}'::jsonb));
 FOR ekey IN SELECT jsonb_array_elements_text(coalesce(template->'remove_homework','[]'::jsonb)) LOOP
 hid:=origin->'homework_map'->>ekey;
 IF hid IS NOT NULL THEN UPDATE settings SET value=(public.catalog_object(value)||'{"stopped":true,"deleted":true}'::jsonb)::text WHERE user_id=uid AND key='homework-series-'||hid;origin:=jsonb_set(origin,'{homework_map}',(origin->'homework_map')-ekey);END IF;
 END LOOP;
 FOR ekey IN SELECT jsonb_array_elements_text(coalesce(template->'remove_events','[]'::jsonb)) LOOP
 eid:=(origin->'event_map'->>ekey)::bigint;
 IF eid IS NOT NULL THEN DELETE FROM recurring_events WHERE user_id=uid AND id=eid AND course_id=cid;origin:=jsonb_set(origin,'{event_map}',(origin->'event_map')-ekey);END IF;
 END LOOP;
 FOR e IN SELECT value FROM jsonb_array_elements(template->'events') LOOP
 ekey:=coalesce(e->>'source_key',idx::text);idx:=idx+1;eid:=(origin->'event_map'->>ekey)::bigint;
 IF eid IS NOT NULL THEN
 IF NOT EXISTS(SELECT 1 FROM recurring_events WHERE user_id=uid AND id=eid AND course_id=cid) THEN CONTINUE;END IF;
 UPDATE recurring_events SET title=e->>'title',weekday=(e->>'weekday')::int,start_time=e->>'start_time',end_time=e->>'end_time',starts_on=e->>'starts_on',ends_on=e->>'ends_on',auto_track=coalesce((e->>'auto_track')::int,0) WHERE user_id=uid AND id=eid AND course_id=cid;
 ELSE
 INSERT INTO recurring_events(course_id,title,weekday,start_time,end_time,starts_on,ends_on,auto_track) VALUES(cid,e->>'title',(e->>'weekday')::int,e->>'start_time',e->>'end_time',e->>'starts_on',e->>'ends_on',coalesce((e->>'auto_track')::int,0)) RETURNING id INTO eid;
 END IF;
 origin:=jsonb_set(origin,ARRAY['event_map',ekey],to_jsonb(eid));
 INSERT INTO settings(key,value) VALUES('lecture-exclusions-'||eid,coalesce(e->'excluded','[]'::jsonb)::text) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value;
 END LOOP;
 FOR h IN SELECT value FROM jsonb_array_elements(coalesce(template->'homework','[]'::jsonb)) LOOP
 eid:=(origin->'event_map'->>(h->>'event_key'))::bigint;IF eid IS NULL THEN RAISE EXCEPTION 'Aufgabenserie benötigt eine ausgewählte Einheit';END IF;
 hid:=origin->'homework_map'->>(h->>'source_key');previous:=NULL;
 IF hid IS NOT NULL THEN
 SELECT public.catalog_object(value) INTO previous FROM settings WHERE user_id=uid AND key='homework-series-'||hid;
 IF previous IS NULL OR previous->>'deleted'='true' OR previous->>'stopped'='true' THEN CONTINUE;END IF;
 ELSE hid:=md5(random()::text||clock_timestamp()::text);END IF;
 INSERT INTO settings(key,value) VALUES('homework-series-'||hid,(coalesce(previous,'{}'::jsonb)||jsonb_build_object('id',hid,'event_id',eid,'starts_on',coalesce(previous->>'starts_on',h->>'starts_on'),'skipped',coalesce(previous->'skipped','[]'::jsonb),'task',jsonb_build_object('title',h->>'title','description',coalesce(previous->'task'->>'description',''),'area','Universität','type',coalesce(h->>'type','Hausaufgabe'),'course_id',cid,'deadline',NULL,'estimate_minutes',coalesce((h->>'estimate_minutes')::int,60),'priority',coalesce(h->>'priority','Mittel'),'status','Offen','tracking',coalesce((h->>'tracking')::int,1)),'numbering',h->'numbering','submission',h->'submission'))::text) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value;
 origin:=jsonb_set(origin,ARRAY['homework_map',h->>'source_key'],to_jsonb(hid));
 END LOOP;
 IF template->>'source_key' IS NOT NULL THEN
 origin:=origin||jsonb_build_object('source_key',template->>'source_key','revision',template->>'revision','snapshot',coalesce(template->'source_snapshot',template));
 INSERT INTO settings(key,value) VALUES('course-origin-'||cid,origin::text) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value;
 END IF;
 RETURN jsonb_build_object('id',cid);
END; $$;
REVOKE ALL ON FUNCTION public.apply_course_update(bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_course_update(bigint,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.copy_course_template(template jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT public.apply_course_update(NULL,template) $$;
CREATE OR REPLACE FUNCTION public.course_catalog_transfer_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.course_catalog_transfer_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_catalog_transfer_ready() TO authenticated;
commit;
