-- ============================================================================
-- 008_debug_test_rpcs.sql — TEMPORARY diagnostics (removed in 009)
-- Isolates whether the 42702 ambiguity comes from PostgREST's named-argument
-- RPC call or from the function body, by testing parameter-name collisions.
-- ============================================================================

-- A) distinct param names, referenced directly (control group)
create or replace function public.debug_rpc_a(a uuid, b text[])
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return a::text || '|' || array_to_string(b, ',');
end;
$$;
grant execute on function public.debug_rpc_a(uuid, text[]) to anon, authenticated;

-- B) the SAME param names as set_pack_quizzes, referenced directly
create or replace function public.debug_rpc_b(pack_id uuid, quiz_ids text[])
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return pack_id::text || '|' || array_to_string(quiz_ids, ',');
end;
$$;
grant execute on function public.debug_rpc_b(uuid, text[]) to anon, authenticated;

-- C) the SAME param names, referenced only positionally ($1/$2)
create or replace function public.debug_rpc_c(pack_id uuid, quiz_ids text[])
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return $1::text || '|' || array_to_string($2, ',');
end;
$$;
grant execute on function public.debug_rpc_c(uuid, text[]) to anon, authenticated;

-- D) same names AND a real delete against pack_quizzes (mirrors set_pack_quizzes)
create or replace function public.debug_rpc_d(pack_id uuid, quiz_ids text[])
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  pos int := 0;
  qid text;
begin
  delete from public.pack_quizzes where pack_id = $1;
  for qid in select unnest($2) loop
    pos := pos + 1;
    insert into public.pack_quizzes (pack_id, quiz_id, position) values ($1, qid, pos);
  end loop;
  return 'deleted-and-inserted';
end;
$$;
grant execute on function public.debug_rpc_d(uuid, text[]) to anon, authenticated;

notify pgrst, 'reload schema';
