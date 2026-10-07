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
  Monitor,
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
type SubjectKey = "all" | "physics" | "chemistry" | "biology" | "ict";
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
  is_admin?: boolean | null;
  subjects?: string | null;
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

type DashboardBundle = {
  profile?: Profile | null;
  stats?: StudentStats | null;
  subject_stats?: SubjectStats[] | null;
  past_results?: PastQuizRow[] | null;
  live_quizzes?: Quiz[] | null;
  error?: string;
};

// ------------------------------------------------------------
// Helpers (unchanged)
// ------------------------------------------------------------
function allowedSubjectsForStream(
  stream: string | null | undefined,
  subjectsRaw?: string | null,
): RealSubjectKey[] {
  if (subjectsRaw && subjectsRaw.trim()) {
    const codes = subjectsRaw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is RealSubjectKey =>
        ["physics", "chemistry", "biology", "ict"].includes(s),
      );
    if (codes.length > 0) return codes;
  }

  const s = (stream ?? "").toLowerCase();
  if (s.includes("bio")) return ["physics", "chemistry", "biology"];
  if (s.includes("physical") || s.includes("maths"))
    return ["physics", "chemistry"];
  return ["physics", "chemistry", "biology"];
}

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
  if (s.includes("ict") || s.includes("information")) return "bg-cyan-50 text-cyan-700 border-cyan-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
}

function subjectKeyOf(subject: string | null | undefined): RealSubjectKey | null {
  const s = (subject ?? "").toLowerCase();
  if (s.includes("physics")) return "physics";
  if (s.includes("chemistry")) return "chemistry";
  if (s.includes("biology")) return "biology";
  if (s.includes("ict") || s.includes("information")) return "ict";
  return null;
}

function subjectLabel(k: RealSubjectKey): string {
  if (k === "physics") return "Physics";
  if (k === "chemistry") return "Chemistry";
  if (k === "biology") return "Biology";
  if (k === "ict") return "ICT";
  return "Subject";
}

function subjectIcon(k: SubjectKey) {
  if (k === "physics") return <Atom className="w-3.5 h-3.5" />;
  if (k === "chemistry") return <FlaskConical className="w-3.5 h-3.5" />;
  if (k === "biology") return <Dna className="w-3.5 h-3.5" />;
  if (k === "ict") return <Monitor className="w-3.5 h-3.5" />;
  return <BookOpen className="w-3.5 h-3.5" />;
}

function subjectTabClass(k: SubjectKey, isActive: boolean): string {
  const base =
    "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-bold transition whitespace-nowrap shrink-0";
  if (!isActive) return `${base} text-gray-600 hover:bg-gray-100`;
  if (k === "physics") return `${base} bg-blue-600 text-white shadow-sm`;
  if (k === "chemistry") return `${base} bg-purple-600 text-white shadow-sm`;
  if (k === "biology") return `${base} bg-emerald-600 text-white shadow-sm`;
  if (k === "ict") return `${base} bg-cyan-600 text-white shadow-sm`;
  return `${base} bg-slate-800 text-white shadow-sm`;
}

function canStudentSeeQuiz(
  studentStream: string | null | undefined,
  studentSubjects: string | null | undefined,
  quizSubject: string | null | undefined,
): boolean {
  if (!quizSubject) return true;
  const key = subjectKeyOf(quizSubject);
  if (!key) return true;
  return allowedSubjectsForStream(studentStream, studentSubjects).includes(key);
}

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

    const { data: bundleRaw, error: bundleError } = await supabase.rpc(
      "get_dashboard_data",
    );

    if (bundleError) {
      console.error("[dashboard] get_dashboard_data error:", bundleError);
      setGuardError("Dashboard load කිරීමේදී දෝෂයක්: " + bundleError.message);
      setLoading(false);
      return;
    }

    const bundle = (bundleRaw ?? {}) as DashboardBundle;

    if (bundle.error === "unauthorized" || !bundle.profile) {
      await supabase.auth.signOut();
      router.replace("/auth/login?reason=no_profile");
      return;
    }

    setProfile(bundle.profile);

    if (bundle.profile.is_admin) {
      setDebugWarning(
        "ඔබ Admin ගිණුමක් — Admin ලා leaderboard සහ stats වලින් ඉවත් කරලා තියෙන නිසා ඔබේ stats 0 ලෙස පෙන්වයි.",
      );
    }

    setStats(bundle.stats ?? null);

    if (Array.isArray(bundle.subject_stats)) {
      const map: Record<string, SubjectStats> = {};
      for (const row of bundle.subject_stats) {
        const key = subjectKeyOf(row.subject);
        if (key) map[key] = row;
      }
      setSubjectStats(map);
    } else {
      setSubjectStats({});
    }

    if (Array.isArray(bundle.past_results)) {
      const merged: PastQuizRow[] = bundle.past_results.map((r) => ({
        id: r.id,
        quiz_id: r.quiz_id,
        score: r.score ?? 0,
        total_marks: r.total_marks ?? 0,
        time_spent_seconds: r.time_spent_seconds ?? 0,
        submitted_at: r.submitted_at,
        quizzes: r.quizzes ?? null,
      }));
      setPastQuizzes(merged);
    } else {
      setPastQuizzes([]);
    }

    setQuizzes(Array.isArray(bundle.live_quizzes) ? bundle.live_quizzes : []);

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

  const allowedSubjects = useMemo<RealSubjectKey[]>(
    () => allowedSubjectsForStream(profile?.stream, profile?.subjects),
    [profile?.stream, profile?.subjects],
  );

  const subjectBreakdown = useMemo(() => {
    const empty = { count: 0, avgPct: 0 };
    const acc: Record<RealSubjectKey, typeof empty> = {
      physics: { ...empty },
      chemistry: { ...empty },
      biology: { ...empty },
      ict: { ...empty },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 flex flex-col items-center justify-center gap-4 text-gray-500 text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loading-screen.png"
          alt="AISSA"
          className="w-20 h-20 sm:w-32 sm:h-32 object-contain animate-pulse"
        />
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
          Loading Dashboard...
        </div>
      </div>
    );
  }

  if (guardError) {
    return (
      <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/60 p-6 text-center space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/aissa-logo.png"
            alt="AISSA"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain mx-auto opacity-90"
          />
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <p className="text-red-600 font-medium text-sm">{guardError}</p>
          </div>
          <Link
            href="/auth/login"
            className="inline-block text-sm font-semibold text-emerald-600 hover:underline"
          >
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
    if (!canStudentSeeQuiz(profile?.stream, profile?.subjects, q.subject)) continue;

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
        <div className="max-w-6xl mx-auto space-y-4 sm:space-y-8">
          {/* ============ Welcome Banner — MOBILE-TIGHTENED ============ */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-slate-700/50">
            <div
              className="absolute inset-0 opacity-[0.15] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-teal-400/10" />
            <div className="pointer-events-none absolute top-1/2 -right-24 w-72 h-72 rounded-full border-[1.5px] border-teal-400/10 hidden md:block" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/5" />

            <div className="relative p-4 sm:p-6 md:p-8">
              {/* Top row: logo + greeting */}
              <div className="flex items-start gap-3 sm:gap-6">
                {/* ✨ AISSA Logo — smaller on mobile */}
                <div className="shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
                    <div className="relative w-14 h-14 sm:w-28 sm:h-28 flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src="/aissa-logo.png"
                        alt="AISSA Logo"
                        className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(45,212,191,0.5)]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
                      <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-pulse" />
                      AISSA Quiz Engine
                    </span>
                  </div>

                  <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold mt-2 sm:mt-2.5 leading-tight tracking-tight">
                    ආයුබෝවන්, {profile?.full_name || "Student"}! 👋
                  </h1>

                  <div className="text-slate-300 text-[11px] sm:text-sm mt-1.5 sm:mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 wrap-break-word max-w-full truncate">
                      <span className="w-1.5 h-1.5 bg-teal-400/80 rounded-full shrink-0" />
                      {profile?.school || "—"}
                    </span>
                    <span className="text-white/30 hidden sm:inline">|</span>
                    <span className="truncate">{profile?.stream || "Bio Science"}</span>
                    {profile?.medium && (
                      <span
                        className="inline-flex items-center px-1.5 sm:px-2 py-0.5 bg-teal-500/15 backdrop-blur-sm rounded-md text-[9px] sm:text-[11px] font-bold uppercase tracking-wide border border-teal-400/30 text-teal-200"
                        title={mediumFullLabel(profile.medium)}
                      >
                        {mediumLabel(profile.medium)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Leaderboard button — full width on mobile, right-aligned on desktop */}
              <Link
                href="/student/leaderboard"
                className="mt-4 sm:mt-5 w-full sm:w-auto sm:absolute sm:top-6 sm:right-6 md:top-8 md:right-8 px-4 sm:px-5 py-2.5 sm:py-3 bg-teal-500 text-slate-900 font-bold rounded-xl hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 text-xs sm:text-sm group"
              >
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 group-hover:rotate-12 transition-transform" />
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

          {/* ============ Stats — 4 cards, 2-col on mobile ============ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <StatCard
              icon={<BookOpen className="w-4 h-4 sm:w-6 sm:h-6" />}
              color="blue"
              label="Quizzes කළා"
              labelFull="සම්පූර්ණ කළ Quizzes"
              value={String(stats?.quizzes_completed ?? 0)}
            />
            <StatCard
              icon={<Target className="w-4 h-4 sm:w-6 sm:h-6" />}
              color="emerald"
              label="මුළු ලකුණු"
              labelFull="මුළු ලකුණු"
              value={String(stats?.total_score ?? 0)}
            />
            <StatCard
              icon={<Timer className="w-4 h-4 sm:w-6 sm:h-6" />}
              color="teal"
              label="මුළු කාලය"
              labelFull="මුළු කාලය"
              value={formatTotalTime(stats?.total_time_seconds)}
            />
            <BestSubjectCard best={bestSubject} />
          </div>

          {/* ============ Subject Mini Cards ============ */}
          <div
            className={`grid grid-cols-2 ${
              allowedSubjects.length >= 3
                ? "sm:grid-cols-2 lg:grid-cols-3"
                : "sm:grid-cols-2"
            } gap-2.5 sm:gap-4`}
          >
            {allowedSubjects.map((key) => (
              <SubjectMiniCard
                key={key}
                subjectKey={key}
                stats={subjectStats[key] ?? null}
              />
            ))}
          </div>

          {/* ============ Average strip — MOBILE-TIGHTENED ============ */}
          <div className="bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-white/70 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium">
                  සාමාන්‍ය ලකුණු මට්ටම (All Subjects)
                </p>
                <p className="text-sm sm:text-base font-bold text-gray-800">
                  {hasAttempts ? averageScoreText : "—"}
                </p>
              </div>
            </div>
            <p className="text-[10px] sm:text-[11px] text-gray-400 sm:text-right sm:max-w-xs leading-tight">
              Subject ranking එක subject එකක් ඇතුළේ — මුළු ලකුණු එකතුව මත · සම ලකුණු විට වේගවත් කෙනා ඉහළට.
            </p>
          </div>

          {/* ============ ACTIVE quizzes ============ */}
          <section className="space-y-3 sm:space-y-4">
            <div className="flex justify-between items-center gap-2">
              <h2 className="text-sm sm:text-xl font-bold text-gray-800 flex items-center gap-1.5 sm:gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" /> Active Live Quizzes
              </h2>
              {activeQuizzes.length > 0 && (
                <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                  {activeQuizzes.length} <span className="hidden sm:inline">සක්‍රියයි</span>
                </span>
              )}
            </div>
            {activeQuizzes.length === 0 ? (
              <div className="p-4 sm:p-6 bg-white/80 backdrop-blur-md rounded-xl text-center text-gray-500 border border-white/70 shadow-sm text-xs sm:text-sm">
                දැන් කිසිම Live Quiz එකක් නොමැත.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                {activeQuizzes.map((quiz) => (
                  <ActiveQuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            )}
          </section>

          {/* ============ UPCOMING ============ */}
          {upcomingQuizzes.length > 0 && (
            <section className="space-y-3 sm:space-y-4">
              <h2 className="text-sm sm:text-xl font-bold text-gray-800 flex items-center gap-1.5 sm:gap-2">
                <Hourglass className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" /> ඉදිරි Quizzes
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                {upcomingQuizzes.map((quiz) => (
                  <UpcomingQuizCard key={quiz.id} quiz={quiz} />
                ))}
              </div>
            </section>
          )}

          {/* ============ PAST quizzes — MOBILE-TIGHTENED ============ */}
          <section className="space-y-3 sm:space-y-4 pt-1 sm:pt-2">
            <h2 className="text-sm sm:text-xl font-bold text-gray-800 flex items-center gap-1.5 sm:gap-2">
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" /> පසුගිය ප්‍රතිඵල
            </h2>

            {pastQuizzes.length === 0 ? (
              <div className="p-5 sm:p-8 bg-white/80 backdrop-blur-md rounded-xl text-center text-gray-400 text-xs sm:text-sm border border-white/70 shadow-sm">
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

                <div className="bg-white/80 backdrop-blur-md px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border border-white/70 shadow-sm flex flex-wrap items-center gap-x-3 sm:gap-x-5 gap-y-1.5 sm:gap-y-2 text-[11px] sm:text-sm">
                  {selectedSubject === "all" ? (
                    <>
                      <span className="font-bold text-gray-900">All Subjects</span>
                      <span className="text-gray-500">
                        <strong className="text-gray-800">{pastQuizzes.length}</strong>{" "}
                        quiz{pastQuizzes.length === 1 ? "" : "zes"}
                      </span>
                      <span className="text-gray-500">
                        Avg:{" "}
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
                        Avg:{" "}
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
                      <span className="text-gray-400 text-[11px] sm:text-xs">
                        තවම මෙම subject එකට ප්‍රතිඵල නොමැත.
                      </span>
                    </>
                  )}
                </div>

                <div className="bg-white/80 backdrop-blur-md rounded-xl border border-white/70 shadow-sm overflow-hidden">
                  {visiblePastQuizzes.length === 0 ? (
                    <div className="p-5 sm:p-8 text-center text-gray-400 text-xs sm:text-sm">
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

                      {/* Mobile cards — tighter */}
                      <div className="md:hidden relative">
                        <div className="divide-y divide-gray-100 overflow-y-auto max-h-[70vh]">
                          {visiblePastQuizzes.map((pq) => {
                            const pct =
                              pq.total_marks > 0
                                ? Math.round((pq.score / pq.total_marks) * 100)
                                : 0;
                            return (
                              <div key={pq.id} className="p-3 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <span
                                      className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mb-1 ${subjectStyle(
                                        pq.quizzes?.subject,
                                      )}`}
                                    >
                                      {pq.quizzes?.subject ?? "—"}
                                    </span>
                                    <span className="block text-sm font-semibold text-gray-900 leading-snug">
                                      {pq.quizzes?.title ?? "Untitled quiz"}
                                    </span>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-extrabold text-emerald-600 leading-none">
                                      {pq.score}/{pq.total_marks}
                                    </p>
                                    <span
                                      className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
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
                                </div>
                                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] text-gray-500">
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3 shrink-0" />
                                      {formatDate(pq.submitted_at)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3 shrink-0" />
                                      {formatDuration(pq.time_spent_seconds)}
                                    </span>
                                  </div>
                                  <Link
                                    href={`/student/quiz/${pq.quiz_id}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:underline shrink-0"
                                  >
                                    Review <ArrowRight className="w-3 h-3" />
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-white/95 via-white/60 to-transparent" />
                      </div>

                      <div className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-50/80 border-t border-gray-100 text-[10px] sm:text-[11px] text-gray-500 text-center">
                        ප්‍රතිඵල{" "}
                        <strong className="text-gray-700">
                          {visiblePastQuizzes.length}
                        </strong>
                        ක් පෙන්වයි
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
// Building blocks — MOBILE-TIGHTENED
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  color,
  label,
  labelFull,
  value,
}: {
  icon: React.ReactNode;
  color: "blue" | "emerald" | "teal" | "amber";
  label: string;
  labelFull: string;
  value: string;
}) {
  const colorMap: Record<typeof color, string> = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    teal: "bg-teal-50 text-teal-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white/80 backdrop-blur-md p-2.5 sm:p-5 rounded-xl border border-white/70 shadow-sm flex items-center gap-2 sm:gap-4 hover:shadow-md transition">
      <div className={`p-1.5 sm:p-3 rounded-lg shrink-0 ${colorMap[color]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] sm:text-xs text-gray-500 font-medium leading-tight">
          <span className="hidden sm:inline">{labelFull}</span>
          <span className="sm:hidden">{label}</span>
        </p>
        <p className="text-base sm:text-xl font-bold text-gray-800 truncate leading-tight">
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
        ict: {
          icon: "bg-cyan-50 text-cyan-600",
          label: "text-cyan-800",
        },
      }[best.key]
    : null;

  return (
    <div className="bg-white/80 backdrop-blur-md p-2.5 sm:p-5 rounded-xl border border-white/70 shadow-sm flex items-center gap-2 sm:gap-4 hover:shadow-md transition">
      <div
        className={`p-1.5 sm:p-3 rounded-lg shrink-0 ${
          theme ? theme.icon : "bg-amber-50 text-amber-600"
        }`}
      >
        <Award className="w-4 h-4 sm:w-6 sm:h-6" />
      </div>
      <div className="min-w-0">
        <p className="text-[9px] sm:text-xs text-gray-500 font-medium leading-tight">
          <span className="hidden sm:inline">හොඳම විෂය (Best Subject)</span>
          <span className="sm:hidden">හොඳම විෂය</span>
        </p>
        {best ? (
          <>
            <p
              className={`text-sm sm:text-xl font-bold truncate leading-tight ${theme?.label ?? "text-gray-800"}`}
            >
              {subjectLabel(best.key)}
            </p>
            <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
              #{best.rank} · {best.avgPct}%
            </p>
          </>
        ) : (
          <p className="text-sm sm:text-xl font-bold text-gray-400">—</p>
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
    ict: {
      wrap: "border-cyan-200/70",
      icon: "bg-cyan-50 text-cyan-600",
      label: "text-cyan-800",
      rank: "text-cyan-700",
      score: "text-cyan-900",
    },
  }[subjectKey];

  const hasStats = stats && stats.quizzes_completed > 0;

  return (
    <div
      className={`bg-white/80 backdrop-blur-md p-2.5 sm:p-4 rounded-xl border ${theme.wrap} shadow-sm space-y-2 sm:space-y-2.5 hover:shadow-md transition`}
    >
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className={`p-1 sm:p-1.5 rounded-md ${theme.icon}`}>
          {subjectIcon(subjectKey)}
        </div>
        <span
          className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-wide ${theme.label}`}
        >
          {subjectLabel(subjectKey)}
        </span>
      </div>

      {hasStats ? (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            <div className="bg-gray-50/80 rounded-lg p-1.5 sm:p-2">
              <p className="text-[8px] sm:text-[9px] uppercase font-bold text-gray-500 tracking-wider leading-none">
                Rank
              </p>
              <p className={`text-sm sm:text-base font-extrabold mt-0.5 leading-tight ${theme.rank}`}>
                #{stats.subject_rank}
              </p>
            </div>
            <div className="bg-gray-50/80 rounded-lg p-1.5 sm:p-2">
              <p className="text-[8px] sm:text-[9px] uppercase font-bold text-gray-500 tracking-wider leading-none">
                Marks
              </p>
              <p className={`text-sm sm:text-base font-extrabold mt-0.5 leading-tight ${theme.score}`}>
                {stats.total_score}
                <span className="text-[10px] sm:text-xs font-semibold text-gray-400">
                  /{stats.total_marks}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] sm:text-xs text-gray-500 pt-0.5">
            <span>
              {stats.quizzes_completed} quiz
              {stats.quizzes_completed === 1 ? "" : "z"}
            </span>
            <span className="font-bold text-emerald-700">
              {stats.average_score != null ? `${stats.average_score}%` : "—"}
            </span>
          </div>
        </>
      ) : (
        <div className="py-2 sm:py-3 text-center text-gray-400 text-[10px] sm:text-xs">
          සහභාගී වී නැත.
        </div>
      )}
    </div>
  );
}

function ActiveQuizCard({ quiz }: { quiz: Quiz }) {
  const endsIn = useLiveCountdown(() => msUntilEnd(quiz), [quiz]);

  return (
    <div className="bg-white/80 backdrop-blur-md p-3 sm:p-6 rounded-xl border border-emerald-200/70 shadow-sm space-y-2.5 sm:space-y-4 hover:shadow-md transition">
      <div className="flex justify-between items-start gap-2">
        <span
          className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold rounded-md border ${subjectStyle(
            quiz.subject,
          )}`}
        >
          {quiz.subject}
        </span>
        <span className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 shrink-0">
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {quiz.duration_minutes}m
        </span>
      </div>
      <div>
        <h3 className="text-sm sm:text-lg font-bold text-gray-900 leading-snug line-clamp-2">
          {quiz.title}
        </h3>
        <p className="text-[11px] sm:text-xs text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
          <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> {quiz.total_questions} ප්‍රශ්න
          {quiz.stream ? ` • ${quiz.stream}` : ""}
        </p>
      </div>
      {endsIn && (
        <div className="text-[10px] sm:text-[11px] font-bold text-red-600 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-500 rounded-full animate-pulse" />
          අවසන් වන තෙක්: {endsIn}
        </div>
      )}
      <Link
        href={`/student/quiz/${quiz.id}`}
        className="w-full py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex justify-center items-center gap-1.5 sm:gap-2 transition text-xs sm:text-sm shadow-sm"
      >
        Quiz එක ආරම්භ කරන්න <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </Link>
    </div>
  );
}

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
    <div className="bg-white/80 backdrop-blur-md p-3 sm:p-6 rounded-xl border border-amber-200/70 shadow-sm space-y-2.5 sm:space-y-4 opacity-90">
      <div className="flex justify-between items-start gap-2">
        <span
          className={`px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold rounded-md border ${subjectStyle(
            quiz.subject,
          )}`}
        >
          {quiz.subject}
        </span>
        <span className="flex items-center gap-1 text-[10px] sm:text-xs text-gray-500 shrink-0">
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> {quiz.duration_minutes}m
        </span>
      </div>
      <div>
        <h3 className="text-sm sm:text-lg font-bold text-gray-900 leading-snug line-clamp-2">
          {quiz.title}
        </h3>
        <p className="text-[11px] sm:text-xs text-gray-500 mt-1 flex items-center gap-1 flex-wrap">
          <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> {quiz.total_questions} ප්‍රශ්න
          {quiz.stream ? ` • ${quiz.stream}` : ""}
        </p>
      </div>
      <div className="text-[10px] sm:text-[11px] font-bold text-amber-700 flex items-center gap-1.5">
        <Hourglass className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
        {startsIn ? `ආරම්භ වන තෙක්: ${startsIn}` : `ආරම්භය: ${startTime}`}
      </div>
      <button
        type="button"
        disabled
        className="w-full py-2 sm:py-2.5 bg-gray-200/80 text-gray-500 font-semibold rounded-lg flex justify-center items-center gap-1.5 sm:gap-2 cursor-not-allowed text-xs sm:text-sm"
      >
        <Hourglass className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> තවම ආරම්භ වී නෑ
      </button>
    </div>
  );
}