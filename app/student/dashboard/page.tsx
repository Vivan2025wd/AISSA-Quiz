"use client";

import React, { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import {
  getQuizWindowStatus,
  msUntilEnd,
  msUntilStart,
  formatCountdown,
} from "@/lib/quiz-window";

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
};

type StudentStats = {
  quizzes_completed: number | null;
  total_score: number | null;
  total_time_seconds: number | null;
  average_score: number | null;
  island_rank: number | null;
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

export default function StudentDashboard() {
  const router = useRouter();

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [pastQuizzes, setPastQuizzes] = useState<PastQuizRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [guardError, setGuardError] = useState<string | null>(null);

  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth/login");
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, school, stream")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setGuardError("Profile එක load කිරීමේදී දෝෂයක් ඇති විය.");
      setLoading(false);
      return;
    }

    if (!profileData) {
      await supabase.auth.signOut();
      router.replace("/auth/login?reason=no_profile");
      return;
    }

    setProfile(profileData);

    const { data: statsData } = await supabase.rpc("get_student_stats", {
      p_student_id: user.id,
    });
    if (statsData && statsData.length > 0) setStats(statsData[0]);

    const { data: resultsData } = await supabase
      .from("quiz_results")
      .select(
        "id, quiz_id, score, total_marks, time_spent_seconds, submitted_at, quizzes(title, subject, stream)",
      )
      .eq("student_id", user.id)
      .order("submitted_at", { ascending: false });

    if (resultsData) {
      setPastQuizzes(resultsData as unknown as PastQuizRow[]);
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

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>
    );
  }

  if (guardError) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <p className="text-red-600 font-medium">{guardError}</p>
        <Link href="/auth/login" className="text-sm text-blue-600 hover:underline">
          ← නැවත Login වෙත
        </Link>
      </div>
    );
  }

  const hasAttempts = (stats?.quizzes_completed ?? 0) > 0;
  const averageScoreText =
    typeof stats?.average_score === "number" ? `${stats.average_score}%` : "N/A";

  const activeQuizzes: Quiz[] = [];
  const upcomingQuizzes: Quiz[] = [];
  for (const q of quizzes) {
    const status = getQuizWindowStatus(q);
    if (status === "active" || status === "unscheduled") activeQuizzes.push(q);
    else if (status === "upcoming") upcomingQuizzes.push(q);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5 sm:space-y-8">
        {/* ============ Welcome Banner ============ */}
        <div className="bg-linear-to-r from-blue-700 to-indigo-800 text-white p-5 sm:p-6 md:p-8 rounded-2xl shadow-md flex flex-col gap-4">
          <div>
            <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[10px] sm:text-xs font-semibold uppercase tracking-wide">
              AISSA Quiz Engine
            </span>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold mt-2 leading-tight">
              ආයුබෝවන්, {profile?.full_name || "Student"}! 👋
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm mt-1 wrap-break-word">
              {profile?.school || "—"} • {profile?.stream || "Bio Science"}
            </p>
          </div>
          <Link
            href="/student/leaderboard"
            className="self-start px-4 sm:px-5 py-2.5 bg-white text-blue-900 font-bold rounded-xl hover:bg-blue-50 transition shadow-sm flex items-center gap-2 text-xs sm:text-sm"
          >
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" /> Leaderboard
          </Link>
        </div>

        {/* ============ Stats — 2 cols on mobile, 4 on desktop ============ */}
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
            color="indigo"
            label="මුළු කාලය"
            value={formatTotalTime(stats?.total_time_seconds)}
          />
          <StatCard
            icon={<Trophy className="w-5 h-5 sm:w-6 sm:h-6" />}
            color="amber"
            label="Island Rank"
            value={
              hasAttempts && stats?.island_rank != null
                ? `#${stats.island_rank}`
                : "—"
            }
          />
        </div>

        {/* ============ Average strip ============ */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 text-green-600 rounded-lg shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">
                සාමාන්‍ය ලකුණු මට්ටම
              </p>
              <p className="text-base font-bold text-gray-800">
                {hasAttempts ? averageScoreText : "—"}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 sm:text-right sm:max-w-xs leading-tight">
            Leaderboard ranking මුළු ලකුණු එකතුව මත — සම ලකුණු විට වේගවත් කෙනා ඉහළට.
          </p>
        </div>

        {/* ============ ACTIVE quizzes ============ */}
        <section className="space-y-3 sm:space-y-4">
          <div className="flex justify-between items-center gap-2">
            <h2 className="text-base sm:text-xl font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600 shrink-0" /> Active Live Quizzes
            </h2>
            {activeQuizzes.length > 0 && (
              <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 sm:px-3 py-1 rounded-full whitespace-nowrap">
                {activeQuizzes.length} සක්‍රියයි
              </span>
            )}
          </div>

          {activeQuizzes.length === 0 ? (
            <div className="p-5 sm:p-6 bg-white rounded-xl text-center text-gray-500 border border-gray-200 text-sm">
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
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" /> පසුගිය ප්‍රතිඵල
          </h2>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {pastQuizzes.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-gray-400 text-sm">
                තවම Quiz කිසිවක් සම්පූර්ණ කර නැත.
              </div>
            ) : (
              <>
                {/* ---- DESKTOP table (md+) ---- */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-sm text-gray-600">
                    <thead className="bg-gray-50 border-b text-gray-700 font-semibold uppercase text-xs">
                      <tr>
                        <th className="p-4">Subject & Topic</th>
                        <th className="p-4">දිනය</th>
                        <th className="p-4">ලකුණු</th>
                        <th className="p-4">කාලය</th>
                        <th className="p-4 text-right">Answers</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pastQuizzes.map((pq) => (
                        <tr key={pq.id} className="hover:bg-gray-50">
                          <td className="p-4 font-medium text-gray-900">
                            <span className="block text-xs text-blue-600 font-semibold">
                              {pq.quizzes?.subject ?? "—"}
                            </span>
                            {pq.quizzes?.title ?? "Untitled quiz"}
                          </td>
                          <td className="p-4">{formatDate(pq.submitted_at)}</td>
                          <td className="p-4 font-bold text-green-600">
                            {pq.score}/{pq.total_marks}
                          </td>
                          <td className="p-4">
                            {formatDuration(pq.time_spent_seconds)}
                          </td>
                          <td className="p-4 text-right">
                            <Link
                              href={`/student/quiz/${pq.quiz_id}`}
                              className="text-xs font-bold text-blue-600 hover:underline"
                            >
                              Review →
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ---- MOBILE cards (<md) ---- */}
                <div className="md:hidden divide-y divide-gray-100">
                  {pastQuizzes.map((pq) => (
                    <div key={pq.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[11px] text-blue-600 font-semibold block">
                            {pq.quizzes?.subject ?? "—"}
                          </span>
                          <span className="text-sm font-semibold text-gray-900 block leading-snug">
                            {pq.quizzes?.title ?? "Untitled quiz"}
                          </span>
                        </div>
                        <span className="text-sm font-extrabold text-green-600 whitespace-nowrap shrink-0">
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
                      </div>

                      <Link
                        href={`/student/quiz/${pq.quiz_id}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                      >
                        Review Answers <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
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
  color: "blue" | "emerald" | "indigo" | "amber";
  label: string;
  value: string;
}) {
  const colorMap: Record<typeof color, string> = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    indigo: "bg-indigo-50 text-indigo-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div className="bg-white p-3 sm:p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2 sm:gap-4">
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

function ActiveQuizCard({ quiz }: { quiz: Quiz }) {
  const msLeft = msUntilEnd(quiz);
  const endsIn = msLeft != null ? formatCountdown(msLeft) : null;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-emerald-200 shadow-sm space-y-3 sm:space-y-4 hover:shadow-md transition">
      <div className="flex justify-between items-start gap-2">
        <span className="px-2.5 sm:px-3 py-1 bg-blue-50 text-blue-700 text-[11px] sm:text-xs font-bold rounded-md">
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
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex justify-center items-center gap-2 transition text-sm"
      >
        Quiz එක ආරම්භ කරන්න <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

function UpcomingQuizCard({ quiz }: { quiz: Quiz }) {
  const msWait = msUntilStart(quiz);
  const startsIn = msWait != null && msWait > 0 ? formatCountdown(msWait) : null;
  const startTime = quiz.scheduled_at
    ? new Date(quiz.scheduled_at).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl border border-amber-200 shadow-sm space-y-3 sm:space-y-4 opacity-90">
      <div className="flex justify-between items-start gap-2">
        <span className="px-2.5 sm:px-3 py-1 bg-blue-50 text-blue-700 text-[11px] sm:text-xs font-bold rounded-md">
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
        className="w-full py-2.5 bg-gray-200 text-gray-500 font-semibold rounded-lg flex justify-center items-center gap-2 cursor-not-allowed text-sm"
      >
        <Hourglass className="w-4 h-4" /> තවම ආරම්භ වී නැත
      </button>
    </div>
  );
}