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

// ============================================================
// Types — matching the RPC output from migration 018
// ============================================================
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

// Compact duration formatter — "2h 14m" / "12m 30s" / "45s"
function formatTime(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Safe numeric formatter — never returns "NaN"
function fmt(value: unknown, decimals = 1): string {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n.toFixed(decimals) : "0.0";
}

// ============================================================
// Small helper — coloured progress bar
// ============================================================
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
    <div
      className={`${width} h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1 ml-auto`}
    >
      <div
        className={`h-full ${color} transition-all`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"school" | "individual">("school");
  const [schoolLeaderboard, setSchoolLeaderboard] = useState<SchoolRow[]>([]);
  const [individualLeaderboard, setIndividualLeaderboard] = useState<IndividualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---- Auth + registration gate ----
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

  // ---- Load both leaderboards ----
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
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ============================================================ */}
        {/* Header + Tabs                                                 */}
        {/* ============================================================ */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link
              href="/student/dashboard"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1"
            >
              <ArrowLeft className="w-4 h-4" /> Dashboard එකට යන්න
            </Link>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <Trophy className="w-7 h-7 text-amber-500" /> AISSA Leaderboard
            </h1>
          </div>

          <div className="bg-gray-200 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setActiveTab("school")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "school"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <School className="w-4 h-4" /> පාසල් මට්ටමින්
            </button>
            <button
              onClick={() => setActiveTab("individual")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "individual"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Users className="w-4 h-4" /> ශිෂ්‍ය මට්ටමින්
            </button>
          </div>
        </div>

        {loadError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
            {loadError}
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading Leaderboard...
          </div>
        ) : (
          <>
            {/* ============================================================ */}
            {/* SCHOOL VIEW                                                  */}
            {/* ============================================================ */}
            {activeTab === "school" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 border-b text-gray-700 uppercase text-xs font-semibold">
                      <tr>
                        <th className="p-4 w-14">Rank</th>
                        <th className="p-4 min-w-[50]">පාසල</th>
                        <th className="p-4 text-center">සහභාගී</th>
                        <th className="p-4 text-right">Top 5</th>
                        <th className="p-4 text-right">Academic /80</th>
                        <th className="p-4 text-right">Participation /20</th>
                        <th className="p-4 text-right">Total /100</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-gray-100">
                      {schoolLeaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-gray-400">
                            තවම දත්ත නොමැත.
                          </td>
                        </tr>
                      ) : (
                        schoolLeaderboard.map((item) => (
                          <tr
                            key={item.school}
                            className={
                              item.rank <= 3
                                ? "bg-amber-50/20 hover:bg-amber-50/40"
                                : "hover:bg-gray-50"
                            }
                          >
                            <td className="p-4 font-bold text-center">
                              {item.rank === 1 && <span className="text-xl">🥇</span>}
                              {item.rank === 2 && <span className="text-xl">🥈</span>}
                              {item.rank === 3 && <span className="text-xl">🥉</span>}
                              {item.rank > 3 && `#${item.rank}`}
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

                            <td className="p-4 text-center">
                              <span className="font-semibold text-gray-800">
                                {item.participating_students}
                              </span>
                            </td>

                            <td className="p-4 text-right">
                              <span className="font-mono text-sm font-bold text-gray-700">
                                {fmt(item.top5_marks)}
                              </span>
                            </td>

                            <td className="p-4 text-right align-top">
                              <div className="font-extrabold text-blue-700">
                                {fmt(item.academic_score)}
                              </div>
                              <ScoreBar
                                value={item.academic_score}
                                max={80}
                                color="bg-blue-500"
                              />
                            </td>

                            <td className="p-4 text-right align-top">
                              <div className="font-extrabold text-emerald-700">
                                {fmt(item.participation_score)}
                              </div>
                              <ScoreBar
                                value={item.participation_score}
                                max={20}
                                color="bg-emerald-500"
                              />
                            </td>

                            <td className="p-4 text-right align-top">
                              <div className="text-lg font-extrabold text-indigo-700">
                                {fmt(item.total_score)}
                              </div>
                              <ScoreBar
                                value={item.total_score}
                                max={100}
                                color="bg-indigo-500"
                                width="w-24"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* INDIVIDUAL VIEW                                              */}
            {/* ============================================================ */}
            {activeTab === "individual" && (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
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
                      {individualLeaderboard.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-gray-400">
                            තවම දත්ත නොමැත.
                          </td>
                        </tr>
                      ) : (
                        individualLeaderboard.map((item) => (
                          <tr
                            key={item.student_id}
                            className={
                              item.rank <= 3
                                ? "bg-amber-50/20 hover:bg-amber-50/40"
                                : "hover:bg-gray-50"
                            }
                          >
                            <td className="p-4 font-bold text-center">
                              {item.rank === 1 && <span className="text-xl">🥇</span>}
                              {item.rank === 2 && <span className="text-xl">🥈</span>}
                              {item.rank === 3 && <span className="text-xl">🥉</span>}
                              {item.rank > 3 && `#${item.rank}`}
                            </td>

                            <td className="p-4 font-bold text-gray-900">
                              <div className="flex items-center gap-2">
                                <Award className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="truncate">{item.full_name}</span>
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}