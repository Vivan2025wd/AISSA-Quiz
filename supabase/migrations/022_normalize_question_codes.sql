-- ================================================================
-- Migration 022: Normalize ALL question_codes to canonical format
-- AISSA Quiz Platform
--
-- PURPOSE
-- -------
-- Old questions in the DB may have codes like:
--   • NULL            (never got a code at all)
--   • '1', '2', '3'  (bare numbers, no prefix)
--   • 'PHY1'          (prefix but no zero-padding)
--   • 'PHY001'        (already canonical — SKIP)
--
-- This migration normalises every row so the entire table uses the
-- single canonical format:  PREFIX + 3-digit zero-padded number
--   e.g.  PHY001  CHE042  BIO007  ICT013
--
-- After normalisation the trigger (also replaced here) will always
-- find the max correctly and never produce a duplicate.
--
-- SAFE TO RE-RUN: drops the unique constraint first, rebuilds at end.
-- ================================================================

-- ----------------------------------------------------------------
-- STEP 0 — Drop unique constraint (we'll re-add at the end)
-- ----------------------------------------------------------------
ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_question_code_unique;

-- ----------------------------------------------------------------
-- STEP 1 — Drop old trigger + function
-- ----------------------------------------------------------------
DROP TRIGGER  IF EXISTS generate_question_code_trigger ON public.questions;
DROP FUNCTION IF EXISTS public.generate_question_code() CASCADE;

-- ----------------------------------------------------------------
-- STEP 2 — Null out every code that is NOT already canonical
--
-- Canonical = starts with 1-4 uppercase letters, then exactly
-- 3 zero-padded digits, nothing else:  ^[A-Z]{1,4}[0-9]{3}$
--
-- Anything that does NOT match (bare '1', 'PHY1', 'PHY0001', etc.)
-- gets cleared so the DO block below can re-assign it cleanly.
-- ----------------------------------------------------------------
UPDATE public.questions
SET    question_code = NULL
WHERE  question_code IS NOT NULL
  AND  question_code !~ '^[A-Z]{1,4}[0-9]{3}$';

-- ----------------------------------------------------------------
-- STEP 3 — Null out DUPLICATE canonical codes  (keep oldest row)
-- ----------------------------------------------------------------
UPDATE public.questions
SET    question_code = NULL
WHERE  id IN (
  SELECT id
  FROM (
    SELECT id,
           row_number() OVER (
             PARTITION BY question_code
             ORDER BY created_at ASC   -- keep oldest = row 1
           ) AS rn
    FROM   public.questions
    WHERE  question_code IS NOT NULL
  ) ranked
  WHERE rn > 1
);

-- ----------------------------------------------------------------
-- STEP 4 — Helper: canonical prefix for a subject text
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._qcode_prefix(p_subject text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN lower(p_subject) LIKE '%physics%'                            THEN 'PHY'
      WHEN lower(p_subject) LIKE '%chemistry%'                          THEN 'CHE'
      WHEN lower(p_subject) LIKE '%biology%'                            THEN 'BIO'
      WHEN lower(p_subject) LIKE '%ict%'
        OR lower(p_subject) LIKE '%information%'                        THEN 'ICT'
      ELSE upper(
             left(
               regexp_replace(coalesce(p_subject, 'GEN'), '[^A-Za-z]', '', 'g'),
               3
             )
           )
    END;
$$;

-- ----------------------------------------------------------------
-- STEP 5 — Backfill: assign canonical codes to every NULL-coded row
--
-- Strategy:
--   • Process each subject group independently (advisory lock per subject
--     so this is safe even if run while the app is live).
--   • Within each group, process rows in created_at ASC order so
--     older questions receive lower numbers.
--   • Find the smallest gap in [1 .. 99999] not already taken by
--     a canonical code for that subject — gap-filling, never skipping.
-- ----------------------------------------------------------------
DO $$
DECLARE
  r          RECORD;
  v_prefix   text;
  v_next     bigint;
  v_lock_key bigint;
BEGIN
  -- Outer loop: one row at a time, oldest first, so numbers are assigned
  -- in the natural creation order of the question bank.
  FOR r IN
    SELECT id, subject
    FROM   public.questions
    WHERE  question_code IS NULL
    ORDER  BY created_at ASC, id ASC   -- id as tie-breaker for same timestamp
  LOOP
    -- ── Advisory lock: serialise writers per subject ──────────────────
    -- 64-bit key: high-32 = subject hash, low-32 = salt hash.
    -- This avoids cross-subject collisions that plague single-int32 keys.
    v_lock_key :=
      (hashtext(coalesce(r.subject, '<NULL>'))::bigint << 32)
      | (hashtext('aissa.qcode.022')::bigint & x'FFFFFFFF'::bigint);

    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- ── Prefix ────────────────────────────────────────────────────────
    -- Prefer whatever canonical prefix already dominates for this subject
    -- so pre-existing PHY### rows keep their PHY prefix.
    SELECT regexp_replace(q.question_code, '[0-9]+$', '')
    INTO   v_prefix
    FROM   public.questions AS q
    WHERE  q.subject IS NOT DISTINCT FROM r.subject
      AND  q.question_code ~ '^[A-Z]{1,4}[0-9]{3}$'
    GROUP  BY regexp_replace(q.question_code, '[0-9]+$', '')
    ORDER  BY count(*) DESC,
              regexp_replace(q.question_code, '[0-9]+$', '') ASC
    LIMIT  1;

    -- Fall back to the hard-coded map if no canonical codes exist yet
    v_prefix := coalesce(v_prefix, public._qcode_prefix(r.subject));

    -- ── Next available slot ───────────────────────────────────────────
    -- Fixed upper bound = no race window (see migration 021 for details)
    SELECT gs.candidate
    INTO   v_next
    FROM   generate_series(1, 99999) AS gs(candidate)
    WHERE  NOT EXISTS (
      SELECT 1
      FROM   public.questions AS q
      WHERE  q.subject IS NOT DISTINCT FROM r.subject
        AND  q.question_code = v_prefix || lpad(gs.candidate::text, 3, '0')
    )
    ORDER  BY gs.candidate
    LIMIT  1;

    IF v_next IS NULL THEN
      RAISE EXCEPTION
        'All 99 999 slots for subject "%" prefix "%" are taken — cannot backfill id=%.',
        r.subject, v_prefix, r.id;
    END IF;

    -- ── Assign ────────────────────────────────────────────────────────
    UPDATE public.questions
    SET    question_code = v_prefix || lpad(v_next::text, 3, '0')
    WHERE  id = r.id;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------
-- STEP 6 — Replace the trigger with the final, canonical-aware version
--
-- Key guarantees:
--   1. Only generates if question_code is NULL / empty-string.
--   2. Prefix is derived from the same _qcode_prefix() helper used
--      in the backfill — always consistent.
--   3. Scans [1 .. 99999] with a fixed upper bound (no race window).
--   4. Advisory lock is a 64-bit composite key (no hash collision).
--   5. Code format is always PREFIX + lpad(n, 3, '0').
-- ----------------------------------------------------------------
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
  -- ── 1. Skip if a valid code was manually supplied ─────────────────
  IF nullif(btrim(new.question_code), '') IS NOT NULL THEN
    RETURN new;
  END IF;

  -- ── 2. Serialise concurrent inserts for the same subject ──────────
  v_lock_key :=
    (hashtext(coalesce(new.subject, '<NULL>'))::bigint << 32)
    | (hashtext('aissa.qcode.022')::bigint & x'FFFFFFFF'::bigint);

  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- ── 3. Determine prefix ───────────────────────────────────────────
  -- Use the dominant canonical prefix already in the table for this
  -- subject.  Falls back to _qcode_prefix() if none exist yet.
  SELECT regexp_replace(q.question_code, '[0-9]+$', '')
  INTO   v_prefix
  FROM   public.questions AS q
  WHERE  q.subject IS NOT DISTINCT FROM new.subject
    AND  q.question_code ~ '^[A-Z]{1,4}[0-9]{3}$'
  GROUP  BY regexp_replace(q.question_code, '[0-9]+$', '')
  ORDER  BY count(*) DESC,
            regexp_replace(q.question_code, '[0-9]+$', '') ASC
  LIMIT  1;

  v_prefix := coalesce(v_prefix, public._qcode_prefix(new.subject));

  -- ── 4. Find smallest unused slot ─────────────────────────────────
  SELECT gs.candidate
  INTO   v_next_number
  FROM   generate_series(1, 99999) AS gs(candidate)
  WHERE  NOT EXISTS (
    SELECT 1
    FROM   public.questions AS q
    WHERE  q.subject IS NOT DISTINCT FROM new.subject
      AND  q.question_code = v_prefix || lpad(gs.candidate::text, 3, '0')
  )
  ORDER  BY gs.candidate
  LIMIT  1;

  IF v_next_number IS NULL THEN
    RAISE EXCEPTION
      'Could not allocate a question_code for subject "%": all slots up to 99999 are taken.',
      new.subject;
  END IF;

  -- ── 5. Assign ─────────────────────────────────────────────────────
  new.question_code := v_prefix || lpad(v_next_number::text, 3, '0');
  RETURN new;
END;
$$;

CREATE TRIGGER generate_question_code_trigger
BEFORE INSERT ON public.questions
FOR EACH ROW
EXECUTE FUNCTION public.generate_question_code();

-- ----------------------------------------------------------------
-- STEP 7 — Restore unique constraint
-- Now every row has a code and they are all canonical + unique.
-- ----------------------------------------------------------------
ALTER TABLE public.questions
  ADD CONSTRAINT questions_question_code_unique UNIQUE (question_code);

-- ----------------------------------------------------------------
-- STEP 8 — Verification  (uncomment to run checks)
-- ----------------------------------------------------------------
-- Check 1: No NULLs remain
-- SELECT count(*) AS null_code_rows
-- FROM public.questions
-- WHERE question_code IS NULL;
-- -- Expected: 0

-- Check 2: All codes match canonical format
-- SELECT count(*) AS non_canonical_rows
-- FROM public.questions
-- WHERE question_code !~ '^[A-Z]{1,4}[0-9]{3}$';
-- -- Expected: 0

-- Check 3: Per-subject summary
-- SELECT
--   subject,
--   count(*)                                        AS total,
--   min(question_code)                              AS first_code,
--   max(question_code)                              AS last_code,
--   count(*) FILTER (WHERE question_code IS NULL)   AS null_codes,
--   count(*) FILTER (WHERE question_code !~ '^[A-Z]{1,4}[0-9]{3}$') AS bad_format
-- FROM public.questions
-- GROUP BY subject
-- ORDER BY subject;

-- Check 4: Confirm trigger exists
-- SELECT tgname, tgenabled
-- FROM pg_trigger
-- WHERE tgrelid = 'public.questions'::regclass
--   AND tgname = 'generate_question_code_trigger';

-- ----------------------------------------------------------------
-- STEP 9 — Reload PostgREST schema cache
-- ----------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
