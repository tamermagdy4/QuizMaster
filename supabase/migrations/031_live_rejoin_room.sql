-- ============================================================================
-- 031_live_rejoin_room.sql — one-click group rejoin for replay rounds.
--
-- "العب مرة أخرى" creates a new lobby (with previous_room_id, migration 030).
-- This RPC lets a player rejoin the new room with ONE click from the shared
-- invite link (?code=NEWCODE&prev=OLDROOMID): the player's name/avatar are
-- reused from the previous round's live_pack_players row instead of asking
-- them to type a name again. Already-in-the-room players simply reconnect.
-- ============================================================================

create or replace function public.live_rejoin_room(p_room_code text, p_previous_room_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_id uuid;
  v_pack_id uuid;
  v_prev_pack_id uuid;
  v_max_players integer;
  v_player_count integer;
  v_name text;
  v_avatar text;
  v_player_id uuid;
begin
  select id, pack_id, max_players
    into v_room_id, v_pack_id, v_max_players
  from public.live_pack_rooms
  where room_code = upper(trim(p_room_code))
  limit 1;
  if v_room_id is null then
    raise exception 'Room not found.';
  end if;

  if exists (
    select 1 from public.live_pack_rooms
    where id = v_room_id and status <> 'lobby'
  ) then
    raise exception 'This round has already started.';
  end if;

  -- The rejoin link must point at a replay of the same pack.
  select pack_id into v_prev_pack_id
  from public.live_pack_rooms
  where id = p_previous_room_id;
  if v_prev_pack_id is not null and v_prev_pack_id <> v_pack_id then
    raise exception 'This link is for another pack.';
  end if;

  -- Already in the new room? Reconnect instead of duplicating.
  select id into v_player_id
  from public.live_pack_players
  where room_id = v_room_id and user_id = auth.uid()
  limit 1;
  if v_player_id is not null then
    update public.live_pack_players
    set connected = true, last_seen_at = now()
    where id = v_player_id;
    return v_player_id;
  end if;

  select count(*) into v_player_count
  from public.live_pack_players
  where room_id = v_room_id;
  if v_player_count >= v_max_players then
    raise exception 'Room is full.';
  end if;

  -- Reuse the caller's identity from the previous round when available.
  select name, avatar_url
    into v_name, v_avatar
  from public.live_pack_players
  where room_id = p_previous_room_id and user_id = auth.uid()
  order by joined_at asc
  limit 1;

  if v_name is null then
    v_name := coalesce(
      nullif(auth.jwt()->'user_metadata'->>'display_name', ''),
      nullif(auth.jwt()->'user_metadata'->>'full_name', ''),
      split_part(coalesce(auth.jwt()->'user_metadata'->>'email', ''), '@', 1),
      'لاعب'
    );
  end if;

  insert into public.live_pack_players (room_id, user_id, name, avatar_url, connected, last_seen_at)
  values (v_room_id, auth.uid(), v_name, v_avatar, true, now())
  returning id into v_player_id;

  return v_player_id;
end;
$$;

grant execute on function public.live_rejoin_room(text, uuid) to authenticated;
