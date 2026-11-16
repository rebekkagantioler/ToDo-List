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
 INSERT INTO settings(key,value) VALUES('lecture-unplanned-'||event_id,coalesce(e->'unplanned','[]'::jsonb)::text);
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
    'excluded',public.catalog_exclusions(s.value),'unplanned',public.catalog_exclusions(u.value)
   ) ORDER BY e.starts_on,e.weekday,e.start_time,e.title,e.id)
   FROM public.recurring_events e LEFT JOIN public.settings s ON s.user_id=e.user_id AND s.key='lecture-exclusions-'||e.id LEFT JOIN public.settings u ON u.user_id=e.user_id AND u.key='lecture-unplanned-'||e.id
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
COMMENT ON FUNCTION public.list_course_catalog() IS 'Authenticated course catalog; shares numbered worksheet names and deadlines, shares existing course task titles and deadlines; excludes user IDs, descriptions, completion, scores, sessions, planned blocks and private settings.';
commit;

-- Auswahl bei Übernahmen und bewusst bestätigte Updates bestehender Kopien.
begin;
CREATE OR REPLACE FUNCTION public.catalog_object(value text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE parsed jsonb;
BEGIN parsed:=value::jsonb;IF jsonb_typeof(parsed)='object' THEN RETURN parsed;END IF;RETURN '{}'::jsonb;
EXCEPTION WHEN invalid_text_representation THEN RETURN '{}'::jsonb;END; $$;
REVOKE ALL ON FUNCTION public.catalog_object(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_object(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.catalog_array(value text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE parsed jsonb;
BEGIN parsed:=value::jsonb;IF jsonb_typeof(parsed)='array' THEN RETURN parsed;END IF;RETURN '[]'::jsonb;
EXCEPTION WHEN invalid_text_representation THEN RETURN '[]'::jsonb;END; $$;
REVOKE ALL ON FUNCTION public.catalog_array(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_array(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.general_requirement(value jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT coalesce(jsonb_object_agg(key,v),'{}'::jsonb) FROM jsonb_each(value) AS item(key,v) WHERE key IN ('title','unit','target','kind','dateMode','date','time','bookingDeadline','examScoreType','percentage','pointsPerSheet','maximumPoints','worksheetCount','dropLowest','attendanceRequired','taskType');
$$;
REVOKE ALL ON FUNCTION public.general_requirement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.general_requirement(jsonb) TO authenticated;
-- Same stable task ID as src/homework.ts; never exports source account/task IDs.
CREATE OR REPLACE FUNCTION public.worksheet_task_id(series text,day text) RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE hash numeric:=1469598103934665603; input text:=series||':'||day; signed bigint; i int;
BEGIN
 FOR i IN 1..length(input) LOOP
 signed:=(CASE WHEN hash>=9223372036854775808 THEN hash-18446744073709551616 ELSE hash END)::bigint;
 hash:=mod((signed # ascii(substr(input,i,1)))::numeric*1099511628211,18446744073709551616);
 IF hash<0 THEN hash:=hash+18446744073709551616;END IF;
 END LOOP;
 RETURN (mod(hash,4000000000000000)+4000000000000000)::bigint;
END; $$;
REVOKE ALL ON FUNCTION public.worksheet_task_id(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worksheet_task_id(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.worksheet_number(title text,prefix text) RETURNS text LANGUAGE plpgsql IMMUTABLE RETURNS NULL ON NULL INPUT SET search_path=public AS $$
DECLARE compact text:=regexp_replace(title,'[[:space:]  ]+','','g'); base text:=regexp_replace(prefix,'[[:space:]  ]+','','g'); suffix text;
BEGIN
 IF left(compact,length(base))<>base THEN RETURN NULL;END IF;
 suffix:=substr(compact,length(base)+1);
 IF suffix !~ '^[0-9]+$' THEN RETURN NULL;END IF;
 RETURN coalesce(nullif(ltrim(suffix,'0'),''),'0');
END; $$;
REVOKE ALL ON FUNCTION public.worksheet_number(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.worksheet_number(text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.merge_catalog_homework_sheets(owner_id uuid,series jsonb,event_id bigint,sheets jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE e recurring_events%ROWTYPE; actual tasks%ROWTYPE; day text; candidate date; seen text[]:=ARRAY[]::text[]; result jsonb:=sheets; previous_key text; sheet_number text;
BEGIN
 SELECT * INTO e FROM recurring_events WHERE user_id=owner_id AND id=event_id;
 FOR actual IN SELECT * FROM tasks WHERE user_id=owner_id AND course_id=e.course_id AND type=series->'task'->>'type' AND public.worksheet_number(title,series->'task'->>'title') IS NOT NULL AND deadline ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' ORDER BY id LOOP
 sheet_number:=public.worksheet_number(actual.title,series->'task'->>'title');
 IF sheet_number=ANY(seen) THEN CONTINUE;END IF;seen:=array_append(seen,sheet_number);
 SELECT r->>'key' INTO previous_key FROM jsonb_array_elements(result) r WHERE public.worksheet_number(r->>'title',series->'task'->>'title')=sheet_number LIMIT 1;
 SELECT r->>'date' INTO day FROM jsonb_array_elements(result) r WHERE public.worksheet_task_id(series->>'id',coalesce(r->>'key',r->>'date'))=actual.id LIMIT 1;
 IF day IS NULL THEN
 SELECT v::date::text INTO day FROM generate_series(e.starts_on::date,e.ends_on::date,interval '1 day') v WHERE extract(dow FROM v)::int=e.weekday AND public.worksheet_task_id(series->>'id',v::date::text)=actual.id LIMIT 1;
 END IF;
 IF day IS NULL THEN
 candidate:=left(actual.deadline,10)::date+coalesce((series->'submission'->>'days_before')::int,0);
 day:=(candidate+((e.weekday-extract(dow FROM candidate)::int+7)%7))::text;
 END IF;
 SELECT coalesce(jsonb_agg(r),'[]'::jsonb) INTO result FROM jsonb_array_elements(result) r WHERE public.worksheet_number(r->>'title',series->'task'->>'title') IS DISTINCT FROM sheet_number;
 result:=result||jsonb_build_array(jsonb_build_object('date',day,'title',actual.title,'deadline',actual.deadline,'visible',true)||CASE WHEN previous_key IS NOT NULL THEN jsonb_build_object('key',previous_key) ELSE '{}'::jsonb END);
 END LOOP;
 RETURN (SELECT coalesce(jsonb_agg(r||CASE WHEN (SELECT count(*) FROM jsonb_array_elements(result) other WHERE other->>'date'=r->>'date')>1 THEN jsonb_build_object('key',coalesce(r->>'key','number:'||coalesce(public.worksheet_number(r->>'title',series->'task'->>'title'),r->>'title'))) ELSE '{}'::jsonb END ORDER BY r->>'date',r->>'title'),'[]'::jsonb) FROM jsonb_array_elements(result) r);
END; $$;
REVOKE ALL ON FUNCTION public.merge_catalog_homework_sheets(uuid,jsonb,bigint,jsonb) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.catalog_homework_sheets(owner_id uuid,series jsonb,event_id bigint) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE e recurring_events%ROWTYPE; d date; day text; result jsonb:='[]'::jsonb; exclusions jsonb; unplanned jsonb; requirements jsonb; keeps boolean; number int; sheet_title text; deadline text; actual tasks%ROWTYPE; reference jsonb;
BEGIN
 IF series->'numbering' IS NULL OR series->'numbering'='null'::jsonb THEN RETURN NULL;END IF;
 SELECT * INTO e FROM recurring_events WHERE user_id=owner_id AND id=event_id;
 IF jsonb_typeof(series->'reference')='array' THEN
 RETURN public.merge_catalog_homework_sheets(owner_id,series,event_id,(SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('key',r->>'key','date',r->>'date','title',coalesce(t.title,r->>'title'),'deadline',coalesce(t.deadline,r->>'deadline'),'visible',t.id IS NOT NULL)) ORDER BY r->>'date'),'[]'::jsonb) FROM jsonb_array_elements(series->'reference') r LEFT JOIN tasks t ON t.user_id=owner_id AND t.course_id=e.course_id AND t.id=public.worksheet_task_id(series->>'id',coalesce(r->>'key',r->>'date'))));
 END IF;
 IF e.ends_on IS NULL THEN RETURN public.merge_catalog_homework_sheets(owner_id,series,event_id,'[]'::jsonb);END IF;
 SELECT public.catalog_exclusions(value) INTO exclusions FROM settings WHERE user_id=owner_id AND key='lecture-exclusions-'||event_id;
 SELECT public.catalog_exclusions(value) INTO unplanned FROM settings WHERE user_id=owner_id AND key='lecture-unplanned-'||event_id;
 SELECT public.catalog_array(value) INTO requirements FROM settings WHERE user_id=owner_id AND key='course-requirements-'||e.course_id;
 keeps:=EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(requirements,'[]'::jsonb)) r WHERE r->>'kind'='homework' AND r->>'taskType'=series->'task'->>'type');
 number:=(series->'numbering'->>'start')::int;
 FOR d IN SELECT v::date FROM generate_series(e.starts_on::date,e.ends_on::date,interval '1 day') v WHERE extract(dow FROM v)::int=e.weekday LOOP
 day:=d::text;
 IF day<series->>'starts_on' OR coalesce(unplanned,'[]'::jsonb)?day THEN CONTINUE;END IF;
 SELECT * INTO actual FROM tasks WHERE user_id=owner_id AND course_id=e.course_id AND id=public.worksheet_task_id(series->>'id',day);
 IF coalesce(exclusions,'[]'::jsonb)?day AND NOT keeps AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(requirements,'[]'::jsonb)) r WHERE r->>'kind'='homework' AND coalesce(r->'taskIds','[]'::jsonb) @> to_jsonb(public.worksheet_task_id(series->>'id',day))) THEN
 -- Already assigned numbers remain reserved in the original course.
 IF actual.id IS NOT NULL AND actual.title LIKE (series->'task'->>'title')||' %' AND substring(actual.title FROM length(series->'task'->>'title')+2) ~ '^[0-9]+$' THEN number:=greatest(number,substring(actual.title FROM length(series->'task'->>'title')+2)::int+1);END IF;
 CONTINUE;
 END IF;
 sheet_title:=series->'task'->>'title';
 IF day>=series->'numbering'->>'from' THEN sheet_title:=sheet_title||' '||number;number:=number+1;END IF;
 IF series->'submission' IS NOT NULL AND series->'submission'<>'null'::jsonb THEN
 deadline:=(d-coalesce((series->'submission'->>'days_before')::int,0))::text||'T'||(series->'submission'->>'time');
 ELSE deadline:=day||'T'||e.start_time;END IF;
 SELECT value INTO reference FROM jsonb_array_elements(coalesce(series->'reference','[]'::jsonb)) WHERE value->>'date'=day;
 IF actual.id IS NULL THEN SELECT * INTO actual FROM tasks WHERE user_id=owner_id AND course_id=e.course_id AND type=series->'task'->>'type' AND tasks.title=coalesce(reference->>'title',sheet_title) ORDER BY id LIMIT 1;END IF;
 sheet_title:=coalesce(actual.title,reference->>'title',sheet_title);deadline:=coalesce(actual.deadline,reference->>'deadline',deadline);
 IF actual.id IS NOT NULL AND sheet_title LIKE (series->'task'->>'title')||' %' AND substring(sheet_title FROM length(series->'task'->>'title')+2) ~ '^[0-9]+$' THEN number:=greatest(number,substring(sheet_title FROM length(series->'task'->>'title')+2)::int+1);END IF;
 IF NOT coalesce(series->'skipped','[]'::jsonb)?day THEN
 result:=result||jsonb_build_array(jsonb_build_object('date',day,'title',sheet_title,'deadline',deadline,'visible',actual.id IS NOT NULL));
 END IF;
 END LOOP;
 RETURN public.merge_catalog_homework_sheets(owner_id,series,event_id,result);
END; $$;
REVOKE ALL ON FUNCTION public.catalog_homework_sheets(uuid,jsonb,bigint) FROM PUBLIC;
-- Share task structure only; source status, descriptions and results are private.
CREATE OR REPLACE FUNCTION public.catalog_course_tasks(owner_id uuid,course_id bigint) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE t tasks%ROWTYPE; h jsonb; templates jsonb; sheet jsonb; occurrence text; entry jsonb; result jsonb:='[]'::jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',s.key,'obj',v.obj,'starts_on',e.starts_on,'ends_on',e.ends_on,'weekday',e.weekday,'sheets',public.catalog_homework_sheets(owner_id,v.obj,e.id)) ORDER BY s.key),'[]'::jsonb) INTO templates
 FROM settings s CROSS JOIN LATERAL (SELECT public.catalog_object(s.value) AS obj) v JOIN recurring_events e ON e.user_id=s.user_id AND e.id::text=v.obj->>'event_id'
 WHERE s.user_id=owner_id AND e.course_id=catalog_course_tasks.course_id AND v.obj->'task'->>'course_id'=catalog_course_tasks.course_id::text AND s.key LIKE 'homework-series-%' AND coalesce(v.obj->>'deleted','false')<>'true' AND coalesce(v.obj->>'stopped','false')<>'true';
 FOR t IN SELECT * FROM tasks WHERE user_id=owner_id AND tasks.course_id=catalog_course_tasks.course_id AND area='Universität' ORDER BY title,type,deadline NULLS LAST,id LOOP
 entry:=jsonb_build_object('source_key',md5(owner_id::text||':task:'||t.id),'title',t.title,'type',t.type,'deadline',t.deadline,'estimate_minutes',t.estimate_minutes,'priority',t.priority,'tracking',t.tracking);
 FOR h IN SELECT value FROM jsonb_array_elements(templates) LOOP
 IF h->'obj'->'task'->>'type' IS DISTINCT FROM t.type THEN CONTINUE;END IF;
 sheet:=NULL;occurrence:=NULL;
 SELECT r INTO sheet FROM jsonb_array_elements(CASE WHEN jsonb_typeof(h->'sheets')='array' THEN h->'sheets' ELSE '[]'::jsonb END) r WHERE r->>'title'=t.title OR public.worksheet_number(t.title,h->'obj'->'task'->>'title') IS NOT NULL AND public.worksheet_number(r->>'title',h->'obj'->'task'->>'title')=public.worksheet_number(t.title,h->'obj'->'task'->>'title') LIMIT 1;
 IF sheet IS NOT NULL THEN
 entry:=entry||jsonb_strip_nulls(jsonb_build_object('homework_key',md5(owner_id::text||':'||(h->>'key')),'occurrence_on',sheet->>'date','sheet_key',sheet->>'key'));EXIT;
 END IF;
 SELECT v::date::text INTO occurrence FROM generate_series((h->>'starts_on')::date,(h->>'ends_on')::date,interval '1 day') v WHERE extract(dow FROM v)::int=(h->>'weekday')::int AND public.worksheet_task_id(h->'obj'->>'id',v::date::text)=t.id LIMIT 1;
 IF occurrence IS NOT NULL THEN entry:=entry||jsonb_build_object('homework_key',md5(owner_id::text||':'||(h->>'key')),'occurrence_on',occurrence);EXIT;END IF;
 END LOOP;
 result:=result||jsonb_build_array(entry);
 END LOOP;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.catalog_course_tasks(uuid,bigint) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.course_catalog_payload(owner_id uuid,course_id bigint) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT jsonb_build_object(
 'tasks',public.catalog_course_tasks(c.user_id,c.id),
 'course',jsonb_build_object('name',c.name,'code',c.code,'semester',c.semester,'ects',c.ects,'hours_per_ects',c.hours_per_ects,'color',c.color,'description',''),
 'events',coalesce((SELECT jsonb_agg(jsonb_build_object('source_key',md5(e.user_id::text||':'||e.id),'title',e.title,'weekday',e.weekday,'start_time',e.start_time,'end_time',e.end_time,'starts_on',e.starts_on,'ends_on',e.ends_on,'auto_track',e.auto_track,'excluded',public.catalog_exclusions(s.value),'unplanned',public.catalog_exclusions(u.value)) ORDER BY e.starts_on,e.weekday,e.start_time,e.title,e.id)
 FROM recurring_events e LEFT JOIN settings s ON s.user_id=e.user_id AND s.key='lecture-exclusions-'||e.id LEFT JOIN public.settings u ON u.user_id=e.user_id AND u.key='lecture-unplanned-'||e.id WHERE e.user_id=c.user_id AND e.course_id=c.id),'[]'::jsonb),
 'sheet_maximum',(SELECT to_jsonb(value::numeric) FROM settings WHERE user_id=c.user_id AND key='course-sheet-points-'||c.id AND value ~ '^[0-9]+([.][0-9]+)?$' AND value::numeric>0),
 'requirements',coalesce((SELECT jsonb_agg(public.general_requirement(r)||jsonb_build_object('source_key',md5(c.user_id::text||':'||(r->>'id')))||CASE WHEN r->>'eventId' IS NOT NULL THEN jsonb_build_object('event_key',md5(c.user_id::text||':'||(r->>'eventId'))) ELSE '{}'::jsonb END) FROM settings rs CROSS JOIN LATERAL jsonb_array_elements(public.catalog_array(rs.value)) r WHERE rs.user_id=c.user_id AND rs.key='course-requirements-'||c.id),'[]'::jsonb),
 'homework',coalesce((SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object('source_key',md5(s.user_id::text||':'||s.key),'event_key',md5(e.user_id::text||':'||e.id),'title',v.obj->'task'->>'title','type',v.obj->'task'->>'type','starts_on',v.obj->>'starts_on','estimate_minutes',v.obj->'task'->'estimate_minutes','priority',v.obj->'task'->>'priority','tracking',v.obj->'task'->'tracking','numbering',v.obj->'numbering','submission',v.obj->'submission','sheets',public.catalog_homework_sheets(c.user_id,v.obj,e.id))) ORDER BY s.key)
 FROM settings s CROSS JOIN LATERAL (SELECT public.catalog_object(s.value) AS obj) v JOIN recurring_events e ON e.user_id=s.user_id AND e.id::text=v.obj->>'event_id' AND e.course_id=c.id
 WHERE s.user_id=c.user_id AND s.key LIKE 'homework-series-%' AND v.obj->'task'->>'course_id'=c.id::text AND coalesce(v.obj->>'deleted','false')<>'true' AND coalesce(v.obj->>'stopped','false')<>'true'),'[]'::jsonb))
 FROM courses c WHERE c.user_id=owner_id AND c.id=course_id;
$$;
REVOKE ALL ON FUNCTION public.course_catalog_payload(uuid,bigint) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.list_course_catalog() RETURNS TABLE(id text,name text,payload jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT DISTINCT ON (jsonb_build_object('tasks',(SELECT coalesce(jsonb_agg(v-'source_key'-'homework_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'tasks') v),'sheet_maximum',x.base->'sheet_maximum','requirements',(SELECT coalesce(jsonb_agg(v-'source_key'-'event_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'requirements') v),'course',x.base->'course','events',(SELECT coalesce(jsonb_agg(v-'source_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'events') v),'homework',(SELECT coalesce(jsonb_agg(v-'source_key'-'event_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'homework') v))::text) x.source_key,x.name,x.base||jsonb_build_object('source_key',x.source_key,'revision',md5(x.base::text)) FROM (
 SELECT c.name,md5(c.user_id::text||':'||c.id) AS source_key,public.course_catalog_payload(c.user_id,c.id) AS base
 FROM courses c WHERE auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM settings s WHERE s.user_id=c.user_id AND s.key='course-catalog-visible-'||c.id AND s.value='true')
 ) x ORDER BY jsonb_build_object('tasks',(SELECT coalesce(jsonb_agg(v-'source_key'-'homework_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'tasks') v),'sheet_maximum',x.base->'sheet_maximum','requirements',(SELECT coalesce(jsonb_agg(v-'source_key'-'event_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'requirements') v),'course',x.base->'course','events',(SELECT coalesce(jsonb_agg(v-'source_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'events') v),'homework',(SELECT coalesce(jsonb_agg(v-'source_key'-'event_key'),'[]'::jsonb) FROM jsonb_array_elements(x.base->'homework') v))::text,x.source_key;
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
DECLARE uid uuid:=auth.uid(); cid bigint:=target_course; c jsonb:=template->'course'; e jsonb; h jsonb; origin jsonb; ekey text; hid text; eid bigint; idx int:=0; previous jsonb; r jsonb; requirements jsonb; rid text; old_requirement jsonb; clean jsonb; t jsonb; tid bigint; local_series text; imported jsonb;
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
 IF eid IS NULL AND target_course IS NOT NULL THEN SELECT id INTO eid FROM recurring_events WHERE user_id=uid AND course_id=cid AND title=e->>'title' AND weekday=(e->>'weekday')::int AND start_time=e->>'start_time' AND starts_on=e->>'starts_on' ORDER BY id LIMIT 1;END IF;
 IF eid IS NOT NULL THEN
 IF NOT EXISTS(SELECT 1 FROM recurring_events WHERE user_id=uid AND id=eid AND course_id=cid) THEN CONTINUE;END IF;
 UPDATE recurring_events SET title=e->>'title',weekday=(e->>'weekday')::int,start_time=e->>'start_time',end_time=e->>'end_time',starts_on=e->>'starts_on',ends_on=e->>'ends_on',auto_track=coalesce((e->>'auto_track')::int,0) WHERE user_id=uid AND id=eid AND course_id=cid;
 ELSE
 INSERT INTO recurring_events(course_id,title,weekday,start_time,end_time,starts_on,ends_on,auto_track) VALUES(cid,e->>'title',(e->>'weekday')::int,e->>'start_time',e->>'end_time',e->>'starts_on',e->>'ends_on',coalesce((e->>'auto_track')::int,0)) RETURNING id INTO eid;
 END IF;
 origin:=jsonb_set(origin,ARRAY['event_map',ekey],to_jsonb(eid));
 INSERT INTO settings(key,value) VALUES('lecture-exclusions-'||eid,coalesce(e->'excluded','[]'::jsonb)::text) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value;
 INSERT INTO settings(key,value) VALUES('lecture-unplanned-'||eid,coalesce(e->'unplanned','[]'::jsonb)::text) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value;
 END LOOP;
 FOR h IN SELECT value FROM jsonb_array_elements(coalesce(template->'homework','[]'::jsonb)) LOOP
 eid:=(origin->'event_map'->>(h->>'event_key'))::bigint;IF eid IS NULL THEN RAISE EXCEPTION 'Aufgabenserie benötigt eine ausgewählte Einheit';END IF;
 hid:=origin->'homework_map'->>(h->>'source_key');previous:=NULL;
 IF hid IS NULL AND target_course IS NOT NULL THEN SELECT public.catalog_object(value)->>'id' INTO hid FROM settings WHERE user_id=uid AND key LIKE 'homework-series-%' AND public.catalog_object(value)->'task'->>'course_id'=cid::text AND public.catalog_object(value)->'task'->>'title'=h->>'title' AND public.catalog_object(value)->'task'->>'type'=h->>'type' AND coalesce(public.catalog_object(value)->>'deleted','false')<>'true' AND coalesce(public.catalog_object(value)->>'stopped','false')<>'true' ORDER BY key LIMIT 1;END IF;
 IF hid IS NOT NULL THEN
 SELECT public.catalog_object(value) INTO previous FROM settings WHERE user_id=uid AND key='homework-series-'||hid;
 IF (previous IS NULL OR previous->>'deleted'='true' OR previous->>'stopped'='true') AND jsonb_typeof(h->'sheets') IS DISTINCT FROM 'array' THEN CONTINUE;END IF;
 ELSE hid:=md5(random()::text||clock_timestamp()::text);END IF;
 INSERT INTO settings(key,value) VALUES('homework-series-'||hid,(coalesce(previous,'{}'::jsonb)||jsonb_build_object('id',hid,'event_id',eid,'starts_on',least(previous->>'starts_on',h->>'starts_on'),'skipped',coalesce(previous->'skipped','[]'::jsonb),'task',jsonb_build_object('title',h->>'title','description',coalesce(previous->'task'->>'description',''),'area','Universität','type',coalesce(h->>'type','Hausaufgabe'),'course_id',cid,'deadline',NULL,'estimate_minutes',coalesce((h->>'estimate_minutes')::int,60),'priority',coalesce(h->>'priority','Mittel'),'status','Offen','tracking',coalesce((h->>'tracking')::int,1)),'numbering',h->'numbering','submission',h->'submission')||CASE WHEN jsonb_typeof(h->'sheets')='array' THEN jsonb_build_object('reference',h->'sheets','skipped','[]'::jsonb,'title_updates','{}'::jsonb,'stopped',false,'deleted',false) ELSE '{}'::jsonb END)::text) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value;
 IF jsonb_typeof(h->'sheets')='array' THEN
 UPDATE settings SET value=(public.catalog_object(value)||jsonb_build_object('stopped',true))::text WHERE user_id=uid AND key LIKE 'homework-series-%' AND key<>'homework-series-'||hid AND public.catalog_object(value)->'task'->>'course_id'=cid::text AND public.catalog_object(value)->'task'->>'title'=h->>'title' AND public.catalog_object(value)->'task'->>'type'=h->>'type';
 END IF;
 origin:=jsonb_set(origin,ARRAY['homework_map',h->>'source_key'],to_jsonb(hid));
 END LOOP;
 IF (template->>'sheet_maximum')::numeric>0 THEN
 INSERT INTO settings(key,value) VALUES('course-sheet-points-'||cid,template->>'sheet_maximum') ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value;
 END IF;
 IF jsonb_typeof(template->'requirements')='array' THEN
 SELECT public.catalog_array(value) INTO requirements FROM settings WHERE user_id=uid AND key='course-requirements-'||cid;
 requirements:=coalesce(requirements,'[]'::jsonb);
 origin:=jsonb_set(origin,'{requirement_map}',coalesce(origin->'requirement_map','{}'::jsonb));
 FOR r IN SELECT value FROM jsonb_array_elements(template->'requirements') LOOP
 rid:=origin->'requirement_map'->>(r->>'source_key');old_requirement:=NULL;
 SELECT value INTO old_requirement FROM jsonb_array_elements(requirements) WHERE value->>'id'=rid;
 IF rid IS NOT NULL AND old_requirement IS NULL THEN CONTINUE;END IF;
 rid:=coalesce(rid,md5(random()::text||clock_timestamp()::text));
 clean:=coalesce(old_requirement,'{}'::jsonb)||public.general_requirement(r)||jsonb_build_object('id',rid,'current',coalesce(old_requirement->'current','0'::jsonb),'eventId',origin->'event_map'->(r->>'event_key'));
 SELECT coalesce(jsonb_agg(value),'[]'::jsonb) INTO requirements FROM jsonb_array_elements(requirements) WHERE value->>'id'<>rid;
 requirements:=requirements||jsonb_build_array(clean);
 origin:=jsonb_set(origin,ARRAY['requirement_map',r->>'source_key'],to_jsonb(rid));
 END LOOP;
 INSERT INTO settings(key,value) VALUES('course-requirements-'||cid,requirements::text) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value;
 END IF;
 IF jsonb_typeof(template->'tasks')='array' THEN
 origin:=jsonb_set(origin,'{task_map}',coalesce(origin->'task_map','{}'::jsonb));
 FOR t IN SELECT value FROM jsonb_array_elements(template->'tasks') LOOP
 IF coalesce(t->>'source_key','')='' OR coalesce(trim(t->>'title'),'')='' OR coalesce(trim(t->>'type'),'')='' THEN RAISE EXCEPTION 'Ungültige Aufgabenvorlage';END IF;
 local_series:=origin->'homework_map'->>(t->>'homework_key');
 IF t->>'homework_key' IS NOT NULL AND local_series IS NULL THEN CONTINUE;END IF;
 tid:=NULL;
 IF local_series IS NOT NULL AND t->>'occurrence_on' IS NOT NULL THEN tid:=public.worksheet_task_id(local_series,coalesce(t->>'sheet_key',t->>'occurrence_on'));
 ELSE tid:=(origin->'task_map'->>(t->>'source_key'))::bigint;END IF;
 IF tid IS NULL AND target_course IS NOT NULL THEN SELECT id INTO tid FROM tasks WHERE user_id=uid AND course_id=cid AND title=t->>'title' AND type=t->>'type' AND deadline IS NOT DISTINCT FROM t->>'deadline' ORDER BY id LIMIT 1;END IF;
 tid:=coalesce(tid,(floor(random()*3500000000000000)+1)::bigint);
 INSERT INTO tasks(id,course_id,title,description,area,type,deadline,estimate_minutes,priority,status,tracking,completed_at) VALUES(tid,cid,t->>'title','','Universität',t->>'type',t->>'deadline',coalesce((t->>'estimate_minutes')::int,60),coalesce(t->>'priority','Mittel'),'Offen',coalesce((t->>'tracking')::int,1),NULL) ON CONFLICT(user_id,id) DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM tasks WHERE user_id=uid AND id=tid AND course_id=cid) THEN RAISE EXCEPTION 'Aufgabe gehört zu einem anderen Kurs';END IF;
 origin:=jsonb_set(origin,ARRAY['task_map',t->>'source_key'],to_jsonb(tid));
 IF local_series IS NOT NULL AND t->>'occurrence_on' IS NOT NULL THEN
 SELECT coalesce(public.catalog_object(value)->'imported_dates','[]'::jsonb) INTO imported FROM settings WHERE user_id=uid AND key='homework-series-'||local_series;
 imported:=coalesce(imported,'[]'::jsonb);
 IF NOT imported ? (t->>'occurrence_on') THEN imported:=imported||jsonb_build_array(t->>'occurrence_on');END IF;
 UPDATE settings SET value=(public.catalog_object(value)||jsonb_build_object('imported_dates',imported))::text WHERE user_id=uid AND key='homework-series-'||local_series;
 END IF;
 END LOOP;
 END IF;
 IF template->>'source_key' IS NOT NULL THEN
 origin:=origin||jsonb_build_object('source_key',template->>'source_key','revision',template->>'revision','snapshot',coalesce(template->'source_snapshot',template));
 INSERT INTO settings(key,value) VALUES('course-origin-'||cid,origin::text) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value;
 END IF;
 RETURN jsonb_build_object('id',cid);
END; $$;
REVOKE ALL ON FUNCTION public.apply_course_update(bigint,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_course_update(bigint,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.copy_course_template(template jsonb) RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path=public AS $$ SELECT public.apply_course_update(NULL,template) $$;
CREATE OR REPLACE FUNCTION public.course_catalog_all_tasks_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.course_catalog_all_tasks_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_catalog_all_tasks_ready() TO authenticated;
CREATE OR REPLACE FUNCTION public.course_catalog_sheet_names_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.course_catalog_sheet_names_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_catalog_sheet_names_ready() TO authenticated;
CREATE OR REPLACE FUNCTION public.course_catalog_sheet_keys_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.course_catalog_sheet_keys_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_catalog_sheet_keys_ready() TO authenticated;
CREATE OR REPLACE FUNCTION public.course_catalog_history_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.course_catalog_history_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_catalog_history_ready() TO authenticated;
CREATE OR REPLACE FUNCTION public.course_catalog_worksheets_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.course_catalog_worksheets_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_catalog_worksheets_ready() TO authenticated;
CREATE OR REPLACE FUNCTION public.course_catalog_requirements_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.course_catalog_requirements_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_catalog_requirements_ready() TO authenticated;
CREATE OR REPLACE FUNCTION public.course_catalog_transfer_ready() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.course_catalog_transfer_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.course_catalog_transfer_ready() TO authenticated;
commit;
