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
