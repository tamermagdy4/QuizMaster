-- ============================================================================
-- 029_live_round_history.sql — completed-round history for Live Pack rooms.
--
-- Every finished round gets a permanent snapshot row so the host and the
-- players can reopen results of earlier rounds (winner, final standings,
-- question count, settings). The snapshot is written inside live_finish_game
-- (the single host-only finish path) so it is atomic with the status flip.
--
--   1) live_round_history       — one row per finished room (unique room_id)
--   2) live_finish_game         — re-declared: also inserts the snapshot
--   3) live_get_round_history   — all rounds of a pack (newest first)
--   4) live_get_round_history_by_room — single round lookup
-- ============================================================================

create table if not exists public.live_round_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null,
  pack_id uuid not null,
  pack_title text not null,
  host_name text not null,
  question_count integer not null,
  deduct_on_wrong boolean not null default true,
  finished_at timestamptz not null default now(),
  winner_name text,
  winner_score integer,
  -- Final standings snapshot: [{name, score, correct_count, wrong_count,
  -- avg_wager, best_win_wager}, ...] ordered by score desc (same as the
  -- results screen). Players can leave/rejoin; the snapshot never changes.
  players jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint live_round_history_room_key unique (room_id)
);

create index if not exists live_round_history_pack_idx
  on public.live_round_history (pack_id, finished_at desc);

comment on table public.live_round_history is
  'Immutable snapshot of each finished Live Pack round — lets the host and players reopen earlier results.';

-- RLS: reads allowed for any signed-in user (the data is just names/scores of
-- public pack games). Writes happen only through the security-definer
-- live_finish_game, which bypasses RLS.
alter table public.live_round_history enable row level security;

drop policy if exists live_round_history_select on public.live_round_history;
create policy live_round_history_select
  on public.live_round_history
  for select
  to authenticated
  using (true);

grant select on table public.live_round_history to authenticated;

-- ---------------------------------------------------------------------------
-- live_finish_game — host-only; flips the room to 'finished' and snapshots
-- the final standings into live_round_history in the same transaction.
-- ---------------------------------------------------------------------------
create or replace function public.live_finish_game(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pack_id uuid;
  v_pack_title text;
  v_host_name text;
  v_question_count integer;
  v_deduct_on_wrong boolean;
  v_players jsonb;
  v_winner_name text;
  v_winner_score integer;
begin
  if not exists (
    select 1 from public.live_pack_rooms
    where id = p_room_id and host_auth_id = auth.uid()
  ) then
    raise exception 'Only the host may finish the game.';
  end if;

  select pack_id, pack_title, host_name, question_count, deduct_on_wrong
    into v_pack_id, v_pack_title, v_host_name, v_question_count, v_deduct_on_wrong
  from public.live_pack_rooms
  where id = p_room_id;

  -- Final standings snapshot — identical ordering to the results screen.
  select coalesce(jsonb_agg(jsonb_build_object(
      'name', p.name,
      'score', p.score,
      'correct_count', p.correct_count,
      'wrong_count', p.wrong_count,
      'avg_wager', p.avg_wager,
      'best_win_wager', p.best_win_wager
    ) order by p.score desc, p.joined_at asc), '[]'::jsonb)
    into v_players
  from public.live_pack_players p
  where p.room_id = p_room_id;

  select name, score
    into v_winner_name, v_winner_score
  from public.live_pack_players
  where room_id = p_room_id
  order by score desc, joined_at asc
  limit 1;

  update public.live_pack_rooms
  set status = 'finished', finished_at = now()
  where id = p_room_id;

  insert into public.live_round_history
    (room_id, pack_id, pack_title, host_name, question_count, deduct_on_wrong,
     finished_at, winner_name, winner_score, players)
  values
    (p_room_id, v_pack_id, v_pack_title, v_host_name, v_question_count, v_deduct_on_wrong,
     now(), v_winner_name, v_winner_score, v_players)
  on conflict (room_id) do nothing;
end;
$$;

grant execute on function public.live_finish_game(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Read RPCs
-- ---------------------------------------------------------------------------
-- All finished rounds of a pack, newest first.
create or replace function public.live_get_round_history(p_pack_id uuid)
returns setof public.live_round_history
language sql
security definer
set search_path = public
as $$
  select * from public.live_round_history
  where pack_id = p_pack_id
  order by finished_at desc;
$$;

-- Single round by room id (e.g. the round that just finished).
create or replace function public.live_get_round_history_by_room(p_room_id uuid)
returns public.live_round_history
language sql
security definer
set search_path = public
as $$
  select * from public.live_round_history
  where room_id = p_room_id
  limit 1;
$$;

grant execute on function public.live_get_round_history(uuid) to authenticated;
grant execute on function public.live_get_round_history_by_room(uuid) to authenticated;
