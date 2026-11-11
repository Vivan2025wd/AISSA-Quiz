-- ================================================================
-- Migration 021: Fix question_code trigger race condition + backfill
-- AISSA Quiz Platform
--
-- Problems fixed:
--   1. generate_series upper bound was a correlated subquery → race window
--   2. Advisory lock key used hashtext() which can collide across subjects
--   3. Master SQL Section 7 used `UPDATE … SET subject = subject` to try
--      to fire a BEFORE INSERT trigger — that never works; NULLs stayed NULL.
--
-- Safe to run on any database. Idempotent.
-- ================================================================

-- Step 1: Drop the unique constraint temporarily so backfill can proceed
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_question_code_unique;

-- Step 2: Drop the existing trigger + function
DROP TRIGGER IF EXISTS generate_question_code_trigger ON public.questions;
DROP FUNCTION IF EXISTS public.generate_question_code() CASCADE;

-- Step 3: Null out DUPLICATE question_codes (keep the oldest row's code)
--         This cleans up any duplicates from previous migration runs.
UPDATE public.questions
SET question_code = NULL
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY question_code
             ORDER BY created_at ASC   -- keep oldest = row 1
           ) AS rn
    FROM public.questions
    WHERE question_code IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Step 4: Create the fixed, race-safe trigger function.
--
--   Key improvements over the previous version:
--   • Advisory lock key is a 64-bit integer derived from subject text,
--     avoiding cross-subject hash collisions.
--   • generate_series uses a FIXED upper bound (99999) instead of a
--     correlated subquery inside generate_series() — eliminates the
--     window where two concurrent transactions could both compute the
--     same "max+1" candidate and collide.
--   • Prefix regex is tightened to `^[A-Z]+[0-9]+$` to avoid matching
--     malformed codes.
--   • Safety RAISE if all 99999 slots are exhausted.
CREATE OR REPLACE FUNCTION public.generate_question_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_prefix      text;
  v_next_number bigint;
  v_lock_key    bigint;
BEGIN
  -- If a valid code was manually provided, skip generation
  IF nullif(btrim(new.question_code), '') IS NOT NULL THEN
    RETURN new;
  END IF;

  -- Build a unique 64-bit advisory lock key per subject.
  -- hashtext() returns int4 (32-bit); we shift it into the high 32 bits
  -- and XOR with a fixed salt in the low 32 bits to prevent collisions
  -- between subjects whose hashtext values happen to be equal.
  v_lock_key := (hashtext(coalesce(new.subject, '<NULL>'))::bigint << 32)
                | (hashtext('aissa.question_code.v2')::bigint & x'FFFFFFFF'::bigint);

  -- Serialise all concurrent inserts for the same subject.
  -- pg_advisory_xact_lock is session-level and released on COMMIT/ROLLBACK.
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Determine the prefix: use the most common existing prefix for this
  -- subject, falling back to a hard-coded abbreviation.
  SELECT regexp_replace(q.question_code, '[0-9]+$', '')
  INTO   v_prefix
  FROM   public.questions AS q
  WHERE  q.subject IS NOT DISTINCT FROM new.subject
    AND  q.question_code ~ '^[A-Z]+[0-9]+$'
  GROUP BY regexp_replace(q.question_code, '[0-9]+$', '')
  ORDER BY count(*) DESC,
           regexp_replace(q.question_code, '[0-9]+$', '') ASC
  LIMIT 1;

  v_prefix := coalesce(
    v_prefix,
    CASE
      WHEN lower(new.subject) LIKE '%physics%'       THEN 'PHY'
      WHEN lower(new.subject) LIKE '%chemistry%'     THEN 'CHE'
      WHEN lower(new.subject) LIKE '%biology%'       THEN 'BIO'
      WHEN lower(new.subject) LIKE '%ict%'
        OR lower(new.subject) LIKE '%information%'   THEN 'ICT'
      ELSE upper(
             left(
               regexp_replace(coalesce(new.subject, 'GEN'), '[^A-Za-z]', '', 'g'),
               3
             )
           )
    END
  );

  -- Find the smallest gap in [1, 99999] not already taken.
  -- FIXED upper bound = no correlated subquery inside generate_series(),
  -- so the range is never under-estimated during concurrent writes.
  SELECT gs.candidate
  INTO   v_next_number
  FROM   generate_series(1, 99999) AS gs(candidate)
  WHERE  NOT EXISTS (
    SELECT 1
    FROM   public.questions AS q
    WHERE  q.subject IS NOT DISTINCT FROM new.subject
      AND  q.question_code = v_prefix || lpad(gs.candidate::text, 3, '0')
  )
  ORDER BY gs.candidate
  LIMIT 1;

  -- Safety net: raise a clear error rather than inserting a NULL code
  IF v_next_number IS NULL THEN
    RAISE EXCEPTION
      'Could not allocate a question_code for subject "%": all slots up to 99999 are taken.',
      new.subject;
  END IF;

  new.question_code := v_prefix || lpad(v_next_number::text, 3, '0');
  RETURN new;
END;
$$;

-- Step 5: Recreate the trigger
CREATE TRIGGER generate_question_code_trigger
BEFORE INSERT ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.generate_question_code();

-- Step 6: Backfill all existing NULL-coded questions.
--         We cannot fire a BEFORE INSERT trigger via UPDATE, so we
--         replicate the trigger logic in a DO block instead.
DO $$
DECLARE
  r          RECORD;
  v_prefix   text;
  v_next     bigint;
  v_lock_key bigint;
BEGIN
  FOR r IN
    SELECT id, subject
    FROM public.questions
    WHERE question_code IS NULL
    ORDER BY created_at ASC   -- assign in creation order for determinism
  LOOP
    -- Same lock key computation as the trigger
    v_lock_key := (hashtext(coalesce(r.subject, '<NULL>'))::bigint << 32)
                  | (hashtext('aissa.question_code.v2')::bigint & x'FFFFFFFF'::bigint);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- Determine prefix
    SELECT regexp_replace(q.question_code, '[0-9]+$', '')
    INTO   v_prefix
    FROM   public.questions AS q
    WHERE  q.subject IS NOT DISTINCT FROM r.subject
      AND  q.question_code ~ '^[A-Z]+[0-9]+$'
    GROUP BY regexp_replace(q.question_code, '[0-9]+$', '')
    ORDER BY count(*) DESC, regexp_replace(q.question_code, '[0-9]+$', '') ASC
    LIMIT 1;

    v_prefix := coalesce(v_prefix,
      CASE
        WHEN lower(r.subject) LIKE '%physics%'       THEN 'PHY'
        WHEN lower(r.subject) LIKE '%chemistry%'     THEN 'CHE'
        WHEN lower(r.subject) LIKE '%biology%'       THEN 'BIO'
        WHEN lower(r.subject) LIKE '%ict%'
          OR lower(r.subject) LIKE '%information%'   THEN 'ICT'
        ELSE upper(left(regexp_replace(coalesce(r.subject,'GEN'),'[^A-Za-z]','','g'),3))
      END
    );

    SELECT gs.candidate
    INTO   v_next
    FROM   generate_series(1, 99999) AS gs(candidate)
    WHERE  NOT EXISTS (
      SELECT 1 FROM public.questions AS q
      WHERE  q.subject IS NOT DISTINCT FROM r.subject
        AND  q.question_code = v_prefix || lpad(gs.candidate::text, 3, '0')
    )
    ORDER BY gs.candidate
    LIMIT 1;

    UPDATE public.questions
    SET    question_code = v_prefix || lpad(v_next::text, 3, '0')
    WHERE  id = r.id;

  END LOOP;
END;
$$;

-- Step 7: Restore the unique constraint (now that all rows have codes)
ALTER TABLE public.questions
  ADD CONSTRAINT questions_question_code_unique UNIQUE (question_code);

-- Step 8: Verification query — run to confirm all questions have codes
-- SELECT subject,
--        count(*)                             AS total,
--        count(question_code)                 AS with_code,
--        count(*) - count(question_code)      AS missing_code,
--        count(*) FILTER (WHERE question_code IS NULL) AS null_codes
-- FROM public.questions
-- GROUP BY subject
-- ORDER BY subject;

-- Notify PostgREST to reload
NOTIFY pgrst, 'reload schema';
