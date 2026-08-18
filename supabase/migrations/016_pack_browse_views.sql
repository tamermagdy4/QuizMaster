-- ============================================================================
-- 016_pack_browse_views.sql — browse support views for the Packs platform
--
-- pack_category_stats: real count of public published Packs per category, so
-- the browse page can show category cards with true numbers (no client-side
-- guessing). Read-only; respects RLS via security_invoker.
-- ============================================================================

create or replace view public.pack_category_stats
with (security_invoker = true) as
  select
    category,
    count(*) as pack_count
  from public.packs
  where status = 'published' and visibility = 'public'
  group by category;

grant select on public.pack_category_stats to anon, authenticated;
