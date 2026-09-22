"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Clock,
  Calendar,
  BookOpen,
  Trophy,
  ArrowRight,
  CheckCircle,
  BarChart3,
  Target,
  Timer,
  AlertTriangle,
  Hourglass,
  FlaskConical,
  Atom,
  Dna,
  Award,
  RefreshCw,
  GraduationCap,
} from "lucide-react";
import {
  getQuizWindowStatus,
  msUntilEnd,
  msUntilStart,
  formatCountdown,
} from "@/lib/quiz-window";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
type Medium = "sinhala" | "english" | "tamil";
type SubjectKey = "all" | "physics" | "chemistry" | "biology";
type RealSubjectKey = Exclude<SubjectKey, "all">;

type Quiz = {
  id: string;
  title: string;
  subject?: string | null;
  stream?: string | null;
  duration_minutes: number;
  total_questions?: number | null;
  is_live?: boolean | null;
  scheduled_at: string | null;
  created_at?: string | null;
};

type Profile = {
  id?: string;
  full_name?: string | null;
  school?: string | null;
  stream?: string | null;
  medium?: Medium | null;
};

type StudentStats = {
  quizzes_completed: number | null;
  total_score: number | null;
  total_time_seconds: number | null;
  average_score: number | null;
  island_rank: number | null;
};

type SubjectStats = {
  subject: string;
  quizzes_completed: number;
  total_score: number;
  total_marks: number;
  total_time_seconds: number;
  average_score: number | null;
  subject_rank: number;
};

type PastQuizRow = {
  id: string;
  quiz_id: string;
  score: number;
  total_marks: number;
  time_spent_seconds: number;
  submitted_at: string;
  quizzes: {
    title: string;
    subject: string | null;
    stream: string | null;
  } | null;
};

type ResultRow = {
  id: string;
  quiz_id: string;
  score: number | null;
  total_marks: number | null;
  time_spent_seconds: number | null;
  submitted_at: string;
};

type QuizRow = {
  id: string;
  title: string | null;
  subject: string | null;
  stream: string | null;
};

// ------------------------------------------------------------
// Stream → Subject rules
// ------------------------------------------------------------
function allowedSubjectsForStream(
  stream: string | null | undefined,
): RealSubjectKey[] {
  const s = (stream ?? "").toLowerCase();
  if (s.includes("bio")) return ["physics", "chemistry", "biology"];
  if (s.includes("physical") || s.includes("maths"))
    return ["physics", "chemistry"];
  return ["physics", "chemistry", "biology"];
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatTotalTime(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function mediumLabel(medium: Medium | null | undefined): string {
  if (medium === "english") return "EN";
  if (medium === "tamil") return "தமிழ்";
  return "සිං";
}

function mediumFullLabel(medium: Medium | null | undefined): string {
  if (medium === "english") return "English Medium";
  if (medium === "tamil") return "Tamil Medium";
  return "Sinhala Medium";
}

function subjectStyle(subject: string | null | undefined): string {
  const s = (subject ?? "").toLowerCase();
  if (s.includes("physics")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (s.includes("chemistry")) return "bg-purple-50 text-purple-700 border-purple-200";
  if (s.includes("biology")) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function subjectKeyOf(subject: string | null | undefined): RealSubjectKey | null {
  const s = (subject ?? "").toLowerCase();
  if (s.includes("physics")) return "physics";
  if (s.includes("chemistry")) return "chemistry";
  if (s.includes("biology")) return "biology";
  return null;
}

function subjectLabel(k: RealSubjectKey): string {
  if (k === "physics") return "Physics";
  if (k === "chemistry") return "Chemistry";
  return "Biology";
}

function subjectIcon(k: SubjectKey) {
  if (k === "physics") return <Atom className="w-3.5 h-3.5" />;
  if (k === "chemistry") return <FlaskConical className="w-3.5 h-3.5" />;
  if (k === "biology") return <Dna className="w-3.5 h-3.5" />;
  return <BookOpen className="w-3.5 h-3.5" />;
}

function subjectTabClass(k: SubjectKey, isActive: boolean): string {
  const base =
    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0";
  if (!isActive) return `${base} text-gray-600 hover:bg-gray-100`;
  if (k === "physics") return `${base} bg-blue-600 text-white shadow-sm`;
  if (k === "chemistry") return `${base} bg-purple-600 text-white shadow-sm`;
  if (k === "biology") return `${base} bg-emerald-600 text-white shadow-sm`;
  return `${base} bg-slate-800 text-white shadow-sm`;
}

function canStudentSeeQuiz(
  studentStream: string | null | undefined,
  quizSubject: string | null | undefined,
): boolean {
  if (!quizSubject) return true;
  const key = subjectKeyOf(quizSubject);
  if (!key) return true;
  return allowedSubjectsForStream(studentStream).includes(key);
}

// ------------------------------------------------------------
// 🔥 NEW: live countdown hook
// Re-computes a countdown string every second, so the value
// stays fresh WITHOUT the parent needing to re-render.
// ------------------------------------------------------------
function useLiveCountdown(
  computeMs: () => number | null,
  deps: React.DependencyList,
): string | null {
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const update = () => {
      if (cancelled) return;
      const ms = computeMs();
      setDisplay(ms != null && ms > 0 ? formatCountdown(ms) : null);
    };

    update();
    const i = setInterval(update, 1000);
    return () => {
      cancelled = true;
      clearInterval(i);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return display;
}

// ------------------------------------------------------------
// Main component
// ------------------------------------------------------------
export default function StudentDashboard() {
  const router = useRouter();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [subjectStats, setSubjectStats] = useState<Record<string, SubjectStats>>({});
  const [pastQuizzes, setPastQuizzes] = useState<PastQuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardError, setGuardError] = useState<string | null>(null);
  const [debugWarning, setDebugWarning] = useState<string | null>(null);

  const [selectedSubject, setSelectedSubject] = useState<SubjectKey>("all");

  // Parent re-render every 10s — used so quizzes actually MOVE
  // from "upcoming" → "active" → "expired" without a manual refresh.
  // (The per-second countdown text itself is handled inside the
  // ActiveQuizCard / UpcomingQuizCard components, so we don't
  // re-render the whole page every second.)
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    setDebugWarning(null);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) console.error("[dashboard] auth.getUser error:", authError);

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, school, stream, medium, is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setGuardError("Profile එක load කිරීමේදී දෝෂයක් ඇති විය: " + profileError.message);
      setLoading(false);
      return;
    }

    if (!profileData) {
      await supabase.auth.signOut();
      router.replace("/auth/login?reason=no_profile");
      return;
    }

    setProfile(profileData as Profile);

    if ((profileData as { is_admin?: boolean }).is_admin) {
      setDebugWarning(
        "ඔබ Admin ගිණුමක් — Admin ලා leaderboard සහ stats වලින් ඉවත් කරලා තියෙන නිසා ඔබේ stats 0 ලෙස පෙන්වයි.",
      );
    }

    const { data: statsData, error: statsError } = await supabase.rpc(
      "get_student_stats",
      { p_student_id: user.id },
    );

    if (statsError) {
      console.error("[dashboard] get_student_stats error:", statsError);
      setDebugWarning((prev) => prev ?? "Stats load කිරීමේදී දෝෂයක්: " + statsError.message);
    } else if (statsData && statsData.length > 0) {
      setStats(statsData[0]);
    }

    const { data: subjectStatsData, error: subjectStatsError } = await supabase.rpc(
      "get_student_subject_stats",
      { p_student_id: user.id },
    );

    if (subjectStatsError) {
      console.error("[dashboard] get_student_subject_stats error:", subjectStatsError);
    } else if (subjectStatsData) {
      const map: Record<string, SubjectStats> = {};
      for (const row of subjectStatsData as SubjectStats[]) {
        const key = subjectKeyOf(row.subject);
        if (key) map[key] = row;
      }
      setSubjectStats(map);
    }

    const { data: resultsRaw, error: resultsError } = await supabase
      .from("quiz_results")
      .select("id, quiz_id, score, total_marks, time_spent_seconds, submitted_at")
      .eq("student_id", user.id)
      .order("submitted_at", { ascending: false });

    if (resultsError) {
      console.error("[dashboard] quiz_results error:", resultsError);
    }

    const results = (resultsRaw as ResultRow[] | null) ?? [];

    if (results.length > 0) {
      const quizIds = Array.from(new Set(results.map((r) => r.quiz_id)));

      const { data: quizzesRaw, error: quizzesError } = await supabase
        .from("quizzes")
        .select("id, title, subject, stream")
        .in("id", quizIds);

      if (quizzesError) console.error("[dashboard] quizzes lookup error:", quizzesError);

      const quizMap = new Map<string, QuizRow>();
      (quizzesRaw as QuizRow[] | null)?.forEach((q) => quizMap.set(q.id, q));

      const merged: PastQuizRow[] = results.map((r) => {
        const q = quizMap.get(r.quiz_id);
        return {
          id: r.id,
          quiz_id: r.quiz_id,
          score: r.score ?? 0,
          total_marks: r.total_marks ?? 0,
          time_spent_seconds: r.time_spent_seconds ?? 0,
          submitted_at: r.submitted_at,
          quizzes: q
            ? {
                title: q.title ?? "Untitled quiz",
                subject: q.subject ?? null,
                stream: q.stream ?? null,
              }
            : null,
        };
      });

      setPastQuizzes(merged);
    } else {
      setPastQuizzes([]);
    }

    const { data: quizData } = await supabase
      .from("quizzes")
      .select(
        "id, title, subject, stream, duration_minutes, total_questions, is_live, scheduled_at, created_at",
      )
      .eq("is_live", true)
      .order("scheduled_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    setQuizzes((quizData as Quiz[]) ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  // ------------------------------------------------------------
  // Derived
  // ------------------------------------------------------------
  const allowedSubjects = useMemo<RealSubjectKey[]>(
    () => allowedSubjectsForStream(profile?.stream),
    [profile?.stream],
  );

  const subjectBreakdown = useMemo(() => {
    const empty = { count: 0, avgPct: 0 };
    const acc: Record<RealSubjectKey, typeof empty> = {
      physics: { ...empty },
      chemistry: { ...empty },
      biology: { ...empty },
    };

    for (const row of pastQuizzes) {
      const key = subjectKeyOf(row.quizzes?.subject);
      if (!key) continue;
      acc[key].count += 1;
    }

    for (const k of Object.keys(acc) as RealSubjectKey[]) {
      const st = subjectStats[k];
      acc[k].avgPct = st?.average_score ?? 0;
    }

    return { bySubject: acc };
  }, [pastQuizzes, subjectStats]);

  const bestSubject = useMemo<{
    key: RealSubjectKey;
    avgPct: number;
    rank: number;
  } | null>(() => {
    const entries = allowedSubjects
      .map((k) => {
        const st = subjectStats[k];
        if (!st || st.quizzes_completed === 0) return null;
        return {
          key: k,
          avgPct: st.average_score ?? 0,
          rank: st.subject_rank,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (entries.length === 0) return null;
    entries.sort((a, b) => b.avgPct - a.avgPct);
    return entries[0];
  }, [subjectStats, allowedSubjects]);

  const visiblePastQuizzes = useMemo(() => {
    if (selectedSubject === "all") return pastQuizzes;
    return pastQuizzes.filter(
      (pq) => subjectKeyOf(pq.quizzes?.subject) === selectedSubject,
    );
  }, [pastQuizzes, selectedSubject]);

  // ------------------------------------------------------------
  // Render states
  // ------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center gap-2 text-gray-500 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" /> Loading Dashboard...
      </div>
    );
  }

  if (guardError) {
    return (
      <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/60 p-6 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-red-600 font-medium">{guardError}</p>
          <Link href="/auth/login" className="text-sm text-emerald-600 hover:underline">
            ← නැවත Login වෙත
          </Link>
        </div>
      </div>
    );
  }

  const hasAttempts = (stats?.quizzes_completed ?? 0) > 0;
  const averageScoreText =
    typeof stats?.average_score === "number" ? `${stats.average_score}%` : "N/A";

  const activeQuizzes: Quiz[] = [];
  const upcomingQuizzes: Quiz[] = [];
  for (const q of quizzes) {
    if (!canStudentSeeQuiz(profile?.stream, q.subject)) continue;

    const status = getQuizWindowStatus(q);
    if (status === "active" || status === "unscheduled") activeQuizzes.push(q);
    else if (status === "upcoming") upcomingQuizzes.push(q);
  }

  const subjectTabs: { key: SubjectKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: pastQuizzes.length },
    ...allowedSubjects.map((k) => ({
      key: k as SubjectKey,
      label: subjectLabel(k),
      count: subjectBreakdown.bySubject[k].count,
    })),
  ];

  const currentSubjectStats: SubjectStats | null =
    selectedSubject === "all"
      ? null
      : subjectStats[selectedSubject] ?? null;

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 relative">
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/50 rounded-full filter blur-3xl" />
      <div
        className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 rounded-full filter blur-3xl"
        style={{ animationDelay: "2s" }}
      />
      <div className="pointer-events-none fixed top-[35%] right-[15%] w-72 h-72 bg-green-100/60 rounded-full filter blur-3xl" />

      <div className="relative p-3 sm:p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-5 sm:space-y-8">
          {/* ============ Welcome Banner ============ */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl shadow-emerald-900/20">
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-teal-300/25 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-white/5" />
            <div className="pointer-events-none absolute top-1/2 -right-24 w-72 h-72 rounded-full border-[1.5px] border-white/10 hidden md:block" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/8" />

            <div className="relative p-5 sm:p-6 md:p-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-300/40 blur-xl rounded-full" />
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-white/15 backdrop-blur-md rounded-2xl border border-white/25 shadow-lg flex items-center justify-center overflow-hidden">
                    <GraduationCap className="w-9 h-9 sm:w-11 sm:h-11 text-white drop-shadow" />
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-white/15">
                    <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />
                    AISSA Quiz Engine
                  </span>
                </div>

                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold mt-2.5 leading-tight tracking-tight">
                  ආයුබෝවන්, {profile?.full_name || "Student"}! 👋
                </h1>

                <div className="text-emerald-50/90 text-xs sm:text-sm mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <span className="inline-flex items-center gap-1.5 wrap-break-word">
                    <span className="w-1.5 h-1.5 bg-emerald-300/80 rounded-full" />
                    {profile?.school || "—"}
                  </span>
                  <span className="text-white/30">|</span>
                  <span>{profile?.stream || "Bio Science"}</span>
                  {profile?.medium && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 bg-white/15 backdrop-blur-sm rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wide border border-white/15"
                      title={mediumFullLabel(profile.medium)}
                    >
                      {mediumLabel(profile.medium)}
                    </span>
                  )}
                </div>
              </div>

              <Link
                href="/student/leaderboard"
                className="relative self-stretch sm:self-auto sm:shrink-0 px-4 sm:px-5 py-3 bg-white text-emerald-900 font-bold rounded-xl hover:bg-emerald-50 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm group"
              >
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500 group-hover:rotate-12 transition-transform" />
                Leaderboard
                <ArrowRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

          {debugWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{debugWarning}</span>
            </div>
          )}

          {/* ============ Stats — 4 cards ============ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              icon={<BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />}
              color="blue"
              label="සම්පූර්ණ කළ Quizzes"
              value={String(stats?.quizzes_completed ?? 0)}
            />
            <StatCard
              icon={<Target className="w-5 h-5 sm:w-6 sm:h-6" />}
              color="emerald"
              label="මුළු ලකුණු"
              value={String(stats?.total_score ?? 0)}
            />
            <StatCard
              icon={<Timer className="w-5 h-5 sm:w-6 sm:h-6" />}
              color="teal"
              label="මුළු කාලය"
              value={formatTotalTime(stats?.total_time_seconds)}
            />
            <BestSubjectCard best={bestSubject} />
          </div>

          {/* ============ Subject Mini Cards ============ */}
          <div
            className={`grid grid-cols-1 ${
              allowedSubjects.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
            } gap-3 sm:gap-4`}
          >
            {allowedSubjects.map((key) => (
              <SubjectMiniCard
                key={key}
                subjectKey={key}
                stats={subjectStats[key] ?? null}
              />
            ))}
          </div>

          {/* ============ Average strip ============ */}
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl border border-white/70 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 font-medium">
                  සාමාන්‍ය ලකුණු මට්ටම (All Subjects)
                </p>
                <p className="text-base font-bold text-gray-800">
                  {hasAttempts ? averageScoreText : "—"}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 sm:text-right sm:max-w-xs leading-tight">
              Subject ranking එක subject එකක් ඇතුළේ — මුළු ලකුණු එකතුව මත · සම ලකුණු විට වේගවත් කෙනා ඉහළට.
            </p>
          </div>

          {/* ============ ACTIVE quizzes ============ */}
          <section className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center gap-2">
              <h2 className="text-base sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600 shrink-0" /> Active Live Quizzes
              </h2>
              {activeQuizzes.length > 0 && (
                <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
                  {activeQuizzes.length} සක්‍රියයි
                </span>
              )}
            </div>
            {activeQuizzes.length === 0 ? (
              <div className="p-5 sm:p-6 bg-white/80 backdrop-blur-md rounded-xl text-center text-gray-500 border border-white/70 shadow-sm text-sm">
                දැන් කිසිම Live Quiz එකක් නොමැත.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {activeQuizzes.map((quiz) => (
                  <ActiveQuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            )}
          </section>

          {/* ============ UPCOMING ============ */}
          {upcomingQuizzes.length > 0 && (
            <section className="space-y-3 sm:space-y-4">
              <h2 className="text-base sm:text-xl font-bold text-gray-800 flex items-center gap-2">
                <Hourglass className="w-5 h-5 text-amber-600 shrink-0" /> ඉදිරි Quizzes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {upcomingQuizzes.map((quiz) => (
                  <UpcomingQuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            </section>
          )}

          {/* ============ PAST quizzes ============ */}
          <section className="space-y-3 sm:space-y-4 pt-2">
            <h2 className="text-base sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" /> පසුගිය ප්‍රතිඵල
            </h2>

            {pastQuizzes.length === 0 ? (
              <div className="p-6 sm:p-8 bg-white/80 backdrop-blur-md rounded-xl text-center text-gray-400 text-sm border border-white/70 shadow-sm">
                තවම Quiz කිසිවක් සම්පූර්ණ කර නැත.
              </div>
            ) : (
              <>
                <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-xl border border-white/70 shadow-sm flex gap-1 overflow-x-auto">
                  {subjectTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSelectedSubject(tab.key)}
                      className={subjectTabClass(tab.key, selectedSubject === tab.key)}
                    >
                      {subjectIcon(tab.key)}
                      <span>{tab.label}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                          selectedSubject === tab.key
                            ? "bg-white/25 text-white"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="bg-white/80 backdrop-blur-md px-4 py-3 rounded-xl border border-white/70 shadow-sm flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm">
                  {selectedSubject === "all" ? (
                    <>
                      <span className="font-bold text-gray-900">All Subjects</span>
                      <span className="text-gray-500">
                        <strong className="text-gray-800">{pastQuizzes.length}</strong>{" "}
                        quiz{pastQuizzes.length === 1 ? "" : "zes"} completed
                      </span>
                      <span className="text-gray-500">
                        Average:{" "}
                        <strong className="text-emerald-700">
                          {hasAttempts ? averageScoreText : "—"}
                        </strong>
                      </span>
                    </>
                  ) : currentSubjectStats ? (
                    <>
                      <span className="font-bold text-gray-900 flex items-center gap-1.5">
                        {subjectIcon(selectedSubject)}
                        {subjectLabel(selectedSubject as RealSubjectKey)}
                      </span>
                      <span className="text-gray-500">
                        Rank:{" "}
                        <strong className="text-teal-700">
                          #{currentSubjectStats.subject_rank}
                        </strong>
                      </span>
                      <span className="text-gray-500">
                        Marks:{" "}
                        <strong className="text-blue-700">
                          {currentSubjectStats.total_score}/
                          {currentSubjectStats.total_marks}
                        </strong>
                      </span>
                      <span className="text-gray-500">
                        Average:{" "}
                        <strong className="text-emerald-700">
                          {currentSubjectStats.average_score != null
                            ? `${currentSubjectStats.average_score}%`
                            : "—"}
                        </strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold text-gray-900 flex items-center gap-1.5">
                        {subjectIcon(selectedSubject)}
                        {subjectLabel(selectedSubject as RealSubjectKey)}
                      </span>
                      <span className="text-gray-400 text-xs">
                        තවම මෙම subject එකට ප්‍රතිඵල නොමැත.
                      </span>
                    </>
                  )}
                </div>

                <div className="bg-white/80 backdrop-blur-md rounded-xl border border-white/70 shadow-sm overflow-hidden">
                  {visiblePastQuizzes.length === 0 ? (
                    <div className="p-6 sm:p-8 text-center text-gray-400 text-sm">
                      මෙම subject එකට තවම ප්‍රතිඵල නොමැත.
                    </div>
                  ) : (
                    <>
                      <div className="hidden md:block relative">
                        <div className="overflow-x-auto overflow-y-auto max-h-125 lg:max-h-140">
                          <table className="w-full text-left text-sm text-gray-600">
                            <thead className="sticky top-0 z-10 bg-emerald-50 shadow-[0_1px_0_0_#a7f3d0] text-emerald-900 font-semibold uppercase text-xs">
                              <tr>
                                <th className="p-4">Subject & Topic</th>
                                <th className="p-4">දිනය</th>
                                <th className="p-4">ලකුණු</th>
                                <th className="p-4">%</th>
                                <th className="p-4">කාලය</th>
                                <th className="p-4 text-right">Answers</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {visiblePastQuizzes.map((pq) => {
                                const pct =
                                  pq.total_marks > 0
                                    ? Math.round((pq.score / pq.total_marks) * 100)
                                    : 0;
                                return (
                                  <tr key={pq.id} className="hover:bg-emerald-50/40 transition">
                                    <td className="p-4 font-medium text-gray-900">
                                      <span
                                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border mb-1 ${subjectStyle(
                                          pq.quizzes?.subject,
                                        )}`}
                                      >
                                        {pq.quizzes?.subject ?? "—"}
                                      </span>
                                      <span className="block">
                                        {pq.quizzes?.title ?? "Untitled quiz"}
                                      </span>
                                    </td>
                                    <td className="p-4">{formatDate(pq.submitted_at)}</td>
                                    <td className="p-4 font-bold text-emerald-600">
                                      {pq.score}/{pq.total_marks}
                                    </td>
                                    <td className="p-4">
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                          pct >= 75
                                            ? "bg-emerald-100 text-emerald-800"
                                            : pct >= 50
                                              ? "bg-blue-100 text-blue-800"
                                              : pct >= 35
                                                ? "bg-amber-100 text-amber-800"
                                                : "bg-red-100 text-red-800"
                                        }`}
                                      >
                                        {pct}%
                                      </span>
                                    </td>
                                    <td className="p-4">
                                      {formatDuration(pq.time_spent_seconds)}
                                    </td>
                                    <td className="p-4 text-right">
                                      <Link
                                        href={`/student/quiz/${pq.quiz_id}`}
                                        className="text-xs font-bold text-emerald-600 hover:underline"
                                      >
                                        Review →
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-white/95 via-white/60 to-transparent" />
                      </div>

                      <div className="md:hidden relative">
                        <div className="divide-y divide-gray-100 overflow-y-auto max-h-[70vh]">
                          {visiblePastQuizzes.map((pq) => {
                            const pct =
                              pq.total_marks > 0
                                ? Math.round((pq.score / pq.total_marks) * 100)
                                : 0;
                            return (
                              <div key={pq.id} className="p-4 space-y-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <span
                                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border mb-1 ${subjectStyle(
                                        pq.quizzes?.subject,
                                      )}`}
                                    >
                                      {pq.quizzes?.subject ?? "—"}
                                    </span>
                                    <span className="block text-sm font-semibold text-gray-900 leading-snug">
                                      {pq.quizzes?.title ?? "Untitled quiz"}
                                    </span>
                                  </div>
                                  <span className="text-sm font-extrabold text-emerald-600 whitespace-nowrap shrink-0">
                                    {pq.score}/{pq.total_marks}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {formatDate(pq.submitted_at)}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDuration(pq.time_spent_seconds)}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      pct >= 75
                                        ? "bg-emerald-100 text-emerald-800"
                                        : pct >= 50
                                          ? "bg-blue-100 text-blue-800"
                                          : pct >= 35
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-red-100 text-red-800"
                                    }`}
                                  >
                                    {pct}%
                                  </span>
                                </div>
                                <Link
                                  href={`/student/quiz/${pq.quiz_id}`}
                                  className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 hover:underline"
                                >
                                  Review Answers <ArrowRight className="w-3 h-3" />
                                </Link>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-white/95 via-white/60 to-transparent" />
                      </div>

                      <div className="px-4 py-2.5 bg-gray-50/80 border-t border-gray-100 text-[11px] text-gray-500 text-center">
                        ප්‍රතිඵල{" "}
                        <strong className="text-gray-700">
                          {visiblePastQuizzes.length}
                        </strong>
                        ක් පෙන්වයි · scroll කරලා බලන්න
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  color,
  label,
  value,
}: {
  icon: React.ReactNode;
  color: "blue" | "emerald" | "teal" | "amber";
  label: string;
  value: string;
}) {
  const colorMap: Record<typeof color, string> = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white/80 backdrop-blur-md p-3 sm:p-5 rounded-xl border border-white/70 shadow-sm flex items-center gap-2 sm:gap-4 hover:shadow-md transition">
      <div className={`p-2 sm:p-3 rounded-lg shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs text-gray-500 font-medium leading-tight">
          {label}
        </p>
        <p className="text-base sm:text-xl font-bold text-gray-800 truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

function BestSubjectCard({
  best,
}: {
  best: {
    key: RealSubjectKey;
    avgPct: number;
    rank: number;
  } | null;
}) {
  const theme = best
    ? {
        physics: {
          icon: "bg-blue-50 text-blue-600",
          label: "text-blue-800",
        },
        chemistry: {
          icon: "bg-purple-50 text-purple-600",
          label: "text-purple-800",
        },
        biology: {
          icon: "bg-emerald-50 text-emerald-600",
          label: "text-emerald-800",
        },
      }[best.key]
    : null;

  return (
    <div className="bg-white/80 backdrop-blur-md p-3 sm:p-5 rounded-xl border border-white/70 shadow-sm flex items-center gap-2 sm:gap-4 hover:shadow-md transition">
      <div
        className={`p-2 sm:p-3 rounded-lg shrink-0 ${
          theme ? theme.icon : "bg-amber-50 text-amber-600"
        }`}
      >
        <Award className="w-5 h-5 sm:w-6 sm:h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] sm:text-xs text-gray-500 font-medium leading-tight">
          හොඳම විෂය (Best Subject)
        </p>
        {best ? (
          <>
            <p
              className={`text-base sm:text-xl font-bold truncate ${theme?.label ?? "text-gray-800"}`}
            >
              {subjectLabel(best.key)}
            </p>
            <p className="text-[10px] text-gray-400">
              #{best.rank} · Avg {best.avgPct}%
            </p>
          </>
        ) : (
          <p className="text-base sm:text-xl font-bold text-gray-400">—</p>
        )}
      </div>
    </div>
  );
}

function SubjectMiniCard({
  subjectKey,
  stats,
}: {
  subjectKey: RealSubjectKey;
  stats: SubjectStats | null;
}) {
  const theme = {
    physics: {
      wrap: "border-blue-200/70",
      icon: "bg-blue-50 text-blue-600",
      label: "text-blue-800",
      rank: "text-blue-700",
      score: "text-blue-900",
    },
    chemistry: {
      wrap: "border-purple-200/70",
      icon: "bg-purple-50 text-purple-600",
      label: "text-purple-800",
      rank: "text-purple-700",
      score: "text-purple-900",
    },
    biology: {
      wrap: "border-emerald-200/70",
      icon: "bg-emerald-50 text-emerald-600",
      label: "text-emerald-800",
      rank: "text-emerald-700",
      score: "text-emerald-900",
    },
  }[subjectKey];

  const hasStats = stats && stats.quizzes_completed > 0;

  return (
    <div
      className={`bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border ${theme.wrap} shadow-sm space-y-2.5 hover:shadow-md transition`}
    >
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${theme.icon}`}>
          {subjectIcon(subjectKey)}
        </div>
        <span
          className={`text-[11px] sm:text-xs font-extrabold uppercase tracking-wide ${theme.label}`}
        >
          {subjectLabel(subjectKey)}
        </span>
      </div>

      {hasStats ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50/80 rounded-lg p-2">
              <p className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">
                Rank
              </p>
              <p className={`text-base font-extrabold ${theme.rank}`}>
                #{stats.subject_rank}
              </p>
            </div>
            <div className="bg-gray-50/80 rounded-lg p-2">
              <p className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">
                Total Marks
              </p>
              <p className={`text-base font-extrabold ${theme.score}`}>
                {stats.total_score}
                <span className="text-xs font-semibold text-gray-400">
                  /{stats.total_marks}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-500 pt-0.5">
            <span>
              {stats.quizzes_completed} quiz
              {stats.quizzes_completed === 1 ? "" : "zes"}
            </span>
            <span className="font-bold text-emerald-700">
              Avg {stats.average_score != null ? `${stats.average_score}%` : "—"}
            </span>
          </div>
        </>
      ) : (
        <div className="py-3 text-center text-gray-400 text-xs">
          තවම මෙම subject එකට සහභාගී වී නැත.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🔥 ActiveQuizCard — now has its own 1s countdown timer
// ---------------------------------------------------------------------------
function ActiveQuizCard({ quiz }: { quiz: Quiz }) {
  // Live-updating "ends in ..." string, refreshed every second
  // without needing the parent dashboard to re-render.
  const endsIn = useLiveCountdown(() => msUntilEnd(quiz), [quiz]);

  return (
    <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-xl border border-emerald-200/70 shadow-sm space-y-3 sm:space-y-4 hover:shadow-md transition">
      <div className="flex justify-between items-start gap-2">
        <span
          className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold rounded-md border ${subjectStyle(
            quiz.subject,
          )}`}
        >
          {quiz.subject}
        </span>
        <span className="flex items-center gap-1 text-[11px] sm:text-xs text-gray-500 shrink-0">
          <Clock className="w-3.5 h-3.5" /> {quiz.duration_minutes}m
        </span>
      </div>
      <div>
        <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
          {quiz.title}
        </h3>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
          <BookOpen className="w-3.5 h-3.5" /> {quiz.total_questions} ප්‍රශ්න
          {quiz.stream ? ` • ${quiz.stream}` : ""}
        </p>
      </div>
      {endsIn && (
        <div className="text-[11px] font-bold text-red-600 flex items-center gap-1.5">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          අවසන් වන තෙක්: {endsIn}
        </div>
      )}
      <Link
        href={`/student/quiz/${quiz.id}`}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex justify-center items-center gap-2 transition text-sm shadow-sm"
      >
        Quiz එක ආරම්භ කරන්න <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🔥 UpcomingQuizCard — now has its own 1s countdown timer
// ---------------------------------------------------------------------------
function UpcomingQuizCard({ quiz }: { quiz: Quiz }) {
  const startsIn = useLiveCountdown(() => msUntilStart(quiz), [quiz]);

  const startTime = quiz.scheduled_at
    ? new Date(quiz.scheduled_at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-xl border border-amber-200/70 shadow-sm space-y-3 sm:space-y-4 opacity-90">
      <div className="flex justify-between items-start gap-2">
        <span
          className={`px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-bold rounded-md border ${subjectStyle(
            quiz.subject,
          )}`}
        >
          {quiz.subject}
        </span>
        <span className="flex items-center gap-1 text-[11px] sm:text-xs text-gray-500 shrink-0">
          <Clock className="w-3.5 h-3.5" /> {quiz.duration_minutes}m
        </span>
      </div>
      <div>
        <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
          {quiz.title}
        </h3>
        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
          <BookOpen className="w-3.5 h-3.5" /> {quiz.total_questions} ප්‍රශ්න
          {quiz.stream ? ` • ${quiz.stream}` : ""}
        </p>
      </div>
      <div className="text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
        <Hourglass className="w-3.5 h-3.5" />
        {startsIn ? `ආරම්භ වන තෙක්: ${startsIn}` : `ආරම්භය: ${startTime}`}
      </div>
      <button
        type="button"
        disabled
        className="w-full py-2.5 bg-gray-200/80 text-gray-500 font-semibold rounded-lg flex justify-center items-center gap-2 cursor-not-allowed text-sm"
      >
        <Hourglass className="w-4 h-4" /> තවම ආරම්භ වී නැත
      </button>
    </div>
  );
}