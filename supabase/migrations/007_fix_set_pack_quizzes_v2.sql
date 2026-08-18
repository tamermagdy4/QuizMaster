-- ============================================================================
-- 007_fix_set_pack_quizzes_v2.sql — Final fix for SQLSTATE 42702 in
-- public.set_pack_quizzes.
--
-- Uses positional parameters ($1 / $2) inside the body so the names
-- `pack_id` / `quiz_ids` can never collide with table columns, while the
-- declared parameter names (mapped by PostgREST from the RPC body keys)
-- stay exactly `pack_id` and `quiz_ids`.
--
-- Also ships a temporary debug function (dropped by 008) that returns the
-- deployed source of set_pack_quizzes, so the running definition can be
-- verified through PostgREST.
-- ============================================================================

create or replace function public.set_pack_quizzes(pack_id uuid, quiz_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_creator uuid;
  is_admin boolean;
  pos int := 0;
  qid text;
begin
  select creator_id into target_creator from public.packs where id = $1;
  if target_creator is null then
    raise exception 'Pack not found.';
  end if;

  is_admin := (auth.jwt()->'app_metadata'->>'role') = 'admin';
  if auth.uid() <> target_creator and not is_admin then
    raise exception 'Only the pack owner may edit its quizzes.';
  end if;

  delete from public.pack_quizzes where pack_id = $1;

  for qid in select unnest($2) loop
    pos := pos + 1;
    insert into public.pack_quizzes (pack_id, quiz_id, position)
    values ($1, qid, pos);
  end loop;
end;
$$;

grant execute on function public.set_pack_quizzes(uuid, text[]) to authenticated;

-- TEMPORARY diagnostic (removed by migration 008)
create or replace function public.debug_get_set_pack_quizzes()
returns text
language sql
security definer
set search_path = public
as $$
  select pg_get_functiondef('public.set_pack_quizzes(uuid, text[])'::regprocedure)
$$;

grant execute on function public.debug_get_set_pack_quizzes() to anon, authenticated;

notify pgrst, 'reload schema';
