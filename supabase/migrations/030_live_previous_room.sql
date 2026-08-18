-- ============================================================================
-- 030_live_previous_room.sql — point a replay round at its predecessor.
--
-- When the host presses "العب مرة أخرى" (play again), the NEW lobby room
-- stores a reference to the finished round (previous_room_id). The lobby can
-- then show the previous round's final ranking (from live_round_history,
-- migration 029) so players see who won before the next round starts.
--
--   1) live_pack_rooms.previous_room_id — nullable, host set at creation
--   2) live_create_room             — new optional p_previous_room_id param
-- ============================================================================

alter table public.live_pack_rooms
  add column if not exists previous_room_id uuid;

comment on column public.live_pack_rooms.previous_room_id is
  'For replay rounds: the finished room this lobby continues after (drives the "previous round" summary in the lobby).';

-- Re-declare live_create_room with the extra optional parameter (same body as
-- migration 026, plus the previous_room_id column in the insert).
drop function if exists public.live_create_room(uuid, integer, integer, integer, integer, integer, boolean);

create or replace function public.live_create_room(
  p_pack_id uuid,
  p_max_players integer default 10,
  p_question_timeout_seconds integer default 30,
  p_question_count integer default 10,
  p_min_wager integer default 1,
  p_max_wager integer default null,
  p_deduct_on_wrong boolean default false,
  p_previous_room_id uuid default null
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
        question_timeout_seconds, question_count, min_wager, max_wager, deduct_on_wrong,
        previous_room_id
      ) values (
        auth.uid(), p_pack_id, v_code, coalesce(p_max_players, 10), v_pack_title,
        v_timeout, v_qcount, v_min, v_max, coalesce(p_deduct_on_wrong, false),
        p_previous_room_id
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

grant execute on function public.live_create_room(uuid, integer, integer, integer, integer, integer, boolean, uuid) to authenticated;
