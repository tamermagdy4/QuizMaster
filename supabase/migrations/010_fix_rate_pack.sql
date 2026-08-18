-- ============================================================================
-- 010_fix_rate_pack.sql — Fix SQLSTATE 42702 in public.rate_pack.
--
-- Same root cause as set_pack_quizzes: the parameters `pack_id`/`rating`
-- collide with the pack_ratings columns of the same names inside the
-- INSERT ... ON CONFLICT statement. Fixed with the same wrapper pattern —
-- public signature preserved for PostgREST, real logic in an internal
-- function with collision-free parameter names.
-- ============================================================================

create or replace function public._rate_pack_impl(p_pack_id uuid, p_rating integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pack_ratings (user_id, pack_id, rating)
  values (auth.uid(), p_pack_id, p_rating)
  on conflict (user_id, pack_id)
  do update set rating = excluded.rating, created_at = now();

  update public.packs p
  set
    ratings_count = (
      select count(*) from public.pack_ratings r where r.pack_id = p.id
    ),
    average_rating = coalesce((
      select round(avg(r.rating)::numeric, 2) from public.pack_ratings r where r.pack_id = p.id
    ), 0)
  where p.id = p_pack_id;
end;
$$;

create or replace function public.rate_pack(pack_id uuid, rating integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._rate_pack_impl($1, $2);
end;
$$;

grant execute on function public.rate_pack(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
