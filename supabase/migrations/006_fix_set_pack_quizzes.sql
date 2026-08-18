-- ============================================================================
-- 006_fix_set_pack_quizzes.sql — Fix ambiguous column reference in
-- public.set_pack_quizzes (SQLSTATE 42702)
--
-- The original function (004) used `pack_id` unqualified inside
-- `delete from public.pack_quizzes where pack_id = pack_id`, which is
-- ambiguous between the PL/pgSQL parameter and the table column and fails
-- at runtime. The parameter name must stay `pack_id` because PostgREST
-- maps RPC body keys to parameter names. We qualify the parameter with the
-- function name (`set_pack_quizzes.pack_id`) and rename the position loop
-- variable to `pos` (avoids the `position` column of pack_quizzes).
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
  v_pack_id uuid := pack_id;    -- unambiguous copies of the parameters
  v_quiz_ids text[] := quiz_ids;
begin
  select creator_id into target_creator from public.packs where id = v_pack_id;
  if target_creator is null then
    raise exception 'Pack not found.';
  end if;

  is_admin := (auth.jwt()->'app_metadata'->>'role') = 'admin';
  if auth.uid() <> target_creator and not is_admin then
    raise exception 'Only the pack owner may edit its quizzes.';
  end if;

  delete from public.pack_quizzes where pack_id = v_pack_id;

  for qid in select unnest(v_quiz_ids) loop
    pos := pos + 1;
    insert into public.pack_quizzes (pack_id, quiz_id, position)
    values (v_pack_id, qid, pos);
  end loop;
end;
$$;

grant execute on function public.set_pack_quizzes(uuid, text[]) to authenticated;

notify pgrst, 'reload schema';
