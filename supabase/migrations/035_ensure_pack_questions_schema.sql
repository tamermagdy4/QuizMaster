-- ============================================================================
-- 035_ensure_pack_questions_schema.sql — Comprehensive pack_questions fix
--
-- This migration GUARANTEES the pack_questions table works correctly with
-- pack_id (direct Pack → Questions relationship, no quiz intermediary).
--
-- It is idempotent — safe to run multiple times.
-- ============================================================================

-- Step 1: Add pack_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pack_questions' AND column_name = 'pack_id'
  ) THEN
    ALTER TABLE public.pack_questions ADD COLUMN pack_id uuid;
    RAISE NOTICE 'Added pack_id column to pack_questions';
  END IF;
END $$;

-- Step 2: Drop NOT NULL constraint on quiz_id (allow NULL for new questions)
ALTER TABLE public.pack_questions
  ALTER COLUMN quiz_id DROP NOT NULL;

-- Step 3: Drop foreign key constraint on quiz_id if it exists
DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'pack_questions'
    AND con.contype = 'f'
    AND con.conkey @> ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'quiz_id')
    ]::smallint[]
  LIMIT 1;

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pack_questions DROP CONSTRAINT %I', constraint_name);
    RAISE NOTICE 'Dropped foreign key constraint: %', constraint_name;
  END IF;
END $$;

-- Step 4: Ensure pack_id has a foreign key to packs
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
    RAISE NOTICE 'Added foreign key pack_questions_pack_id_fkey';
  END IF;
END $$;

-- Step 5: Add index on pack_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pack_questions' AND indexname = 'pack_questions_pack_id_idx'
  ) THEN
    CREATE INDEX pack_questions_pack_id_idx ON public.pack_questions (pack_id);
    RAISE NOTICE 'Created index pack_questions_pack_id_idx';
  END IF;
END $$;

-- Step 6: Add composite index for common queries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'pack_questions' AND indexname = 'pack_questions_pack_position_idx'
  ) THEN
    CREATE INDEX pack_questions_pack_position_idx ON public.pack_questions (pack_id, position);
    RAISE NOTICE 'Created index pack_questions_pack_position_idx';
  END IF;
END $$;

-- Step 7: Ensure RLS policies exist for pack_id-based access
-- (These are idempotent — drop and recreate)

-- SELECT: Owner can read their own pack questions
DROP POLICY IF EXISTS "pack_questions_select_owner" ON public.pack_questions;
CREATE POLICY "pack_questions_select_owner"
ON public.pack_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_id AND p.creator_id = auth.uid()
  )
);

-- SELECT: Anyone can read questions of published public packs
DROP POLICY IF EXISTS "pack_questions_select_public" ON public.pack_questions;
CREATE POLICY "pack_questions_select_public"
ON public.pack_questions FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_id AND p.visibility = 'public' AND p.status = 'published'
  )
);

-- INSERT: Owner can insert questions into their packs
DROP POLICY IF EXISTS "pack_questions_insert_owner" ON public.pack_questions;
CREATE POLICY "pack_questions_insert_owner"
ON public.pack_questions FOR INSERT
TO authenticated
WITH CHECK (
  creator_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_id AND p.creator_id = auth.uid()
  )
);

-- UPDATE: Owner can update questions in their packs
DROP POLICY IF EXISTS "pack_questions_update_owner" ON public.pack_questions;
CREATE POLICY "pack_questions_update_owner"
ON public.pack_questions FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_id AND p.creator_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_id AND p.creator_id = auth.uid()
  )
);

-- DELETE: Owner can delete questions from their packs
DROP POLICY IF EXISTS "pack_questions_delete_owner" ON public.pack_questions;
CREATE POLICY "pack_questions_delete_owner"
ON public.pack_questions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_id AND p.creator_id = auth.uid()
  )
);

-- Step 8: Ensure RLS is enabled
ALTER TABLE public.pack_questions ENABLE ROW LEVEL SECURITY;

-- Step 9: Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- Step 10: Log summary
DO $$
DECLARE
  v_total integer;
  v_with_pack_id integer;
  v_with_quiz_id integer;
BEGIN
  SELECT count(*) INTO v_total FROM public.pack_questions;
  SELECT count(*) INTO v_with_pack_id FROM public.pack_questions WHERE pack_id IS NOT NULL;
  SELECT count(*) INTO v_with_quiz_id FROM public.pack_questions WHERE quiz_id IS NOT NULL;
  RAISE NOTICE 'pack_questions: % total, % with pack_id, % with quiz_id', v_total, v_with_pack_id, v_with_quiz_id;
END $$;
