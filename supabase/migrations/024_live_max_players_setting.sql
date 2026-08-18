-- ============================================================================
-- 024_live_max_players_setting.sql — host-adjustable party size.
--
-- live_update_settings already handles the lobby-only round setup; this adds
-- p_max_players (2..100) so the host can resize the party from the lobby
-- without recreating the room.
-- ============================================================================

drop function if exists public.live_update_settings(uuid, integer, integer, integer, integer, boolean);

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

  select coalesce(p_min_wager, min_wager), coalesce(p_max_wager, max_wager)
  into v_min, v_max
  from public.live_pack_rooms
  where id = p_room_id;

  if v_min > v_max then
    raise exception 'Minimum wager (%) cannot exceed the maximum (%).', v_min, v_max;
  end if;

  update public.live_pack_rooms
  set
    question_count = coalesce(p_question_count, question_count),
    question_timeout_seconds = coalesce(p_question_timeout_seconds, question_timeout_seconds),
    min_wager = coalesce(p_min_wager, min_wager),
    max_wager = coalesce(p_max_wager, max_wager),
    deduct_on_wrong = coalesce(p_deduct_on_wrong, deduct_on_wrong),
    max_players = coalesce(p_max_players, max_players)
  where id = p_room_id;
end;
$$;

grant execute on function public.live_update_settings(uuid, integer, integer, integer, integer, boolean, integer) to authenticated;
