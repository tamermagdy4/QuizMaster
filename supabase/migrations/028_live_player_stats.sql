-- ============================================================================
-- 028_live_player_stats.sql — per-player end-of-round statistics.
--
-- The final results screen shows each player's correct/wrong counts, average
-- wager and best winning wager. The live_pack_answers table is RLS-restricted
-- (a player only sees their own answers), so the aggregates must live on the
-- shared live_pack_players row (readable by all room members) to be identical
-- for every client. They are recomputed whenever an answer is submitted or
-- reviewed (verdict flips included), so the data always matches the answers.
-- ============================================================================

alter table public.live_pack_players
  add column if not exists wrong_count integer not null default 0,
  add column if not exists avg_wager integer not null default 0,
  add column if not exists best_win_wager integer not null default 0;

-- Recompute the aggregate stats of one player straight from their answers.
create or replace function public.live_refresh_player_stats(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.live_pack_players pl
  set correct_count = (
        select count(*) from public.live_pack_answers a
        where a.player_id = pl.id and a.status = 'correct'
      ),
      wrong_count = (
        select count(*) from public.live_pack_answers a
        where a.player_id = pl.id and a.status = 'wrong'
      ),
      avg_wager = coalesce((
        select round(avg(a.wager)) from public.live_pack_answers a
        where a.player_id = pl.id and a.wager > 0
      ), 0),
      best_win_wager = coalesce((
        select max(a.wager) from public.live_pack_answers a
        where a.player_id = pl.id and a.status = 'correct'
      ), 0)
  where pl.id = p_player_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- live_review_answer — refresh stats after every verdict (or verdict flip).
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
  set score = pl.score + (v_new_points - v_old_points)
  where pl.id = p_player_id;

  perform public.live_refresh_player_stats(p_player_id);
end;
$$;

grant execute on function public.live_review_answer(uuid, uuid, integer, text) to authenticated;
grant execute on function public.live_refresh_player_stats(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- live_submit_answer — keep avg/best wager fresh as soon as an answer lands
-- (correct/wrong counts only change at review time).
-- ---------------------------------------------------------------------------
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

  perform public.live_refresh_player_stats(v_player_id);
end;
$$;

grant execute on function public.live_submit_answer(uuid, integer, text, integer) to authenticated;

-- Backfill the stats for any existing players from their answers.
update public.live_pack_players pl
set correct_count = coalesce((
      select count(*) from public.live_pack_answers a
      where a.player_id = pl.id and a.status = 'correct'
    ), 0),
    wrong_count = coalesce((
      select count(*) from public.live_pack_answers a
      where a.player_id = pl.id and a.status = 'wrong'
    ), 0),
    avg_wager = coalesce((
      select round(avg(a.wager)) from public.live_pack_answers a
      where a.player_id = pl.id and a.wager > 0
    ), 0),
    best_win_wager = coalesce((
      select max(a.wager) from public.live_pack_answers a
      where a.player_id = pl.id and a.status = 'correct'
    ), 0);
