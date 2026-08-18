-- ============================================================================
-- 020_live_no_deduction_hardening.sql — harden round settings + verify the
-- "no deduction on wrong" rule at the database level.
--
-- 1) The wager range had per-column checks (1..1000) but nothing guaranteed
--    min <= max at the table level. The RPCs validate it, but every future
--    definer function must too — now the CHECK is the final safety net.
-- 2) Documented (and enforced by the existing host-only RPCs + SELECT-only
--    RLS) contract: deduct_on_wrong is a lobby-time setting — live_update_settings
--    rejects changes once the game is playing, and the scoring RPC
--    live_review_answer reads it per verdict, so flipping it in the lobby
--    changes how wrong answers score without any client-side guessing.
-- ============================================================================

alter table public.live_pack_rooms
  drop constraint if exists live_pack_rooms_wager_range_check;

alter table public.live_pack_rooms
  add constraint live_pack_rooms_wager_range_check
  check (min_wager <= max_wager);

comment on column public.live_pack_rooms.deduct_on_wrong is
  'When true (default), a wrong answer subtracts the player''s wager. When false, wrong answers score 0. Host-only, lobby-time setting.';
