-- ============================================================================
-- 015_live_pack_rooms.sql — Live Pack multiplayer (Sporcle-Live style)
--
-- A Live Pack game turns a published Pack into a shared realtime quiz:
--   * The host creates a room, shares a short code / invite link.
--   * Players join the lobby with their name (max 10 by default).
--   * The host starts the game: the SAME question is shown to everyone.
--   * Players type answers; the host manually reviews each one (correct/wrong)
--     and the score is applied/de-applied live. Answers are NEVER graded
--     automatically — the host is the only judge.
--   * The host advances questions for everyone at once, then finishes the
--     game and everyone sees the leaderboard.
--
-- The database is the single source of truth for room state. All writes go
-- through security-definer RPCs below (host/player authorization is checked
-- inside each function); the direct-table RLS policies only allow SELECTs.
-- Realtime (postgres_changes) pushes the shared state to every client.
--
-- Naming rule learned from the earlier 42702 issue: parameters are prefixed
-- with p_ and locals with v_ so they can never collide with column names in
-- the same statement (PostgreSQL raises 42702 for such ambiguity).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.live_pack_rooms (
  id uuid primary key default gen_random_uuid(),
  host_auth_id uuid not null references auth.users(id) on delete cascade,
  -- The host's player row (created together with the room). Null until then.
  host_player_id uuid,
  pack_id uuid not null references public.packs(id) on delete cascade,
  room_code text not null unique,
  -- Denormalized host/pack display info (auth.users is not readable by users).
  host_name text not null default '',
  host_avatar_url text,
  pack_title text not null default '',
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  current_question_index integer not null default -1,
  max_players integer not null default 10 check (max_players between 2 and 50),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.live_pack_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_pack_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default '',
  connected boolean not null default true,
  score integer not null default 0,
  correct_count integer not null default 0,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (room_id, user_id)
);

-- The resolved, ordered question list of the Pack at game start. The host
-- client resolves it (custom quizzes from pack_questions, existing category
-- quizzes through the same questionLoader the board uses) and sends it in one
-- atomic RPC. Every client reads the current question by index.
create table if not exists public.live_pack_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_pack_rooms(id) on delete cascade,
  question_index integer not null,
  quiz_id text not null default '',
  question text not null default '',
  answer text not null default '',
  points integer not null default 100,
  hint text,
  unique (room_id, question_index)
);

create table if not exists public.live_pack_answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.live_pack_rooms(id) on delete cascade,
  player_id uuid not null references public.live_pack_players(id) on delete cascade,
  question_index integer not null,
  answer_text text not null default '',
  status text not null default 'pending' check (status in ('pending', 'correct', 'wrong')),
  points integer not null default 0,
  reviewed_by_host boolean not null default false,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, player_id, question_index)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists live_players_room_idx on public.live_pack_players (room_id, last_seen_at);
create index if not exists live_answers_room_idx on public.live_pack_answers (room_id, question_index);
create index if not exists live_questions_room_idx on public.live_pack_questions (room_id, question_index);

-- ---------------------------------------------------------------------------
-- updated_at trigger (same pattern as packs)
-- ---------------------------------------------------------------------------
create or replace function public.set_live_rooms_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists live_pack_rooms_updated_at on public.live_pack_rooms;
create trigger live_pack_rooms_updated_at
before update on public.live_pack_rooms
for each row execute function public.set_live_rooms_updated_at();

-- ---------------------------------------------------------------------------
-- Room code generator (unambiguous alphabet, 6 chars)
-- ---------------------------------------------------------------------------
create or replace function public.generate_live_room_code()
returns text
language sql
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 32)::int + 1, 1),
    ''
  )
  from generate_series(1, 6);
$$;

-- ---------------------------------------------------------------------------
-- RPCs (all writes go through these — authorization is checked inside)
-- ---------------------------------------------------------------------------

-- Creates a room for a readable Pack and registers the caller as host.
create or replace function public.live_create_room(p_pack_id uuid, p_max_players integer default 10)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_code text;
  v_player_id uuid;
  v_name text;
  v_avatar text;
  v_pack_title text;
  v_tries integer := 0;
begin
  select title into v_pack_title
  from public.packs
  where id = p_pack_id;
  if v_pack_title is null then
    raise exception 'Pack not found.';
  end if;

  -- Only published public Packs (or the owner) can be hosted live.
  if not exists (
    select 1 from public.packs
    where id = p_pack_id
      and (visibility = 'public' and status = 'published' or creator_id = auth.uid())
  ) then
    raise exception 'This pack cannot be hosted live.';
  end if;

  if not exists (select 1 from public.pack_quizzes where pack_id = p_pack_id) then
    raise exception 'This pack has no quizzes yet.';
  end if;

  if coalesce(p_max_players, 10) < 2 or coalesce(p_max_players, 10) > 50 then
    raise exception 'Player limit must be between 2 and 50.';
  end if;

  v_code := public.generate_live_room_code();
  loop
    begin
      insert into public.live_pack_rooms (host_auth_id, pack_id, room_code, max_players, pack_title)
      values (auth.uid(), p_pack_id, v_code, coalesce(p_max_players, 10), v_pack_title)
      returning id into v_room_id;
      exit;
    exception when unique_violation then
      v_tries := v_tries + 1;
      if v_tries > 5 then raise exception 'Could not allocate a room code. Try again.'; end if;
      v_code := public.generate_live_room_code();
    end;
  end loop;

  v_name := coalesce(
    nullif(auth.jwt()->'user_metadata'->>'display_name', ''),
    nullif(auth.jwt()->'user_metadata'->>'full_name', ''),
    split_part(coalesce(auth.jwt()->'user_metadata'->>'email', ''), '@', 1),
    'المضيف'
  );
  v_avatar := auth.jwt()->'user_metadata'->>'avatar_url';

  insert into public.live_pack_players (room_id, user_id, name, connected, last_seen_at)
  values (v_room_id, auth.uid(), v_name, true, now())
  returning id into v_player_id;

  update public.live_pack_rooms
  set host_player_id = v_player_id, host_name = v_name, host_avatar_url = v_avatar
  where id = v_room_id;

  return v_room_id;
end;
$$;

grant execute on function public.live_create_room(uuid, integer) to authenticated;

-- Joins (or rejoins) a room by its short code. Rejoining an existing player
-- restores their connection and keeps score/answers — progress is never lost.
create or replace function public.live_join_room(p_room_code text, p_player_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_player_id uuid;
  v_name text;
  v_player_count integer;
  v_max integer;
  v_status text;
begin
  select id, status, max_players into v_room_id, v_status, v_max
  from public.live_pack_rooms
  where upper(room_code) = upper(coalesce(p_room_code, ''));
  if v_room_id is null then
    raise exception 'Room not found. Check the code.';
  end if;

  select id into v_player_id
  from public.live_pack_players
  where room_id = v_room_id and user_id = auth.uid();

  if v_player_id is not null then
    -- Reconnect: keep score/answers, refresh name + presence.
    update public.live_pack_players
    set name = coalesce(nullif(trim(coalesce(p_player_name, '')), ''), name),
        connected = true,
        last_seen_at = now()
    where id = v_player_id;
    return v_player_id;
  end if;

  if v_status <> 'lobby' then
    raise exception 'This game has already started.';
  end if;

  select count(*) into v_player_count
  from public.live_pack_players
  where room_id = v_room_id;

  if v_player_count >= v_max then
    raise exception 'Room is full.';
  end if;

  v_name := coalesce(
    nullif(trim(coalesce(p_player_name, '')), ''),
    split_part(coalesce(auth.jwt()->'user_metadata'->>'email', ''), '@', 1),
    'لاعب'
  );

  insert into public.live_pack_players (room_id, user_id, name, connected, last_seen_at)
  values (v_room_id, auth.uid(), v_name, true, now())
  returning id into v_player_id;

  return v_player_id;
end;
$$;

grant execute on function public.live_join_room(text, text) to authenticated;

-- Heartbeat: marks the caller's player row as connected (called every ~8s).
create or replace function public.live_mark_connected(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  select id into v_player_id
  from public.live_pack_players
  where room_id = p_room_id and user_id = auth.uid();
  if v_player_id is null then
    raise exception 'You are not in this room.';
  end if;
  update public.live_pack_players
  set connected = true, last_seen_at = now()
  where id = v_player_id;
end;
$$;

grant execute on function public.live_mark_connected(uuid) to authenticated;

-- Marks players whose heartbeat is stale (no heartbeat for 30s) as offline.
-- The host client runs this periodically; harmless for anyone to call.
create or replace function public.live_sweep_stale(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_pack_players
  set connected = false
  where room_id = p_room_id
    and last_seen_at < now() - interval '30 seconds';
end;
$$;

grant execute on function public.live_sweep_stale(uuid) to authenticated;

-- Starts the game: inserts the resolved question list and opens question 0.
-- The host client builds the ordered list (custom quizzes → pack_questions;
-- category quizzes → the same questionLoader the board uses).
create or replace function public.live_start_game(p_room_id uuid, p_questions jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_index integer := 0;
  v_elem jsonb;
  v_count integer;
begin
  if not exists (
    select 1 from public.live_pack_rooms
    where id = p_room_id and host_auth_id = auth.uid()
  ) then
    raise exception 'Only the host may start the game.';
  end if;

  if (select status from public.live_pack_rooms where id = p_room_id) <> 'lobby' then
    raise exception 'The game has already started.';
  end if;

  select count(*) into v_count from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb));
  if v_count = 0 then
    raise exception 'No questions to play.';
  end if;

  -- Idempotent: clear any previous resolution for this room.
  delete from public.live_pack_questions where room_id = p_room_id;

  for v_elem in select value from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    insert into public.live_pack_questions (
      room_id, question_index, quiz_id, question, answer, points, hint
    ) values (
      p_room_id,
      v_index,
      coalesce(v_elem->>'quiz_id', ''),
      coalesce(v_elem->>'question', ''),
      coalesce(v_elem->>'answer', ''),
      coalesce(nullif(v_elem->>'points', '')::integer, 100),
      nullif(v_elem->>'hint', '')
    );
    v_index := v_index + 1;
  end loop;

  update public.live_pack_rooms
  set status = 'playing', started_at = now(), current_question_index = 0
  where id = p_room_id;
end;
$$;

grant execute on function public.live_start_game(uuid, jsonb) to authenticated;

-- Player submits (or replaces) their answer for the CURRENT open question.
-- The answer stays 'pending' until the host reviews it — never auto-graded.
create or replace function public.live_submit_answer(p_room_id uuid, p_question_index integer, p_answer_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
begin
  select id into v_player_id
  from public.live_pack_players
  where room_id = p_room_id and user_id = auth.uid();
  if v_player_id is null then
    raise exception 'You are not in this room.';
  end if;

  if not exists (
    select 1 from public.live_pack_rooms
    where id = p_room_id
      and status = 'playing'
      and current_question_index = p_question_index
  ) then
    raise exception 'This question is not currently open for answers.';
  end if;

  insert into public.live_pack_answers (room_id, player_id, question_index, answer_text, status, points)
  values (p_room_id, v_player_id, p_question_index, left(coalesce(p_answer_text, ''), 500), 'pending', 0)
  on conflict (room_id, player_id, question_index)
  do update set
    answer_text = excluded.answer_text,
    status = 'pending',
    points = 0,
    reviewed_by_host = false,
    reviewed_at = null;
end;
$$;

grant execute on function public.live_submit_answer(uuid, integer, text) to authenticated;

-- Host grades one player's answer. Changing the verdict later re-applies the
-- score delta automatically (correct → +points, wrong → 0, and back again).
create or replace function public.live_review_answer(
  p_room_id uuid,
  p_player_id uuid,
  p_question_index integer,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer_id uuid;
  v_old_points integer := 0;
  v_new_points integer := 0;
  v_question_points integer := 0;
begin
  if not exists (
    select 1 from public.live_pack_rooms
    where id = p_room_id and host_auth_id = auth.uid()
  ) then
    raise exception 'Only the host may review answers.';
  end if;

  if p_status not in ('correct', 'wrong') then
    raise exception 'Invalid review status.';
  end if;

  select a.id, a.points into v_answer_id, v_old_points
  from public.live_pack_answers a
  where a.room_id = p_room_id
    and a.player_id = p_player_id
    and a.question_index = p_question_index;

  if v_answer_id is null then
    raise exception 'This player has not answered this question yet.';
  end if;

  select coalesce(q.points, 0) into v_question_points
  from public.live_pack_questions q
  where q.room_id = p_room_id and q.question_index = p_question_index;

  v_new_points := case when p_status = 'correct' then v_question_points else 0 end;

  update public.live_pack_answers
  set status = p_status, points = v_new_points, reviewed_by_host = true, reviewed_at = now()
  where id = v_answer_id;

  update public.live_pack_players pl
  set score = pl.score + (v_new_points - v_old_points),
      correct_count = (
        select count(*) from public.live_pack_answers a2
        where a2.player_id = pl.id and a2.status = 'correct'
      )
  where pl.id = p_player_id;
end;
$$;

grant execute on function public.live_review_answer(uuid, uuid, integer, text) to authenticated;

-- Host moves everyone to the next question (answers for the new question
-- start empty; players who did not answer move along with the group).
create or replace function public.live_next_question(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
  v_total integer;
begin
  if not exists (
    select 1 from public.live_pack_rooms
    where id = p_room_id and host_auth_id = auth.uid()
  ) then
    raise exception 'Only the host may advance the question.';
  end if;

  if (select status from public.live_pack_rooms where id = p_room_id) <> 'playing' then
    raise exception 'The game is not running.';
  end if;

  select current_question_index into v_current
  from public.live_pack_rooms where id = p_room_id;

  select count(*) into v_total
  from public.live_pack_questions where room_id = p_room_id;

  if v_total = 0 then
    raise exception 'No questions to play.';
  end if;

  if v_current + 1 >= v_total then
    raise exception 'This is the last question. Finish the game instead.';
  end if;

  update public.live_pack_rooms
  set current_question_index = v_current + 1
  where id = p_room_id;
end;
$$;

grant execute on function public.live_next_question(uuid) to authenticated;

-- Host goes back one question (optional, e.g. to re-grade something).
create or replace function public.live_previous_question(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current integer;
begin
  if not exists (
    select 1 from public.live_pack_rooms
    where id = p_room_id and host_auth_id = auth.uid()
  ) then
    raise exception 'Only the host may go back.';
  end if;

  select current_question_index into v_current
  from public.live_pack_rooms where id = p_room_id;

  if v_current <= 0 then
    raise exception 'Already on the first question.';
  end if;

  update public.live_pack_rooms
  set current_question_index = v_current - 1
  where id = p_room_id;
end;
$$;

grant execute on function public.live_previous_question(uuid) to authenticated;

-- Host ends the game; everyone sees the final leaderboard.
create or replace function public.live_finish_game(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.live_pack_rooms
    where id = p_room_id and host_auth_id = auth.uid()
  ) then
    raise exception 'Only the host may finish the game.';
  end if;

  update public.live_pack_rooms
  set status = 'finished', finished_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.live_finish_game(uuid) to authenticated;

-- Transfers hosting to another player in the room. Allowed when the current
-- host is disconnected, or while still in the lobby (before the game starts).
create or replace function public.live_transfer_host(p_room_id uuid, p_new_host_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_user uuid;
  v_new_name text;
begin
  if not exists (
    select 1 from public.live_pack_players
    where room_id = p_room_id and user_id = auth.uid()
  ) then
    raise exception 'You must be in the room to take over hosting.';
  end if;

  select user_id, name into v_new_user, v_new_name
  from public.live_pack_players
  where id = p_new_host_player_id and room_id = p_room_id;

  if v_new_user is null then
    raise exception 'This player is not in the room.';
  end if;

  if not exists (
    select 1
    from public.live_pack_rooms r
    join public.live_pack_players hp on hp.id = r.host_player_id
    where r.id = p_room_id
      and (r.status = 'lobby' or hp.connected = false)
  ) then
    raise exception 'The host is still connected.';
  end if;

  update public.live_pack_rooms
  set host_auth_id = v_new_user, host_player_id = p_new_host_player_id, host_name = v_new_name
  where id = p_room_id;
end;
$$;

grant execute on function public.live_transfer_host(uuid, uuid) to authenticated;

-- Host deletes the room (e.g. cancels in the lobby). Cascades to players,
-- questions and answers.
create or replace function public.live_delete_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.live_pack_rooms
    where id = p_room_id and host_auth_id = auth.uid()
  ) then
    raise exception 'Only the host may delete the room.';
  end if;
  delete from public.live_pack_rooms where id = p_room_id;
end;
$$;

grant execute on function public.live_delete_room(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security (reads only — all writes flow through the RPCs above)
-- ---------------------------------------------------------------------------
alter table public.live_pack_rooms enable row level security;
alter table public.live_pack_players enable row level security;
alter table public.live_pack_questions enable row level security;
alter table public.live_pack_answers enable row level security;

drop policy if exists "authenticated can read live rooms" on public.live_pack_rooms;
create policy "authenticated can read live rooms"
on public.live_pack_rooms for select
to authenticated
using (true);

drop policy if exists "authenticated can read live players" on public.live_pack_players;
create policy "authenticated can read live players"
on public.live_pack_players for select
to authenticated
using (true);

-- Players (and the host) can read the resolved question list. The player UI
-- never renders the answer field; grading is always manual by the host.
drop policy if exists "room members can read live questions" on public.live_pack_questions;
create policy "room members can read live questions"
on public.live_pack_questions for select
to authenticated
using (exists (
  select 1 from public.live_pack_rooms r
  where r.id = room_id
    and (r.host_auth_id = auth.uid()
         or exists (select 1 from public.live_pack_players p
                    where p.room_id = room_id and p.user_id = auth.uid()))
));

-- Answers: the host sees everything; a player only sees their own.
drop policy if exists "host or self can read live answers" on public.live_pack_answers;
create policy "host or self can read live answers"
on public.live_pack_answers for select
to authenticated
using (exists (
  select 1 from public.live_pack_rooms r
  where r.id = room_id and r.host_auth_id = auth.uid()
) or exists (
  select 1 from public.live_pack_players p
  where p.id = player_id and p.user_id = auth.uid()
));

-- ---------------------------------------------------------------------------
-- Realtime: push room / player / question / answer changes to all clients.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.live_pack_rooms;
    alter publication supabase_realtime add table public.live_pack_players;
    alter publication supabase_realtime add table public.live_pack_questions;
    alter publication supabase_realtime add table public.live_pack_answers;
  end if;
end;
$$;
