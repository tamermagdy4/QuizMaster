-- ============================================================================
-- RUN THIS IN: Supabase SQL Editor (https://supabase.com/dashboard)
--
-- This script adds pack_id to pack_questions and fixes the schema.
-- Safe to run multiple times (idempotent).
-- ============================================================================

-- Step 1: Add pack_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pack_questions'
      AND column_name = 'pack_id'
  ) THEN
    ALTER TABLE public.pack_questions ADD COLUMN pack_id uuid;
    RAISE NOTICE 'SUCCESS: Added pack_id column to pack_questions';
  ELSE
    RAISE NOTICE 'pack_id column already exists';
  END IF;
END $$;

-- Step 2: Drop NOT NULL constraint on quiz_id (allow NULL for new questions)
ALTER TABLE public.pack_questions ALTER COLUMN quiz_id DROP NOT NULL;
RAISE NOTICE 'Dropped NOT NULL on quiz_id';

-- Step 3: Drop foreign key constraint on quiz_id if it exists
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'pack_questions'
      AND nsp.nspname = 'public'
      AND con.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.pack_questions DROP CONSTRAINT IF EXISTS %I', rec.conname);
    RAISE NOTICE 'Dropped foreign key: %', rec.conname;
  END LOOP;
END $$;

-- Step 4: Add foreign key from pack_id to packs(id)
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
    RAISE NOTICE 'SUCCESS: Added foreign key pack_questions_pack_id_fkey';
  ELSE
    RAISE NOTICE 'Foreign key pack_questions_pack_id_fkey already exists';
  END IF;
END $$;

-- Step 5: Add index on pack_id
CREATE INDEX IF NOT EXISTS pack_questions_pack_id_idx ON public.pack_questions (pack_id);
CREATE INDEX IF NOT EXISTS pack_questions_pack_position_idx ON public.pack_questions (pack_id, position);
RAISE NOTICE 'Indexes created';

-- Step 6: Populate pack_id from existing data (for any legacy questions)
UPDATE public.pack_questions pq
SET pack_id = q.pack_id
FROM public.pack_custom_quizzes q
WHERE pq.quiz_id = q.id
  AND pq.pack_id IS NULL;
RAISE NOTICE 'Populated pack_id from legacy data';

-- Step 7: Drop and recreate RLS policies for pack_id-based access

-- Drop old quiz_id-based policies if they conflict
DROP POLICY IF EXISTS "owners can add questions to their packs" ON public.pack_questions;
DROP POLICY IF EXISTS "owners can read their own pack questions" ON public.pack_questions;
DROP POLICY IF EXISTS "owners can update their pack questions" ON public.pack_questions;
DROP POLICY IF EXISTS "owners can delete their pack questions" ON public.pack_questions;
DROP POLICY IF EXISTS "anyone can read questions of published packs" ON public.pack_questions;
DROP POLICY IF EXISTS "admins can read all pack questions" ON public.pack_questions;
DROP POLICY IF EXISTS "admins can update any pack question" ON public.pack_questions;
DROP POLICY IF EXISTS "admins can delete any pack question" ON public.pack_questions;

-- Create pack_id-based policies

-- SELECT: Owner can read their own pack questions
DROP POLICY IF EXISTS "pack_questions_select_owner_v2" ON public.pack_questions;
CREATE POLICY "pack_questions_select_owner_v2"
ON public.pack_questions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_id AND p.creator_id = auth.uid()
  )
);

-- SELECT: Anyone can read questions of published public packs
DROP POLICY IF EXISTS "pack_questions_select_public_v2" ON public.pack_questions;
CREATE POLICY "pack_questions_select_public_v2"
ON public.pack_questions FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_id AND p.visibility = 'public' AND p.status = 'published'
  )
);

-- INSERT: Owner can insert questions into their packs
DROP POLICY IF EXISTS "pack_questions_insert_owner_v2" ON public.pack_questions;
CREATE POLICY "pack_questions_insert_owner_v2"
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
DROP POLICY IF EXISTS "pack_questions_update_owner_v2" ON public.pack_questions;
CREATE POLICY "pack_questions_update_owner_v2"
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
DROP POLICY IF EXISTS "pack_questions_delete_owner_v2" ON public.pack_questions;
CREATE POLICY "pack_questions_delete_owner_v2"
ON public.pack_questions FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_id AND p.creator_id = auth.uid()
  )
);

-- Admin policies
DROP POLICY IF EXISTS "pack_questions_admin_all_v2" ON public.pack_questions;
CREATE POLICY "pack_questions_admin_all_v2"
ON public.pack_questions FOR ALL
TO authenticated
USING (
  (auth.jwt()->'app_metadata'->>'role') = 'admin'
)
WITH CHECK (
  (auth.jwt()->'app_metadata'->>'role') = 'admin'
);

RAISE NOTICE 'RLS policies created';

-- Step 8: Ensure RLS is enabled
ALTER TABLE public.pack_questions ENABLE ROW LEVEL SECURITY;
RAISE NOTICE 'RLS enabled';

-- Step 9: Refresh schema cache
NOTIFY pgrst, 'reload schema';
RAISE NOTICE 'Schema cache refresh requested';

-- Step 10: Verify
DO $$
DECLARE
  v_total integer;
  v_with_pack_id integer;
  v_has_column boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pack_questions'
      AND column_name = 'pack_id'
  ) INTO v_has_column;

  SELECT count(*) INTO v_total FROM public.pack_questions;
  SELECT count(*) INTO v_with_pack_id FROM public.pack_questions WHERE pack_id IS NOT NULL;

  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE 'pack_id column exists: %', v_has_column;
  RAISE NOTICE 'Total questions: %', v_total;
  RAISE NOTICE 'Questions with pack_id: %', v_with_pack_id;
  RAISE NOTICE '===================';

  IF NOT v_has_column THEN
    RAISE EXCEPTION 'FAILED: pack_id column does not exist!';
  END IF;
END $$;
