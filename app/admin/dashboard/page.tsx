"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileQuestion, Calendar, School, Users, PlusCircle, ArrowUpRight, Loader2 } from "lucide-react";
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

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);

    try {
      // 1. Upcoming live quizzes — soonest scheduled first, only future ones
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("is_live", true)
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true });

      if (quizError) {
        console.error("Error fetching live quizzes:", quizError);
        setFetchError("Live Quizzes load කිරීමේදී දෝෂයක් ඇති විය.");
      } else if (quizData) {
        setQuizzes(quizData as Quiz[]);
      }

      // 2. Total question count + breakdown by subject (via the parent quiz's subject)
      const { data: questionRows, error: questionError } = await supabase
        .from("questions")
        .select("quiz_id, quizzes(subject)");

      let totalQuestions = 0;
      const questionsBySubject: Record<string, number> = {};
      if (!questionError && questionRows) {
        totalQuestions = questionRows.length;
        for (const row of questionRows as unknown as { quizzes?: { subject?: string } }[]) {
          const subj = row.quizzes?.subject || "Other";
          questionsBySubject[subj] = (questionsBySubject[subj] || 0) + 1;
        }
      }

      // 3. Total registered students (non-admin profiles)
      const { count: studentCount, error: studentError } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_admin", false);

      // 4. Distinct active schools
      const { data: schoolRows, error: schoolError } = await supabase
        .from("profiles")
        .select("school")
        .eq("is_admin", false);

      const activeSchools = !schoolError && schoolRows
        ? new Set(schoolRows.map((r) => r.school).filter(Boolean)).size
        : 0;

      setStats({
        totalQuestions,
        questionsBySubject,
        totalStudents: studentError ? 0 : studentCount || 0,
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
    const loadDashboard = async () => {
      await fetchDashboardData();
    };

    void loadDashboard();
  }, [fetchDashboardData]);

  const subjectSummary = Object.entries(stats.questionsBySubject)
    .map(([subject, count]) => `${subject}: ${count}`)
    .join(" • ") || "දත්ත නැත";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Admin Control Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            AISSA Quiz Engine ප්‍රශ්න බැංකුව සහ Quiz සටහන පාලනය කරන්න.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/questions"
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition"
          >
            <PlusCircle className="w-4 h-4" /> නව ප්‍රශ්නයක් එකතු කරන්න
          </Link>
          <Link
            href="/admin/quizzes"
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition"
          >
            <Calendar className="w-4 h-4" /> Live Quiz Schedule කරන්න
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
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="p-2.5 bg-blue-50 text-blue-600 w-fit rounded-lg mb-3">
            <FileQuestion className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 font-medium">එකතු කර ඇති ප්‍රශ්න ගණන</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : stats.totalQuestions}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">{loading ? "…" : subjectSummary}</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="p-2.5 bg-green-50 text-green-600 w-fit rounded-lg mb-3">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 font-medium">ලඟම එන Live Quizzes</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{loading ? "…" : quizzes.length}</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">
            {loading ? "…" : quizzes[0] ? formatScheduledTime(quizzes[0].scheduled_at) : "සටහන් කර නැත"}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="p-2.5 bg-purple-50 text-purple-600 w-fit rounded-lg mb-3">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 font-medium">ලියාපදිංචි සිසුන් ගණන</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : stats.totalStudents.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">දිවයින පුරා සිසුන්</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="p-2.5 bg-amber-50 text-amber-600 w-fit rounded-lg mb-3">
            <School className="w-5 h-5" />
          </div>
          <p className="text-xs text-gray-500 font-medium">සක්‍රිය පාසල් ගණන</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {loading ? "…" : stats.activeSchools}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Leaderboard එකට ඇතුළත්</p>
        </div>
      </div>

      {/* Quick Action Tables View */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-bold text-gray-900">ඉදිරි Live Quizzes වල තත්ත්වය</h2>
          <Link href="/admin/quizzes" className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline">
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
          ) : quizzes.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-xs">
              දැනට Live Quiz කිසිවක් Schedule කර නොමැත.
            </div>
          ) : (
            quizzes.map((quiz) => (
              <div key={quiz.id} className="p-3.5 grid grid-cols-4 items-center">
                <div>
                  <span className="text-xs font-bold text-blue-600 block">{quiz.subject}</span>
                  <span className="font-semibold text-gray-800">{quiz.title}</span>
                </div>
                <span className="text-xs text-gray-600">{formatScheduledTime(quiz.scheduled_at)}</span>
                <span className="text-xs text-gray-600">{quiz.total_questions} MCQ</span>
                <span className="w-fit text-[11px] font-bold px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md border border-amber-200">
                  Scheduled
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}