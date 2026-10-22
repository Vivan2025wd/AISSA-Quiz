"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileQuestion,
  Calendar,
  School,
  Users,
  PlusCircle,
  ArrowUpRight,
  Loader2,
  BarChart3,
  Radio,
  RefreshCw,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface Quiz {
  id: string;
  title: string;
  subject: string;
  stream: string;
  scheduled_at: string | null;
  duration_minutes: number;
  total_questions: number;
  is_live: boolean;
  created_at: string;
}

interface DashboardStats {
  totalQuestions: number;
  questionsBySubject: Record<string, number>;
  totalStudents: number;
  activeSchools: number;
}

function formatScheduledTime(iso: string | null) {
  if (!iso) return "සටහන් කර නැත";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "සටහන් කර නැත";
  return d.toLocaleString("si-LK", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboardPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalQuestions: 0,
    questionsBySubject: {},
    totalStudents: 0,
    activeSchools: 0,
  });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select(
          "id, title, subject, stream, scheduled_at, duration_minutes, total_questions, is_live, created_at",
        )
        .eq("is_live", true)
        .order("scheduled_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });

      if (quizError) {
        console.error("Error fetching live quizzes:", quizError);
        setFetchError(
          "Live Quizzes load කිරීමේදී දෝෂයක් ඇති විය: " + quizError.message,
        );
      } else {
        setQuizzes((quizData as Quiz[]) ?? []);
      }

      const { data: questionRows, error: questionError } = await supabase
        .from("questions")
        .select("subject");

      let totalQuestions = 0;
      const questionsBySubject: Record<string, number> = {};

      if (questionError) {
        console.error("Error fetching questions:", questionError);
        setFetchError(
          (prev) =>
            prev ??
            "ප්‍රශ්න load කිරීමේදී දෝෂයක් ඇති විය: " + questionError.message,
        );
      } else if (questionRows) {
        totalQuestions = questionRows.length;
        for (const row of questionRows as { subject: string | null }[]) {
          const subj = row.subject?.trim() || "Other";
          questionsBySubject[subj] = (questionsBySubject[subj] || 0) + 1;
        }
      }

      const { count: studentCount, error: studentError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_admin", false);

      if (studentError) {
        console.error("Error fetching student count:", studentError);
      }

      const { data: schoolRows, error: schoolError } = await supabase
        .from("profiles")
        .select("school")
        .eq("is_admin", false);

      let activeSchools = 0;
      if (schoolError) {
        console.error("Error fetching schools:", schoolError);
      } else if (schoolRows) {
        const unique = new Set<string>();
        for (const r of schoolRows as { school: string | null }[]) {
          const s = r.school?.trim();
          if (!s) continue;
          if (s === "Not Specified" || s === "AISSA Admin") continue;
          unique.add(s);
        }
        activeSchools = unique.size;
      }

      setStats({
        totalQuestions,
        questionsBySubject,
        totalStudents: studentError ? 0 : studentCount ?? 0,
        activeSchools,
      });
    } catch (err) {
      console.error("Unexpected dashboard error:", err);
      setFetchError("Dashboard දත්ත load කිරීමේදී දෝෂයක් ඇති විය.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentTime(Date.now());
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const subjectSummary =
    Object.entries(stats.questionsBySubject)
      .sort((a, b) => b[1] - a[1])
      .map(([subject, count]) => `${subject}: ${count}`)
      .join(" • ") || "දත්ත නැත";

  const now = currentTime ?? 0;
  const liveNow = quizzes.filter((q) => {
    if (!q.scheduled_at) return false;
    const start = new Date(q.scheduled_at).getTime();
    const end = start + q.duration_minutes * 60 * 1000;
    return start <= now && now < end;
  });
  const upcoming = quizzes.filter((q) => {
    if (!q.scheduled_at) return true;
    return new Date(q.scheduled_at).getTime() > now;
  });
  const orderedQuizzes = [...liveNow, ...upcoming];

  const statusBadge = (isLiveNow: boolean) =>
    isLiveNow ? (
      <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-1 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800 whitespace-nowrap">
        <Radio className="w-3 h-3 animate-pulse" /> Live
      </span>
    ) : (
      <span className="inline-block text-[10px] sm:text-[11px] font-bold px-2 sm:px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-md border border-amber-200 dark:border-amber-800 whitespace-nowrap">
        Scheduled
      </span>
    );

  if (loading && quizzes.length === 0 && stats.totalQuestions === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-gray-500 dark:text-gray-400 text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loading-screen.png"
          alt="AISSA"
          className="w-20 h-20 sm:w-32 sm:h-32 object-contain animate-pulse"
        />
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
          Loading Admin Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">

      {/* ============ Header Banner — MOBILE-TIGHTENED ============ */}
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

        <div className="relative p-4 sm:p-6 md:p-7">
          {/* Header row: logo + title + refresh */}
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/aissa-logo.png"
                    alt="AISSA Logo"
                    className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(45,212,191,0.5)]"
                  />
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5">
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
                  <GraduationCap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  AISSA
                </span>
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-500/20 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200">
                  <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Admin
                </span>
              </div>
              <h1 className="text-base sm:text-xl md:text-2xl font-extrabold leading-tight tracking-tight">
                Admin Control Center
              </h1>
              <p className="text-slate-300 text-[11px] sm:text-xs mt-1 leading-snug">
                AISSA Quiz Engine ප්‍රශ්න බැංකුව සහ Quiz සටහන පාලනය කරන්න.
              </p>
            </div>

            {/* Refresh — compact on mobile */}
            <button
              onClick={() => void fetchDashboardData()}
              disabled={loading}
              className="shrink-0 p-2 sm:px-3 sm:py-2 bg-teal-500/15 hover:bg-teal-500/25 backdrop-blur-md text-teal-200 text-xs font-bold rounded-xl flex items-center gap-2 transition border border-teal-400/30 disabled:opacity-60"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Action buttons — 2-col grid on mobile, 3-col on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 sm:mt-5">
            <Link
              href="/admin/questions"
              className="col-span-2 sm:col-span-1 px-3 sm:px-4 py-2.5 bg-teal-500 text-slate-900 hover:bg-teal-400 text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-teal-500/20 hover:scale-[1.01]"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">නව ප්‍රශ්නයක්</span>
            </Link>

            <Link
              href="/admin/quizzes"
              className="px-2 sm:px-4 py-2.5 bg-teal-500/15 hover:bg-teal-500/25 backdrop-blur-md text-teal-100 text-[11px] sm:text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition border border-teal-400/30"
            >
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="truncate">Quiz Schedule</span>
            </Link>

            <Link
              href="/admin/performance"
              className="px-2 sm:px-4 py-2.5 bg-teal-500/15 hover:bg-teal-500/25 backdrop-blur-md text-teal-100 text-[11px] sm:text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 sm:gap-2 transition border border-teal-400/30"
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="truncate">Performance</span>
            </Link>
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
          <span>⚠️</span>
          <span>{fetchError}</span>
        </div>
      )}

      {/* ============ Stat cards — 2-col grid on mobile ============ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-3 sm:p-5 rounded-xl border border-white/70 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:border-slate-600 transition">
          <div className="p-2 sm:p-2.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 w-fit rounded-lg mb-2 sm:mb-3">
            <FileQuestion className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight">
            ප්‍රශ්න ගණන
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">
            {loading ? "…" : stats.totalQuestions}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 mt-1 wrap-break-word line-clamp-2">
            {loading ? "…" : subjectSummary}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-3 sm:p-5 rounded-xl border border-white/70 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:border-slate-600 transition">
          <div className="p-2 sm:p-2.5 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 w-fit rounded-lg mb-2 sm:mb-3">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight">
            Live / Upcoming
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">
            {loading ? "…" : quizzes.length}
          </p>
          <p className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 line-clamp-2">
            {loading
              ? "…"
              : liveNow.length > 0
                ? `${liveNow.length} දැන් Live · ඉදිරියේදී ${upcoming.length}`
                : upcoming[0]
                  ? formatScheduledTime(upcoming[0].scheduled_at)
                  : "සටහන් කර නැත"}
          </p>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-3 sm:p-5 rounded-xl border border-white/70 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:border-slate-600 transition">
          <div className="p-2 sm:p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 w-fit rounded-lg mb-2 sm:mb-3">
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight">
            ලියාපදිංචි සිසුන්
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">
            {loading ? "…" : stats.totalStudents.toLocaleString()}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            දිවයින පුරා
          </p>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-3 sm:p-5 rounded-xl border border-white/70 dark:border-slate-700 shadow-sm hover:shadow-md dark:hover:border-slate-600 transition">
          <div className="p-2 sm:p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 w-fit rounded-lg mb-2 sm:mb-3">
            <School className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium leading-tight">
            සක්‍රිය පාසල්
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-gray-100 mt-0.5 sm:mt-1">
            {loading ? "…" : stats.activeSchools}
          </p>
          <p className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 mt-1">
            Leaderboard
          </p>
        </div>
      </div>

      {/* ============ QUIZZES table — MOBILE-TIGHTENED ============ */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/70 dark:border-slate-700 p-3.5 sm:p-6 shadow-sm space-y-3 sm:space-y-4">
        <div className="flex justify-between items-center gap-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
            Live Quizzes වල තත්ත්වය
          </h2>
          <Link
            href="/admin/quizzes"
            className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 hover:underline transition whitespace-nowrap"
          >
            සියල්ල <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="p-6 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" /> Loading...
          </div>
        ) : orderedQuizzes.length === 0 ? (
          <div className="p-5 sm:p-6 text-center text-gray-400 dark:text-gray-500 text-[11px] sm:text-xs">
            දැනට Live Quiz කිසිවක් නොමැත. Quiz එකක් Schedule කරන්න.
          </div>
        ) : (
          <>
            {/* -------- DESKTOP table (unchanged) -------- */}
            <div className="hidden md:block divide-y divide-gray-100 dark:divide-slate-700 border border-gray-100 dark:border-slate-700 rounded-xl overflow-hidden text-sm">
              <div className="bg-emerald-50/80 dark:bg-emerald-950/40 backdrop-blur-sm p-3.5 font-bold text-xs uppercase text-emerald-900 dark:text-emerald-200 grid grid-cols-4 gap-3">
                <span>Subject & Topic</span>
                <span>Scheduled Time</span>
                <span>Questions</span>
                <span>Status</span>
              </div>
              {orderedQuizzes.map((quiz) => {
                const isLiveNow = liveNow.some((q) => q.id === quiz.id);
                return (
                  <div
                    key={quiz.id}
                    className="p-3.5 grid grid-cols-4 items-center gap-3 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition"
                  >
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block truncate">
                        {quiz.subject}
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">
                        {quiz.title}
                      </span>
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {formatScheduledTime(quiz.scheduled_at)}
                    </span>
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {quiz.total_questions} MCQ
                    </span>
                    {statusBadge(isLiveNow)}
                  </div>
                );
              })}
            </div>

            {/* -------- MOBILE cards — tighter spacing -------- */}
            <div className="md:hidden space-y-2">
              {orderedQuizzes.map((quiz) => {
                const isLiveNow = liveNow.some((q) => q.id === quiz.id);
                return (
                  <div
                    key={quiz.id}
                    className="p-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm border border-gray-200 dark:border-slate-700 rounded-xl space-y-1.5 hover:shadow-sm transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wide">
                          {quiz.subject}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 block leading-snug line-clamp-2">
                          {quiz.title}
                        </span>
                      </div>
                      <div className="shrink-0">{statusBadge(isLiveNow)}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 shrink-0" />
                        <span className="truncate">
                          {formatScheduledTime(quiz.scheduled_at)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <FileQuestion className="w-3 h-3 shrink-0" />
                        {quiz.total_questions} MCQ
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ============ Bottom Performance strip — MOBILE-STACKED ============ */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black p-4 sm:p-6 text-white flex flex-col gap-4 shadow-xl shadow-black/40 border border-slate-700/50 sm:flex-row sm:justify-between sm:items-center">
        <div className="pointer-events-none absolute -top-20 -right-16 w-64 h-64 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-16 w-56 h-56 bg-emerald-500/15 rounded-full blur-3xl" />

        <div className="relative flex items-start gap-3">
          <div className="p-2 sm:p-2.5 bg-teal-500/15 backdrop-blur-sm rounded-xl shrink-0 border border-teal-400/30">
            <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-teal-200" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm sm:text-lg">
              Student Performance Analytics
            </h3>
            <p className="text-slate-300 text-[11px] sm:text-xs mt-0.5 leading-snug">
              සියලුම සිසුන්ගේ ලකුණු, ප්‍රගතිය, AISSA IDs සහ CSV export මෙතැනින් බලන්න.
            </p>
          </div>
        </div>
        <Link
          href="/admin/performance"
          className="relative w-full sm:w-auto px-4 sm:px-5 py-2.5 bg-teal-500 text-slate-900 font-bold text-xs sm:text-sm rounded-xl hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0 group"
        >
          Performance
          <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}