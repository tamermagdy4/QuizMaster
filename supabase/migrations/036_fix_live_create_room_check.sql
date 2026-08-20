-- ============================================================================
-- 036_fix_live_create_room_check.sql
--
-- The live_create_room RPC was checking pack_quizzes (old intermediary table)
-- instead of pack_questions (direct questions). This caused:
-- "This pack has no quizzes yet." error even when the pack had questions.
--
-- Fix: Change the check to use pack_questions with pack_id.
-- ============================================================================

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

  -- FIXED: Check pack_questions (direct) instead of pack_quizzes (old intermediary)
  if not exists (
    select 1 from public.pack_questions
    where pack_id = p_pack_id
    limit 1
  ) then
    raise exception 'This pack has no questions yet.';
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

  -- Get host info
  select coalesce(
    nullif(auth.jwt()->'user_metadata'->>'display_name', ''),
    nullif(auth.jwt()->'user_metadata'->>'full_name', ''),
    split_part(coalesce(auth.jwt()->'user_metadata'->>'email', ''), '@', 1),
    'Host'
  ) into v_name;
  v_avatar := auth.jwt()->'user_metadata'->>'avatar_url';

  -- Create host player row
  insert into public.live_pack_players (room_id, user_id, name, avatar_url, connected, last_seen_at)
  values (v_room_id, auth.uid(), v_name, v_avatar, true, now())
  returning id into v_player_id;

  -- Set host player on room
  update public.live_pack_rooms
  set host_player_id = v_player_id, host_name = v_name, host_avatar_url = v_avatar
  where id = v_room_id;

  return v_room_id;
end;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
