-- Einmal im Supabase SQL Editor ausführen: Familien-Sperren für neue Runden.
BEGIN;
CREATE OR REPLACE FUNCTION public.wichtel_draw_family(request_id uuid,round_title text,participant_names text[],blocked_pairs jsonb DEFAULT '[]'::jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE names text[]; ids uuid[]; shuffled uuid[]; n integer; i integer; existing public.wichtel_rounds%ROWTYPE; previous_names text[];
BEGIN
 IF NOT public.wichtel_is_admin() THEN RAISE EXCEPTION 'Keine Berechtigung';END IF;
 IF request_id IS NULL OR round_title IS NULL OR length(btrim(round_title)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Bitte einen Titel mit höchstens 120 Zeichen eingeben.';END IF;
 IF coalesce(cardinality(participant_names),0) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Bitte 2 bis 100 Personen eintragen.';END IF;
 SELECT array_agg(btrim(name) ORDER BY ord) INTO names FROM unnest(participant_names) WITH ORDINALITY AS p(name,ord);
 IF EXISTS(SELECT 1 FROM unnest(names) name WHERE name IS NULL OR length(name) NOT BETWEEN 1 AND 80) OR (SELECT count(DISTINCT lower(name)) FROM unnest(names) name)<>cardinality(names) THEN RAISE EXCEPTION 'Ungültige Teilnehmer:innen.';END IF;
 IF jsonb_typeof(coalesce(blocked_pairs,'[]'::jsonb))<>'array' OR EXISTS(SELECT 1 FROM jsonb_array_elements(coalesce(blocked_pairs,'[]'::jsonb)) pair WHERE jsonb_typeof(pair)<>'array' OR jsonb_array_length(pair)<>2 OR pair->>0=pair->>1 OR NOT ((pair->>0)=ANY(names) AND (pair->>1)=ANY(names))) THEN RAISE EXCEPTION 'Ungültige Familiengruppe.';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(request_id::text,0));SELECT * INTO existing FROM public.wichtel_rounds WHERE id=request_id;
 IF FOUND THEN SELECT array_agg(name ORDER BY position) INTO previous_names FROM public.wichtel_people WHERE round_id=request_id;IF existing.owner_id=auth.uid() AND existing.title=btrim(round_title) AND previous_names=names THEN RETURN existing.id;END IF;RAISE EXCEPTION 'Diese Auslosung existiert bereits.';END IF;
 n:=cardinality(names);SELECT array_agg(gen_random_uuid() ORDER BY ord) INTO ids FROM generate_series(1,n) ord;
 LOOP
  SELECT array_agg(person ORDER BY random()) INTO shuffled FROM unnest(ids) person;
  EXIT WHEN NOT EXISTS(SELECT 1 FROM generate_subscripts(ids,1) s(i) WHERE ids[s.i]=shuffled[s.i]) AND (n=2 OR NOT EXISTS(SELECT 1 FROM generate_subscripts(ids,1) s(i) WHERE shuffled[array_position(ids,shuffled[s.i])]=ids[s.i])) AND NOT EXISTS(SELECT 1 FROM generate_subscripts(ids,1) s(i),jsonb_array_elements(coalesce(blocked_pairs,'[]'::jsonb)) pair WHERE (pair->>0=names[s.i] AND pair->>1=names[array_position(ids,shuffled[s.i])]) OR (pair->>1=names[s.i] AND pair->>0=names[array_position(ids,shuffled[s.i])]));
 END LOOP;
 INSERT INTO public.wichtel_rounds(id,owner_id,title) VALUES(request_id,auth.uid(),btrim(round_title));FOR i IN 1..n LOOP INSERT INTO public.wichtel_people(id,round_id,position,name,recipient_id) VALUES(ids[i],request_id,i,names[i],shuffled[i]);END LOOP;RETURN request_id;
END;$$;
REVOKE ALL ON FUNCTION public.wichtel_draw_family(uuid,text,text[],jsonb) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.wichtel_draw_family(uuid,text,text[],jsonb) TO authenticated;NOTIFY pgrst,'reload schema';COMMIT;
