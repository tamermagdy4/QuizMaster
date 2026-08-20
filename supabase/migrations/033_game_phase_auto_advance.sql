-- ============================================================================
-- 033_game_phase_auto_advance.sql — Game-loop-driven gameplay
--
-- Adds a `game_phase` column to track the round lifecycle within a question:
--   'lobby'        — waiting for players
--   'question_intro' — showing "Question N" briefly (3s)
--   'active'        — accepting answers (timer running)
--   'locked'        — timer expired, answers locked
--   'reveal'        — showing correct answer + who got it right
--   'scoring'       — showing score changes
--   'finished'      — game over
--
-- Adds RPC for host to advance the game phase.
-- ============================================================================

-- New phase column
alter table public.live_pack_rooms
  add column if not exists game_phase text not null default 'lobby'
    check (game_phase in ('lobby', 'question_intro', 'active', 'locked', 'reveal', 'scoring', 'finished'));

-- RPC: advance game phase (host only)
create or replace function public.live_advance_phase(p_room_id uuid, p_phase text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room record;
begin
  select * into v_room from public.live_pack_rooms where id = p_room_id;

  if v_room is null then
    raise exception 'Room not found.';
  end if;

  if v_room.host_auth_id != auth.uid() then
    raise exception 'Only the host can advance the game phase.';
  end if;

  update public.live_pack_rooms
  set game_phase = p_phase, updated_at = now()
  where id = p_room_id;
end;
$$;

-- RPC: auto-close question and grade all answers (host only, called when timer expires)
create or replace function public.live_close_and_grade(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room record;
  v_answer record;
  v_question record;
begin
  select * into v_room from public.live_pack_rooms where id = p_room_id;

  if v_room is null then
    raise exception 'Room not found.';
  end if;

  if v_room.host_auth_id != auth.uid() then
    raise exception 'Only the host can close and grade.';
  end if;

  -- Lock answers
  update public.live_pack_rooms
  set question_phase = 'closed', game_phase = 'locked', updated_at = now()
  where id = p_room_id;

  -- Get the current question to compare answers
  select * into v_question
  from public.live_pack_questions
  where room_id = p_room_id and question_index = v_room.current_question_index;

  if v_question is null then
    return;
  end if;

  -- Auto-grade each pending answer
  for v_answer in
    select * from public.live_pack_answers
    where room_id = p_room_id
      and question_index = v_room.current_question_index
      and status = 'pending'
  loop
    -- Simple exact match (case-insensitive, trimmed)
    if lower(trim(v_answer.answer_text)) = lower(trim(v_question.answer))
       or v_answer.answer_text = v_question.answer then
      update public.live_pack_answers
      set status = 'correct',
          points = v_answer.wager,
          reviewed_by_host = true,
          reviewed_at = now()
      where id = v_answer.id;

      update public.live_pack_players
      set score = score + v_answer.wager,
          correct_count = correct_count + 1
      where id = v_answer.player_id;
    else
      update public.live_pack_answers
      set status = 'wrong',
          points = 0,
          reviewed_by_host = true,
          reviewed_at = now()
      where id = v_answer.id;

      update public.live_pack_players
      set wrong_count = wrong_count + 1
      where id = v_answer.player_id;
    end if;
  end loop;
end;
$$;

-- RPC: host manually overrides a player's grade (correct/wrong) after auto-grade
create or replace function public.live_override_grade(
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
  v_room record;
  v_answer record;
  v_old_status text;
  v_old_points integer;
  v_new_points integer;
  v_wager integer;
begin
  select * into v_room from public.live_pack_rooms where id = p_room_id;
  if v_room is null then raise exception 'Room not found.'; end if;
  if v_room.host_auth_id != auth.uid() then raise exception 'Only the host can override.'; end if;
  if p_status not in ('correct', 'wrong') then raise exception 'Status must be correct or wrong.'; end if;

  select * into v_answer
  from public.live_pack_answers
  where room_id = p_room_id and player_id = p_player_id and question_index = p_question_index;

  if v_answer is null then
    raise exception 'Answer not found.';
  end if;

  v_old_status := v_answer.status;
  v_old_points := v_answer.points;
  v_wager := v_answer.wager;

  if p_status = 'correct' then
    v_new_points := v_wager;
  else
    v_new_points := 0;
  end if;

  -- Update answer
  update public.live_pack_answers
  set status = p_status, points = v_new_points, reviewed_by_host = true, reviewed_at = now()
  where id = v_answer.id;

  -- Adjust player score
  if v_old_status = 'correct' and p_status = 'wrong' then
    update public.live_pack_players
    set score = score - v_old_points, correct_count = correct_count - 1, wrong_count = wrong_count + 1
    where id = p_player_id;
  elsif v_old_status = 'wrong' and p_status = 'correct' then
    update public.live_pack_players
    set score = score + v_new_points, correct_count = correct_count + 1, wrong_count = wrong_count - 1
    where id = p_player_id;
  end if;
end;
$$;

-- RPC: host skips the current question (no scoring, just advance)
create or replace function public.live_skip_question(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room record;
  v_total integer;
begin
  select * into v_room from public.live_pack_rooms where id = p_room_id;
  if v_room is null then raise exception 'Room not found.'; end if;
  if v_room.host_auth_id != auth.uid() then raise exception 'Only the host can skip.'; end if;

  select count(*) into v_total from public.live_pack_questions where room_id = p_room_id;

  if v_room.current_question_index + 1 >= v_total then
    -- Last question — finish
    update public.live_pack_rooms
    set status = 'finished', game_phase = 'finished', finished_at = now(), updated_at = now()
    where id = p_room_id;
  else
    update public.live_pack_rooms
    set current_question_index = current_question_index + 1,
        question_phase = 'active',
        game_phase = 'active',
        question_started_at = now(),
        updated_at = now()
    where id = p_room_id;
  end if;
end;
$$;

-- RPC: host pauses the game
create or replace function public.live_pause_game(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room record;
begin
  select * into v_room from public.live_pack_rooms where id = p_room_id;
  if v_room is null then raise exception 'Room not found.'; end if;
  if v_room.host_auth_id != auth.uid() then raise exception 'Only the host can pause.'; end if;

  update public.live_pack_rooms
  set game_phase = 'locked', question_phase = 'closed', updated_at = now()
  where id = p_room_id;
end;
$$;

-- RPC: host resumes the game (from paused/locked state)
create or replace function public.live_resume_game(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room record;
begin
  select * into v_room from public.live_pack_rooms where id = p_room_id;
  if v_room is null then raise exception 'Room not found.'; end if;
  if v_room.host_auth_id != auth.uid() then raise exception 'Only the host can resume.'; end if;

  update public.live_pack_rooms
  set game_phase = 'active', question_phase = 'active',
      question_started_at = now(), updated_at = now()
  where id = p_room_id;
end;
$$;

-- RLS: everyone can read game_phase
-- (covered by existing live_pack_rooms SELECT policies)
