"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { Clock, BookOpen, Trophy, ArrowRight, CheckCircle, BarChart3 } from "lucide-react";

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

// Aggregates returned by the get_student_stats() RPC (see
// 002_student_stats.sql). These are NOT columns on `profiles`.
type StudentStats = {
  quizzes_completed: number | null;
  average_score: number | null;
  island_rank: number | null;
};

// Row shape from quiz_results joined against quizzes, used to
// populate the "past quizzes" table.
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

export default function StudentDashboard() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [pastQuizzes, setPastQuizzes] = useState<PastQuizRow[]>([]);
  const [loading, setLoading] = useState(true);

  const averageScoreText =
    typeof stats?.average_score === "number" ? `${stats.average_score}%` : "N/A";

  useEffect(() => {
    async function loadDashboardData() {
      // 1. Get logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Profile (name, school, stream) — matches "Users can
        // view own profile" RLS policy (auth.uid() = id)
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, school, stream")
          .eq("id", user.id)
          .single();

        setProfile(profileData);

        // Aggregate stats (quizzes completed / avg score / rank)
        // via RPC, since these require cross-student comparison
        // that plain RLS-scoped queries can't do.
        const { data: statsData, error: statsError } = await supabase.rpc(
          "get_student_stats",
          { p_student_id: user.id }
        );

        if (!statsError && statsData && statsData.length > 0) {
          setStats(statsData[0]);
        }

        // Past quiz history, joined with quiz title/subject.
        // Matches "Users can view own results" RLS policy
        // (auth.uid() = student_id).
        const { data: resultsData } = await supabase
          .from("quiz_results")
          .select(
            "id, score, total_marks, time_spent_seconds, submitted_at, quizzes(title, subject, stream)"
          )
          .eq("student_id", user.id)
          .order("submitted_at", { ascending: false });

        if (resultsData) {
          setPastQuizzes(resultsData as unknown as PastQuizRow[]);
        }
      }

      // 2. Fetch active live quizzes
      const { data: quizData } = await supabase
        .from("quizzes")
        .select("*")
        .eq("is_live", true)
        .order("created_at", { ascending: false });

      if (quizData) {
        setQuizzes(quizData);
      }
      setLoading(false);
    }

    loadDashboardData();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header & Welcome Banner */}
        <div className="bg-linear-to-r from-blue-700 to-indigo-800 text-white p-6 md:p-8 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="px-3 py-1 bg-white/20 rounded-full text-xs font-semibold uppercase tracking-wide">
              AISSA Quiz Engine
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-2">
              ආයුබෝවන්, {profile?.full_name || "Student"}! 👋
            </h1>
            <p className="text-blue-100 text-sm mt-1">
              {profile?.school || "Carey College, Colombo"} • {profile?.stream || "Bio Science Stream"}
            </p>
          </div>
          <Link
            href="/student/leaderboard"
            className="px-5 py-2.5 bg-white text-blue-900 font-bold rounded-xl hover:bg-blue-50 transition shadow-sm flex items-center gap-2"
          >
            <Trophy className="w-5 h-5 text-amber-500" /> Leaderboard එක බලන්න
          </Link>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">සම්පූර්ණ කළ Quizzes</p>
              <p className="text-xl font-bold text-gray-800">{stats?.quizzes_completed ?? "N/A"}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-50 text-green-600 rounded-lg">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">සාමාන්‍ය ලකුණු මට්ටම</p>
              <p className="text-xl font-bold text-gray-800">{averageScoreText}</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">දිවයිනේ ශ්‍රේණිගත කිරීම (Island Rank)</p>
              <p className="text-xl font-bold text-gray-800">
                {stats?.island_rank != null ? `#${stats.island_rank}` : "N/A"}
              </p>
            </div>
          </div>
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
                      <Clock className="w-3.5 h-3.5" /> {quiz.duration_minutes} mins
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{quiz.title}</h3>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5" /> {quiz.total_questions} ප්‍රශ්න
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
            <CheckCircle className="w-5 h-5 text-green-600" /> පසුගිය Quizzes සහ ප්‍රතිඵල
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
                        <td className="p-4">{formatDuration(pq.time_spent_seconds)}</td>
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