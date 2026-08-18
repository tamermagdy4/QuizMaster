-- ============================================================================
-- 014_fix_aggregates_guard.sql — Allow the trusted definer RPCs
-- (increment_pack_plays / rate_pack) to update play/rating aggregates while
-- still blocking DIRECT user writes to those columns.
--
-- 013 made the guard raise for every non-admin writer — which also blocked
-- the security-definer RPCs (they run as the function owner 'postgres').
-- The guard now exempts writes performed as the trusted definer role
-- (pg_has_role(current_user, 'postgres', 'USAGE')) — i.e. updates coming
-- from server-side definer functions — and otherwise requires the admin
-- JWT role claim, exactly as intended.
-- ============================================================================

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
  )
  and not pg_has_role(current_user, 'postgres', 'USAGE')
  and coalesce((auth.jwt()->'app_metadata'->>'role'), '') <> 'admin' then
    raise exception 'Only admins may change play counts, ratings or the featured flag.';
  end if;
  return new;
end;
$$;

drop trigger if exists packs_guard_aggregates on public.packs;
create trigger packs_guard_aggregates
before update on public.packs
for each row execute function public.packs_guard_aggregates();

notify pgrst, 'reload schema';
