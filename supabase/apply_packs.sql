-- ============================================================
-- FAHLOY — Complete schema snapshot (migrations 001..010)
-- Generated for the Supabase Dashboard SQL Editor / DR.
-- Idempotent: safe to run more than once.
-- ============================================================

-- >>>>>>> supabase/migrations/001_questions.sql
create extension if not exists pgcrypto;

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category_id text not null,
  question text not null check (length(trim(question)) > 0),
  answer text not null check (length(trim(answer)) > 0),
  points integer not null check (points in (100, 300, 500)),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_category_id_idx on public.questions (category_id);
create index if not exists questions_points_idx on public.questions (points);

create or replace function public.set_questions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists questions_updated_at on public.questions;
create trigger questions_updated_at
before update on public.questions
for each row execute function public.set_questions_updated_at();

alter table public.questions enable row level security;

-- No public write policy is created. Add policies after Admin Auth is connected.
-- The expected admin claim is auth.jwt()->'app_metadata'->>'role' = 'admin'.
-- Policies are dropped first to keep this migration idempotent for databases
-- that were set up manually (dashboard) before migration tracking existed.
drop policy if exists "admins can read questions" on public.questions;
create policy "admins can read questions"
on public.questions for select
to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists "admins can insert questions" on public.questions;
create policy "admins can insert questions"
on public.questions for insert
to authenticated
with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists "admins can update questions" on public.questions;
create policy "admins can update questions"
on public.questions for update
to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists "admins can delete questions" on public.questions;
create policy "admins can delete questions"
on public.questions for delete
to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('question-images', 'question-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins can upload question images" on storage.objects;
create policy "admins can upload question images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'question-images' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists "admins can update question images" on storage.objects;
create policy "admins can update question images"
on storage.objects for update
to authenticated
using (bucket_id = 'question-images' and (auth.jwt()->'app_metadata'->>'role') = 'admin')
with check (bucket_id = 'question-images' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

drop policy if exists "admins can delete question images" on storage.objects;
create policy "admins can delete question images"
on storage.objects for delete
to authenticated
using (bucket_id = 'question-images' and (auth.jwt()->'app_metadata'->>'role') = 'admin');

-- >>>>>>> supabase/migrations/002_public_question_read.sql
-- The game reads question text and answers without an Admin session.
-- Keep all write policies restricted to Admin in 001_questions.sql.
drop policy if exists "public can read questions" on public.questions;
create policy "public can read questions"
on public.questions for select
to anon, authenticated
using (true);

-- >>>>>>> supabase/migrations/003_answer_image_url.sql
alter table public.questions
add column if not exists answer_image_url text;

notify pgrst, 'reload schema';

-- >>>>>>> supabase/migrations/004_packs.sql
-- ============================================================================
-- 004_packs.sql — Quiz Packs (Sporcle-style user-created quiz collections)
--
-- A Pack is a curated, ordered collection of existing quizzes. In Fahloy a
-- "quiz" is a category: each category owns a question pool (100/300/500).
-- pack_quizzes.quiz_id therefore stores a category id (text), so playing a
-- pack quiz reuses the exact same question system as the game board.
--
-- Security model (mirrors the existing questions tables):
--   * Anyone can read public published Packs (anon + authenticated).
--   * Only authenticated users can create Packs.
--   * Only the owner can edit/delete their Pack and its quizzes.
--   * Private Packs are visible only to their owner (no sharing system yet).
--   * play counts / rating aggregates are ONLY changed through
--     security-definer RPCs — users can never write them directly.
--   * Admins (app_metadata.role = 'admin') can manage every Pack.
-- ============================================================================

create table if not exists public.packs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '',
  cover_url text,
  category text not null default 'general',
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  featured boolean not null default false,
  plays_count integer not null default 0,
  average_rating numeric(3, 2) not null default 0,
  ratings_count integer not null default 0,
  tags text[] not null default '{}',
  -- Denormalized creator display info, captured from the session at insert
  -- time (auth.users is not readable through PostgREST by regular users).
  creator_name text not null default '',
  creator_avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pack_quizzes (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.packs(id) on delete cascade,
  quiz_id text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (pack_id, quiz_id)
);

create table if not exists public.pack_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.packs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);

create table if not exists public.pack_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  pack_id uuid not null references public.packs(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists packs_creator_idx on public.packs (creator_id);
create index if not exists packs_status_visibility_idx on public.packs (status, visibility);
create index if not exists packs_category_idx on public.packs (category);
create index if not exists packs_featured_idx on public.packs (featured) where featured = true;
create index if not exists pack_quizzes_pack_position_idx on public.pack_quizzes (pack_id, position);

-- ---------------------------------------------------------------------------
-- updated_at trigger (same pattern as questions)
-- ---------------------------------------------------------------------------
create or replace function public.set_packs_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists packs_updated_at on public.packs;
create trigger packs_updated_at
before update on public.packs
for each row execute function public.set_packs_updated_at();

-- ---------------------------------------------------------------------------
-- Aggregate / featured guard
--
-- plays_count, average_rating, ratings_count and featured may ONLY be
-- changed by admins (or by the security-definer RPCs below). A Pack owner
-- editing their own Pack through the normal UPDATE path can never touch
-- those columns — this enforces "users cannot manipulate play/rating counts".
-- ---------------------------------------------------------------------------
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
  ) and (auth.jwt()->'app_metadata'->>'role') <> 'admin' then
    raise exception 'Only admins may change play counts, ratings or the featured flag.';
  end if;
  return new;
end;
$$;

drop trigger if exists packs_guard_aggregates on public.packs;
create trigger packs_guard_aggregates
before update on public.packs
for each row execute function public.packs_guard_aggregates();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.packs enable row level security;
alter table public.pack_quizzes enable row level security;
alter table public.pack_favorites enable row level security;
alter table public.pack_ratings enable row level security;

-- ---- packs: SELECT ---------------------------------------------------------
-- Public published Packs are visible to everyone; owners always see their own
-- (draft / private / hidden included); admins see everything.
create policy "anyone can read public published packs"
on public.packs for select
to anon, authenticated
using (visibility = 'public' and status = 'published');

create policy "owners can read their own packs"
on public.packs for select
to authenticated
using (creator_id = auth.uid());

create policy "admins can read all packs"
on public.packs for select
to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- ---- packs: INSERT ---------------------------------------------------------
create policy "authenticated users can create packs"
on public.packs for insert
to authenticated
with check (creator_id = auth.uid());

-- ---- packs: UPDATE ---------------------------------------------------------
-- Owners can edit their own Pack (title, cover, category, difficulty,
-- visibility, status, description, tags). Featured flag stays admin-only.
create policy "owners can update their own packs"
on public.packs for update
to authenticated
using (creator_id = auth.uid())
with check (creator_id = auth.uid());

create policy "admins can update any pack"
on public.packs for update
to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- ---- packs: DELETE ---------------------------------------------------------
create policy "owners can delete their own packs"
on public.packs for delete
to authenticated
using (creator_id = auth.uid());

create policy "admins can delete any pack"
on public.packs for delete
to authenticated
using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- ---- pack_quizzes: SELECT --------------------------------------------------
-- Quizzes of a readable Pack are readable. Reuses the same visibility rule.
create policy "anyone can read quizzes of public published packs"
on public.pack_quizzes for select
to anon, authenticated
using (exists (
  select 1 from public.packs p
  where p.id = pack_id and p.visibility = 'public' and p.status = 'published'
));

create policy "owners can read quizzes of their own packs"
on public.pack_quizzes for select
to authenticated
using (exists (select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid()));

create policy "admins can read all pack quizzes"
on public.pack_quizzes for select
to authenticated
using (exists (
  select 1 from public.packs p
  where p.id = pack_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
));

-- ---- pack_quizzes: WRITE (owner only) ---------------------------------------
create policy "owners can add quizzes to their packs"
on public.pack_quizzes for insert
to authenticated
with check (exists (select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid()));

create policy "owners can update quizzes in their packs"
on public.pack_quizzes for update
to authenticated
using (exists (select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid()))
with check (exists (select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid()));

create policy "owners can remove quizzes from their packs"
on public.pack_quizzes for delete
to authenticated
using (exists (select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid()));

-- ---- pack_favorites ---------------------------------------------------------
create policy "users can read their own favorites"
on public.pack_favorites for select
to authenticated
using (user_id = auth.uid());

create policy "users can add favorites"
on public.pack_favorites for insert
to authenticated
with check (user_id = auth.uid());

create policy "users can remove their own favorites"
on public.pack_favorites for delete
to authenticated
using (user_id = auth.uid());

-- ---- pack_ratings: SELECT ---------------------------------------------------
create policy "users can read their own ratings"
on public.pack_ratings for select
to authenticated
using (user_id = auth.uid());

-- ---- pack_ratings: WRITE ----------------------------------------------------
-- Ratings are written ONLY through the security-definer RPC `rate_pack`
-- below (which also recomputes the Pack aggregates). The primary key
-- (user_id, pack_id) guarantees one rating per user per Pack.

-- ---------------------------------------------------------------------------
-- Security-definer RPCs
-- ---------------------------------------------------------------------------

-- Increments a Pack's play count. Called when a user starts playing a Pack
-- or a quiz inside it. Callers cannot pass a count — only +1 per call.
create or replace function public.increment_pack_plays(pack_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.packs
  set plays_count = plays_count + 1
  where id = pack_id;
end;
$$;

grant execute on function public.increment_pack_plays(uuid) to anon, authenticated;

-- Upserts a user's rating for a Pack and recomputes the Pack aggregates.
-- One rating per (user_id, pack_id) is enforced by the primary key.
create or replace function public.rate_pack(pack_id uuid, rating integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.pack_ratings (user_id, pack_id, rating)
  values (auth.uid(), pack_id, rating)
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
  where p.id = pack_id;
end;
$$;

grant execute on function public.rate_pack(uuid, integer) to authenticated;

-- Atomically replaces a Pack's ordered quiz list (delete + re-insert with
-- positions). The caller must own the Pack; admins may edit any Pack.
create or replace function public.set_pack_quizzes(pack_id uuid, quiz_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_creator uuid;
  is_admin boolean;
  position int := 0;
  qid text;
begin
  select creator_id into target_creator from public.packs where id = pack_id;
  if target_creator is null then
    raise exception 'Pack not found.';
  end if;

  is_admin := (auth.jwt()->'app_metadata'->>'role') = 'admin';
  if auth.uid() <> target_creator and not is_admin then
    raise exception 'Only the pack owner may edit its quizzes.';
  end if;

  delete from public.pack_quizzes where pack_id = pack_id;

  for qid in select unnest(quiz_ids) loop
    position := position + 1;
    insert into public.pack_quizzes (pack_id, quiz_id, position)
    values (pack_id, qid, position);
  end loop;
end;
$$;

grant execute on function public.set_pack_quizzes(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage bucket for Pack cover images
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pack-covers', 'pack-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Any authenticated user may upload a cover image; the folder encodes the
-- user id so a user can only ever delete their own uploads.
create policy "authenticated users can upload pack covers"
on storage.objects for insert
to authenticated
with check (bucket_id = 'pack-covers' and auth.role() = 'authenticated');

create policy "users can delete their own pack covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'pack-covers'
  and (storage.foldername(name))[1] = (auth.uid())::text
);

-- Keep the existing admin question-image policies untouched.

-- >>>>>>> supabase/migrations/005_pack_custom_quizzes.sql
-- ============================================================================
-- 005_pack_custom_quizzes.sql — Creator-made quizzes + questions inside Packs
--
-- Extends the Packs system so a Pack creator can build their OWN quizzes and
-- questions (Sporcle-style authoring), in addition to linking existing
-- category quizzes via pack_quizzes.
--
-- Identity model:
--   * pack_quizzes.quiz_id stays a text key. For existing quizzes it is a
--     category id (as before). For creator-made quizzes it is "custom:<uuid>",
--     where <uuid> references pack_custom_quizzes.id. This keeps the existing
--     set_pack_quizzes RPC and ordered-list model fully intact.
--
-- Security model (mirrors packs / pack_quizzes):
--   * Anyone can read custom quizzes + questions of public published Packs.
--   * Owners (and admins) can read their own draft/private content.
--   * Only the Pack owner (or an admin) can create/edit/delete custom quizzes
--     and their questions. RLS enforces ownership on every row.
-- ============================================================================

create table if not exists public.pack_custom_quizzes (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.packs(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 160),
  description text not null default '',
  category text not null default 'general',
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pack_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.pack_custom_quizzes(id) on delete cascade,
  creator_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (length(trim(question)) between 1 and 2000),
  answer text not null check (length(trim(answer)) between 1 and 1000),
  points integer not null default 100 check (points between 0 and 5000),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  hint text,
  image_url text,
  answer_image_url text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists pack_custom_quizzes_pack_idx on public.pack_custom_quizzes (pack_id);
create index if not exists pack_custom_quizzes_creator_idx on public.pack_custom_quizzes (creator_id);
create index if not exists pack_questions_quiz_position_idx on public.pack_questions (quiz_id, position);
create index if not exists pack_questions_creator_idx on public.pack_questions (creator_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function public.set_pack_custom_quizzes_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pack_custom_quizzes_updated_at on public.pack_custom_quizzes;
create trigger pack_custom_quizzes_updated_at
before update on public.pack_custom_quizzes
for each row execute function public.set_pack_custom_quizzes_updated_at();

create or replace function public.set_pack_questions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pack_questions_updated_at on public.pack_questions;
create trigger pack_questions_updated_at
before update on public.pack_questions
for each row execute function public.set_pack_questions_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.pack_custom_quizzes enable row level security;
alter table public.pack_questions enable row level security;

-- Visibility helper: a Pack row is publicly readable when published + public.
-- Reused by every SELECT policy below (mirrors pack_quizzes policies).

-- ---- pack_custom_quizzes: SELECT ------------------------------------------
create policy "anyone can read custom quizzes of public published packs"
on public.pack_custom_quizzes for select
to anon, authenticated
using (exists (
  select 1 from public.packs p
  where p.id = pack_id and p.visibility = 'public' and p.status = 'published'
));

create policy "owners can read custom quizzes of their own packs"
on public.pack_custom_quizzes for select
to authenticated
using (exists (
  select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid()
));

create policy "admins can read all custom quizzes"
on public.pack_custom_quizzes for select
to authenticated
using (exists (
  select 1 from public.packs p
  where p.id = pack_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
));

-- ---- pack_custom_quizzes: WRITE (owner of the Pack, or admin) --------------
create policy "owners can create custom quizzes in their packs"
on public.pack_custom_quizzes for insert
to authenticated
with check (
  exists (select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid())
  and creator_id = auth.uid()
);

create policy "owners can update custom quizzes in their packs"
on public.pack_custom_quizzes for update
to authenticated
using (exists (
  select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid()
))
with check (exists (
  select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid()
));

create policy "admins can update any custom quiz"
on public.pack_custom_quizzes for update
to authenticated
using (exists (
  select 1 from public.packs p where p.id = pack_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
))
with check (exists (
  select 1 from public.packs p where p.id = pack_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
));

create policy "owners can delete custom quizzes from their packs"
on public.pack_custom_quizzes for delete
to authenticated
using (exists (
  select 1 from public.packs p where p.id = pack_id and p.creator_id = auth.uid()
));

create policy "admins can delete any custom quiz"
on public.pack_custom_quizzes for delete
to authenticated
using (exists (
  select 1 from public.packs p where p.id = pack_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
));

-- ---- pack_questions: SELECT ------------------------------------------------
create policy "anyone can read questions of public published packs"
on public.pack_questions for select
to anon, authenticated
using (exists (
  select 1
  from public.pack_custom_quizzes q
  join public.packs p on p.id = q.pack_id
  where q.id = quiz_id and p.visibility = 'public' and p.status = 'published'
));

create policy "owners can read questions of their own packs"
on public.pack_questions for select
to authenticated
using (exists (
  select 1
  from public.pack_custom_quizzes q
  join public.packs p on p.id = q.pack_id
  where q.id = quiz_id and p.creator_id = auth.uid()
));

create policy "admins can read all pack questions"
on public.pack_questions for select
to authenticated
using (exists (
  select 1
  from public.pack_custom_quizzes q
  join public.packs p on p.id = q.pack_id
  where q.id = quiz_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
));

-- ---- pack_questions: WRITE (owner of the Pack, or admin) --------------------
create policy "owners can add questions to their quizzes"
on public.pack_questions for insert
to authenticated
with check (
  creator_id = auth.uid()
  and exists (
    select 1
    from public.pack_custom_quizzes q
    join public.packs p on p.id = q.pack_id
    where q.id = quiz_id and p.creator_id = auth.uid()
  )
);

create policy "owners can update questions in their quizzes"
on public.pack_questions for update
to authenticated
using (exists (
  select 1
  from public.pack_custom_quizzes q
  join public.packs p on p.id = q.pack_id
  where q.id = quiz_id and p.creator_id = auth.uid()
))
with check (exists (
  select 1
  from public.pack_custom_quizzes q
  join public.packs p on p.id = q.pack_id
  where q.id = quiz_id and p.creator_id = auth.uid()
));

create policy "admins can update any pack question"
on public.pack_questions for update
to authenticated
using (exists (
  select 1
  from public.pack_custom_quizzes q
  join public.packs p on p.id = q.pack_id
  where q.id = quiz_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
))
with check (exists (
  select 1
  from public.pack_custom_quizzes q
  join public.packs p on p.id = q.pack_id
  where q.id = quiz_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
));

create policy "owners can delete questions from their quizzes"
on public.pack_questions for delete
to authenticated
using (exists (
  select 1
  from public.pack_custom_quizzes q
  join public.packs p on p.id = q.pack_id
  where q.id = quiz_id and p.creator_id = auth.uid()
));

create policy "admins can delete any pack question"
on public.pack_questions for delete
to authenticated
using (exists (
  select 1
  from public.pack_custom_quizzes q
  join public.packs p on p.id = q.pack_id
  where q.id = quiz_id and (auth.jwt()->'app_metadata'->>'role') = 'admin'
));

-- ---------------------------------------------------------------------------
-- Storage bucket for custom quiz cover images
-- (reuse the same public bucket pattern as Pack covers)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-covers', 'quiz-covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']::text[])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "authenticated users can upload quiz covers"
on storage.objects for insert
to authenticated
with check (bucket_id = 'quiz-covers' and auth.role() = 'authenticated');

create policy "users can delete their own quiz covers"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'quiz-covers'
  and (storage.foldername(name))[1] = (auth.uid())::text
);

-- >>>>>>> supabase/migrations/006_fix_set_pack_quizzes.sql
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

-- >>>>>>> supabase/migrations/007_fix_set_pack_quizzes_v2.sql
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

-- >>>>>>> supabase/migrations/008_debug_test_rpcs.sql
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

-- >>>>>>> supabase/migrations/009_set_pack_quizzes_wrapper.sql
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

-- >>>>>>> supabase/migrations/010_fix_rate_pack.sql
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

