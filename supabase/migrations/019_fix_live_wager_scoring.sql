-- ============================================================================
-- 019_fix_live_wager_scoring.sql — scoring + settings fixes for live wagers
--
-- 1) live_update_settings: all optional params now default to NULL so callers
--    can update a single field (e.g. only the deduction rule) without sending
--    every parameter.
-- 2) live_submit_answer: when a player replaces an existing answer, the
--    previously awarded points for that question are unwound from their score
--    first. Otherwise re-submitting after a review would double-count the
--    award (the answer resets to pending/0 while the score keeps the old
--    points, so the next review adds them again).
-- ============================================================================

drop function if exists public.live_update_settings(uuid, integer, integer, integer, integer, boolean);

create or replace function public.live_update_settings(
  p_room_id uuid,
  p_question_count integer default null,
  p_question_timeout_seconds integer default null,
  p_min_wager integer default null,
  p_max_wager integer default null,
  p_deduct_on_wrong boolean default null
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
    and coalesce(p_min_wager, min_wager) <= coalesce(p_max_wager, max_wager);
end;
$$;

grant execute on function public.live_update_settings(uuid, integer, integer, integer, integer, boolean) to authenticated;

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
      and (
        r.question_started_at is null
        or r.question_started_at + make_interval(secs => r.question_timeout_seconds) > now()
      )
  ) then
    raise exception 'Time is up for this question.';
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
