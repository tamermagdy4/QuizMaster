-- ============================================================================
-- 011_pack_statistics_views.sql — Aggregates for the Admin Statistics page.
--
-- Two read-only views over the creator-made quiz system:
--   * pack_stats          — one row of global numbers
--   * pack_creator_stats  — per-creator activity (quizzes, questions, points)
--
-- RLS: plain views run with the *current user's* row-level security on the
-- base tables, so admins see everything and non-admins only what their
-- policies allow. PostgREST exposes views read-only (GET only).
-- ============================================================================

create or replace view public.pack_stats as
select
  (select count(*) from public.pack_custom_quizzes) as total_custom_quizzes,
  (select count(*) from public.pack_questions) as total_pack_questions,
  (select coalesce(round(avg(points)::numeric, 1), 0) from public.pack_questions) as avg_points,
  (select count(*) from public.pack_questions
   where image_url is not null or answer_image_url is not null) as questions_with_images,
  (select count(distinct creator_id) from public.pack_custom_quizzes) as total_creators;

grant select on public.pack_stats to anon, authenticated;

create or replace view public.pack_creator_stats as
select
  q.creator_id,
  (select p.creator_name from public.packs p where p.creator_id = q.creator_id limit 1) as creator_name,
  count(distinct q.id) as custom_quiz_count,
  count(pq.id) as pack_question_count,
  coalesce(round(avg(pq.points)::numeric, 1), 0) as avg_points
from public.pack_custom_quizzes q
left join public.pack_questions pq on pq.quiz_id = q.id
group by q.creator_id
order by custom_quiz_count desc, pack_question_count desc;

grant select on public.pack_creator_stats to anon, authenticated;

notify pgrst, 'reload schema';
