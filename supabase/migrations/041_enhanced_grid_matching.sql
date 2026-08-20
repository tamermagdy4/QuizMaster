-- ============================================================================
-- 041_enhanced_grid_matching.sql
--
-- Enhances live_match_grid_answer() with:
-- 1. Arabic numeral normalization (text numbers ↔ digits ↔ Arabic-Indic)
-- 2. Fuzzy matching with levenshtein() — length-proportional thresholds:
--    - <= 2 chars: exact match only
--    - 3-5 chars:  levenshtein <= 1
--    - > 5 chars:   levenshtein <= 2
--
-- Requires fuzzystrmatch extension for levenshtein().
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- Enable fuzzystrmatch (levenshtein function)
-- ────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- ────────────────────────────────────────────────────────────────────────────
-- normalize_grid_answer() — full normalization pipeline
--
-- Steps:
--   1. Trim leading/trailing whitespace
--   2. Collapse multiple internal spaces into one
--   3. Convert Arabic-Indic numerals (٠١٢٣٤٥٦٧٨٩) to Western digits
--   4. Convert Arabic text numbers (واحد, اتنين, ...) to digits
--   5. Lowercase
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_grid_answer(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text;
BEGIN
  IF input IS NULL THEN return ''; END IF;

  -- Step 1+2: trim + collapse whitespace
  v := regexp_replace(trim(input), '\s+', ' ', 'g');

  -- Step 3: Arabic-Indic numerals → Western digits
  v := replace(v, '٠', '0');
  v := replace(v, '١', '1');
  v := replace(v, '٢', '2');
  v := replace(v, '٣', '3');
  v := replace(v, '٤', '4');
  v := replace(v, '٥', '5');
  v := replace(v, '٦', '6');
  v := replace(v, '٧', '7');
  v := replace(v, '٨', '8');
  v := replace(v, '٩', '9');

  -- Step 4: Arabic text numbers → digits (1-20 + common forms)
  -- Process longer words first to avoid partial matches
  v := replace(v, 'عشرين',   '20');
  v := replace(v, 'عشرون',   '20');
  v := replace(v, 'تسع عشرة','19');
  v := replace(v, 'تسعة عشر','19');
  v := replace(v, 'تساعطشر','19');
  v := replace(v, ' Dev19',   '19');
  v := replace(v, 'ثمان عشرة','18');
  v := replace(v, 'ثمانية عشر','18');
  v := replace(v, 'ثمانطشر', '18');
  v := replace(v, 'سبع عشرة','17');
  v := replace(v, 'سبعة عشر','17');
  v := replace(v, 'سبعتطشر','17');
  v := replace(v, 'ست عشرة', '16');
  v := replace(v, 'ستة عشر', '16');
  v := replace(v, 'ستطشر',   '16');
  v := replace(v, 'خمس عشرة','15');
  v := replace(v, 'خمسة عشر','15');
  v := replace(v, 'خمسطشر', '15');
  v := replace(v, 'اربع عشرة','14');
  v := replace(v, 'اربعة عشر','14');
  v := replace(v, 'اربعطشر','14');
  v := replace(v, 'ثلاث عشرة','13');
  v := replace(v, 'ثلاثة عشر','13');
  v := replace(v, 'تلاتطشر','13');
  v := replace(v, 'اثنتا عشرة','12');
  v := replace(v, 'اثني عشر',  '12');
  v := replace(v, 'اتناطشر',   '12');
  v := replace(v, 'حداشر',  '11');
  v := replace(v, 'حدعش',   '11');
  v := replace(v, 'احدى عشرة','11');
  v := replace(v, 'احد عشر',  '11');
  v := replace(v, 'عشر',    '10');
  v := replace(v, 'عشرون',  '20');  -- catch any remaining

  v := replace(v, 'تسعة',   '9');
  v := replace(v, 'تسع',    '9');
  v := replace(v, 'ثمانية', '8');
  v := replace(v, 'ثمان',   '8');
  v := replace(v, 'سبعة',   '7');
  v := replace(v, 'سبع',    '7');
  v := replace(v, 'ستة',    '6');
  v := replace(v, 'ست',     '6');
  v := replace(v, 'خمسة',   '5');
  v := replace(v, 'خمس',    '5');
  v := replace(v, 'اربعة',  '4');
  v := replace(v, 'اربع',   '4');
  v := replace(v, 'ثلاثة',  '3');
  v := replace(v, 'ثلاث',   '3');
  v := replace(v, 'تلات',   '3');
  v := replace(v, 'اتنين',  '2');
  v := replace(v, 'اثنان',  '2');
  v := replace(v, 'اثنين',  '2');
  v := replace(v, 'اثنتان', '2');
  v := replace(v, 'สอง',     '2');  -- Thai 2 (just in case)
  v := replace(v, 'واحد',   '1');
  v := replace(v, 'وحده',   '1');
  v := replace(v, 'وحدها',  '1');
  v := replace(v, 'صفر',    '0');
  v := replace(v, '睢',      '0');  -- just in case

  -- Step 5: lowercase
  v := lower(v);

  RETURN v;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- fuzzy_grid_match() — length-proportional fuzzy comparison
--
-- Returns true if:
--   - normalized strings are identical, OR
--   - length <= 2:  exact match only (no tolerance)
--   - length 3-5:   levenshtein <= 1
--   - length > 5:   levenshtein <= 2
--
-- Both inputs must already be normalized via normalize_grid_answer().
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fuzzy_grid_match(normalized_a text, normalized_b text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_len integer;
  v_dist integer;
BEGIN
  -- Exact match after normalization
  IF normalized_a = normalized_b THEN
    RETURN true;
  END IF;

  -- Use the MAX of both lengths for symmetric matching
  -- This prevents "قاهرة" (5 chars) from failing to match "القاهرة" (7 chars)
  v_len := GREATEST(length(normalized_a), length(normalized_b));

  -- For very short strings (1-2 chars): exact match only
  -- This prevents "6" from matching "7" or "8"
  IF v_len <= 2 THEN
    RETURN false;
  END IF;

  -- Calculate edit distance
  v_dist := levenshtein(normalized_a, normalized_b);

  -- Length-proportional threshold
  IF v_len <= 5 AND v_dist <= 1 THEN
    RETURN true;  -- 3-5 chars: allow 1 edit
  ELSIF v_len > 5 AND v_dist <= 2 THEN
    RETURN true;  -- 6+ chars: allow 2 edits
  END IF;

  RETURN false;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- Updated live_match_grid_answer() — uses normalization + fuzzy matching
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
  v_candidate record;
BEGIN
  SELECT id INTO v_player_id
  FROM public.live_pack_players
  WHERE room_id = p_room_id AND user_id = auth.uid();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'You are not in this room.';
  END IF;

  -- Full normalization of player input
  v_normalized_input := public.normalize_grid_answer(p_answer_text);

  -- Check each accepted answer with fuzzy matching
  FOR v_candidate IN
    SELECT qa.id, public.normalize_grid_answer(qa.answer_text) AS normalized
    FROM public.pack_question_answers qa
    WHERE qa.question_id = p_question_id
  LOOP
    IF public.fuzzy_grid_match(v_normalized_input, v_candidate.normalized) THEN
      v_answer_id := v_candidate.id;
      EXIT;
    END IF;
  END LOOP;

  IF v_answer_id IS NULL THEN
    RETURN false;
  END IF;

  -- Insert progress (ignore duplicate)
  INSERT INTO public.live_pack_question_progress (room_id, question_id, answer_id, matched_by_player_id)
  VALUES (p_room_id, p_question_id, v_answer_id, v_player_id)
  ON CONFLICT (room_id, question_id, answer_id) DO NOTHING;

  RETURN FOUND;
END;
$$;
