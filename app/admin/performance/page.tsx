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
  ShieldCheck,
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
      const { data: quizList, error: quizListError } = await supabase
        .from("quizzes")
        .select("id, title")
        .order("created_at", { ascending: false });

      if (quizListError) {
        console.error("Error fetching quiz list:", quizListError);
      } else if (quizList) {
        setQuizzes(quizList as QuizOption[]);
      }

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
    // ============ Modern green/white background ============
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 relative">
      {/* Aurora blobs */}
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md-[28rem] bg-emerald-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed top-[35%] right-[15%] w-72 h-72 bg-green-100/60 rounded-full filter blur-3xl" />

      <div className="relative p-3 sm:p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-5 sm:space-y-6">

          {/* ============ Header Banner ============ */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl shadow-emerald-900/20">
            {/* dot grid */}
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            {/* glows */}
            <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-teal-300/25 rounded-full blur-3xl" />
            {/* rings */}
            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-white/5" />
            {/* shine */}
            <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/8" />

            <div className="relative p-5 sm:p-6 md:p-7 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                {/* Logo */}
                <div className="shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-300/40 blur-xl rounded-full" />
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white/15 backdrop-blur-md rounded-2xl border border-white/25 shadow-lg flex items-center justify-center overflow-hidden">
                      <BarChart3 className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <Link
                      href="/admin/quizzes"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-white/15 hover:bg-white/25 transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to Quizzes
                    </Link>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/25 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-300/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Admin
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold leading-tight tracking-tight flex items-center gap-2">
                    <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300 shrink-0" />
                    Student Performance Analytics
                  </h1>
                  <p className="text-emerald-50/90 text-[11px] sm:text-xs mt-1">
                    සියලුම සිසුන්ගේ ප්‍රශ්න පත්‍ර ලකුණු, ප්‍රගතිය සහ විස්තර මෙතැනින් පරීක්ෂා කරන්න.
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 self-start">
                <button
                  onClick={fetchData}
                  className="p-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white rounded-xl transition border border-white/20"
                  title="Refresh Data"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
                </button>

                <button
                  onClick={exportToCSV}
                  disabled={filteredAttempts.length === 0}
                  className="px-4 py-2.5 bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-xl transition flex items-center gap-2 text-sm shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>
              </div>
            </div>
          </div>

          {fetchWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
              <span>⚠️</span>
              <span>{fetchWarning}</span>
            </div>
          )}

          {/* ============ Summary Cards ============ */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-white/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-white/70 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                <BookOpen className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-gray-400">
                  Total Attempts
                </p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {totalSubmissions}
                </h3>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-white/70 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="p-3.5 bg-teal-50 text-teal-600 rounded-2xl shrink-0">
                <Award className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-gray-400">
                  Average Marks
                </p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {avgPercentage}%
                </h3>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-md p-5 sm:p-6 rounded-2xl border border-white/70 shadow-sm flex items-center gap-4 hover:shadow-md transition">
              <div className="p-3.5 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
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

          {/* ============ Filters ============ */}
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/70 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, AISSA ID, school..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-white/60 border border-gray-200 text-gray-900 placeholder-gray-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 focus:bg-white transition"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={selectedQuiz}
                onChange={(e) => setSelectedQuiz(e.target.value)}
                className="w-full sm:w-64 py-2.5 px-3 text-sm bg-white/60 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition font-medium text-gray-700"
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

          {/* ============ Results Table ============ */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-gray-500 font-medium">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-emerald-600 mb-3" />
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
              <>
                {/* ===== Scrollable table with fade shadow ===== */}
                <div className="relative">
                  <div className="overflow-x-auto overflow-y-auto max-h-[65vh]">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="sticky top-0 z-10 bg-emerald-50 shadow-[0_1px_0_0_#a7f3d0]">
                        <tr className="text-emerald-900 font-semibold uppercase text-xs">
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
                            <tr
                              key={item.id}
                              className="hover:bg-emerald-50/30 transition"
                            >
                              <td className="py-4 px-6 font-semibold text-gray-900">
                                {item.student_name}
                              </td>

                              {/* AISSA ID badge — R=emerald, N=teal, N/A=gray */}
                              <td className="py-4 px-6">
                                <span
                                  className={`inline-block font-mono text-[11px] font-bold px-2 py-1 rounded-md border ${
                                    !hasId
                                      ? "bg-gray-50 text-gray-400 border-gray-200"
                                      : isAissaMember
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                        : "bg-teal-50 text-teal-800 border-teal-200"
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
                                        ? "bg-teal-100 text-teal-800"
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

                  {/* Bottom fade — indicates more content below */}
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-white/95 via-white/60 to-transparent" />
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2.5 bg-emerald-50/60 border-t border-emerald-100/60 text-[11px] text-gray-500 text-center">
                  ප්‍රතිඵල{" "}
                  <strong className="text-gray-700">
                    {filteredAttempts.length}
                  </strong>
                  ක් පෙන්වයි · scroll කරලා බලන්න
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}