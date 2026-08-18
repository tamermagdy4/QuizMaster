-- ============================================================================
-- 026_live_wager_by_question_count.sql — Sporcle wager rule
--
-- Rule (Sporcle-style): the MAXIMUM points a player may wager per question
-- equals the number of questions the host chose for the round.
--   5  questions → each player picks 1..5
--   10 questions → each player picks 1..10
--   20 questions → each player picks 1..20
-- The host never sets the value range: the question count is the ceiling and
-- every player chooses their own value per question (locked once sent).
--
-- Also: wrong answers score 0 by default (no deduction). The host can still
-- turn the deduction rule on from the lobby (deduct_on_wrong toggle).
--
-- Changes:
--   1) live_create_room: p_max_wager defaults to NULL → the ceiling is the
--      question count. An explicit p_max_wager still overrides (future-proof).
--   2) live_update_settings: changing the question count in the lobby moves
--      max_wager with it (unless the host passes an explicit max).
--   3) deduct_on_wrong column + create default → false (wrong = 0).
-- ============================================================================

alter table public.live_pack_rooms
  alter column deduct_on_wrong set default false,
  alter column max_wager set default 10;

-- ---------------------------------------------------------------------------
-- live_create_room: wager ceiling follows the question count.
-- ---------------------------------------------------------------------------
drop function if exists public.live_create_room(uuid, integer, integer, integer, integer, integer, boolean);

create or replace function public.live_create_room(
  p_pack_id uuid,
  p_max_players integer default 10,
  p_question_timeout_seconds integer default 30,
  p_question_count integer default 10,
  p_min_wager integer default 1,
  p_max_wager integer default null,
  p_deduct_on_wrong boolean default false
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

  -- Sporcle rule: the max a player can wager equals the question count,
  -- unless the host explicitly passes a different ceiling.
  v_min := coalesce(p_min_wager, 1);
  v_max := coalesce(p_max_wager, v_qcount);
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
        v_timeout, v_qcount, v_min, v_max, coalesce(p_deduct_on_wrong, false)
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
-- live_update_settings: the wager ceiling tracks the question count. When the
-- host changes the number of questions without passing an explicit max, the
-- ceiling moves with it (5→5, 10→10, 20→20). An explicit max still wins.
-- ---------------------------------------------------------------------------
drop function if exists public.live_update_settings(uuid, integer, integer, integer, integer, boolean, integer);

create or replace function public.live_update_settings(
  p_room_id uuid,
  p_question_count integer default null,
  p_question_timeout_seconds integer default null,
  p_min_wager integer default null,
  p_max_wager integer default null,
  p_deduct_on_wrong boolean default null,
  p_max_players integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min integer;
  v_max integer;
  v_qcount integer;
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
  if p_max_players is not null and (p_max_players < 2 or p_max_players > 100) then
    raise exception 'Player limit must be between 2 and 100.';
  end if;

  select coalesce(p_question_count, question_count),
         coalesce(p_min_wager, min_wager),
         coalesce(p_max_wager, max_wager)
  into v_qcount, v_min, v_max
  from public.live_pack_rooms
  where id = p_room_id;

  -- Sporcle rule: max points = question count (unless an explicit max was sent).
  if p_max_wager is null then
    v_max := v_qcount;
  end if;

  if p_min_wager is not null and p_max_wager is not null and p_min_wager > p_max_wager then
    raise exception 'Minimum wager (%) cannot exceed the maximum (%).', p_min_wager, p_max_wager;
  end if;

  if v_min > v_max then
    v_min := v_max;
  end if;

  update public.live_pack_rooms
  set
    question_count = v_qcount,
    question_timeout_seconds = coalesce(p_question_timeout_seconds, question_timeout_seconds),
    min_wager = v_min,
    max_wager = v_max,
    deduct_on_wrong = coalesce(p_deduct_on_wrong, deduct_on_wrong),
    max_players = coalesce(p_max_players, max_players)
  where id = p_room_id;
end;
$$;

grant execute on function public.live_update_settings(uuid, integer, integer, integer, integer, boolean, integer) to authenticated;
