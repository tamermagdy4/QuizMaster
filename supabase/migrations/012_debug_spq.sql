-- ============================================================================
-- 012_debug_spq.sql — TEMPORARY diagnostics (removed in 013)
--  * dump the deployed source of set_pack_quizzes and its impl
--  * probe what auth.uid() / request.jwt.claims return inside a
--    security-definer function called through the wrapper chain
-- ============================================================================

create or replace function public.debug_spq_source()
returns text
language sql
security definer
set search_path = public
as $$
  select
    pg_get_functiondef('public.set_pack_quizzes(uuid, text[])'::regprocedure)
    || E'\n---IMPL---\n'
    || pg_get_functiondef('public._set_pack_quizzes_impl(uuid, text[])'::regprocedure)
$$;
grant execute on function public.debug_spq_source() to anon, authenticated;

create or replace function public.debug_spq_uid()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return 'uid=' || coalesce(auth.uid()::text, 'NULL')
    || ' | claims=' || coalesce(current_setting('request.jwt.claims', true), 'NULL');
end;
$$;
grant execute on function public.debug_spq_uid() to anon, authenticated;

create or replace function public.debug_spq_uid_from_perform()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result text;
begin
  perform public.debug_spq_uid_inner(result);
  return result;
end;
$$;
grant execute on function public.debug_spq_uid_from_perform() to anon, authenticated;

create or replace function public.debug_spq_uid_inner(out result text)
language plpgsql
security definer
set search_path = public
as $$
begin
  result := 'uid=' || coalesce(auth.uid()::text, 'NULL')
    || ' | claims=' || coalesce(current_setting('request.jwt.claims', true), 'NULL');
end;
$$;
grant execute on function public.debug_spq_uid_inner(out result text) to anon, authenticated;

notify pgrst, 'reload schema';
