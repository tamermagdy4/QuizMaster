-- ============================================================================
-- 025_live_submit_phase_guard.sql — phase-authoritative answer cutoff.
--
-- live_close_question flips the shared question_phase to 'closed'
-- (ANSWERING_CLOSED). Previously live_submit_answer only enforced the
-- deadline (question_started_at + timeout), so a member closing the question
-- early did not actually stop new submissions until the timer ran out.
-- This makes the closed phase authoritative: once a member closes the
-- question, no further answers are accepted until the host reopens it
-- (start / next / previous), which also matches the Sporcle-Party flow
-- ("timer ends → host reviews → host clicks next").
-- ============================================================================

drop function if exists public.live_submit_answer(uuid, integer, text, integer);

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
      and r.question_phase <> 'closed'
      and (
        r.question_started_at is null
        or r.question_started_at + make_interval(secs => r.question_timeout_seconds) > now()
      )
  ) then
    raise exception 'Answering is closed for this question.';
  end if;

  -- Re-submitting replaces the answer: unwind any previously awarded points
  -- for this question first, so the score is never double-counted.
  update public.live_pack_players pl
  set score = pl.score - coalesce((
    select a.points from public.live_pack_answers a
    where a.room_id = p_room_id and a.player_id = pl.id and a.question_index = p_question_index
  ), 0)
  where pl.id = v_player_id;

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
