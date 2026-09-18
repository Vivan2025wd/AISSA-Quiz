// lib/aissa-id.ts
// -----------------------------------------------------------------------------
// AISSA member IDs:  [R|T|O|M]<YY><STUDENT>-<SCHOOL>-<DISTRICT>
// Non-AISSA quiz IDs: N<YY><NAME><STUDENT_NUMBER>-<SCHOOL>-<DISTRICT>
//
// District codes are AISSA's OWN zones — not Sri Lankan administrative
// districts — so they are used as-is without geographic expansion.
//
// School-code generation lives in `lib/school-codes.ts`.
// -----------------------------------------------------------------------------

import { abbreviateSchool } from "./school-codes";

// ============================================================
// Districts — AISSA zones
// ============================================================
export const AISSA_DISTRICT_CODES = [
  "AWC", "AWK", "AUS", "AS", "AC", "ANCW", "ANE", "AWG",
] as const;

export type AissaDistrictCode = (typeof AISSA_DISTRICT_CODES)[number];

export const AISSA_DISTRICT_LABELS: Record<AissaDistrictCode, string> = {
  AWC:  "AWC",
  AWK:  "AWK",
  AUS:  "AUS",
  AS:   "AS",
  AC:   "AC",
  ANCW: "ANCW",
  ANE:  "ANE",
  AWG:  "AWG",
};

// ============================================================
// AISSA member prefixes — R / T / O / M
// ============================================================
export const AISSA_MEMBER_PREFIXES = ["R", "T", "O", "M"] as const;
export type AissaMemberPrefix = (typeof AISSA_MEMBER_PREFIXES)[number];

// ============================================================
// Types
// ============================================================
export interface ParsedAissaId {
  raw: string;
  prefix: AissaMemberPrefix;
  batchYear: string;
  studentCode: string;
  schoolCode: string;
  districtCode: AissaDistrictCode;
}

export interface IdValidationResult {
  valid: boolean;
  error?: string;
  parsed?: ParsedAissaId;
}

// ============================================================
// Guards
// ============================================================
export function isAissaDistrictCode(code: string): code is AissaDistrictCode {
  return (AISSA_DISTRICT_CODES as readonly string[]).includes(
    code.toUpperCase(),
  );
}

export function isAissaMemberPrefix(ch: string): ch is AissaMemberPrefix {
  return (AISSA_MEMBER_PREFIXES as readonly string[]).includes(
    ch.toUpperCase(),
  );
}

// ============================================================
// AISSA member ID — [RTOM]<YY><STUDENT>-<SCHOOL>-<DISTRICT>
//   Examples: R25THENUMI-SBVC-AWC
//             T26KAMAL-SBVC-AWC
// ============================================================
const AISSA_ID_REGEX =
  /^([RTOM])(\d{2})([A-Z0-9]+)-([A-Z0-9]{2,6})-([A-Z]{2,4})$/i;

export function validateAissaId(input: string): IdValidationResult {
  const value = (input ?? "").trim().toUpperCase();

  if (!value) {
    return { valid: false, error: "AISSA ID එක ඇතුළත් කරන්න." };
  }

  const match = value.match(AISSA_ID_REGEX);
  if (!match) {
    return {
      valid: false,
      error: "AISSA ID ආකෘතිය වැරදිය. උදා: R25THENUMI-SBVC-AWC",
    };
  }

  const [, prefix, batchYear, studentCode, schoolCode, districtCode] = match;

  if (!isAissaMemberPrefix(prefix)) {
    return {
      valid: false,
      error: `"${prefix}" වලංගු AISSA උපසර්ගයක් නොවේ. අනුමත: R, T, O, M`,
    };
  }

  if (!isAissaDistrictCode(districtCode)) {
    return {
      valid: false,
      error: `"${districtCode}" වලංගු AISSA කලාප කේතයක් නොවේ. අනුමත: ${AISSA_DISTRICT_CODES.join(", ")}`,
    };
  }

  return {
    valid: true,
    parsed: {
      raw: value,
      prefix: prefix.toUpperCase() as AissaMemberPrefix,
      batchYear,
      studentCode,
      schoolCode,
      districtCode: districtCode.toUpperCase() as AissaDistrictCode,
    },
  };
}

// ============================================================
// Non-AISSA ID — N<YY><NAME><STUDENT_NUMBER>-<SCHOOL>-<DISTRICT>
//   Example: N25VIVAN001-CCC-AWC
// ============================================================
//   N        prefix
//   25       school year (2 digits)
//   VIVAN    name (2–10 letters, first 6 taken)
//   001      student number from school (1–4 digits, zero-padded to 3)
//   CCC      school code (2–6 chars)
//   AWC      AISSA district
const NON_AISSA_REGEX =
  /^N(\d{2})([A-Z]{2,10})(\d{1,4})-([A-Z0-9]{2,6})-([A-Z]{2,4})$/;

function cleanAlpha(s: string): string {
  return (s ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
}

export function abbreviateName(fullName: string): string {
  const cleaned = cleanAlpha(fullName);
  return cleaned ? cleaned.slice(0, 6) : "STUDENT";
}

/**
 * Normalize a school-provided student number into a 1–4 digit string
 * with leading zeros kept if the user provided them ("1" → "001").
 */
export function normalizeStudentNumber(raw: string): string {
  const digits = (raw ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  // If the user typed a short number, pad to 3 digits; longer is kept as-is
  if (digits.length <= 3) return digits.padStart(3, "0");
  return digits.slice(0, 4);
}

export interface GenerateNonAissaOptions {
  /** Year the student entered their A/L batch — 2025 → "25". Required. */
  year: number;
  /** Student number assigned by their school — "1" or "001" both → "001". */
  studentNumber: string;
}

export function generateNonAissaId(
  fullName: string,
  school: string,
  district: AissaDistrictCode,
  options: GenerateNonAissaOptions,
): string {
  const { year, studentNumber } = options;

  if (!year || year < 2000 || year > 2099) {
    throw new Error("Valid year (2000–2099) is required for Non-AISSA ID.");
  }
  if (!studentNumber) {
    throw new Error("Student number is required for Non-AISSA ID.");
  }

  const yearCode = year.toString().padStart(4, "0").slice(-2);
  const namePart = abbreviateName(fullName);
  const studentPart = normalizeStudentNumber(studentNumber);
  const schoolPart = abbreviateSchool(school);

  return `N${yearCode}${namePart}${studentPart}-${schoolPart}-${district}`;
}

export function validateNonAissaId(input: string): IdValidationResult {
  const value = (input ?? "").trim().toUpperCase();
  const match = value.match(NON_AISSA_REGEX);

  if (!match) {
    return { valid: false, error: "Non-AISSA ID ආකෘතිය වැරදිය." };
  }

  const district = match[5];
  if (!isAissaDistrictCode(district)) {
    return { valid: false, error: "වලංගු නොවන AISSA කලාප කේතයක්." };
  }

  return { valid: true };
}

// ============================================================
// Universal entry — accepts any of R/T/O/M or N
// ============================================================
export function validateAnyId(input: string): IdValidationResult {
  const value = (input ?? "").trim().toUpperCase();

  if (!value) {
    return { valid: false, error: "ID එක ඇතුළත් කරන්න." };
  }

  const first = value[0];
  if (isAissaMemberPrefix(first)) return validateAissaId(value);
  if (first === "N") return validateNonAissaId(value);

  return {
    valid: false,
    error:
      "ID එක R, T, O, M (AISSA member) හෝ N (non-member) අක්ෂරයෙන් ආරම්භ විය යුතුය.",
  };
}