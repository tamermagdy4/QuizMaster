-- ============================================================================
-- 009_set_pack_quizzes_wrapper.sql — Final, definitive fix for SQLSTATE
-- 42702 in public.set_pack_quizzes.
--
-- Root cause (confirmed empirically): PL/pgSQL raises "column reference is
-- ambiguous" (42702) when a statement's WHERE clause uses a name that is
-- BOTH a function parameter and a table column — regardless of whether the
-- value is passed positionally. `set_pack_quizzes(pack_id, quiz_ids)` runs
-- `delete from pack_quizzes where pack_id = $1`, and because the function
-- has a parameter named `pack_id` (required so PostgREST can map the RPC
-- body keys), that DELETE is ambiguous and always fails at runtime.
--
-- Fix: keep the public function signature (parameter names must stay
-- `pack_id`/`quiz_ids` for PostgREST), but make its body a pure wrapper
-- that delegates to an internal function whose parameters have names that
-- collide with no column. The internal body is then unambiguous.
-- ============================================================================

create or replace function public._set_pack_quizzes_impl(p_pack_id uuid, p_quiz_ids text[])
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
  select creator_id into target_creator from public.packs where id = p_pack_id;
  if target_creator is null then
    raise exception 'Pack not found.';
  end if;

  is_admin := (auth.jwt()->'app_metadata'->>'role') = 'admin';
  if auth.uid() <> target_creator and not is_admin then
    raise exception 'Only the pack owner may edit its quizzes.';
  end if;

  delete from public.pack_quizzes where pack_id = p_pack_id;

  for qid in select unnest(p_quiz_ids) loop
    pos := pos + 1;
    insert into public.pack_quizzes (pack_id, quiz_id, position)
    values (p_pack_id, qid, pos);
  end loop;
end;
$$;

-- Public wrapper: same signature PostgREST already calls. The body only
-- performs a function call, so the parameter names collide with nothing.
create or replace function public.set_pack_quizzes(pack_id uuid, quiz_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._set_pack_quizzes_impl($1, $2);
end;
$$;

grant execute on function public.set_pack_quizzes(uuid, text[]) to authenticated;

-- Clean up temporary diagnostics from 007 / 008.
drop function if exists public.debug_get_set_pack_quizzes();
drop function if exists public.debug_rpc_a(uuid, text[]);
drop function if exists public.debug_rpc_b(uuid, text[]);
drop function if exists public.debug_rpc_c(uuid, text[]);
drop function if exists public.debug_rpc_d(uuid, text[]);

notify pgrst, 'reload schema';
