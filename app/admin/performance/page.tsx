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
  Calendar,
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

  // Helper to render the percentage pill consistently
  const renderPctPill = (pct: number) => (
    <span
      className={`inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold ${
        pct >= 75
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          : pct >= 50
            ? "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300"
            : pct >= 35
              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
              : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
      }`}
    >
      {pct >= 50 ? (
        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      ) : (
        <XCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
      )}
      {pct}%
    </span>
  );

  return (
    <div className="max-w-7xl mx-auto md:max-h-[calc(100vh-3rem)] flex flex-col gap-4 sm:gap-5">

      {/* ═══ Header Banner — MOBILE-TIGHTENED ═══ */}
      <div className="shrink-0 relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-slate-700/50">
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
          {/* Top row: logo + title + refresh */}
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
                <Link
                  href="/admin/quizzes"
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200 hover:bg-teal-500/25 transition"
                >
                  <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Back
                </Link>
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-500/20 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200">
                  <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Admin
                </span>
              </div>
              <h1 className="text-base sm:text-xl md:text-2xl font-extrabold leading-tight tracking-tight flex items-center gap-2">
                <BarChart3 className="w-5 h-5 sm:w-7 sm:h-7 text-teal-300 shrink-0" />
                <span className="truncate">
                  Student Performance
                </span>
              </h1>
              <p className="text-slate-300 text-[11px] sm:text-xs mt-1 leading-snug hidden sm:block">
                සියලුම සිසුන්ගේ ප්‍රශ්න පත්‍ර ලකුණු, ප්‍රගතිය සහ විස්තර මෙතැනින් පරීක්ෂා කරන්න.
              </p>
            </div>
          </div>

          {/* Action row — refresh + export, both compact */}
          <div className="flex items-center gap-2 mt-4 sm:mt-5">
            <button
              onClick={fetchData}
              className="p-2.5 bg-teal-500/15 hover:bg-teal-500/25 backdrop-blur-md text-teal-200 rounded-xl transition border border-teal-400/30 shrink-0"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? "animate-spin" : ""}`} />
            </button>

            <button
              onClick={exportToCSV}
              disabled={filteredAttempts.length === 0}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2.5 bg-teal-500 text-slate-900 hover:bg-teal-400 font-bold rounded-xl transition flex items-center justify-center gap-2 text-xs sm:text-sm shadow-lg shadow-teal-500/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Export CSV</span>
              <span className="hidden sm:inline">
                ({filteredAttempts.length})
              </span>
            </button>
          </div>
        </div>
      </div>

      {fetchWarning && (
        <div className="shrink-0 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
          <span>⚠️</span>
          <span>{fetchWarning}</span>
        </div>
      )}

      {/* ═══ Summary Cards — 3-col on mobile ═══ */}
      <div className="shrink-0 grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 hover:shadow-md dark:hover:border-slate-600 transition">
          <div className="p-1.5 sm:p-3.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-lg sm:rounded-2xl shrink-0 w-fit">
            <BookOpen className="w-4 h-4 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 leading-tight">
              Attempts
            </p>
            <h3 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {totalSubmissions}
            </h3>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 hover:shadow-md dark:hover:border-slate-600 transition">
          <div className="p-1.5 sm:p-3.5 bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400 rounded-lg sm:rounded-2xl shrink-0 w-fit">
            <Award className="w-4 h-4 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 leading-tight">
              Avg
            </p>
            <h3 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
              {avgPercentage}%
            </h3>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-2.5 sm:p-6 rounded-xl sm:rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 hover:shadow-md dark:hover:border-slate-600 transition">
          <div className="p-1.5 sm:p-3.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-lg sm:rounded-2xl shrink-0 w-fit">
            <Trophy className="w-4 h-4 sm:w-7 sm:h-7" />
          </div>
          <div className="min-w-0">
            <p className="text-[9px] sm:text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 leading-tight">
              Top
            </p>
            <h3 className="text-[11px] sm:text-base font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
              {topScorer ? topScorer.student_name : "N/A"}
            </h3>
            {topScorer && (
              <p className="text-[9px] sm:text-xs text-amber-600 dark:text-amber-400 font-medium hidden sm:block">
                Score: {topScorer.score}/{topScorer.total_marks}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ═══ Filters — MOBILE-TIGHTENED ═══ */}
      <div className="shrink-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-2.5 sm:gap-4 sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 absolute left-3 top-3 sm:top-3.5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search name, ID, school..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2.5 text-xs sm:text-sm bg-white/60 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-900 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500 shrink-0" />
          <select
            value={selectedQuiz}
            onChange={(e) => setSelectedQuiz(e.target.value)}
            className="w-full sm:w-64 py-2.5 px-3 text-xs sm:text-sm bg-white/60 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition font-medium text-gray-700 dark:text-gray-200"
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

      {/* ═══ Results Table — flex-1 + min-h-0 ═══ */}
      <div className="flex-1 min-h-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 font-medium gap-3">
            <RefreshCw className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs sm:text-sm">Loading student results...</span>
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 px-4">
            <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-sm sm:text-lg text-gray-700 dark:text-gray-200">
              No attempts found
            </p>
            <p className="text-xs sm:text-sm text-gray-400 dark:text-gray-500 mt-1 text-center">
              තවම කිසිදු ශිෂ්‍යයෙක් මෙම Quiz එක සඳහා මුහුණ දී නැත.
            </p>
          </div>
        ) : (
          <>
            {/* ──────── DESKTOP: table ──────── */}
            <div className="hidden md:block flex-1 min-h-0 overflow-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-emerald-50 dark:bg-emerald-950/60 shadow-[0_1px_0_0_#a7f3d0] dark:shadow-[0_1px_0_0_rgba(16,185,129,0.25)]">
                  <tr className="text-emerald-900 dark:text-emerald-200 font-semibold uppercase text-xs">
                    <th className="py-4 px-6">Student</th>
                    <th className="py-4 px-6">AISSA ID</th>
                    <th className="py-4 px-6">School / District</th>
                    <th className="py-4 px-6">Quiz Title</th>
                    <th className="py-4 px-6 text-center">Score</th>
                    <th className="py-4 px-6 text-center">Percentage</th>
                    <th className="py-4 px-6 text-right">Date & Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                  {filteredAttempts.map((item) => {
                    const pct =
                      item.total_marks > 0
                        ? Math.round((item.score / item.total_marks) * 100)
                        : 0;

                    const hasId = item.ais_id && item.ais_id !== "N/A";
                    const isAissaMember = hasId && item.ais_id!.startsWith("R");

                    return (
                      <tr key={item.id} className="hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 transition">
                        <td className="py-4 px-6 font-semibold text-gray-900 dark:text-gray-100">
                          {item.student_name}
                        </td>

                        <td className="py-4 px-6">
                          <span
                            className={`inline-block font-mono text-[11px] font-bold px-2 py-1 rounded-md border ${
                              !hasId
                                ? "bg-gray-50 dark:bg-slate-900/60 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-slate-700"
                                : isAissaMember
                                  ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                  : "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800"
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

                        <td className="py-4 px-6 text-gray-600 dark:text-gray-400">
                          <div className="font-medium text-gray-800 dark:text-gray-200">
                            {item.school}
                          </div>
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {item.district}
                          </div>
                        </td>

                        <td className="py-4 px-6 font-medium text-gray-700 dark:text-gray-300 max-w-xs truncate">
                          {item.quiz_title}
                        </td>

                        <td className="py-4 px-6 text-center font-bold text-gray-900 dark:text-gray-100">
                          {item.score} / {item.total_marks}
                        </td>

                        <td className="py-4 px-6 text-center">
                          {renderPctPill(pct)}
                        </td>

                        <td className="py-4 px-6 text-right text-xs text-gray-500 dark:text-gray-400 font-mono">
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

            {/* ──────── MOBILE: cards ──────── */}
            <div className="md:hidden flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
              {filteredAttempts.map((item) => {
                const pct =
                  item.total_marks > 0
                    ? Math.round((item.score / item.total_marks) * 100)
                    : 0;

                const hasId = item.ais_id && item.ais_id !== "N/A";
                const isAissaMember = hasId && item.ais_id!.startsWith("R");

                return (
                  <div
                    key={item.id}
                    className="p-3 bg-white/70 dark:bg-slate-900/60 backdrop-blur-sm border border-gray-200 dark:border-slate-700 rounded-xl space-y-2 hover:shadow-sm transition"
                  >
                    {/* Row 1: name + percentage */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                          {item.student_name}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                          {item.school}
                          {item.district && item.district !== "N/A"
                            ? ` · ${item.district}`
                            : ""}
                        </p>
                      </div>
                      <div className="shrink-0">{renderPctPill(pct)}</div>
                    </div>

                    {/* Row 2: AISSA ID chip */}
                    <div>
                      <span
                        className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          !hasId
                            ? "bg-gray-50 dark:bg-slate-900/60 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-slate-700"
                            : isAissaMember
                              ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800"
                        }`}
                      >
                        {item.ais_id}
                      </span>
                    </div>

                    {/* Row 3: quiz title */}
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 font-medium truncate">
                      {item.quiz_title}
                    </p>

                    {/* Row 4: score + date */}
                    <div className="flex items-center justify-between gap-2 text-[10px] text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-slate-700">
                      <span className="font-bold text-gray-800 dark:text-gray-200">
                        {item.score} / {item.total_marks}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3 h-3 shrink-0" />
                        {new Date(item.submitted_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className="shrink-0 px-4 py-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 border-t border-emerald-100/60 dark:border-emerald-900/50 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 text-center">
              ප්‍රතිඵල{" "}
              <strong className="text-gray-700 dark:text-gray-300">
                {filteredAttempts.length}
              </strong>
              ක් පෙන්වයි · scroll කරලා බලන්න
            </div>
          </>
        )}
      </div>
    </div>
  );
}