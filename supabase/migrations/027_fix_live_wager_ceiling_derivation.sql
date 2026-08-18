-- ============================================================================
-- 027_fix_live_wager_ceiling_derivation.sql
--
-- 026 derived the wager ceiling from the question count on EVERY settings
-- update where no explicit max was sent — including unrelated changes such as
-- toggling the deduction rule or resizing the party. That clobbered an
-- explicitly chosen ceiling (e.g. 20 with a 3-question round) down to the
-- question count on the very next lobby tweak.
--
-- Fix: the ceiling only follows the question count when the question count
-- itself is being CHANGED (p_question_count set). Otherwise the current
-- ceiling is preserved. An explicit p_max_wager always wins.
-- ============================================================================

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

  -- Sporcle rule: max points = question count. The ceiling follows the count
  -- ONLY when the count is actually changing; unrelated updates (deduction
  -- toggle, party size, timer) keep the current ceiling. An explicit max wins.
  if p_max_wager is null and p_question_count is not null then
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
