// lib/school-codes.ts
// -----------------------------------------------------------------------------
// School code utilities for AISSA member IDs and non-member quiz IDs.
//
// A "school code" is a short uppercase abbreviation built from the
// **initials of the significant words** in a school name:
//
//   "Sirimavo Bandaranayake Vidyalaya, Colombo"  →  SBVC
//      S      B            V           C
//
//   "Royal College, Colombo"                     →  RCC
//   "Ananda College"                             →  AC
//   "Nalanda"                                    →  NAL   (single word, first 3)
//   "St. Thomas' College, Mount Lavinia"         →  STCM  (St, Thomas, College, Mount)
//
// The same letter can mean different things in different schools
// (C = Colombo here, C = Central elsewhere), so we keep BOTH:
//   • SCHOOL_CODES       — the authoritative lookup we've catalogued
//   • SCHOOL_CODE_LETTERS — a display-only best-effort hint for unknown codes
// -----------------------------------------------------------------------------

/** Fully-catalogued school codes → friendly display name. */
export const SCHOOL_CODES: Record<string, string> = {
  SBVC: "Sirimavo Bandaranayake Vidyalaya, Colombo",

  // Add more as you catalogue them. Examples:
  // RCC:  "Royal College, Colombo",
  // AC:   "Ananda College, Colombo",
  // NC:   "Nalanda College, Colombo",
  // DCK:  "Dharmaraja College, Kandy",
  // MVC:  "Mahamaya Girls' College, Kandy",
  // TCM:  "Trinity College, Kandy",
};

/**
 * Display-only letter dictionary — a best-effort hint when a code is
 * not in SCHOOL_CODES. Never used for validation.
 */
export const SCHOOL_CODE_LETTERS: Record<string, string> = {
  S: "Sirimavo",
  B: "Bandaranayake",
  V: "Vidyalaya",
  C: "Colombo",
  R: "Royal",
  A: "Ananda",
  N: "Nalanda",
  K: "Kandy",
  M: "Maha",
  D: "Dharmaraja",
  T: "Trinity",
  // Extend as you catalogue more schools
};

// -----------------------------------------------------------------------------
// Name  →  Code  (used when GENERATING a non-AISSA ID)
// -----------------------------------------------------------------------------

/**
 * Build a school code from a free-text school name by taking the first
 * letter of each significant word:
 *   - Splits on whitespace, commas, periods, ampersands, hyphens, slashes
 *   - Single-word names fall back to their first 3 letters (padded with X)
 *   - Multi-word names take initials of up to 5 words (min 2 letters)
 */
export function abbreviateSchool(schoolName: string): string {
  const words = (schoolName ?? "")
    .split(/[\s,.&\-/]+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter((w) => w.length > 0);

  if (words.length === 0) return "SCH";

  if (words.length === 1) {
    const single = words[0].slice(0, 3).toUpperCase();
    return single.padEnd(3, "X");
  }

  const initials = words
    .slice(0, 5)
    .map((w) => w[0].toUpperCase())
    .join("");

  return initials.length >= 2 ? initials : initials.padEnd(2, "X");
}

// -----------------------------------------------------------------------------
// Code  →  Name  (used when DISPLAYING a member ID)
// -----------------------------------------------------------------------------

/** Exact lookup — returns the catalogued name, or the raw code if unknown. */
export function expandSchoolCode(code: string): string {
  if (!code) return "";
  const upper = code.toUpperCase();
  return SCHOOL_CODES[upper] ?? upper;
}

/**
 * Best-effort expansion from the letter dictionary for codes we haven't
 * catalogued yet. Example: "SBVC" → "Sirimavo Bandaranayake Vidyalaya Colombo".
 * Falls back to the raw code if no letter matches.
 */
export function guessSchoolFromCode(code: string): string {
  if (!code) return "";
  const upper = code.toUpperCase();

  const exact = SCHOOL_CODES[upper];
  if (exact) return exact;

  const expanded = Array.from(upper)
    .map((ch) => SCHOOL_CODE_LETTERS[ch] ?? "")
    .filter(Boolean)
    .join(" ");

  return expanded || upper;
}