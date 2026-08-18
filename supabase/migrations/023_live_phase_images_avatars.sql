-- ============================================================================
-- 023_live_phase_images_avatars.sql — Sporcle-Party-style flow completion
--
-- 1) question_phase: an EXPLICIT shared per-question state on the room
--    (active → closed). The server still enforces the deadline inside
--    live_submit_answer (question_started_at + timeout); the phase is the
--    room-level "ANSWERING_CLOSED" signal every client shares via Realtime,
--    set by live_close_question (any member, idempotent) and reopened on
--    start / next / previous.
-- 2) live_pack_questions.image_url: question images (pack_questions.image_url)
--    now travel into the live game and render in the player + host screens.
-- 3) live_pack_players.avatar_url: each player's avatar (from user_metadata)
--    is stored on join, so the lobby and player lists can show real avatars
--    instead of plain names.
-- 4) max_players raised 50 → 100: the host decides the party size; the default
--    stays 10 but nothing is artificially capped at a small number.
-- ============================================================================

alter table public.live_pack_rooms
  add column if not exists question_phase text not null default 'active'
    check (question_phase in ('active', 'closed'));

alter table public.live_pack_questions
  add column if not exists image_url text;

alter table public.live_pack_players
  add column if not exists avatar_url text;

-- Raise the player cap: 2..100 (the lobby shows "N / max").
alter table public.live_pack_rooms
  drop constraint if exists live_pack_rooms_max_players_check;
alter table public.live_pack_rooms
  add constraint live_pack_rooms_max_players_check
  check (max_players between 2 and 100);

-- ---------------------------------------------------------------------------
-- live_create_room: same signature/settings, cap 100, host avatar stored on
-- the host's player row too (not just on the room).
-- ---------------------------------------------------------------------------
drop function if exists public.live_create_room(uuid, integer, integer);
drop function if exists public.live_create_room(uuid, integer, integer, integer, integer, integer, boolean);

create or replace function public.live_create_room(
  p_pack_id uuid,
  p_max_players integer default 10,
  p_question_timeout_seconds integer default 30,
  p_question_count integer default 10,
  p_min_wager integer default 1,
  p_max_wager integer default 20,
  p_deduct_on_wrong boolean default true
)
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
  v_timeout integer;
  v_qcount integer;
  v_min integer;
  v_max integer;
  v_tries integer := 0;
begin
  select title into v_pack_title
  from public.packs
  where id = p_pack_id;
  if v_pack_title is null then
    raise exception 'Pack not found.';
  end if;

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

  if coalesce(p_max_players, 10) < 2 or coalesce(p_max_players, 10) > 100 then
    raise exception 'Player limit must be between 2 and 100.';
  end if;

  v_timeout := coalesce(p_question_timeout_seconds, 30);
  if v_timeout < 5 or v_timeout > 300 then
    raise exception 'Question time must be between 5 and 300 seconds.';
  end if;

  v_qcount := coalesce(p_question_count, 10);
  if v_qcount < 1 or v_qcount > 50 then
    raise exception 'Question count must be between 1 and 50.';
  end if;

  v_min := coalesce(p_min_wager, 1);
  v_max := coalesce(p_max_wager, 20);
  if v_min < 1 or v_max > 1000 or v_min > v_max then
    raise exception 'Wager range must satisfy 1 <= min <= max <= 1000.';
  end if;

  v_code := public.generate_live_room_code();
  loop
    begin
      insert into public.live_pack_rooms (
        host_auth_id, pack_id, room_code, max_players, pack_title,
        question_timeout_seconds, question_count, min_wager, max_wager, deduct_on_wrong
      ) values (
        auth.uid(), p_pack_id, v_code, coalesce(p_max_players, 10), v_pack_title,
        v_timeout, v_qcount, v_min, v_max, coalesce(p_deduct_on_wrong, true)
      )
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

  insert into public.live_pack_players (room_id, user_id, name, avatar_url, connected, last_seen_at)
  values (v_room_id, auth.uid(), v_name, nullif(v_avatar, ''), true, now())
  returning id into v_player_id;

  update public.live_pack_rooms
  set host_player_id = v_player_id, host_name = v_name, host_avatar_url = nullif(v_avatar, '')
  where id = v_room_id;

  return v_room_id;
end;
$$;

grant execute on function public.live_create_room(uuid, integer, integer, integer, integer, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- live_join_room: also stores the joining player's avatar.
-- ---------------------------------------------------------------------------
drop function if exists public.live_join_room(text, text);

create or replace function public.live_join_room(p_room_code text, p_player_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_status text;
  v_max integer;
  v_player_id uuid;
  v_name text;
  v_avatar text;
begin
  select id, status, max_players into v_room_id, v_status, v_max
  from public.live_pack_rooms
  where room_code = upper(trim(p_room_code));

  if v_room_id is null then
    raise exception 'Room not found. Check the code.';
  end if;

  if v_status = 'finished' then
    raise exception 'This game has already finished.';
  end if;

  if not exists (
    select 1 from public.live_pack_players
    where room_id = v_room_id and user_id = auth.uid()
  ) then
    if (select count(*) from public.live_pack_players where room_id = v_room_id) >= v_max then
      raise exception 'This room is full (%).', v_max;
    end if;
  end if;

  v_name := coalesce(
    nullif(trim(coalesce(p_player_name, '')), ''),
    split_part(coalesce(auth.jwt()->'user_metadata'->>'email', ''), '@', 1),
    'لاعب'
  );
  v_avatar := auth.jwt()->'user_metadata'->>'avatar_url';

  insert into public.live_pack_players (room_id, user_id, name, avatar_url, connected, last_seen_at)
  values (v_room_id, auth.uid(), v_name, nullif(v_avatar, ''), true, now())
  on conflict (room_id, user_id)
  do update set
    name = excluded.name,
    avatar_url = excluded.avatar_url,
    connected = true,
    last_seen_at = now()
  returning id into v_player_id;

  return v_player_id;
end;
$$;

grant execute on function public.live_join_room(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- live_start_game: accepts image_url per question, opens question 0 as active.
-- ---------------------------------------------------------------------------
drop function if exists public.live_start_game(uuid, jsonb);

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

  delete from public.live_pack_questions where room_id = p_room_id;

  for v_elem in select value from jsonb_array_elements(coalesce(p_questions, '[]'::jsonb)) loop
    insert into public.live_pack_questions (
      room_id, question_index, quiz_id, question, answer, points, hint, image_url
    ) values (
      p_room_id,
      v_index,
      coalesce(v_elem->>'quiz_id', ''),
      coalesce(v_elem->>'question', ''),
      coalesce(v_elem->>'answer', ''),
      coalesce(nullif(v_elem->>'points', '')::integer, 100),
      nullif(v_elem->>'hint', ''),
      nullif(v_elem->>'image_url', '')
    );
    v_index := v_index + 1;
  end loop;

  update public.live_pack_rooms
  set status = 'playing', started_at = now(), current_question_index = 0,
      question_started_at = now(), question_phase = 'active'
  where id = p_room_id;
end;
$$;

grant execute on function public.live_start_game(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- live_next_question / live_previous_question: reopen the phase as active.
-- ---------------------------------------------------------------------------
drop function if exists public.live_next_question(uuid);

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
  set current_question_index = v_current + 1,
      question_started_at = now(),
      question_phase = 'active'
  where id = p_room_id;
end;
$$;

grant execute on function public.live_next_question(uuid) to authenticated;

drop function if exists public.live_previous_question(uuid);

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
  set current_question_index = v_current - 1,
      question_started_at = now(),
      question_phase = 'active'
  where id = p_room_id;
end;
$$;

grant execute on function public.live_previous_question(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- live_close_question: flips the shared phase to 'closed' (ANSWERING_CLOSED).
-- Any room member can call it (the client whose countdown hits zero does), and
-- the host can close early to stop receiving answers. Idempotent.
-- ---------------------------------------------------------------------------
create or replace function public.live_close_question(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.live_pack_players
    where room_id = p_room_id and user_id = auth.uid()
  ) then
    raise exception 'You must be in the room to close the question.';
  end if;

  update public.live_pack_rooms
  set question_phase = 'closed'
  where id = p_room_id
    and status = 'playing'
    and question_phase <> 'closed';
end;
$$;

grant execute on function public.live_close_question(uuid) to authenticated;
