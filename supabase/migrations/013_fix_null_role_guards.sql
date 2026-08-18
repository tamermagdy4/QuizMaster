-- ============================================================================
-- 013_fix_null_role_guards.sql — Fix a NULL-semantics security bug.
--
-- Root cause (found by live two-account testing):
--   is_admin := (auth.jwt()->'app_metadata'->>'role') = 'admin';
-- For a regular user whose JWT has NO 'role' claim, `...->>'role'` is NULL,
-- so the comparison yields NULL (not FALSE). Guards written as
--   if <cond> and not is_admin then raise ...
-- then evaluate to `TRUE and NULL` = NULL, and `IF NULL` skips the raise.
-- Result: any authenticated user could call set_pack_quizzes on someone
-- else's Pack, and owners could write plays_count/featured directly.
--
-- Fix: coalesce the role before comparing, so the guard is a real boolean.
-- ============================================================================

-- ---- set_pack_quizzes internal implementation ------------------------------
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

  is_admin := coalesce((auth.jwt()->'app_metadata'->>'role'), '') = 'admin';
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

grant execute on function public.set_pack_quizzes(uuid, text[]) to authenticated;

-- ---- packs aggregate / featured guard trigger ------------------------------
create or replace function public.packs_guard_aggregates()
returns trigger
language plpgsql
security invoker
as $$
begin
  if (
    new.plays_count is distinct from old.plays_count or
    new.average_rating is distinct from old.average_rating or
    new.ratings_count is distinct from old.ratings_count or
    new.featured is distinct from old.featured
  ) and coalesce((auth.jwt()->'app_metadata'->>'role'), '') <> 'admin' then
    raise exception 'Only admins may change play counts, ratings or the featured flag.';
  end if;
  return new;
end;
$$;

drop trigger if exists packs_guard_aggregates on public.packs;
create trigger packs_guard_aggregates
before update on public.packs
for each row execute function public.packs_guard_aggregates();

-- ---- remove temporary diagnostics from 012 ----------------------------------
drop function if exists public.debug_spq_source();
drop function if exists public.debug_spq_uid();
drop function if exists public.debug_spq_uid_from_perform();
drop function if exists public.debug_spq_uid_inner(text);

notify pgrst, 'reload schema';
