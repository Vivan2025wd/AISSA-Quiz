"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Trophy,
  School,
  Users,
  Award,
  ArrowLeft,
  Loader2,
  Clock,
  Atom,
  FlaskConical,
  Dna,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

// ------------------------------------------------------------
// Constants
// ------------------------------------------------------------
const TOP_SCHOOLS = 10;
const TOP_INDIVIDUALS = 20;
const FETCH_LIMIT = 500;

const SUBJECT_PRIORITY = ["physics", "chemistry", "biology"];

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
type Medium = "sinhala" | "english" | "tamil";

type IndividualRow = {
  rank: number;
  student_id: string;
  full_name: string;
  school: string;
  medium: Medium | null;
  quizzes_completed: number;
  total_score: number;
  total_time_seconds: number;
  average_score: number | null;
};

type SchoolRow = {
  rank: number;
  school: string;
  students_count: number;
  participating_students: number;
  total_quizzes: number;
  top5_marks: number;
  academic_score: number;
  participation_score: number;
  total_score: number;
  avg_score: number | null;
};

type QuizSubjectRow = {
  subject: string | null;
  stream: string | null;
};

// ------------------------------------------------------------
// Subject visibility by stream
// ------------------------------------------------------------
function isSubjectAllowedForStream(
  subject: string | null | undefined,
  quizStream: string | null | undefined,
  studentStream: string | null | undefined,
): boolean {
  if (!subject) return false;

  const subj = subject.toLowerCase();
  const s = (studentStream ?? "").toLowerCase();

  if (s.includes("bio")) {
    return (
      subj.includes("physics") ||
      subj.includes("chemistry") ||
      subj.includes("biology")
    );
  }

  if (s.includes("physical") || s.includes("maths")) {
    return subj.includes("physics") || subj.includes("chemistry");
  }

  return streamsMatch(studentStream, quizStream);
}

function streamsMatch(
  studentStream: string | null | undefined,
  quizStream: string | null | undefined,
): boolean {
  if (!studentStream || !quizStream) return false;
  const s = studentStream.trim().toLowerCase();
  const q = quizStream.trim().toLowerCase();

  if (s === q) return true;
  if (s.includes("bio") && q.includes("bio")) return true;
  if (
    (s.includes("physical") || s.includes("maths")) &&
    (q.includes("physical") || q.includes("maths"))
  ) {
    return true;
  }
  return false;
}

function subjectMeta(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes("physics")) {
    return {
      icon: <Atom className="w-3.5 h-3.5" />,
      active: "bg-blue-600 text-white shadow-sm",
    };
  }
  if (s.includes("chemistry")) {
    return {
      icon: <FlaskConical className="w-3.5 h-3.5" />,
      active: "bg-purple-600 text-white shadow-sm",
    };
  }
  if (s.includes("biology")) {
    return {
      icon: <Dna className="w-3.5 h-3.5" />,
      active: "bg-emerald-600 text-white shadow-sm",
    };
  }
  return {
    icon: <BookOpen className="w-3.5 h-3.5" />,
    active: "bg-slate-800 text-white shadow-sm",
  };
}

function formatTime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmt(value: unknown, decimals = 1): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : "0.0";
}

function mediumShort(m: Medium | null | undefined): string {
  if (m === "english") return "EN";
  if (m === "tamil") return "தமிழ்";
  return "සිං";
}

function mediumFull(m: Medium | null | undefined): string {
  if (m === "english") return "English Medium";
  if (m === "tamil") return "Tamil Medium";
  return "Sinhala Medium";
}

function ScoreBar({
  value,
  max,
  color,
  width = "w-20",
}: {
  value: number;
  max: number;
  color: string;
  width?: string;
}) {
  const n = typeof value === "number" ? value : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const pct = max > 0 ? Math.min(100, (safe / max) * 100) : 0;
  return (
    <div className={`${width} h-1.5 bg-gray-100 rounded-full overflow-hidden`}>
      <div
        className={`h-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="font-bold text-gray-500">#{rank}</span>;
}

function schoolsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

// ------------------------------------------------------------
// Page
// ------------------------------------------------------------
export default function LeaderboardPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"school" | "individual">("school");

  const [studentId, setStudentId] = useState<string | null>(null);
  const [studentStream, setStudentStream] = useState<string | null>(null);
  const [studentSchool, setStudentSchool] = useState<string | null>(null);

  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  const [schoolLeaderboard, setSchoolLeaderboard] = useState<SchoolRow[]>([]);
  const [individualLeaderboard, setIndividualLeaderboard] = useState<
    IndividualRow[]
  >([]);

  const [loadingSchool, setLoadingSchool] = useState(true);
  const [loadingIndividual, setLoadingIndividual] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ------------------------------------------------------------
  // Auth gate
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function gate() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id, stream, school")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!profile) {
        await supabase.auth.signOut();
        router.replace("/auth/login?reason=no_profile");
        return;
      }

      setStudentId(profile.id ?? null);
      setStudentStream(profile.stream ?? null);
      setStudentSchool(profile.school ?? null);
    }

    void gate();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ------------------------------------------------------------
  // Load subject tabs
  // ------------------------------------------------------------
  useEffect(() => {
    if (studentStream === null) return;

    let cancelled = false;

    async function loadSubjects() {
      setLoadingSubjects(true);

      const { data, error } = await supabase
        .from("quizzes")
        .select("subject, stream");

      if (cancelled) return;

      if (error) {
        console.error("Subject tabs fetch error:", error);
        setAvailableSubjects([]);
        setSelectedSubject(null);
        setLoadingSubjects(false);
        return;
      }

      const set = new Set<string>();
      for (const row of (data ?? []) as QuizSubjectRow[]) {
        if (!row.subject) continue;
        if (isSubjectAllowedForStream(row.subject, row.stream, studentStream)) {
          set.add(row.subject);
        }
      }

      const sorted = Array.from(set).sort((a, b) => {
        const ai = SUBJECT_PRIORITY.indexOf(a.toLowerCase());
        const bi = SUBJECT_PRIORITY.indexOf(b.toLowerCase());
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      });

      setAvailableSubjects(sorted);
      setSelectedSubject((prev) =>
        prev && sorted.includes(prev) ? prev : sorted[0] ?? null,
      );
      setLoadingSubjects(false);
    }

    void loadSubjects();
    return () => {
      cancelled = true;
    };
  }, [studentStream]);

  // ------------------------------------------------------------
  // School leaderboard — load once
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadSchool() {
      setLoadingSchool(true);
      const { data, error } = await supabase.rpc("get_school_leaderboard", {
        p_limit: FETCH_LIMIT,
      });

      if (cancelled) return;

      if (error) {
        console.error("School leaderboard error:", error);
        setLoadError("Leaderboard එක පූරණය කිරීමේදී දෝෂයක් ඇති විය.");
        setSchoolLeaderboard([]);
      } else {
        setSchoolLeaderboard((data as SchoolRow[]) ?? []);
      }
      setLoadingSchool(false);
    }

    void loadSchool();
    return () => {
      cancelled = true;
    };
  }, []);

  // ------------------------------------------------------------
  // Individual leaderboard — reload on subject change
  // ------------------------------------------------------------
  useEffect(() => {
    if (!selectedSubject) {
      return;
    }

    let cancelled = false;

    async function loadIndividual() {
      setLoadingIndividual(true);

      const result = await supabase.rpc("get_subject_leaderboard", {
        p_subject: selectedSubject,
        p_limit: FETCH_LIMIT,
      });

      if (cancelled) return;

      if (result.error) {
        console.error("Individual leaderboard error:", result.error);
        setLoadError("Leaderboard එක පූරණය කිරීමේදී දෝෂයක් ඇති විය.");
        setIndividualLeaderboard([]);
      } else {
        setIndividualLeaderboard((result.data as IndividualRow[]) ?? []);
      }
      setLoadingIndividual(false);
    }

    void loadIndividual();
    return () => {
      cancelled = true;
    };
  }, [selectedSubject]);

  // ------------------------------------------------------------
  // Top-N slices + "my own row" lookups
  // ------------------------------------------------------------
  const topSchools = useMemo(
    () => schoolLeaderboard.slice(0, TOP_SCHOOLS),
    [schoolLeaderboard],
  );
  const mySchoolRow = useMemo(() => {
    if (!studentSchool) return null;
    return (
      schoolLeaderboard.find((s) => schoolsMatch(s.school, studentSchool)) ?? null
    );
  }, [schoolLeaderboard, studentSchool]);
  const isMySchoolInTop = useMemo(
    () => mySchoolRow != null && mySchoolRow.rank <= TOP_SCHOOLS,
    [mySchoolRow],
  );

  const topIndividuals = useMemo(
    () => individualLeaderboard.slice(0, TOP_INDIVIDUALS),
    [individualLeaderboard],
  );
  const myIndividualRow = useMemo(() => {
    if (!studentId) return null;
    return (
      individualLeaderboard.find((s) => s.student_id === studentId) ?? null
    );
  }, [individualLeaderboard, studentId]);
  const isMyIndividualInTop = useMemo(
    () => myIndividualRow != null && myIndividualRow.rank <= TOP_INDIVIDUALS,
    [myIndividualRow],
  );

  const noSubjectsForStream =
    !loadingSubjects && availableSubjects.length === 0;

  const pageLoading =
    activeTab === "school" ? loadingSchool : loadingIndividual;

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* ---------- Header ---------- */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <Link
              href="/student/dashboard"
              className="text-xs sm:text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="w-4 h-4" /> Dashboard
            </Link>
            <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-500 shrink-0" />
              AISSA Leaderboard
            </h1>
            <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
              {activeTab === "school"
                ? `Top ${TOP_SCHOOLS} පාසල් පමණක් · ඔබේ පාසල ඊට යටින්`
                : `Top ${TOP_INDIVIDUALS} සිසුන් · විෂය අනුව · ඔබේ තැන ඊට යටින්`}
            </p>
          </div>

          <div className="bg-gray-200 p-1 rounded-xl grid grid-cols-2 gap-1 sm:w-fit">
            <button
              onClick={() => setActiveTab("school")}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === "school"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <School className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> පාසල්
            </button>
            <button
              onClick={() => setActiveTab("individual")}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 sm:gap-2 ${
                activeTab === "individual"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> ශිෂ්‍ය
            </button>
          </div>
        </div>

        {loadError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
            {loadError}
          </div>
        )}

        {/* ============================================================ */}
        {/* SCHOOL VIEW                                                    */}
        {/* ============================================================ */}
        {activeTab === "school" && (
          <>
            {loadingSchool ? (
              <div className="p-8 sm:p-12 text-center text-gray-500 flex items-center justify-center gap-2 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading Leaderboard...
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {schoolLeaderboard.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm">
                      තවම දත්ත නොමැත.
                    </div>
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden lg:block overflow-x-auto overflow-y-auto max-h-[60vh]">
                        <table className="w-full text-left text-sm">
                          <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb] text-gray-700 uppercase text-xs font-semibold">
                            <tr>
                              <th className="p-4 w-14">Rank</th>
                              <th className="p-4">පාසල</th>
                              <th className="p-4 text-center">සහභාගී</th>
                              <th className="p-4 text-right">Top 5</th>
                              <th className="p-4 text-right">Academic /80</th>
                              <th className="p-4 text-right">Participation /20</th>
                              <th className="p-4 text-right">Total /100</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {topSchools.map((item) => {
                              const isMine = schoolsMatch(
                                item.school,
                                studentSchool,
                              );
                              return (
                                <tr
                                  key={item.school}
                                  className={
                                    isMine
                                      ? "bg-blue-50/60 hover:bg-blue-50"
                                      : item.rank <= 3
                                        ? "bg-amber-50/20 hover:bg-amber-50/40"
                                        : "hover:bg-gray-50"
                                  }
                                >
                                  <td className="p-4 text-center">
                                    <RankBadge rank={item.rank} />
                                  </td>
                                  <td className="p-4">
                                    <div className="font-bold text-gray-900 flex items-center gap-2">
                                      <span className="wrap-break-word">
                                        {item.school}
                                      </span>
                                      {isMine && (
                                        <span className="text-[9px] font-bold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded shrink-0">
                                          Your School
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-gray-400 mt-0.5">
                                      {item.students_count} registered ·{" "}
                                      {item.total_quizzes} attempts
                                    </div>
                                  </td>
                                  <td className="p-4 text-center font-semibold text-gray-800">
                                    {item.participating_students}
                                  </td>
                                  <td className="p-4 text-right">
                                    <span className="font-mono text-sm font-bold text-gray-700">
                                      {fmt(item.top5_marks)}
                                    </span>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="font-extrabold text-blue-700">
                                      {fmt(item.academic_score)}
                                    </div>
                                    <div className="flex justify-end mt-1">
                                      <ScoreBar
                                        value={item.academic_score}
                                        max={80}
                                        color="bg-blue-500"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="font-extrabold text-emerald-700">
                                      {fmt(item.participation_score)}
                                    </div>
                                    <div className="flex justify-end mt-1">
                                      <ScoreBar
                                        value={item.participation_score}
                                        max={20}
                                        color="bg-emerald-500"
                                      />
                                    </div>
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="text-lg font-extrabold text-indigo-700">
                                      {fmt(item.total_score)}
                                    </div>
                                    <div className="flex justify-end mt-1">
                                      <ScoreBar
                                        value={item.total_score}
                                        max={100}
                                        color="bg-indigo-500"
                                        width="w-24"
                                      />
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile cards — max-h + scroll */}
                      <div className="lg:hidden divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                        {topSchools.map((item) => {
                          const isTop3 = item.rank <= 3;
                          const isMine = schoolsMatch(
                            item.school,
                            studentSchool,
                          );
                          return (
                            <div
                              key={item.school}
                              className={`p-4 space-y-3 ${
                                isMine
                                  ? "bg-blue-50/60"
                                  : isTop3
                                    ? "bg-amber-50/30"
                                    : ""
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="shrink-0 w-8 text-center">
                                  <RankBadge rank={item.rank} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-gray-900 leading-snug wrap-break-word">
                                      {item.school}
                                    </h3>
                                    {isMine && (
                                      <span className="text-[9px] font-bold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded shrink-0">
                                        Your School
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-gray-500 mt-0.5">
                                    {item.students_count} registered ·{" "}
                                    {item.total_quizzes} attempts ·{" "}
                                    {item.participating_students} participated
                                  </p>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-center">
                                  <p className="text-[9px] uppercase font-bold text-blue-600">
                                    Academic
                                  </p>
                                  <p className="text-sm font-extrabold text-blue-800">
                                    {fmt(item.academic_score)}
                                  </p>
                                  <p className="text-[9px] text-blue-500">/80</p>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
                                  <p className="text-[9px] uppercase font-bold text-emerald-600">
                                    Participation
                                  </p>
                                  <p className="text-sm font-extrabold text-emerald-800">
                                    {fmt(item.participation_score)}
                                  </p>
                                  <p className="text-[9px] text-emerald-500">
                                    /20
                                  </p>
                                </div>
                                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-center">
                                  <p className="text-[9px] uppercase font-bold text-indigo-600">
                                    Total
                                  </p>
                                  <p className="text-sm font-extrabold text-indigo-800">
                                    {fmt(item.total_score)}
                                  </p>
                                  <p className="text-[9px] text-indigo-500">
                                    /100
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {mySchoolRow && !isMySchoolInTop && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-500 font-semibold px-1">
                      ✨ ඔබේ පාසලේ තැන (Your School)
                    </div>
                    <YourSchoolRow item={mySchoolRow} />
                  </div>
                )}

                {!studentSchool && schoolLeaderboard.length > 0 && (
                  <p className="text-[11px] text-center text-gray-400">
                    ඔබේ profile එකේ පාසල සටහන් කර නැත — ඔබේ පාසලේ තැන පෙන්විය
                    නොහැක.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {/* ============================================================ */}
        {/* INDIVIDUAL VIEW                                                */}
        {/* ============================================================ */}
        {activeTab === "individual" && (
          <div className="space-y-4">
            {loadingSubjects ? (
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm text-xs text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading subjects...
              </div>
            ) : noSubjectsForStream ? (
              <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm text-center text-gray-400 text-sm">
                ඔබේ <strong className="text-gray-600">{studentStream ?? "stream"}</strong>{" "}
                එකට අදාළ quizzes තවම නොමැත.
              </div>
            ) : (
              <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm flex gap-1 overflow-x-auto">
                {availableSubjects.map((subject) => {
                  const meta = subjectMeta(subject);
                  const isActive = selectedSubject === subject;
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => setSelectedSubject(subject)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 ${
                        isActive ? meta.active : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {meta.icon}
                      <span>{subject}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {loadingSubjects || noSubjectsForStream ? null : loadingIndividual ? (
              <div className="p-8 sm:p-12 text-center text-gray-500 flex items-center justify-center gap-2 text-sm bg-white rounded-xl border border-gray-200">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading{" "}
                {selectedSubject} Leaderboard...
              </div>
            ) : individualLeaderboard.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
                {selectedSubject} ප්‍රතිඵල තවම නොමැත.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto overflow-y-auto max-h-[60vh]">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_#e5e7eb] text-gray-700 uppercase text-xs font-semibold">
                        <tr>
                          <th className="p-4 w-16">Rank</th>
                          <th className="p-4">ශිෂ්‍යයා</th>
                          <th className="p-4">පාසල</th>
                          <th className="p-4 text-center">Medium</th>
                          <th className="p-4 text-center">Quizzes</th>
                          <th className="p-4 text-right">මුළු ලකුණු</th>
                          <th className="p-4 text-right">මුළු කාලය</th>
                          <th className="p-4 text-right">Avg %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {topIndividuals.map((item) => {
                          const isMe = item.student_id === studentId;
                          return (
                            <tr
                              key={item.student_id}
                              className={
                                isMe
                                  ? "bg-blue-50/60 hover:bg-blue-50"
                                  : item.rank <= 3
                                    ? "bg-amber-50/20 hover:bg-amber-50/40"
                                    : "hover:bg-gray-50"
                              }
                            >
                              <td className="p-4 text-center">
                                <RankBadge rank={item.rank} />
                              </td>
                              <td className="p-4 font-bold text-gray-900">
                                <div className="flex items-center gap-2">
                                  <Award className="w-4 h-4 text-blue-600 shrink-0" />
                                  <span className="truncate">
                                    {item.full_name}
                                  </span>
                                  {isMe && (
                                    <span className="text-[9px] font-bold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded shrink-0">
                                      You
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-gray-600 text-xs">
                                {item.school}
                              </td>
                              <td className="p-4 text-center">
                                <span
                                  className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 uppercase"
                                  title={mediumFull(item.medium)}
                                >
                                  {mediumShort(item.medium)}
                                </span>
                              </td>
                              <td className="p-4 text-center text-gray-500">
                                {item.quizzes_completed}
                              </td>
                              <td className="p-4 text-right font-extrabold text-blue-700 text-base">
                                {item.total_score}
                              </td>
                              <td className="p-4 text-right text-xs text-gray-500 font-mono">
                                <span className="flex items-center justify-end gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatTime(item.total_time_seconds)}
                                </span>
                              </td>
                              <td className="p-4 text-right text-xs font-semibold text-gray-500">
                                {item.average_score != null
                                  ? `${item.average_score}%`
                                  : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards — max-h + scroll */}
                  <div className="md:hidden divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                    {topIndividuals.map((item) => {
                      const isTop3 = item.rank <= 3;
                      const isMe = item.student_id === studentId;
                      return (
                        <div
                          key={item.student_id}
                          className={`p-4 space-y-2 ${
                            isMe
                              ? "bg-blue-50/60"
                              : isTop3
                                ? "bg-amber-50/30"
                                : ""
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 w-8 text-center">
                              <RankBadge rank={item.rank} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-gray-900 leading-snug truncate">
                                  {item.full_name}
                                </h3>
                                {isMe && (
                                  <span className="text-[9px] font-bold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded shrink-0">
                                    You
                                  </span>
                                )}
                                <span
                                  className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 uppercase shrink-0"
                                  title={mediumFull(item.medium)}
                                >
                                  {mediumShort(item.medium)}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                                {item.school}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-base font-extrabold text-blue-700 leading-none">
                                {item.total_score}
                              </p>
                              <p className="text-[9px] text-gray-400 uppercase font-bold mt-0.5">
                                marks
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 pl-11">
                            <span className="flex items-center gap-1">
                              <Award className="w-3 h-3" />
                              {item.quizzes_completed} quizzes
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTime(item.total_time_seconds)}
                            </span>
                            {item.average_score != null && (
                              <span className="font-semibold text-gray-600">
                                Avg {item.average_score}%
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {myIndividualRow && !isMyIndividualInTop && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] sm:text-xs text-gray-500 font-semibold px-1">
                      ✨ ඔබේ ස්ථානය (Your Rank) — {selectedSubject}
                    </div>
                    <YourRankRow item={myIndividualRow} />
                  </div>
                )}

                {!myIndividualRow && (
                  <p className="text-[11px] text-center text-gray-400">
                    {selectedSubject} විෂයට ඔබ තවම සහභාගී වී නැත — ranking
                    එකේ ඔබේ ස්ථානයක් නොමැත.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "individual" &&
          !pageLoading &&
          !noSubjectsForStream &&
          selectedSubject && (
            <p className="text-[11px] text-center text-gray-400 leading-relaxed">
              {selectedSubject} ranking එකේදී —{" "}
              <span className="font-semibold text-gray-500">මුළු ලකුණු එකතුව</span>{" "}
              ඉහළම කෙනා ඉහළට · සම ලකුණු විට{" "}
              <span className="font-semibold text-gray-500">අඩු මුළු කාලය</span>{" "}
              ගතකළ කෙනා ජය ගනී.
            </p>
          )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// "Your Rank"
// ------------------------------------------------------------
function YourRankRow({ item }: { item: IndividualRow }) {
  return (
    <div className="bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-xl shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm">
            #{item.rank}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                {item.full_name}
              </h3>
              <span className="text-[9px] font-bold uppercase bg-blue-600 text-white px-1.5 py-0.5 rounded shrink-0">
                You
              </span>
              <span
                className="inline-block text-[9px] font-bold px-1.5 py-0.5 rounded bg-white text-gray-700 uppercase shrink-0 border border-gray-200"
                title={mediumFull(item.medium)}
              >
                {mediumShort(item.medium)}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
              {item.school}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <Stat
            label="Marks"
            value={String(item.total_score)}
            accent="text-blue-700"
          />
          <Stat
            label="Avg"
            value={item.average_score != null ? `${item.average_score}%` : "—"}
            accent="text-emerald-700"
          />
          <Stat
            label="Time"
            value={formatTime(item.total_time_seconds)}
            accent="text-indigo-700"
            mono
          />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// "Your School"
// ------------------------------------------------------------
function YourSchoolRow({ item }: { item: SchoolRow }) {
  return (
    <div className="bg-linear-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm">
            #{item.rank}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base leading-snug wrap-break-word">
                {item.school}
              </h3>
              <span className="text-[9px] font-bold uppercase bg-amber-600 text-white px-1.5 py-0.5 rounded shrink-0">
                Your School
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {item.students_count} registered · {item.total_quizzes} attempts ·{" "}
              {item.participating_students} participated
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-5">
          <Stat
            label="Academic"
            value={`${fmt(item.academic_score)}/80`}
            accent="text-blue-700"
          />
          <Stat
            label="Participation"
            value={`${fmt(item.participation_score)}/20`}
            accent="text-emerald-700"
          />
          <Stat
            label="Total"
            value={`${fmt(item.total_score)}/100`}
            accent="text-indigo-700"
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value: string;
  accent: string;
  mono?: boolean;
}) {
  return (
    <div className="text-center shrink-0">
      <p className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">
        {label}
      </p>
      <p
        className={`text-sm sm:text-base font-extrabold ${accent} ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}