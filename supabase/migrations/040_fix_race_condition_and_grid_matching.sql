-- ============================================================================
-- 040_fix_race_condition_and_grid_matching.sql
--
-- Fixes from migration 039 review:
-- 1. live_match_grid_answer() — normalize multiple spaces before matching
-- 2. Race condition fix: unique partial index + EXCEPTION handler on INSERT
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Fix live_match_grid_answer() — normalize multiple whitespace
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.live_match_grid_answer(
  p_room_id uuid,
  p_question_id uuid,
  p_answer_text text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_answer_id uuid;
  v_normalized_input text;
BEGIN
  SELECT id INTO v_player_id
  FROM public.live_pack_players
  WHERE room_id = p_room_id AND user_id = auth.uid();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'You are not in this room.';
  END IF;

  -- Normalize: trim + collapse multiple whitespace into single space
  v_normalized_input := lower(regexp_replace(trim(p_answer_text), '\s+', ' ', 'g'));

  -- Find a matching accepted answer (normalized comparison)
  SELECT qa.id INTO v_answer_id
  FROM public.pack_question_answers qa
  WHERE qa.question_id = p_question_id
    AND lower(regexp_replace(trim(qa.answer_text), '\s+', ' ', 'g')) = v_normalized_input
  LIMIT 1;

  IF v_answer_id IS NULL THEN
    RETURN false;
  END IF;

  -- Insert progress (ignore duplicate — another player already matched this slot)
  INSERT INTO public.live_pack_question_progress (room_id, question_id, answer_id, matched_by_player_id)
  VALUES (p_room_id, p_question_id, v_answer_id, v_player_id)
  ON CONFLICT (room_id, question_id, answer_id) DO NOTHING;

  RETURN FOUND;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Race condition fix: unique partial index on active room codes
-- ────────────────────────────────────────────────────────────────────────────
-- Only enforces uniqueness for rooms that are NOT finished (lobby/playing).
-- Finished rooms can share codes since they are dead.
CREATE UNIQUE INDEX IF NOT EXISTS live_pack_rooms_active_code_uidx
ON public.live_pack_rooms (room_code)
WHERE status != 'finished';

-- ────────────────────────────────────────────────────────────────────────────
-- 3. Wrap live_create_room() INSERT in EXCEPTION handler for code collisions
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.live_create_room(
  p_pack_id uuid,
  p_max_players integer DEFAULT 10,
  p_question_timeout_seconds integer DEFAULT 30,
  p_question_count integer DEFAULT 10,
  p_min_wager integer DEFAULT 1,
  p_max_wager integer DEFAULT NULL,
  p_deduct_on_wrong boolean DEFAULT false,
  p_previous_room_id uuid DEFAULT NULL,
  p_who_can_join text DEFAULT 'anyone'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_code text;
  v_player_id uuid;
  v_name text;
  v_avatar text;
  v_pack_title text;
  v_tries integer := 0;
BEGIN
  SELECT title INTO v_pack_title
  FROM public.packs
  WHERE id = p_pack_id;
  IF v_pack_title IS NULL THEN
    RAISE EXCEPTION 'Pack not found.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.packs
    WHERE id = p_pack_id
      AND (visibility = 'public' AND status = 'published' OR creator_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'This pack cannot be hosted live.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pack_questions WHERE pack_id = p_pack_id LIMIT 1
  ) THEN
    RAISE EXCEPTION 'This pack has no questions yet.';
  END IF;

  IF coalesce(p_max_players, 10) < 2 OR coalesce(p_max_players, 10) > 50 THEN
    RAISE EXCEPTION 'Player limit must be between 2 and 50.';
  END IF;

  IF p_who_can_join NOT IN ('invite_only', 'friends', 'anyone') THEN
    RAISE EXCEPTION 'Invalid who_can_join value.';
  END IF;

  -- Generate unique numeric code with retry on collision
  LOOP
    v_code := public.generate_live_room_code();
    BEGIN
      INSERT INTO public.live_pack_rooms (
        host_auth_id, pack_id, room_code, max_players, pack_title,
        question_timeout_seconds, question_count, min_wager, max_wager,
        deduct_on_wrong, previous_room_id, who_can_join
      ) VALUES (
        auth.uid(), p_pack_id, v_code, coalesce(p_max_players, 10), v_pack_title,
        coalesce(p_question_timeout_seconds, 30), coalesce(p_question_count, 10),
        coalesce(p_min_wager, 1), p_max_wager,
        coalesce(p_deduct_on_wrong, false), p_previous_room_id, p_who_can_join
      )
      RETURNING id INTO v_room_id;
      EXIT; -- Success, break out of loop
    EXCEPTION WHEN unique_violation THEN
      v_tries := v_tries + 1;
      IF v_tries > 10 THEN
        RAISE EXCEPTION 'Could not allocate a unique room code after % attempts.', v_tries;
      END IF;
      -- Loop again with a new code
    END;
  END LOOP;

  v_name := coalesce(
    nullif(auth.jwt()->'user_metadata'->>'display_name', ''),
    nullif(auth.jwt()->'user_metadata'->>'full_name', ''),
    split_part(coalesce(auth.jwt()->'user_metadata'->>'email', ''), '@', 1),
    'المضيف'
  );
  v_avatar := auth.jwt()->'user_metadata'->>'avatar_url';

  INSERT INTO public.live_pack_players (room_id, user_id, name, connected, last_seen_at, is_ready)
  VALUES (v_room_id, auth.uid(), v_name, true, now(), false)
  RETURNING id INTO v_player_id;

  UPDATE public.live_pack_rooms
  SET host_player_id = v_player_id, host_name = v_name, host_avatar_url = v_avatar
  WHERE id = v_room_id;

  RETURN v_room_id;
END;
$$;
