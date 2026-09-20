"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Trophy,
  Award,
  Search,
  Filter,
  Download,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  BarChart3,
  RefreshCw,
  BookOpen,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

interface StudentAttempt {
  id: string;
  student_id: string;
  quiz_id: string;
  score: number;
  total_marks: number;
  submitted_at: string;
  student_name?: string;
  ais_id?: string;
  school?: string;
  district?: string;
  quiz_title?: string;
}

interface QuizOption {
  id: string;
  title: string;
}

// Flat row shapes — we no longer use PostgREST nested selects.
interface ResultRow {
  id: string;
  student_id: string;
  quiz_id: string;
  score: number | null;
  total_marks: number | null;
  submitted_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  ais_id: string | null;
  school: string | null;
  district: string | null;
}

interface QuizRow {
  id: string;
  title: string;
}

export default function AdminPerformancePage() {
  const [attempts, setAttempts] = useState<StudentAttempt[]>([]);
  const [quizzes, setQuizzes] = useState<QuizOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedQuiz, setSelectedQuiz] = useState<string>("ALL");
  const [fetchWarning, setFetchWarning] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    setFetchWarning(null);

    try {
      // ============================================================
      // 1. Quiz list (filter dropdown)
      // ============================================================
      const { data: quizList, error: quizListError } = await supabase
        .from("quizzes")
        .select("id, title")
        .order("created_at", { ascending: false });

      if (quizListError) {
        console.error("Error fetching quiz list:", quizListError);
      } else if (quizList) {
        setQuizzes(quizList as QuizOption[]);
      }

      // ============================================================
      // 2. Raw quiz_results — FLAT query, no nested select.
      //    Avoids PostgREST's array-vs-object ambiguity that caused
      //    profiles.ais_id to come back as undefined.
      // ============================================================
      const { data: resultsData, error: resultsError } = await supabase
        .from("quiz_results")
        .select("id, student_id, quiz_id, score, total_marks, submitted_at")
        .order("submitted_at", { ascending: false });

      if (resultsError) {
        console.error("Error fetching quiz results:", resultsError);
        setFetchWarning(
          "Quiz results load කිරීමේදී දෝෂයක්: " + resultsError.message,
        );
        setLoading(false);
        return;
      }

      if (!resultsData || resultsData.length === 0) {
        setAttempts([]);
        setLoading(false);
        return;
      }

      const results = resultsData as ResultRow[];

      // ============================================================
      // 3. Profiles for the involved students — ONE batched query
      // ============================================================
      const studentIds = Array.from(new Set(results.map((r) => r.student_id)));

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, ais_id, school, district")
        .in("id", studentIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        setFetchWarning("Profiles load කිරීමේදී දෝෂයක්: " + profilesError.message);
      }

      const profileMap = new Map<string, ProfileRow>();
      (profilesData as ProfileRow[] | null)?.forEach((p) =>
        profileMap.set(p.id, p),
      );

      // ============================================================
      // 4. Quiz titles for the involved quizzes
      // ============================================================
      const quizIds = Array.from(new Set(results.map((r) => r.quiz_id)));

      const { data: quizData, error: quizDataError } = await supabase
        .from("quizzes")
        .select("id, title")
        .in("id", quizIds);

      if (quizDataError) {
        console.error("Error fetching quiz titles:", quizDataError);
      }

      const quizMap = new Map<string, string>();
      (quizData as QuizRow[] | null)?.forEach((q) => quizMap.set(q.id, q.title));

      // ============================================================
      // 5. Merge everything
      // ============================================================
      const formatted: StudentAttempt[] = results.map((r) => {
        const p = profileMap.get(r.student_id);
        return {
          id: r.id,
          student_id: r.student_id,
          quiz_id: r.quiz_id,
          score: r.score ?? 0,
          total_marks: r.total_marks ?? 0,
          submitted_at: r.submitted_at,
          student_name: p?.full_name || "Unknown Student",
          ais_id: p?.ais_id || "N/A",
          school: p?.school || "N/A",
          district: p?.district || "N/A",
          quiz_title: quizMap.get(r.quiz_id) || "Deleted Quiz",
        };
      });

      setAttempts(formatted);
    } catch (err) {
      console.error("Unexpected error:", err);
      setFetchWarning("Unexpected error loading performance data.");
    } finally {
      setLoading(false);
    }
  }

  // ============================================================
  // Filtering — search now matches AISSA ID / Non-AISSA ID
  // ============================================================
  const filteredAttempts = attempts.filter((item) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      item.student_name?.toLowerCase().includes(q) ||
      item.ais_id?.toLowerCase().includes(q) ||
      item.school?.toLowerCase().includes(q) ||
      item.district?.toLowerCase().includes(q);

    const matchesQuiz = selectedQuiz === "ALL" || item.quiz_id === selectedQuiz;

    return matchesSearch && matchesQuiz;
  });

  // ============================================================
  // Metrics
  // ============================================================
  const totalSubmissions = attempts.length;
  const avgPercentage =
    totalSubmissions > 0
      ? (
          attempts.reduce(
            (acc, curr) =>
              acc +
              (curr.total_marks > 0
                ? (curr.score / curr.total_marks) * 100
                : 0),
            0,
          ) / totalSubmissions
        ).toFixed(1)
      : "0";

  const topScorer =
    attempts.length > 0
      ? [...attempts].sort(
          (a, b) =>
            (b.total_marks ? b.score / b.total_marks : 0) -
            (a.total_marks ? a.score / a.total_marks : 0),
        )[0]
      : null;

  // ============================================================
  // CSV Export — column renamed to AISSA ID
  // ============================================================
  const exportToCSV = () => {
    if (filteredAttempts.length === 0) return;

    const headers = [
      "Student Name",
      "AISSA ID",
      "School",
      "District",
      "Quiz Title",
      "Score",
      "Total Marks",
      "Percentage",
      "Date Completed",
    ];

    const rows = filteredAttempts.map((item) => [
      `"${item.student_name}"`,
      `"${item.ais_id}"`,
      `"${item.school}"`,
      `"${item.district}"`,
      `"${item.quiz_title}"`,
      item.score,
      item.total_marks,
      `${item.total_marks > 0 ? Math.round((item.score / item.total_marks) * 100) : 0}%`,
      `"${new Date(item.submitted_at).toLocaleString("en-GB")}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `aissa_student_performance_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/admin/quizzes"
                className="text-xs text-blue-600 hover:underline flex items-center gap-1 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Quizzes
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              Student Performance Analytics
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              සියලුම සිසුන්ගේ ප්‍රශ්න පත්‍ර ලකුණු, ප්‍රගතිය සහ විස්තර මෙතැනින් පරීක්ෂා කරන්න.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 transition text-gray-600"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={exportToCSV}
              disabled={filteredAttempts.length === 0}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> Export CSV
            </button>
          </div>
        </div>

        {fetchWarning && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl">
            {fetchWarning}
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3.5 bg-blue-50 text-blue-600 rounded-2xl">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">
                Total Attempts
              </p>
              <h3 className="text-2xl font-bold text-gray-900">
                {totalSubmissions}
              </h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Award className="w-7 h-7" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-gray-400">
                Average Marks
              </p>
              <h3 className="text-2xl font-bold text-gray-900">
                {avgPercentage}%
              </h3>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-4">
            <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl">
              <Trophy className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-gray-400">
                Top Performer
              </p>
              <h3 className="text-base font-bold text-gray-900 truncate">
                {topScorer ? topScorer.student_name : "N/A"}
              </h3>
              {topScorer && (
                <p className="text-xs text-amber-600 font-medium">
                  Score: {topScorer.score}/{topScorer.total_marks}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search name, AISSA ID, school..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedQuiz}
              onChange={(e) => setSelectedQuiz(e.target.value)}
              className="w-full sm:w-64 py-2.5 px-3 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition font-medium text-gray-700"
            >
              <option value="ALL">All Quizzes</option>
              {quizzes.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500 font-medium">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
              Loading student results...
            </div>
          ) : filteredAttempts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="font-semibold text-lg text-gray-700">
                No attempts found
              </p>
              <p className="text-sm text-gray-400 mt-1">
                තවම කිසිදු ශිෂ්‍යයෙක් මෙම Quiz එක සඳහා මුහුණ දී නැත.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb]">
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase text-xs">
                    <th className="py-4 px-6">Student</th>
                    <th className="py-4 px-6">AISSA ID</th>
                    <th className="py-4 px-6">School / District</th>
                    <th className="py-4 px-6">Quiz Title</th>
                    <th className="py-4 px-6 text-center">Score</th>
                    <th className="py-4 px-6 text-center">Percentage</th>
                    <th className="py-4 px-6 text-right">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAttempts.map((item) => {
                    const pct =
                      item.total_marks > 0
                        ? Math.round((item.score / item.total_marks) * 100)
                        : 0;

                    const hasId = item.ais_id && item.ais_id !== "N/A";
                    const isAissaMember = hasId && item.ais_id!.startsWith("R");

                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition">
                        <td className="py-4 px-6 font-semibold text-gray-900">
                          {item.student_name}
                        </td>

                        {/* AISSA ID badge — R=blue, N=indigo, N/A=gray */}
                        <td className="py-4 px-6">
                          <span
                            className={`inline-block font-mono text-[11px] font-bold px-2 py-1 rounded-md border ${
                              !hasId
                                ? "bg-gray-50 text-gray-400 border-gray-200"
                                : isAissaMember
                                  ? "bg-blue-50 text-blue-800 border-blue-200"
                                  : "bg-indigo-50 text-indigo-800 border-indigo-200"
                            }`}
                            title={
                              !hasId
                                ? "No ID on file"
                                : isAissaMember
                                  ? "AISSA Member ID"
                                  : "Non-AISSA Quiz ID"
                            }
                          >
                            {item.ais_id}
                          </span>
                        </td>

                        <td className="py-4 px-6 text-gray-600">
                          <div className="font-medium text-gray-800">
                            {item.school}
                          </div>
                          <div className="text-xs text-gray-400">
                            {item.district}
                          </div>
                        </td>

                        <td className="py-4 px-6 font-medium text-gray-700 max-w-xs truncate">
                          {item.quiz_title}
                        </td>

                        <td className="py-4 px-6 text-center font-bold text-gray-900">
                          {item.score} / {item.total_marks}
                        </td>

                        <td className="py-4 px-6 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                              pct >= 75
                                ? "bg-emerald-100 text-emerald-800"
                                : pct >= 50
                                  ? "bg-blue-100 text-blue-800"
                                  : pct >= 35
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-red-100 text-red-800"
                            }`}
                          >
                            {pct >= 50 ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            {pct}%
                          </span>
                        </td>

                        <td className="py-4 px-6 text-right text-xs text-gray-500 font-mono">
                          {new Date(item.submitted_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}