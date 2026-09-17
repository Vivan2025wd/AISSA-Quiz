// lib/aissa-id.ts
// -----------------------------------------------------------------------------
// Utilities for parsing / validating AISSA member IDs (R-prefix) and
// generating non-member quiz IDs (N-prefix).
// -----------------------------------------------------------------------------

export const AISSA_DISTRICT_CODES = [
  "AWC", "AWK", "AUS", "AS", "AC", "ANCW", "ANE", "AWG",
] as const;

export type AissaDistrictCode = (typeof AISSA_DISTRICT_CODES)[number];

/** Human-friendly labels for UI dropdowns. */
export const AISSA_DISTRICT_LABELS: Record<AissaDistrictCode, string> = {
  AWC:  "AWC ",
  AWK:  "AWK ",
  AUS:  "AUS ",
  AS:   "AS ",
  AC:   "AC ",
  ANCW: "ANCW ",
  ANE:  "ANE ",
  AWG:  "AWG ",
};

// -----------------------------------------------------------------------------
// AISSA member ID (R-prefix): R<YY><STUDENT>-<SCHOOL>-<DISTRICT>
// Example: R26THENUMI-SBVC-AWC
// -----------------------------------------------------------------------------
const AISSA_ID_REGEX = /^R(\d{2})([A-Z0-9]+)-([A-Z0-9]+)-([A-Z]{2,4})$/i;

export interface ParsedAissaId {
  raw: string;
  prefix: "R";
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

export function isAissaDistrictCode(
  code: string,
): code is AissaDistrictCode {
  return (AISSA_DISTRICT_CODES as readonly string[]).includes(
    code.toUpperCase(),
  );
}

export function validateAissaId(input: string): IdValidationResult {
  const value = (input ?? "").trim().toUpperCase();
  if (!value) {
    return { valid: false, error: "AISSA ID එක ඇතුළත් කරන්න." };
  }

  const match = value.match(AISSA_ID_REGEX);
  if (!match) {
    return {
      valid: false,
      error: "AISSA ID ආකෘතිය වැරදිය. උදා: R26THENUMI-SBVC-AWC",
    };
  }

  const [, batchYear, studentCode, schoolCode, districtCode] = match;
  if (!isAissaDistrictCode(districtCode)) {
    return {
      valid: false,
      error: `"${districtCode}" වලංගු AISSA දිස්ත්‍රික්ක කේතයක් නොවේ. අනුමත කේත: ${AISSA_DISTRICT_CODES.join(", ")}`,
    };
  }

  return {
    valid: true,
    parsed: {
      raw: value,
      prefix: "R",
      batchYear,
      studentCode,
      schoolCode,
      districtCode: districtCode.toUpperCase() as AissaDistrictCode,
    },
  };
}

// -----------------------------------------------------------------------------
// Non-AISSA ID (N-prefix): N<YY><NAME6><RND3>-<SCHOOL3>-<DISTRICT>
// Example: N26VIVAN123-COL-AWC
// -----------------------------------------------------------------------------
const NON_AISSA_REGEX =
  /^N(\d{2})([A-Z]{2,6})(\d{3})-([A-Z0-9]{2,6})-([A-Z]{2,4})$/;

function cleanAlpha(s: string): string {
  return (s ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
}

export function abbreviateName(fullName: string): string {
  const cleaned = cleanAlpha(fullName);
  return cleaned ? cleaned.slice(0, 6) : "STUDENT";
}

export function abbreviateSchool(school: string): string {
  const cleaned = cleanAlpha(school);
  if (!cleaned) return "SCH";
  // First three letters of the cleaned school name, padded if too short.
  return cleaned.slice(0, 3).padEnd(3, "X");
}

export interface GenerateNonAissaOptions {
  /** Override the year code (last two digits). Defaults to current year. */
  year?: number;
  /** Deterministic random 3-digit value (100–999) — handy for tests. */
  randomSeed?: number;
}

export function generateNonAissaId(
  fullName: string,
  school: string,
  district: AissaDistrictCode,
  options: GenerateNonAissaOptions = {},
): string {
  const year = (options.year ?? new Date().getFullYear())
    .toString()
    .padStart(4, "0")
    .slice(-2);

  const namePart = abbreviateName(fullName);
  const schoolPart = abbreviateSchool(school);

  const randomPart =
    options.randomSeed !== undefined
      ? (((options.randomSeed % 900) + 900) % 900 + 100).toString()
      : Math.floor(100 + Math.random() * 900).toString();

  return `N${year}${namePart}${randomPart}-${schoolPart}-${district}`;
}

export function validateNonAissaId(input: string): IdValidationResult {
  const value = (input ?? "").trim().toUpperCase();
  const match = value.match(NON_AISSA_REGEX);
  if (!match) {
    return { valid: false, error: "Non-AISSA ID ආකෘතිය වැරදිය." };
  }
  const district = match[5];
  if (!isAissaDistrictCode(district)) {
    return { valid: false, error: "වලංගු නොවන AISSA දිස්ත්‍රික්ක කේතයක්." };
  }
  return { valid: true };
}

/** Accepts either an R-prefixed AISSA ID or an N-prefixed non-member ID. */
export function validateAnyId(input: string): IdValidationResult {
  const value = (input ?? "").trim().toUpperCase();
  if (value.startsWith("R")) return validateAissaId(value);
  if (value.startsWith("N")) return validateNonAissaId(value);
  return {
    valid: false,
    error: "ID එක R (AISSA member) හෝ N (non-member) අක්ෂරයෙන් ආරම්භ විය යුතුය.",
  };
}