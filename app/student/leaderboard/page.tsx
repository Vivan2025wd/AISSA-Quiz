"use client";

import React, { useEffect, useState } from "react";
import {
  Trophy,
  School,
  Users,
  Award,
  ArrowLeft,
  Loader2,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type IndividualRow = {
  rank: number;
  student_id: string;
  full_name: string;
  school: string;
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

export default function LeaderboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"school" | "individual">("school");
  const [schoolLeaderboard, setSchoolLeaderboard] = useState<SchoolRow[]>([]);
  const [individualLeaderboard, setIndividualLeaderboard] = useState<IndividualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!profile) {
        await supabase.auth.signOut();
        router.replace("/auth/login?reason=no_profile");
        return;
      }
    }

    void gate();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    async function loadLeaderboards() {
      setLoading(true);
      setLoadError(null);

      const [
        { data: schoolData, error: schoolError },
        { data: individualData, error: individualError },
      ] = await Promise.all([
        supabase.rpc("get_school_leaderboard", { p_limit: 50 }),
        supabase.rpc("get_individual_leaderboard", { p_limit: 50 }),
      ]);

      if (schoolError || individualError) {
        console.error("Leaderboard RPC error:", schoolError ?? individualError);
        setLoadError("Leaderboard එක පූරණය කිරීමේදී දෝෂයක් ඇති විය.");
        setLoading(false);
        return;
      }

      setSchoolLeaderboard((schoolData as SchoolRow[]) ?? []);
      setIndividualLeaderboard((individualData as IndividualRow[]) ?? []);
      setLoading(false);
    }

    loadLeaderboards();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
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
          </div>

          {/* Tabs — full-width on mobile */}
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

        {loading ? (
          <div className="p-8 sm:p-12 text-center text-gray-500 flex items-center justify-center gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading Leaderboard...
          </div>
        ) : (
          <>
            {/* ============ SCHOOL VIEW ============ */}
            {activeTab === "school" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {schoolLeaderboard.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    තවම දත්ත නොමැත.
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b text-gray-700 uppercase text-xs font-semibold">
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
                          {schoolLeaderboard.map((item) => (
                            <tr
                              key={item.school}
                              className={
                                item.rank <= 3
                                  ? "bg-amber-50/20 hover:bg-amber-50/40"
                                  : "hover:bg-gray-50"
                              }
                            >
                              <td className="p-4 text-center">
                                <RankBadge rank={item.rank} />
                              </td>
                              <td className="p-4">
                                <div className="font-bold text-gray-900">
                                  {item.school}
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
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="lg:hidden divide-y divide-gray-100">
                      {schoolLeaderboard.map((item) => {
                        const isTop3 = item.rank <= 3;
                        return (
                          <div
                            key={item.school}
                            className={`p-4 space-y-3 ${
                              isTop3 ? "bg-amber-50/30" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="shrink-0 w-8 text-center">
                                <RankBadge rank={item.rank} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-gray-900 leading-snug wrap-break-word">
                                  {item.school}
                                </h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  {item.students_count} registered ·{" "}
                                  {item.total_quizzes} attempts ·{" "}
                                  {item.participating_students} participated
                                </p>
                              </div>
                            </div>

                            {/* Score breakdown */}
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
                                <p className="text-[9px] text-emerald-500">/20</p>
                              </div>
                              <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-center">
                                <p className="text-[9px] uppercase font-bold text-indigo-600">
                                  Total
                                </p>
                                <p className="text-sm font-extrabold text-indigo-800">
                                  {fmt(item.total_score)}
                                </p>
                                <p className="text-[9px] text-indigo-500">/100</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ============ INDIVIDUAL VIEW ============ */}
            {activeTab === "individual" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {individualLeaderboard.length === 0 ? (
                  <div className="p-6 text-center text-gray-400 text-sm">
                    තවම දත්ත නොමැත.
                  </div>
                ) : (
                  <>
                    {/* Desktop table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 border-b text-gray-700 uppercase text-xs font-semibold">
                          <tr>
                            <th className="p-4 w-16">Rank</th>
                            <th className="p-4">ශිෂ්‍යයා</th>
                            <th className="p-4">පාසල</th>
                            <th className="p-4 text-center">Quizzes</th>
                            <th className="p-4 text-right">මුළු ලකුණු</th>
                            <th className="p-4 text-right">මුළු කාලය</th>
                            <th className="p-4 text-right">Avg %</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {individualLeaderboard.map((item) => (
                            <tr
                              key={item.student_id}
                              className={
                                item.rank <= 3
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
                                </div>
                              </td>
                              <td className="p-4 text-gray-600 text-xs">
                                {item.school}
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
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden divide-y divide-gray-100">
                      {individualLeaderboard.map((item) => {
                        const isTop3 = item.rank <= 3;
                        return (
                          <div
                            key={item.student_id}
                            className={`p-4 space-y-2 ${
                              isTop3 ? "bg-amber-50/30" : ""
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div className="shrink-0 w-8 text-center">
                                <RankBadge rank={item.rank} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-gray-900 leading-snug truncate">
                                  {item.full_name}
                                </h3>
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
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}