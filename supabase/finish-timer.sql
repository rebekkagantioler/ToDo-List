begin;
-- Speichert den Zeiteintrag und beendet den Timer in derselben Transaktion.
CREATE OR REPLACE FUNCTION public.finish_timer(expected_value text, session_data jsonb)
RETURNS public.work_sessions
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
 uid uuid := auth.uid();
 timer_id bigint := (session_data->>'id')::bigint;
 saved public.work_sessions;
BEGIN
 UPDATE public.settings
 SET value = 'null'
 WHERE user_id = uid AND key = 'active-timer-v1' AND value = expected_value
   AND (expected_value::jsonb->>'id')::bigint = timer_id;

 IF NOT FOUND THEN
  SELECT * INTO saved FROM public.work_sessions WHERE user_id = uid AND id = timer_id;
  IF FOUND THEN RETURN saved; END IF;
  RAISE EXCEPTION 'Der Timer wurde auf einem anderen Gerät geändert.';
 END IF;

 INSERT INTO public.work_sessions (user_id, id, task_id, course_id, started_at, ended_at)
 VALUES (uid, timer_id, (session_data->>'task_id')::bigint, (session_data->>'course_id')::bigint,
         session_data->>'started_at', session_data->>'ended_at')
 ON CONFLICT (user_id, id) DO NOTHING
 RETURNING * INTO saved;

 IF NOT FOUND THEN
  SELECT * INTO STRICT saved FROM public.work_sessions WHERE user_id = uid AND id = timer_id;
 END IF;
 RETURN saved;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.finish_timer(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finish_timer(text, jsonb) TO authenticated;
commit;
