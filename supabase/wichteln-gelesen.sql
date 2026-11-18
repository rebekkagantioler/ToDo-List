-- Ergänzung für eine bereits eingerichtete Engila-Bengila-Auslosung.
-- Speichert nur, wann ein persönlicher Link erstmals geöffnet wurde;
-- die Zuordnung selbst bleibt in der Verwaltungsansicht verborgen.
BEGIN;
ALTER TABLE public.wichtel_people ADD COLUMN IF NOT EXISTS revealed_at timestamptz;

CREATE OR REPLACE FUNCTION public.wichtel_list() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT public.wichtel_is_admin() THEN RAISE EXCEPTION 'Keine Berechtigung';END IF;
 RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'title',r.title,'created_at',r.created_at,'people',(SELECT jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'token',p.token,'revealed_at',p.revealed_at) ORDER BY p.position) FROM public.wichtel_people p WHERE p.round_id=r.id)) ORDER BY r.created_at DESC,r.id),'[]'::jsonb) FROM public.wichtel_rounds r WHERE r.owner_id=auth.uid());
END; $$;

CREATE OR REPLACE FUNCTION public.wichtel_reveal(secret_token text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE gift jsonb;
BEGIN
 SELECT jsonb_build_object('title',r.title,'giver',p.name,'recipient',recipient.name) INTO gift
 FROM public.wichtel_people p JOIN public.wichtel_people recipient ON recipient.round_id=p.round_id AND recipient.id=p.recipient_id JOIN public.wichtel_rounds r ON r.id=p.round_id
 WHERE secret_token ~ '^[a-f0-9]{64}$' AND p.token=secret_token;
 IF gift IS NULL THEN RETURN NULL; END IF;
 UPDATE public.wichtel_people SET revealed_at=coalesce(revealed_at,clock_timestamp()) WHERE token=secret_token;
 RETURN gift;
END; $$;
REVOKE ALL ON FUNCTION public.wichtel_list() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wichtel_list() TO authenticated;
REVOKE ALL ON FUNCTION public.wichtel_reveal(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wichtel_reveal(text) TO anon,authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
