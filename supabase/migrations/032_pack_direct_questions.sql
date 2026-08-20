-- ============================================================================
-- 032_pack_direct_questions.sql — Decouple pack_questions from quiz dependency
--
-- Adds pack_id directly to pack_questions so Pack → Questions relationship
-- no longer requires pack_custom_quizzes as intermediary.
--
-- This migration:
--   1. Adds pack_id column to pack_questions
--   2. Populates pack_id from existing data (through pack_custom_quizzes)
--   3. Makes quiz_id nullable (kept for backward compatibility)
--   4. Adds RLS policies for direct pack_id-based access
--   5. Adds index on pack_questions(pack_id, position)
--
-- All existing data is preserved. Old quiz_id-based queries still work.
-- ============================================================================

-- Step 1: Add pack_id column
alter table public.pack_questions
  add column if not exists pack_id uuid;

-- Step 2: Populate pack_id from existing data
-- Each question's pack_id comes from pack_custom_quizzes.pack_id
update public.pack_questions pq
set pack_id = q.pack_id
from public.pack_custom_quizzes q
where pq.quiz_id = q.id
  and pq.pack_id is null;

-- Step 3: Make quiz_id nullable (was NOT NULL before)
alter table public.pack_questions
  alter column quiz_id drop not null;

-- Step 4: Add NOT NULL constraint on pack_id after migration
-- (only if all rows have been migrated)
do $$
begin
  if not exists (
    select 1 from public.pack_questions where pack_id is null limit 1
  ) then
    alter table public.pack_questions
      alter column pack_id set not null;
  else
    raise notice 'Some pack_questions rows have NULL pack_id — keeping pack_id nullable for safety.';
  end if;
end $$;

-- Step 5: Add foreign key constraint on pack_id
alter table public.pack_questions
  add constraint pack_questions_pack_id_fkey
  foreign key (pack_id) references public.packs(id) on delete cascade;

-- Step 6: Add index for direct pack queries
create index if not exists pack_questions_pack_position_idx
  on public.pack_questions (pack_id, position);

-- Step 7: Add RLS policies for pack_id-based access (parallel to existing quiz_id policies)

-- ---- pack_questions: SELECT by pack_id ------------------------------------
-- Anyone can read questions of public published packs (via pack_id)
drop policy if exists "anyone can read questions of published packs by pack_id" on public.pack_questions;
create policy "anyone can read questions of published packs by pack_id"
on public.pack_questions for select
to anon, authenticated
using (
  exists (
    select 1 from public.packs p
    where p.id = pack_id and p.visibility = 'public' and p.status = 'published'
  )
);

-- Owners can read questions of their own packs (via pack_id)
drop policy if exists "owners can read questions of their own packs by pack_id" on public.pack_questions;
create policy "owners can read questions of their own packs by pack_id"
on public.pack_questions for select
to authenticated
using (
  exists (
    select 1 from public.packs p
    where p.id = pack_id and p.creator_id = auth.uid()
  )
);

-- Admins can read all questions (via pack_id)
drop policy if exists "admins can read all pack questions by pack_id" on public.pack_questions;
create policy "admins can read all pack questions by pack_id"
on public.pack_questions for select
to authenticated
using (
  exists (
    select 1 from public.packs p
    where p.id = pack_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  )
);

-- ---- pack_questions: INSERT by pack_id ------------------------------------
-- Owners can add questions to their packs (via pack_id)
drop policy if exists "owners can add questions to their packs by pack_id" on public.pack_questions;
create policy "owners can add questions to their packs by pack_id"
on public.pack_questions for insert
to authenticated
with check (
  creator_id = auth.uid()
  and exists (
    select 1 from public.packs p
    where p.id = pack_id and p.creator_id = auth.uid()
  )
);

-- ---- pack_questions: UPDATE by pack_id ------------------------------------
-- Owners can update questions in their packs (via pack_id)
drop policy if exists "owners can update questions in their packs by pack_id" on public.pack_questions;
create policy "owners can update questions in their packs by pack_id"
on public.pack_questions for update
to authenticated
using (
  exists (
    select 1 from public.packs p
    where p.id = pack_id and p.creator_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.packs p
    where p.id = pack_id and p.creator_id = auth.uid()
  )
);

-- Admins can update any pack question (via pack_id)
drop policy if exists "admins can update any pack question by pack_id" on public.pack_questions;
create policy "admins can update any pack question by pack_id"
on public.pack_questions for update
to authenticated
using (
  exists (
    select 1 from public.packs p
    where p.id = pack_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  )
)
with check (
  exists (
    select 1 from public.packs p
    where p.id = pack_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  )
);

-- ---- pack_questions: DELETE by pack_id ------------------------------------
-- Owners can delete questions from their packs (via pack_id)
drop policy if exists "owners can delete questions from their packs by pack_id" on public.pack_questions;
create policy "owners can delete questions from their packs by pack_id"
on public.pack_questions for delete
to authenticated
using (
  exists (
    select 1 from public.packs p
    where p.id = pack_id and p.creator_id = auth.uid()
  )
);

-- Admins can delete any pack question (via pack_id)
drop policy if exists "admins can delete any pack question by pack_id" on public.pack_questions;
create policy "admins can delete any pack question by pack_id"
on public.pack_questions for delete
to authenticated
using (
  exists (
    select 1 from public.packs p
    where p.id = pack_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
  )
);

-- Step 8: Update pack_stats view to count by pack_id
create or replace view public.pack_stats as
select
  (select count(*) from public.pack_custom_quizzes) as total_custom_quizzes,
  (select count(*) from public.pack_questions where pack_id is not null) as total_pack_questions,
  (select coalesce(round(avg(points)::numeric, 1), 0) from public.pack_questions where pack_id is not null) as avg_points,
  (select count(*) from public.pack_questions
   where pack_id is not null
     and (image_url is not null or answer_image_url is not null)) as questions_with_images,
  (select count(distinct creator_id) from public.pack_custom_quizzes) as total_creators;

grant select on public.pack_stats to anon, authenticated;

-- Step 9: Create a view for pack question counts (by pack_id)
create or replace view public.pack_question_counts as
select
  pack_id,
  count(*) as question_count
from public.pack_questions
where pack_id is not null
group by pack_id;

grant select on public.pack_question_counts to anon, authenticated;

-- Notify PostgREST to reload schema
notify pgrst, 'reload schema';
