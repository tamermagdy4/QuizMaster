-- ============================================================================
-- 022_auto_host_transfer.sql — automatic host failover.
--
-- live_sweep_stale previously only marked stale players offline, and it was
-- only ever called by the host client — so when the host disconnected, nobody
-- marked them offline and the room just waited forever.
--
-- Now live_sweep_stale (a) marks stale players offline, then (b) if the host
-- is offline (or missing) it automatically promotes the most ACTIVE connected
-- player: highest score → most recent heartbeat → earliest join. The new host
-- id is returned so the promoting client can react immediately, and the room
-- UPDATE is pushed through Realtime to every client.
--
-- The promotion is deterministic and idempotent: concurrent sweeps all pick
-- the same top player, so double-promotion is impossible. The manual
-- live_transfer_host RPC remains as an instant fallback for the lobby / for
-- players who don't want to wait one sweep cycle.
-- ============================================================================

drop function if exists public.live_sweep_stale(uuid);

create or replace function public.live_sweep_stale(p_room_id uuid)
returns uuid  -- the new host player id, or null when nothing changed
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host_player_id uuid;
  v_new_host uuid;
  v_new_user uuid;
  v_new_name text;
begin
  -- Callers must be members of the room (players or the host).
  if not exists (
    select 1 from public.live_pack_players
    where room_id = p_room_id and user_id = auth.uid()
  ) then
    raise exception 'You must be in the room to refresh presence.';
  end if;

  -- 1) Mark stale players offline (no heartbeat for 30s).
  update public.live_pack_players
  set connected = false
  where room_id = p_room_id
    and last_seen_at < now() - interval '30 seconds';

  -- 2) Auto-promote when the current host is offline (or the room has no host).
  select host_player_id into v_host_player_id
  from public.live_pack_rooms
  where id = p_room_id;

  if v_host_player_id is null
     or not exists (
       select 1 from public.live_pack_players
       where id = v_host_player_id and connected = true
     )
  then
    select id, user_id, name into v_new_host, v_new_user, v_new_name
    from public.live_pack_players
    where room_id = p_room_id
      and connected = true
      and id <> coalesce(v_host_player_id, '00000000-0000-0000-0000-000000000000'::uuid)
    order by score desc, last_seen_at desc, joined_at asc
    limit 1;

    if v_new_host is not null then
      update public.live_pack_rooms
      set host_auth_id = v_new_user,
          host_player_id = v_new_host,
          host_name = v_new_name
      where id = p_room_id;
      return v_new_host;
    end if;
  end if;

  return null;
end;
$$;

grant execute on function public.live_sweep_stale(uuid) to authenticated;
