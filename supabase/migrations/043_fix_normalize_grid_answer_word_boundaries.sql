-- ============================================================================
-- 043_fix_normalize_grid_answer_word_boundaries.sql
--
-- Critical fix: replace() does substring matching without word boundaries.
-- "مستشفى" contains "ست" and was being converted to "م6شفى".
--
-- Fix: Use regexp_replace() with \y word boundaries so replacements only
-- happen on whole standalone words.
-- Also removes erroneous lines (Dev19, two,睢) that leaked into 041.
-- ============================================================================

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

  -- Step 4: Arabic text numbers → digits (1-20)
  -- All use \y word boundaries to prevent substring corruption
  -- Longer forms processed first to avoid partial matches

  -- 20
  v := regexp_replace(v, '\y(عشرين|عشرون)\y', '20', 'g');

  -- 19
  v := regexp_replace(v, '\y(تسع\s*عشرة|تسعة\s* عشر|تساعطشر)\y', '19', 'g');

  -- 18
  v := regexp_replace(v, '\y(ثمان\s*عشرة|ثمانية\s* عشر|ثمانطشر)\y', '18', 'g');

  -- 17
  v := regexp_replace(v, '\y(سبع\s*عشرة|سبعة\s* عشر|سبعتطشر)\y', '17', 'g');

  -- 16
  v := regexp_replace(v, '\y(ست\s*عشرة|ستة\s* عشر|ستطشر)\y', '16', 'g');

  -- 15
  v := regexp_replace(v, '\y(خمس\s*عشرة|خمسة\s* عشر|خمسطشر)\y', '15', 'g');

  -- 14
  v := regexp_replace(v, '\y(اربع\s*عشرة|اربعة\s* عشر|اربعطشر)\y', '14', 'g');

  -- 13
  v := regexp_replace(v, '\y(ثلاث\s*عشرة|ثلاثة\s* عشر|تلاتطشر)\y', '13', 'g');

  -- 12
  v := regexp_replace(v, '\y(اثنتا\s*عشرة|اثني\s* عشر|اتناطشر)\y', '12', 'g');

  -- 11
  v := regexp_replace(v, '\y(حداشر|حدعش|احدى\s*عشرة|احد\s* عشر)\y', '11', 'g');

  -- 10 — "عشرة" must be handled before "عشر" isn't an issue with \y boundaries
  -- but we list the longer form first to be safe
  v := regexp_replace(v, '\y(عشرة|عشر)\y', '10', 'g');

  -- 9
  v := regexp_replace(v, '\y(تسعة|تسع)\y', '9', 'g');

  -- 8
  v := regexp_replace(v, '\y(ثمانية|ثمان)\y', '8', 'g');

  -- 7
  v := regexp_replace(v, '\y(سبعة|سبع)\y', '7', 'g');

  -- 6
  v := regexp_replace(v, '\y(ستة|ست)\y', '6', 'g');

  -- 5
  v := regexp_replace(v, '\y(خمسة|خمس)\y', '5', 'g');

  -- 4
  v := regexp_replace(v, '\y(اربعة|اربع)\y', '4', 'g');

  -- 3
  v := regexp_replace(v, '\y(ثلاثة|ثلاث|تلات)\y', '3', 'g');

  -- 2
  v := regexp_replace(v, '\y(اتنين|اثنان|اثنين|اثنتان)\y', '2', 'g');

  -- 1
  v := regexp_replace(v, '\y(واحد|وحده|وحدها)\y', '1', 'g');

  -- 0
  v := regexp_replace(v, '\y(صفر)\y', '0', 'g');

  -- Step 5: lowercase
  v := lower(v);

  RETURN v;
END;
$$;
