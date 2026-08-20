-- ============================================================================
-- 039_party_system_upgrade.sql — Sporcle-Party-style features
--
-- Adds:
-- 1. who_can_join on live_pack_rooms (invite_only / friends / anyone)
-- 2. is_ready on live_pack_players
-- 3. live_pack_chat table (persisted chat messages)
-- 4. pack_question_answers table (accepted answers for list-type questions)
-- 5. live_pack_question_progress table (grid slot tracking per live game)
-- 6. question_type on live_pack_questions (text / list)
-- 7. RPC: live_list_public_lobbies()
-- 8. RPC: live_set_ready(p_room_id, p_ready)
-- 9. RPC: live_send_chat(p_room_id, p_message)
-- 10. RPC: live_get_chat(p_room_id, p_since)
-- 11. Updated generate_live_room_code() — numeric-only, zero-padded
-- 12. Updated live_create_room() — accepts who_can_join, uses numeric codes
-- 13. Updated live_join_room() — validates numeric codes
-- 14. Reset is_ready on Play Again (live_create_room clears players)
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. who_can_join on live_pack_rooms
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.live_pack_rooms
  ADD COLUMN IF NOT EXISTS who_can_join text NOT NULL DEFAULT 'anyone'
  CHECK (who_can_join IN ('invite_only', 'friends', 'anyone'));

-- ────────────────────────────────────────────────────────────────────────────
-- 2. is_ready on live_pack_players
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.live_pack_players
  ADD COLUMN IF NOT EXISTS is_ready boolean NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. live_pack_chat — persisted chat messages
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_pack_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_pack_rooms(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.live_pack_players(id) ON DELETE CASCADE,
  player_name text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(message) <= 500)
);

CREATE INDEX IF NOT EXISTS live_chat_room_idx ON public.live_pack_chat (room_id, created_at);

-- ────────────────────────────────────────────────────────────────────────────
-- 4. pack_question_answers — accepted answers for list-type questions
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pack_question_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.pack_questions(id) ON DELETE CASCADE,
  answer_text text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pack_question_answers_qidx ON public.pack_question_answers (question_id, position);

-- ────────────────────────────────────────────────────────────────────────────
-- 5. live_pack_question_progress — grid slot tracking per live game
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.live_pack_question_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.live_pack_rooms(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.live_pack_questions(id) ON DELETE CASCADE,
  answer_id uuid NOT NULL REFERENCES public.pack_question_answers(id) ON DELETE CASCADE,
  matched_by_player_id uuid NOT NULL REFERENCES public.live_pack_players(id) ON DELETE CASCADE,
  matched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, question_id, answer_id)
);

CREATE INDEX IF NOT EXISTS live_question_progress_idx ON public.live_pack_question_progress (room_id, question_id);

-- ────────────────────────────────────────────────────────────────────────────
-- 6. question_type on live_pack_questions
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.live_pack_questions
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'text'
  CHECK (question_type IN ('text', 'list'));

-- ────────────────────────────────────────────────────────────────────────────
-- RLS for new tables
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.live_pack_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_pack_question_progress ENABLE ROW LEVEL SECURITY;

-- Chat: room members can read, room members can insert their own messages
DROP POLICY IF EXISTS "room members can read chat" ON public.live_pack_chat;
CREATE POLICY "room members can read chat"
ON public.live_pack_chat FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.live_pack_players p
  WHERE p.room_id = live_pack_chat.room_id AND p.user_id = auth.uid()
));

DROP POLICY IF EXISTS "room members can insert chat" ON public.live_pack_chat;
CREATE POLICY "room members can insert chat"
ON public.live_pack_chat FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.live_pack_players p
  WHERE p.room_id = live_pack_chat.room_id AND p.user_id = auth.uid()
));

-- pack_question_answers: authenticated can read (questions are shared)
DROP POLICY IF EXISTS "authenticated can read question answers" ON public.pack_question_answers;
CREATE POLICY "authenticated can read question answers"
ON public.pack_question_answers FOR SELECT TO authenticated USING (true);

-- Question progress: room members can read
DROP POLICY IF EXISTS "room members can read progress" ON public.live_pack_question_progress;
CREATE POLICY "room members can read progress"
ON public.live_pack_question_progress FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.live_pack_players p
  WHERE p.room_id = live_pack_question_progress.room_id AND p.user_id = auth.uid()
));

-- ────────────────────────────────────────────────────────────────────────────
-- Realtime for new tables
-- ────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_pack_chat;
    ALTER PUBLICATION supabase_realtime ADD TABLE public.live_pack_question_progress;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 7. Updated generate_live_room_code() — numeric-only, zero-padded
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_live_room_code()
RETURNS text
LANGUAGE sql
AS $$
  SELECT lpad(floor(random() * 1000000)::text, 6, '0');
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 8. Updated live_create_room() — accepts who_can_join, numeric codes
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

  -- Generate unique numeric code (only check non-finished rooms for uniqueness)
  v_code := public.generate_live_room_code();
  LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM public.live_pack_rooms
        WHERE room_code = v_code AND status != 'finished'
      ) THEN
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
        EXIT;
      END IF;
      v_tries := v_tries + 1;
      IF v_tries > 10 THEN
        RAISE EXCEPTION 'Could not allocate a room code. Try again.';
      END IF;
      v_code := public.generate_live_room_code();
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

-- ────────────────────────────────────────────────────────────────────────────
-- 9. Updated live_join_room() — validates numeric codes only
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.live_join_room(p_room_code text, p_player_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id uuid;
  v_player_id uuid;
  v_name text;
  v_player_count integer;
  v_max integer;
  v_status text;
  v_clean_code text;
BEGIN
  -- Strip spaces and normalize to digits only
  v_clean_code := regexp_replace(coalesce(p_room_code, ''), '[^0-9]', '', 'g');

  IF length(v_clean_code) != 6 THEN
    RAISE EXCEPTION 'Room code must be exactly 6 digits.';
  END IF;

  SELECT id, status, max_players INTO v_room_id, v_status, v_max
  FROM public.live_pack_rooms
  WHERE room_code = v_clean_code;
  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Room not found. Check the code.';
  END IF;

  SELECT id INTO v_player_id
  FROM public.live_pack_players
  WHERE room_id = v_room_id AND user_id = auth.uid();

  IF v_player_id IS NOT NULL THEN
    UPDATE public.live_pack_players
    SET name = coalesce(nullif(trim(coalesce(p_player_name, '')), ''), name),
        connected = true,
        is_ready = false,
        last_seen_at = now()
    WHERE id = v_player_id;
    RETURN v_player_id;
  END IF;

  IF v_status <> 'lobby' THEN
    RAISE EXCEPTION 'This game has already started.';
  END IF;

  SELECT count(*) INTO v_player_count
  FROM public.live_pack_players
  WHERE room_id = v_room_id;

  IF v_player_count >= v_max THEN
    RAISE EXCEPTION 'Room is full.';
  END IF;

  v_name := coalesce(
    nullif(trim(coalesce(p_player_name, '')), ''),
    split_part(coalesce(auth.jwt()->'user_metadata'->>'email', ''), '@', 1),
    'لاعب'
  );

  INSERT INTO public.live_pack_players (room_id, user_id, name, connected, last_seen_at, is_ready)
  VALUES (v_room_id, auth.uid(), v_name, true, now(), false)
  RETURNING id INTO v_player_id;

  RETURN v_player_id;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- 10. live_list_public_lobbies() — public games for the join screen
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.live_list_public_lobbies()
RETURNS TABLE (
  room_id uuid,
  room_code text,
  host_name text,
  host_avatar_url text,
  pack_title text,
  pack_cover_url text,
  player_count bigint,
  max_players integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id AS room_id,
    r.room_code,
    r.host_name,
    r.host_avatar_url,
    r.pack_title,
    p.cover_url AS pack_cover_url,
    (SELECT count(*) FROM public.live_pack_players pl WHERE pl.room_id = r.id) AS player_count,
    r.max_players,
    r.created_at
  FROM public.live_pack_rooms r
  LEFT JOIN public.packs p ON p.id = r.pack_id
  WHERE r.status = 'lobby'
    AND r.who_can_join = 'anyone'
    AND (SELECT count(*) FROM public.live_pack_players pl WHERE pl.room_id = r.id) < r.max_players
  ORDER BY r.created_at DESC
  LIMIT 20;
END;
$$;

GRANT EXECUTE ON FUNCTION public.live_list_public_lobbies() TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 11. live_set_ready() — toggle ready status
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.live_set_ready(p_room_id uuid, p_ready boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
BEGIN
  SELECT id INTO v_player_id
  FROM public.live_pack_players
  WHERE room_id = p_room_id AND user_id = auth.uid();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'You are not in this room.';
  END IF;

  UPDATE public.live_pack_players
  SET is_ready = coalesce(p_ready, false)
  WHERE id = v_player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.live_set_ready(uuid, boolean) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 12. live_send_chat() — send a chat message
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.live_send_chat(p_room_id uuid, p_message text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_player_name text;
  v_msg text;
BEGIN
  SELECT id, name INTO v_player_id, v_player_name
  FROM public.live_pack_players
  WHERE room_id = p_room_id AND user_id = auth.uid();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'You are not in this room.';
  END IF;

  v_msg := trim(coalesce(p_message, ''));
  IF length(v_msg) = 0 THEN
    RAISE EXCEPTION 'Message cannot be empty.';
  END IF;

  IF length(v_msg) > 500 THEN
    v_msg := left(v_msg, 500);
  END IF;

  INSERT INTO public.live_pack_chat (room_id, player_id, player_name, message, is_system)
  VALUES (p_room_id, v_player_id, v_player_name, v_msg, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.live_send_chat(uuid, text) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 13. live_get_chat() — fetch chat messages
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.live_get_chat(p_room_id uuid, p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  player_name text,
  message text,
  is_system boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.live_pack_players
    WHERE room_id = p_room_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You are not in this room.';
  END IF;

  RETURN QUERY
  SELECT c.id, c.player_name, c.message, c.is_system, c.created_at
  FROM public.live_pack_chat c
  WHERE c.room_id = p_room_id
    AND (p_since IS NULL OR c.created_at > p_since)
  ORDER BY c.created_at ASC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.live_get_chat(uuid, timestamptz) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 14. live_match_grid_answer() — match a player's answer against accepted answers
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
  v_matched boolean := false;
BEGIN
  SELECT id INTO v_player_id
  FROM public.live_pack_players
  WHERE room_id = p_room_id AND user_id = auth.uid();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'You are not in this room.';
  END IF;

  -- Find a matching accepted answer (case-insensitive, trimmed)
  SELECT qa.id INTO v_answer_id
  FROM public.pack_question_answers qa
  WHERE qa.question_id = p_question_id
    AND lower(trim(qa.answer_text)) = lower(trim(p_answer_text))
  LIMIT 1;

  IF v_answer_id IS NULL THEN
    RETURN false;
  END IF;

  -- Insert progress (ignore duplicate — another player already matched this slot)
  INSERT INTO public.live_pack_question_progress (room_id, question_id, answer_id, matched_by_player_id)
  VALUES (p_room_id, p_question_id, v_answer_id, v_player_id)
  ON CONFLICT (room_id, question_id, answer_id) DO NOTHING;

  v_matched := FOUND;
  RETURN v_matched;
END;
$$;

GRANT EXECUTE ON FUNCTION public.live_match_grid_answer(uuid, uuid, text) TO authenticated;
