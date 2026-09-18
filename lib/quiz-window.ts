// lib/quiz-window.ts
// -----------------------------------------------------------------------------
// Time-window helpers for quizzes.
//
// A quiz is:
//   • "upcoming"    → now < scheduled_at
//   • "active"      → scheduled_at <= now < scheduled_at + duration_minutes
//   • "expired"     → now >= scheduled_at + duration_minutes
//   • "unscheduled" → no valid scheduled_at (treated as active fallback)
// -----------------------------------------------------------------------------

export type QuizWindowStatus = "upcoming" | "active" | "expired" | "unscheduled";

interface QuizWindowInput {
  scheduled_at: string | null;
  duration_minutes: number;
}

export function getQuizStartTime(quiz: QuizWindowInput): Date | null {
  if (!quiz.scheduled_at) return null;
  const d = new Date(quiz.scheduled_at);
  return isNaN(d.getTime()) ? null : d;
}

export function getQuizEndTime(quiz: QuizWindowInput): Date | null {
  const start = getQuizStartTime(quiz);
  if (!start) return null;
  return new Date(start.getTime() + quiz.duration_minutes * 60 * 1000);
}

export function getQuizWindowStatus(quiz: QuizWindowInput): QuizWindowStatus {
  const start = getQuizStartTime(quiz);
  if (!start) return "unscheduled"; // no schedule → treat as always available

  const end = start.getTime() + quiz.duration_minutes * 60 * 1000;
  const now = Date.now();

  if (now < start.getTime()) return "upcoming";
  if (now < end) return "active";
  return "expired";
}

/** Milliseconds until the quiz opens (positive) or since it opened (negative). */
export function msUntilStart(quiz: QuizWindowInput): number | null {
  const start = getQuizStartTime(quiz);
  if (!start) return null;
  return start.getTime() - Date.now();
}

/** Milliseconds until the quiz closes. Negative once it's expired. */
export function msUntilEnd(quiz: QuizWindowInput): number | null {
  const end = getQuizEndTime(quiz);
  if (!end) return null;
  return end.getTime() - Date.now();
}

/** Compact human-readable duration: "2h 14m" / "45m 30s" / "12s". */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "0s";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}