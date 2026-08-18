-- ============================================================================
-- 018_live_wagers.sql — Sporcle-Live style rounds for Live Packs
--
-- Extends the existing live system (015 + 017) with:
--   * Host round settings: question count, question time, min/max wager and
--     the deduction rule (wrong answers subtract the wager by default, and the
--     rule is stored so it can be turned off later without rebuilding).
--   * Per-player wagers: each player picks their own point value for a
--     question BEFORE sending the answer. The wager is locked once sent.
--   * Wager-based scoring: correct = +wager, wrong = -wager (when deduction is
--     on) or 0 (when off). The host remains the only judge — no auto grading.
-- ============================================================================

alter table public.live_pack_rooms
  add column if not exists question_count integer not null default 10
    check (question_count between 1 and 50),
  add column if not exists min_wager integer not null default 1
    check (min_wager between 1 and 1000),
  add column if not exists max_wager integer not null default 20
    check (max_wager between 1 and 1000),
  add column if not exists deduct_on_wrong boolean not null default true;

alter table public.live_pack_answers
  add column if not exists wager integer not null default 0;

-- ---------------------------------------------------------------------------
-- live_create_room: accepts the full host round setup.
-- ---------------------------------------------------------------------------
drop function if exists public.live_create_room(uuid, integer);
drop function if exists public.live_create_room(uuid, integer, integer);

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

  if coalesce(p_max_players, 10) < 2 or coalesce(p_max_players, 10) > 50 then
    raise exception 'Player limit must be between 2 and 50.';
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

  insert into public.live_pack_players (room_id, user_id, name, connected, last_seen_at)
  values (v_room_id, auth.uid(), v_name, true, now())
  returning id into v_player_id;

  update public.live_pack_rooms
  set host_player_id = v_player_id, host_name = v_name, host_avatar_url = v_avatar
  where id = v_room_id;

  return v_room_id;
end;
$$;

grant execute on function public.live_create_room(uuid, integer, integer, integer, integer, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- live_update_settings: host adjusts the round setup while still in the lobby.
-- All params optional (NULL = keep current). Changing the question count only
-- matters before the game starts (the resolved list is built at start).
-- ---------------------------------------------------------------------------
create or replace function public.live_update_settings(
  p_room_id uuid,
  p_question_count integer,
  p_question_timeout_seconds integer,
  p_min_wager integer,
  p_max_wager integer,
  p_deduct_on_wrong boolean
)
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
    raise exception 'Only the host may change the round settings.';
  end if;

  if (select status from public.live_pack_rooms where id = p_room_id) <> 'lobby' then
    raise exception 'Round settings can only be changed before the game starts.';
  end if;

  if p_question_count is not null and (p_question_count < 1 or p_question_count > 50) then
    raise exception 'Question count must be between 1 and 50.';
  end if;
  if p_question_timeout_seconds is not null and (p_question_timeout_seconds < 5 or p_question_timeout_seconds > 300) then
    raise exception 'Question time must be between 5 and 300 seconds.';
  end if;
  if p_min_wager is not null and (p_min_wager < 1 or p_min_wager > 1000) then
    raise exception 'Minimum wager must be between 1 and 1000.';
  end if;
  if p_max_wager is not null and (p_max_wager < 1 or p_max_wager > 1000) then
    raise exception 'Maximum wager must be between 1 and 1000.';
  end if;

  update public.live_pack_rooms
  set
    question_count = coalesce(p_question_count, question_count),
    question_timeout_seconds = coalesce(p_question_timeout_seconds, question_timeout_seconds),
    min_wager = coalesce(p_min_wager, min_wager),
    max_wager = coalesce(p_max_wager, max_wager),
    deduct_on_wrong = coalesce(p_deduct_on_wrong, deduct_on_wrong)
  where id = p_room_id
    and (
      coalesce(p_min_wager, min_wager) <= coalesce(p_max_wager, max_wager)
    );
end;
$$;

grant execute on function public.live_update_settings(uuid, integer, integer, integer, integer, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- live_submit_answer: now takes the player's wager. The wager is validated
-- against the room's min/max and LOCKED once the answer exists (re-submitting
-- or editing the answer text never changes the original wager).
-- ---------------------------------------------------------------------------
drop function if exists public.live_submit_answer(uuid, integer, text);

create or replace function public.live_submit_answer(
  p_room_id uuid,
  p_question_index integer,
  p_answer_text text,
  p_wager integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player_id uuid;
  v_min integer;
  v_max integer;
begin
  select id into v_player_id
  from public.live_pack_players
  where room_id = p_room_id and user_id = auth.uid();
  if v_player_id is null then
    raise exception 'You are not in this room.';
  end if;

  select min_wager, max_wager into v_min, v_max
  from public.live_pack_rooms
  where id = p_room_id;

  if p_wager is null or p_wager < v_min or p_wager > v_max then
    raise exception 'Wager must be between % and % points.', v_min, v_max;
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

  insert into public.live_pack_answers (room_id, player_id, question_index, answer_text, wager, status, points)
  values (p_room_id, v_player_id, p_question_index, left(coalesce(p_answer_text, ''), 500), p_wager, 'pending', 0)
  on conflict (room_id, player_id, question_index)
  do update set
    answer_text = excluded.answer_text,
    -- The wager is locked: keep the original value chosen before the first send.
    wager = live_pack_answers.wager,
    status = 'pending',
    points = 0,
    reviewed_by_host = false,
    reviewed_at = null;
end;
$$;

grant execute on function public.live_submit_answer(uuid, integer, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- live_review_answer: scoring uses the player's wager.
--   correct → +wager
--   wrong   → -wager when deduct_on_wrong, otherwise 0
-- Changing the verdict re-applies the delta automatically.
-- ---------------------------------------------------------------------------
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
  v_wager integer := 0;
  v_deduct boolean := true;
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

  select a.id, a.points, a.wager into v_answer_id, v_old_points, v_wager
  from public.live_pack_answers a
  where a.room_id = p_room_id
    and a.player_id = p_player_id
    and a.question_index = p_question_index;

  if v_answer_id is null then
    raise exception 'This player has not answered this question yet.';
  end if;

  select deduct_on_wrong into v_deduct
  from public.live_pack_rooms
  where id = p_room_id;

  if p_status = 'correct' then
    v_new_points := v_wager;
  elsif v_deduct then
    v_new_points := -v_wager;
  else
    v_new_points := 0;
  end if;

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
