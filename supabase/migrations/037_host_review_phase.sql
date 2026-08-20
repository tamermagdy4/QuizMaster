-- ============================================================================
-- 037_host_review_phase.sql — Host review phase + separated scoring
--
-- Changes:
-- 1. Adds 'host_review' to game_phase CHECK constraint
-- 2. Splits close_and_grade: marks answers but does NOT update scores
-- 3. Adds live_confirm_scoring: applies final scores after host review
-- 4. Adds normalize_answer helper for better auto-grading
-- 5. Adds live_next_question that goes through host_review → scoring → next
-- ============================================================================

-- Step 1: Update game_phase CHECK constraint to include 'host_review'
ALTER TABLE public.live_pack_rooms
  DROP CONSTRAINT IF EXISTS live_pack_rooms_game_phase_check;

ALTER TABLE public.live_pack_rooms
  ADD CONSTRAINT live_pack_rooms_game_phase_check
  CHECK (game_phase IN ('lobby', 'question_intro', 'active', 'locked', 'host_review', 'reveal', 'scoring', 'finished'));

-- Step 2: Answer normalization function (PostgreSQL)
CREATE OR REPLACE FUNCTION public.normalize_answer(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result text;
BEGIN
  IF input IS NULL THEN RETURN ''; END IF;
  -- Trim whitespace
  result := trim(input);
  -- Lowercase
  result := lower(result);
  -- Collapse multiple spaces to single space
  result := regexp_replace(result, '\s+', ' ', 'g');
  -- Normalize Arabic/English numerals: ٠-٩ → 0-9
  result := regexp_replace(result, '٠', '0', 'g');
  result := regexp_replace(result, '١', '1', 'g');
  result := regexp_replace(result, '٢', '2', 'g');
  result := regexp_replace(result, '٣', '3', 'g');
  result := regexp_replace(result, '٤', '4', 'g');
  result := regexp_replace(result, '٥', '5', 'g');
  result := regexp_replace(result, '٦', '6', 'g');
  result := regexp_replace(result, '٧', '7', 'g');
  result := regexp_replace(result, '٨', '8', 'g');
  result := regexp_replace(result, '٩', '9', 'g');
  -- Remove common punctuation that doesn't change meaning
  result := regexp_replace(result, '[.?!,;:،؟!]', '', 'g');
  RETURN result;
END;
$$;

-- Step 3: Rewrite close_and_grade — marks answers but does NOT update player scores
CREATE OR REPLACE FUNCTION public.live_close_and_grade(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_answer record;
  v_question record;
  v_normalized_answer text;
  v_normalized_correct text;
BEGIN
  SELECT * INTO v_room FROM public.live_pack_rooms WHERE id = p_room_id;

  IF v_room IS NULL THEN
    RAISE EXCEPTION 'Room not found.';
  END IF;

  IF v_room.host_auth_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can close and grade.';
  END IF;

  -- Lock answers
  UPDATE public.live_pack_rooms
  SET question_phase = 'closed', game_phase = 'locked', updated_at = now()
  WHERE id = p_room_id;

  -- Get the current question
  SELECT * INTO v_question
  FROM public.live_pack_questions
  WHERE room_id = p_room_id AND question_index = v_room.current_question_index;

  IF v_question IS NULL THEN
    RETURN;
  END IF;

  -- Normalize the correct answer once
  v_normalized_correct := public.normalize_answer(v_question.answer);

  -- Auto-grade each pending answer (does NOT update player scores)
  FOR v_answer IN
    SELECT * FROM public.live_pack_answers
    WHERE room_id = p_room_id
      AND question_index = v_room.current_question_index
      AND status = 'pending'
  LOOP
    v_normalized_answer := public.normalize_answer(v_answer.answer_text);

    -- Compare normalized answers
    IF v_normalized_answer = v_normalized_correct
       OR v_normalized_answer = '' AND v_normalized_correct = '' THEN
      -- Mark as correct but do NOT update score yet
      UPDATE public.live_pack_answers
      SET status = 'correct',
          points = v_answer.wager,
          reviewed_by_host = false,
          reviewed_at = NULL
      WHERE id = v_answer.id;
    ELSE
      -- Mark as wrong but do NOT update score yet
      UPDATE public.live_pack_answers
      SET status = 'wrong',
          points = 0,
          reviewed_by_host = false,
          reviewed_at = NULL
      WHERE id = v_answer.id;
    END IF;
  END LOOP;
END;
$$;

-- Step 4: Confirm scoring — applies final scores after host review
CREATE OR REPLACE FUNCTION public.live_confirm_scoring(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_answer record;
  v_total_earned integer;
BEGIN
  SELECT * INTO v_room FROM public.live_pack_rooms WHERE id = p_room_id;

  IF v_room IS NULL THEN
    RAISE EXCEPTION 'Room not found.';
  END IF;

  IF v_room.host_auth_id != auth.uid() THEN
    RAISE EXCEPTION 'Only the host can confirm scoring.';
  END IF;

  -- Apply scores for all graded answers in this question
  FOR v_answer IN
    SELECT * FROM public.live_pack_answers
    WHERE room_id = p_room_id
      AND question_index = v_room.current_question_index
  LOOP
    IF v_answer.status = 'correct' THEN
      -- Add points to player
      UPDATE public.live_pack_players
      SET score = score + v_answer.wager,
          correct_count = correct_count + 1
      WHERE id = v_answer.player_id;
    ELSIF v_answer.status = 'wrong' THEN
      -- Mark wrong but don't subtract (score stays 0 for this question)
      UPDATE public.live_pack_players
      SET wrong_count = wrong_count + 1
      WHERE id = v_answer.player_id;
    END IF;

    -- Mark as reviewed
    UPDATE public.live_pack_answers
    SET reviewed_by_host = true, reviewed_at = now()
    WHERE id = v_answer.id;
  END LOOP;

  -- Move to scoring phase
  UPDATE public.live_pack_rooms
  SET game_phase = 'scoring', updated_at = now()
  WHERE id = p_room_id;
END;
$$;

-- Step 5: Rewrite live_next_question to go through host_review
CREATE OR REPLACE FUNCTION public.live_next_question(p_room_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room record;
  v_total integer;
BEGIN
  SELECT * INTO v_room FROM public.live_pack_rooms WHERE id = p_room_id;
  IF v_room IS NULL THEN RAISE EXCEPTION 'Room not found.'; END IF;
  IF v_room.host_auth_id != auth.uid() THEN RAISE EXCEPTION 'Only the host can advance.'; END IF;

  SELECT count(*) INTO v_total FROM public.live_pack_questions WHERE room_id = p_room_id;

  IF v_room.current_question_index + 1 >= v_total THEN
    -- Last question → finish
    UPDATE public.live_pack_rooms
    SET status = 'finished', game_phase = 'finished', finished_at = now(), updated_at = now()
    WHERE id = p_room_id;
  ELSE
    -- Move to next question
    UPDATE public.live_pack_rooms
    SET current_question_index = current_question_index + 1,
        question_phase = 'active',
        game_phase = 'active',
        question_started_at = now(),
        updated_at = now()
    WHERE id = p_room_id;
  END IF;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
