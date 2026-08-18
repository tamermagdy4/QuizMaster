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
