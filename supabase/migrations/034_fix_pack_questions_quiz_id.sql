-- ============================================================================
-- 034_fix_pack_questions_quiz_id.sql — Fix nullable quiz_id
--
-- Migration 032 attempted to make quiz_id nullable but did NOT actually drop
-- the original NOT NULL constraint or the foreign key to pack_custom_quizzes.
-- This migration fixes that so new questions can be inserted with quiz_id=null.
-- ============================================================================

-- Step 1: Drop the NOT NULL constraint on quiz_id
ALTER TABLE public.pack_questions
  ALTER COLUMN quiz_id DROP NOT NULL;

-- Step 2: Drop the foreign key constraint to pack_custom_quizzes
-- (quiz_id is kept for backward compatibility but must be nullable for new questions)
ALTER TABLE public.pack_questions
  DROP CONSTRAINT IF EXISTS pack_questions_quiz_id_fkey;

-- Step 3: Ensure pack_id has a foreign key to packs
-- (this may already exist from migration 032, but add it safely)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pack_questions_pack_id_fkey'
      AND conrelid = 'public.pack_questions'::regclass
  ) THEN
    ALTER TABLE public.pack_questions
      ADD CONSTRAINT pack_questions_pack_id_fkey
      FOREIGN KEY (pack_id) REFERENCES public.packs(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 4: Ensure pack_id is NOT NULL for new rows
-- (only if all existing rows already have pack_id set)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pack_questions WHERE pack_id IS NULL LIMIT 1
  ) THEN
    ALTER TABLE public.pack_questions
      ALTER COLUMN pack_id SET NOT NULL;
  END IF;
END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
