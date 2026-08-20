-- ============================================================================
-- Migration 038: Remove 'locked' phase from live_close_and_grade
-- 
-- The live_close_and_grade RPC currently sets game_phase = 'locked' which
-- causes a brief flash. The client handles the phase transition directly
-- (active → host_review) after calling closeAndGrade().
-- ============================================================================

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

  -- Lock answers — do NOT set game_phase here, client handles the transition
  UPDATE public.live_pack_rooms
  SET question_phase = 'closed', updated_at = now()
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

    IF v_normalized_answer = v_normalized_correct THEN
      UPDATE public.live_pack_answers
      SET status = 'correct', reviewed_by_host = false, reviewed_at = now()
      WHERE id = v_answer.id;
    ELSE
      UPDATE public.live_pack_answers
      SET status = 'wrong', reviewed_by_host = false, reviewed_at = now()
      WHERE id = v_answer.id;
    END IF;
  END LOOP;
END;
$$;
