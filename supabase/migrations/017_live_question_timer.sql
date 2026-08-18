-- ============================================================================
-- 017_live_question_timer.sql — shared per-question countdown for Live Packs
--
-- The room stores the host-chosen timeout and the moment each question opens.
-- Every client derives the SAME deadline (question_started_at + timeout) from
-- the database, so the countdown is inherently synchronized — no client-side
-- clock sharing. The server also enforces the deadline: live_submit_answer
-- rejects answers submitted after time is up, so closing a question can never
-- be bypassed from the client.
-- ============================================================================

alter table public.live_pack_rooms
  add column if not exists question_timeout_seconds integer not null default 30
    check (question_timeout_seconds between 10 and 300),
  add column if not exists question_started_at timestamptz;

-- ---------------------------------------------------------------------------
-- live_create_room: accepts the host-chosen timeout (default 30s).
-- ---------------------------------------------------------------------------
drop function if exists public.live_create_room(uuid, integer);

create or replace function public.live_create_room(
  p_pack_id uuid,
  p_max_players integer default 10,
  p_question_timeout_seconds integer default 30
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

  if coalesce(p_max_players, 10) < 2 or coalesce(p_max_players, 10) > 50 then
    raise exception 'Player limit must be between 2 and 50.';
  end if;

  v_timeout := coalesce(p_question_timeout_seconds, 30);
  if v_timeout < 10 or v_timeout > 300 then
    raise exception 'Question time must be between 10 and 300 seconds.';
  end if;

  v_code := public.generate_live_room_code();
  loop
    begin
      insert into public.live_pack_rooms (host_auth_id, pack_id, room_code, max_players, pack_title, question_timeout_seconds)
      values (auth.uid(), p_pack_id, v_code, coalesce(p_max_players, 10), v_pack_title, v_timeout)
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

grant execute on function public.live_create_room(uuid, integer, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- live_set_timeout: host changes the per-question timer (lobby or mid-game —
-- changing it mid-question extends/shortens the current deadline immediately).
-- ---------------------------------------------------------------------------
create or replace function public.live_set_timeout(p_room_id uuid, p_seconds integer)
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
    raise exception 'Only the host may change the question timer.';
  end if;

  if coalesce(p_seconds, 30) < 10 or coalesce(p_seconds, 30) > 300 then
    raise exception 'Question time must be between 10 and 300 seconds.';
  end if;

  update public.live_pack_rooms
  set question_timeout_seconds = p_seconds
  where id = p_room_id;
end;
$$;

grant execute on function public.live_set_timeout(uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Question transitions open the clock for the new question.
-- ---------------------------------------------------------------------------
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
  set status = 'playing', started_at = now(), current_question_index = 0, question_started_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.live_start_game(uuid, jsonb) to authenticated;

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
  set current_question_index = v_current + 1, question_started_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.live_next_question(uuid) to authenticated;

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
  set current_question_index = v_current - 1, question_started_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.live_previous_question(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- live_submit_answer: the server enforces the deadline — once time is up,
-- no new (or replaced) answers are accepted for that question.
-- ---------------------------------------------------------------------------
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
    select 1 from public.live_pack_rooms r
    where r.id = p_room_id
      and r.status = 'playing'
      and r.current_question_index = p_question_index
      and (
        r.question_started_at is null
        or r.question_started_at + make_interval(secs => r.question_timeout_seconds) > now()
      )
  ) then
    raise exception 'Time is up for this question.';
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
