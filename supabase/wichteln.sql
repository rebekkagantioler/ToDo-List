-- Einmal im Supabase SQL Editor ausführen. Nur Rebekkas bestehendes Konto
-- wird als Verwaltungskonto freigeschaltet; andere App-Daten bleiben unberührt.
BEGIN;
CREATE TABLE IF NOT EXISTS public.wichtel_config (
 id integer PRIMARY KEY CHECK (id=1),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS public.wichtel_rounds (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS public.wichtel_people (
 id uuid PRIMARY KEY,
 round_id uuid NOT NULL REFERENCES public.wichtel_rounds(id) ON DELETE CASCADE,
 position integer NOT NULL CHECK (position>0),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
 revealed_at timestamptz,
 recipient_id uuid NOT NULL,
 token text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')) CHECK (token ~ '^[a-f0-9]{64}$'),
 UNIQUE(round_id,id),
 UNIQUE(round_id,position),
 UNIQUE(round_id,recipient_id) DEFERRABLE INITIALLY DEFERRED,
 CHECK (id<>recipient_id),
 FOREIGN KEY(round_id,recipient_id) REFERENCES public.wichtel_people(round_id,id) DEFERRABLE INITIALLY DEFERRED
);
ALTER TABLE public.wichtel_people ADD COLUMN IF NOT EXISTS revealed_at timestamptz;
ALTER TABLE public.wichtel_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wichtel_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wichtel_people ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wichtel_config,public.wichtel_rounds,public.wichtel_people FROM PUBLIC,anon,authenticated;

DO $$
DECLARE owner uuid;
BEGIN
 -- This fingerprint pins the existing configured Rebekka login without putting
 -- her email address in the repository. Mutable profile names grant no access.
 SELECT id INTO STRICT owner FROM auth.users WHERE md5(lower(email))='1bbb677cc548e26a3d4e8d702c6a5bc8';
 INSERT INTO public.wichtel_config(id,owner_id) VALUES(1,owner)
 ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id;
EXCEPTION WHEN no_data_found OR too_many_rows THEN
 RAISE EXCEPTION 'Rebekkas bestehendes Konto wurde nicht eindeutig gefunden. Die Einrichtung wurde abgebrochen.';
END $$;

CREATE OR REPLACE FUNCTION public.wichtel_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.wichtel_config WHERE id=1 AND owner_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.wichtel_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wichtel_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.wichtel_list() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.wichtel_is_admin() THEN RAISE EXCEPTION 'Keine Berechtigung';END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'created_at',r.created_at,'people',(SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'token',p.token,'revealed_at',p.revealed_at) ORDER BY p.position) FROM public.wichtel_people p WHERE p.round_id=r.id)) ORDER BY r.created_at DESC,r.id),'[]'::jsonb) FROM public.wichtel_rounds r WHERE r.owner_id=auth.uid());
END; $$;
REVOKE ALL ON FUNCTION public.wichtel_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wichtel_list() TO authenticated;

CREATE OR REPLACE FUNCTION public.wichtel_draw(request_id uuid,round_title text,participant_names text[]) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE names text[]; ids uuid[]; shuffled uuid[]; n integer; i integer; slot integer; existing public.wichtel_rounds%ROWTYPE; previous_names text[];
BEGIN
 IF NOT public.wichtel_is_admin() THEN RAISE EXCEPTION 'Keine Berechtigung';END IF;
 IF request_id IS NULL OR round_title IS NULL OR length(btrim(round_title)) NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Bitte einen Titel mit höchstens 120 Zeichen eingeben.';END IF;
 IF coalesce(cardinality(participant_names),0) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Bitte 2 bis 100 Personen eintragen.';END IF;
 SELECT array_agg(regexp_replace(name,'^[[:space:]  ]+|[[:space:]  ]+$','','g') ORDER BY ord) INTO names FROM unnest(participant_names) WITH ORDINALITY AS p(name,ord);
 IF EXISTS(SELECT 1 FROM unnest(names) name WHERE name IS NULL OR length(name) NOT BETWEEN 1 AND 80) THEN RAISE EXCEPTION 'Jeder Name muss 1 bis 80 Zeichen lang sein.';END IF;
 IF (SELECT count(DISTINCT lower(name)) FROM unnest(names) name)<>cardinality(names) THEN RAISE EXCEPTION 'Bitte jede Person eindeutig benennen, bei gleichen Vornamen mit einem Zusatz.';END IF;
 -- Retrying a failed connection cannot create a second draw or change links.
 PERFORM pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 SELECT * INTO existing FROM public.wichtel_rounds WHERE id=request_id;
 IF FOUND THEN
  SELECT array_agg(name ORDER BY position) INTO previous_names FROM public.wichtel_people WHERE round_id=request_id;
  IF existing.owner_id=auth.uid() AND existing.title=btrim(round_title) AND previous_names=names THEN RETURN existing.id;END IF;
  RAISE EXCEPTION 'Diese Auslosung existiert bereits. Bitte eine neue Runde anlegen.';
 END IF;
 n:=cardinality(names);
 SELECT array_agg(gen_random_uuid() ORDER BY ord) INTO ids FROM generate_series(1,n) ord;
 SELECT array_agg(person ORDER BY random()) INTO shuffled FROM unnest(ids) person;
 INSERT INTO public.wichtel_rounds(id,owner_id,title) VALUES(request_id,auth.uid(),btrim(round_title));
 -- A randomly shuffled ring gives each person exactly one other person.
 FOR i IN 1..n LOOP
  slot:=array_position(shuffled,ids[i]);
  INSERT INTO public.wichtel_people(id,round_id,position,name,recipient_id) VALUES(ids[i],request_id,i,names[i],shuffled[(slot%n)+1]);
 END LOOP;
 RETURN request_id;
END; $$;
REVOKE ALL ON FUNCTION public.wichtel_draw(uuid,text,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wichtel_draw(uuid,text,text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.wichtel_delete(round_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE removed integer;
BEGIN
 IF NOT public.wichtel_is_admin() THEN RAISE EXCEPTION 'Keine Berechtigung';END IF;
 DELETE FROM public.wichtel_rounds r WHERE r.id=round_id AND r.owner_id=auth.uid();
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed>0;
END; $$;
REVOKE ALL ON FUNCTION public.wichtel_delete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wichtel_delete(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.wichtel_reveal(secret_token text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE gift jsonb;
BEGIN
 SELECT jsonb_build_object('title',r.title,'giver',p.name,'recipient',recipient.name) INTO gift
 FROM public.wichtel_people p JOIN public.wichtel_people recipient ON recipient.round_id=p.round_id AND recipient.id=p.recipient_id JOIN public.wichtel_rounds r ON r.id=p.round_id
 WHERE secret_token ~ '^[a-f0-9]{64}$' AND p.token=secret_token;
 IF gift IS NULL THEN RETURN NULL; END IF;
 -- Only the time of the deliberate "Mein Los öffnen" action is stored, never the assignment in the admin view.
 UPDATE public.wichtel_people SET revealed_at=coalesce(revealed_at,clock_timestamp()) WHERE token=secret_token;
 RETURN gift;
END; $$;
REVOKE ALL ON FUNCTION public.wichtel_reveal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wichtel_reveal(text) TO anon,authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
