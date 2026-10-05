-- =============================================================================
-- AISSA Quiz — Security Hardening Migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- =============================================================================
-- 
-- CRITICAL FIXES addressed by this migration:
--
--   1. [CRITICAL] Revoke UPDATE privilege on is_admin from authenticated role.
--      Any user could PATCH /rest/v1/profiles?id=eq.<own-uid>
--      body {"is_admin": true} and gain admin access.
--
--   2. [HIGH] Restrict SELECT on profiles to own row only.
--      Any authenticated user could dump all 35 profiles including
--      home addresses, school, AISSA IDs of all students.
--
--   3. [HIGH] Restrict SELECT on questions to hide correct_option.
--      Any authenticated user could dump all 372 questions with answers
--      before/during a live quiz. The API route already strips this
--      server-side, but defence-in-depth at the DB level is required.
--
--   4. Additional: tighten quiz_results and quiz_answers RLS so students
--      can only read/write their own rows.
--
-- =============================================================================

-- ── 1. Revoke is_admin column write from authenticated users ──────────────────
-- Revoke UPDATE entirely, then restore it for every other column explicitly.
-- This is the only reliable way to apply column-level restrictions in PostgREST.

-- First, completely revoke UPDATE on profiles from authenticated
REVOKE UPDATE ON profiles FROM authenticated;

-- Re-grant UPDATE for all non-sensitive columns.
-- Adjust the list to match your actual profiles columns.
GRANT UPDATE (
  full_name,
  address,
  district,
  school,
  stream,
  medium,
  subjects,
  ais_id,
  aissa_district,
  is_aissa_member,
  school_year,
  student_number,
  index_number
) ON profiles TO authenticated;

-- is_admin may only be changed by the service role (backend/admin panel).
-- authenticated users no longer have UPDATE on that column.


-- ── 2. Restrict SELECT on profiles (RLS) ──────────────────────────────────────
-- Remove the permissive "all authenticated users can see all profiles" policy
-- and replace it with "each user sees only their own row".
-- Public/leaderboard-safe columns are exposed via a separate view below.

-- Drop the old broad SELECT policy (name may differ — adjust if needed):
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON profiles;

-- Own-row SELECT policy
CREATE POLICY "profiles_select_own"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admins (service role) can read all via service_role key — no RLS applies there.

-- Public leaderboard view (no PII, no address, no is_admin)
CREATE OR REPLACE VIEW profiles_public AS
  SELECT
    id,
    full_name,
    school,
    district,
    stream,
    medium,
    subjects
  FROM profiles;

-- Grant SELECT on the public view to authenticated users
GRANT SELECT ON profiles_public TO authenticated;


-- ── 3. Hide correct_option from authenticated users via RLS/View ───────────────
-- The API route strips correct_option in code, but defence-in-depth:
-- remove SELECT on correct_option from the questions table for authenticated.

-- Option A (preferred if your Supabase plan supports column-level grants):
REVOKE SELECT ON questions FROM authenticated;
GRANT SELECT (
  id,
  quiz_id,
  question_text,
  image_url,
  topic,
  option_1,
  option_2,
  option_3,
  option_4,
  option_5,
  explanation,
  subject,
  stream,
  difficulty,
  created_at,
  -- multilingual columns
  question_text_en,
  option_1_en,
  option_2_en,
  option_3_en,
  option_4_en,
  option_5_en,
  explanation_en,
  question_text_ta,
  option_1_ta,
  option_2_ta,
  option_3_ta,
  option_4_ta,
  option_5_ta,
  explanation_ta
) ON questions TO authenticated;

-- correct_option is only accessible by the service role.


-- ── 4. Quiz results — own-row only ───────────────────────────────────────────
-- Drop any existing overly permissive policy:
DROP POLICY IF EXISTS "Authenticated users can view quiz_results" ON quiz_results;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON quiz_results;

CREATE POLICY "quiz_results_select_own"
  ON quiz_results
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "quiz_results_insert_own"
  ON quiz_results
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- Prevent double-submission tampering: no UPDATE/DELETE from clients.
REVOKE UPDATE ON quiz_results FROM authenticated;
REVOKE DELETE ON quiz_results FROM authenticated;


-- ── 5. Quiz answers — own-row only ───────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can view quiz_answers" ON quiz_answers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON quiz_answers;

CREATE POLICY "quiz_answers_select_own"
  ON quiz_answers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = student_id);

CREATE POLICY "quiz_answers_insert_own"
  ON quiz_answers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = student_id);

REVOKE UPDATE ON quiz_answers FROM authenticated;
REVOKE DELETE ON quiz_answers FROM authenticated;


-- ── 6. Verify is_admin can no longer be set by a client ──────────────────────
-- Test manually: logged in as a non-admin user, run:
--   PATCH /rest/v1/profiles?id=eq.<your-uid>
--   body: {"is_admin": true}
-- Expected result: HTTP 200 but 0 rows affected (column not in the grant list).
-- Also verify via:
--   SELECT is_admin FROM profiles WHERE id = '<your-uid>';
-- should still return false.

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================
