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
      // ============================================================
      // 1. Live quizzes — include scheduled AND unscheduled, sort
      //    by scheduled_at (NULLs last), then created_at desc.
      //    Previously we filtered out scheduled_at = NULL, which
      //    hid any quiz without an explicit schedule.
      // ============================================================
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

      // ============================================================
      // 2. Question count by subject.
      //    FIX: read `questions.subject` directly. The old query
      //    joined through quizzes(quiz_id), but bank questions now
      //    live with quiz_id = NULL (linked via quiz_questions), so
      //    that join always returned NULL → everything was "Other".
      // ============================================================
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

      // ============================================================
      // 3. Total registered students (non-admin)
      // ============================================================
      const { count: studentCount, error: studentError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_admin", false);

      if (studentError) {
        console.error("Error fetching student count:", studentError);
      }

      // ============================================================
      // 4. Distinct active schools — exclude placeholder values
      // ============================================================
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
    // This effect intentionally loads external data on mount; the callback
    // updates state when the asynchronous request completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentTime(Date.now());
    void fetchDashboardData();
  }, [fetchDashboardData]);

  // Sort subjects by count desc for the summary line
  const subjectSummary =
    Object.entries(stats.questionsBySubject)
      .sort((a, b) => b[1] - a[1])
      .map(([subject, count]) => `${subject}: ${count}`)
      .join(" • ") || "දත්ත නැත";

  // Split live vs. upcoming using duration window
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            Admin Control Center
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            AISSA Quiz Engine ප්‍රශ්න බැංකුව සහ Quiz සටහන පාලනය කරන්න.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => void fetchDashboardData()}
            disabled={loading}
            className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl flex items-center gap-2 transition disabled:opacity-60"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <Link
            href="/admin/questions"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" /> නව ප්‍රශ්නයක්
          </Link>

          <Link
            href="/admin/quizzes"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition"
          >
            <Calendar className="w-4 h-4" /> Live Quiz Schedule
          </Link>

          {/* NEW: Performance button */}
          <Link
            href="/admin/performance"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition"
          >
            <BarChart3 className="w-4 h-4" /> Performance
          </Link>
        </div>
      </div>

      {fetchError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
          {fetchError}
        </div>
      )}

      {/* Overview Analytics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Questions */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="p-2.5 bg-blue-50 text-blue-600 w-fit rounded-lg mb-3">
            <FileQuestion className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 font-medium">
            එකතු කර ඇති ප්‍රශ්න ගණන
          </p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : stats.totalQuestions}
          </p>
          <p className="text-[11px] text-gray-400 mt-1 wrap-break-word">
            {loading ? "…" : subjectSummary}
          </p>
        </div>

        {/* Live / Upcoming Quizzes */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="p-2.5 bg-green-50 text-green-600 w-fit rounded-lg mb-3">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 font-medium">
            Live / Upcoming Quizzes
          </p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : quizzes.length}
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">
            {loading
              ? "…"
              : liveNow.length > 0
                ? `${liveNow.length} දැන් Live · ඉදිරියේදී ${upcoming.length}`
                : upcoming[0]
                  ? formatScheduledTime(upcoming[0].scheduled_at)
                  : "සටහන් කර නැත"}
          </p>
        </div>

        {/* Total Students */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="p-2.5 bg-purple-50 text-purple-600 w-fit rounded-lg mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 font-medium">
            ලියාපදිංචි සිසුන් ගණන
          </p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : stats.totalStudents.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">දිවයින පුරා සිසුන්</p>
        </div>

        {/* Active Schools */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="p-2.5 bg-amber-50 text-amber-600 w-fit rounded-lg mb-3">
            <School className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 font-medium">
            සක්‍රිය පාසල් ගණන
          </p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : stats.activeSchools}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Leaderboard එකට ඇතුළත්
          </p>
        </div>
      </div>

      {/* Quick Action Tables View */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-gray-900">
            Live Quizzes වල තත්ත්වය
          </h2>
          <Link
            href="/admin/quizzes"
            className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
          >
            සියල්ල බලන්න <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="divide-y divide-gray-100 border rounded-xl overflow-hidden text-sm">
          <div className="bg-gray-50 p-3.5 font-bold text-xs uppercase text-gray-500 grid grid-cols-4">
            <span>Subject & Topic</span>
            <span>Scheduled Time</span>
            <span>Questions</span>
            <span>Status</span>
          </div>

          {loading ? (
            <div className="p-6 flex items-center justify-center text-gray-400 text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : orderedQuizzes.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-xs">
              දැනට Live Quiz කිසිවක් නොමැත. Quiz එකක් Schedule කරන්න.
            </div>
          ) : (
            orderedQuizzes.map((quiz) => {
              const isLiveNow = liveNow.some((q) => q.id === quiz.id);
              return (
                <div
                  key={quiz.id}
                  className="p-3.5 grid grid-cols-4 items-center"
                >
                  <div>
                    <span className="text-xs font-bold text-blue-600 block">
                      {quiz.subject}
                    </span>
                    <span className="font-semibold text-gray-800">
                      {quiz.title}
                    </span>
                  </div>
                  <span className="text-xs text-gray-600">
                    {formatScheduledTime(quiz.scheduled_at)}
                  </span>
                  <span className="text-xs text-gray-600">
                    {quiz.total_questions} MCQ
                  </span>
                  {isLiveNow ? (
                    <span className="w-fit text-[11px] font-bold px-2.5 py-1 bg-red-50 text-red-700 rounded-md border border-red-200 flex items-center gap-1">
                      <Radio className="w-3 h-3 animate-pulse" /> Live Now
                    </span>
                  ) : (
                    <span className="w-fit text-[11px] font-bold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-200">
                      Scheduled
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* NEW: Bottom quick-access strip to Performance */}
      <div className="bg-linear-to-r from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-white/15 rounded-xl shrink-0">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">Student Performance Analytics</h3>
            <p className="text-indigo-100 text-xs mt-0.5">
              සියලුම සිසුන්ගේ ලකුණු, ප්‍රගතිය, AISSA IDs සහ CSV export මෙතැනින් බලන්න.
            </p>
          </div>
        </div>
        <Link
          href="/admin/performance"
          className="px-5 py-2.5 bg-white text-indigo-700 font-bold text-sm rounded-xl hover:bg-indigo-50 transition flex items-center gap-2 shrink-0"
        >
          Performance එකට යන්න <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}