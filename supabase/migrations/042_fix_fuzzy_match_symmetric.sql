-- ============================================================================
-- 042_fix_fuzzy_match_symmetric.sql
--
-- Fixes fuzzy_grid_match() to use GREATEST(length(a), length(b)) instead of
-- just length(a). This makes matching symmetric:
--   fuzzy_grid_match("قاهرة", "القاهرة") = true  (both directions)
--   fuzzy_grid_match("القاهرة", "قاهرة") = true  (both directions)
-- ============================================================================

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
