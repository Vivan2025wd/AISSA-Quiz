"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  Clock,
  BookOpen,
  Trophy,
  ArrowRight,
  CheckCircle,
  BarChart3,
  Target,
  Timer,
  AlertTriangle,
} from "lucide-react";

type Quiz = {
  id: string;
  title: string;
  subject?: string | null;
  stream?: string | null;
  duration_minutes?: number | null;
  total_questions?: number | null;
  is_live?: boolean | null;
  created_at?: string | null;
};

type Profile = {
  id?: string;
  full_name?: string | null;
  school?: string | null;
  stream?: string | null;
};

// Aggregates returned by the get_student_stats() RPC (migration 015).
type StudentStats = {
  quizzes_completed: number | null;
  total_score: number | null;
  total_time_seconds: number | null;
  average_score: number | null;
  island_rank: number | null;
};

// Row shape from quiz_results joined against quizzes.
type PastQuizRow = {
  id: string;
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

// Compact: "2h 14m" / "45m 30s" / "45s"
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

  const averageScoreText =
    typeof stats?.average_score === "number" ? `${stats.average_score}%` : "N/A";

  useEffect(() => {
    let cancelled = false;

    async function loadDashboardData() {
      // ---- 1. Auth check ---------------------------------------------
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      // ---- 2. Registration check (must have a profiles row) ----------
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, school, stream")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (profileError) {
        setGuardError("Profile එක load කිරීමේදී දෝෂයක් ඇති විය.");
        setLoading(false);
        return;
      }

      if (!profileData) {
        // Half-set-up account: sign out and push back through login.
        await supabase.auth.signOut();
        router.replace("/auth/login?reason=no_profile");
        return;
      }

      setProfile(profileData);

      // ---- 3. Student stats (RPC — matches leaderboard ranking) ------
      const { data: statsData, error: statsError } = await supabase.rpc(
        "get_student_stats",
        { p_student_id: user.id },
      );

      if (statsError) {
        console.warn("get_student_stats error:", statsError.message);
      } else if (statsData && statsData.length > 0) {
        setStats(statsData[0]);
      }

      // ---- 4. Past quiz results --------------------------------------
      const { data: resultsData } = await supabase
        .from("quiz_results")
        .select(
          "id, score, total_marks, time_spent_seconds, submitted_at, quizzes(title, subject, stream)",
        )
        .eq("student_id", user.id)
        .order("submitted_at", { ascending: false });

      if (!cancelled && resultsData) {
        setPastQuizzes(resultsData as unknown as PastQuizRow[]);
      }

      // ---- 5. Active live quizzes ------------------------------------
      const { data: quizData } = await supabase
        .from("quizzes")
        .select("*")
        .eq("is_live", true)
        .order("created_at", { ascending: false });

      if (!cancelled) {
        if (quizData) setQuizzes(quizData);
        setLoading(false);
      }
    }

    loadDashboardData();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>
    );
  }

  if (guardError) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <p className="text-red-600 font-medium">{guardError}</p>
        <Link
          href="/auth/login"
          className="text-sm text-blue-600 hover:underline"
        >
          ← නැවත Login වෙත
        </Link>
      </div>
    );
  }

  const hasAttempts = (stats?.quizzes_completed ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Welcome Banner */}
        <div className="bg-linear-to-r from-blue-700 to-indigo-800 text-white p-6 md:p-8 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold uppercase tracking-wide">
              AISSA Quiz Engine
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-2">
              ආයුබෝවන්, {profile?.full_name || "Student"}! 👋
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              {profile?.school || "—"} • {profile?.stream || "Bio Science Stream"}
            </p>
          </div>
          <Link
            href="/student/leaderboard"
            className="px-5 py-2.5 bg-white text-blue-900 font-bold rounded-xl hover:bg-blue-50 transition shadow-sm flex items-center gap-2"
          >
            <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard එක බලන්න
          </Link>
        </div>

        {/* Quick Stats Grid — now shows total score + total time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Quizzes completed */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">
                සම්පූර්ණ කළ Quizzes
              </p>
              <p className="text-xl font-bold text-gray-800">
                {stats?.quizzes_completed ?? 0}
              </p>
            </div>
          </div>

          {/* Total score */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
              <Target className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">
                මුළු ලකුණු එකතුව
              </p>
              <p className="text-xl font-bold text-gray-800">
                {stats?.total_score ?? 0}
              </p>
            </div>
          </div>

          {/* Total time */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
              <Timer className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">
                මුළු කාලය
              </p>
              <p className="text-xl font-bold text-gray-800">
                {formatTotalTime(stats?.total_time_seconds)}
              </p>
            </div>
          </div>

          {/* Island rank */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-500 font-medium">
                දිවයිනේ ශ්‍රේණිගත කිරීම
              </p>
              <p className="text-xl font-bold text-gray-800">
                {hasAttempts && stats?.island_rank != null
                  ? `#${stats.island_rank}`
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Secondary stat — average score, since it's still useful */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-50 text-green-600 rounded-lg">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">
                සාමාන්‍ය ලකුණු මට්ටම (Average Score)
              </p>
              <p className="text-base font-bold text-gray-800">
                {hasAttempts ? averageScoreText : "—"}
              </p>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 text-right max-w-xs leading-tight">
            Leaderboard ranking මුළු ලකුණු එකතුව මත — සම ලකුණු විට වේගවත් කෙනා ඉහළට.
          </p>
        </div>

        {/* Live Quizzes Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" /> Active Live Quizzes
            </h2>
          </div>

          {quizzes.length === 0 ? (
            <div className="p-6 bg-white rounded-xl text-center text-gray-500 border border-gray-200">
              No live quizzes available right now. Check back soon!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4 hover:border-blue-300 transition"
                >
                  <div className="flex justify-between items-start">
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-bold rounded-md">
                      {quiz.subject}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5" /> {quiz.duration_minutes}{" "}
                      mins
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900">
                      {quiz.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> {quiz.total_questions}{" "}
                      ප්‍රශ්න
                      {quiz.stream ? ` • ${quiz.stream}` : ""}
                    </p>
                  </div>

                  <Link
                    href={`/student/quiz/${quiz.id}`}
                    className="w-full mt-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg flex justify-center items-center gap-2 transition"
                  >
                    Quiz එක ආරම්භ කරන්න <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Performance Section */}
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" /> පසුගිය Quizzes සහ
            ප්‍රතිඵල
          </h2>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50 border-b text-gray-700 font-semibold uppercase text-xs">
                  <tr>
                    <th className="p-4">Subject & Topic</th>
                    <th className="p-4">තැබූ දිනය</th>
                    <th className="p-4">ලකුණු</th>
                    <th className="p-4">ගතකළ කාලය</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pastQuizzes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-gray-400">
                        No completed quizzes yet.
                      </td>
                    </tr>
                  ) : (
                    pastQuizzes.map((pq) => (
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}