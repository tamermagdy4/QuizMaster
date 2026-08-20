-- ============================================================================
-- 044_fix_max_wager_not_null.sql
--
-- Bug: live_create_room() has p_max_wager DEFAULT NULL but the INSERT passes
-- it directly without coalesce. The column max_wager is NOT NULL DEFAULT 20,
-- so inserting NULL causes error 23502.
--
-- Fix: Use coalesce(p_max_wager, 20) in the INSERT, same as min_wager.
-- Also: drop the stale overloaded version of live_create_room (without
-- who_can_join) that causes PostgREST ambiguity errors.
-- ============================================================================

-- Drop the old overload (without who_can_join) that conflicts with the new one
DROP FUNCTION IF EXISTS public.live_create_room(uuid, integer, integer, integer, integer, integer, boolean, uuid);

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
        coalesce(p_min_wager, 1), coalesce(p_max_wager, 20),  -- ← FIX: was just p_max_wager
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

GRANT EXECUTE ON FUNCTION public.live_create_room(uuid, integer, integer, integer, integer, integer, boolean, uuid, text) TO authenticated;
