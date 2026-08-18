-- ============================================================================
-- 021_fix_settings_range_guard.sql — reject invalid wager ranges loudly.
--
-- The previous live_update_settings guarded min <= max with a WHERE clause,
-- which silently did NOTHING (HTTP 204, no change) when the host entered an
-- inverted range. The host's settings would appear saved while staying stale.
-- Now the range is validated explicitly and raises a clear error (HTTP 400).
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

  -- The final min/max after the merge must be ordered correctly.
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
    deduct_on_wrong = coalesce(p_deduct_on_wrong, deduct_on_wrong)
  where id = p_room_id;
end;
$$;

grant execute on function public.live_update_settings(uuid, integer, integer, integer, integer, boolean) to authenticated;
