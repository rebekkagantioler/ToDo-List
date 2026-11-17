-- Entfernt den gesamten Wichtelbereich samt Auslosungen und allen Links.
-- Die übrigen Planraum-Daten bleiben erhalten.
BEGIN;
DROP FUNCTION IF EXISTS public.wichtel_reveal(text);
DROP FUNCTION IF EXISTS public.wichtel_delete(uuid);
DROP FUNCTION IF EXISTS public.wichtel_draw(uuid,text,text[]);
DROP FUNCTION IF EXISTS public.wichtel_list();
DROP FUNCTION IF EXISTS public.wichtel_is_admin();
DROP TABLE IF EXISTS public.wichtel_people;
DROP TABLE IF EXISTS public.wichtel_rounds;
DROP TABLE IF EXISTS public.wichtel_config;
NOTIFY pgrst, 'reload schema';
COMMIT;
