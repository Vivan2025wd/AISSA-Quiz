"use client";

import React, { useEffect, useState } from "react";
import { Trophy, School, Users, Award, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type IndividualRow = {
  rank: number;
  student_id: string;
  full_name: string;
  school: string;
  quizzes_completed: number;
  average_score: number | null;
};

type SchoolRow = {
  rank: number;
  school: string;
  students_count: number;
  total_quizzes: number;
  avg_score: number | null;
};

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<"school" | "individual">("school");
  const [schoolLeaderboard, setSchoolLeaderboard] = useState<SchoolRow[]>([]);
  const [individualLeaderboard, setIndividualLeaderboard] = useState<IndividualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadLeaderboards() {
      setLoading(true);
      setLoadError(null);

      const [{ data: schoolData, error: schoolError }, { data: individualData, error: individualError }] =
        await Promise.all([
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
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <Link href="/student/dashboard" className="text-sm text-blue-600 hover:underline flex items-center gap-1 mb-1">
              <ArrowLeft className="w-4 h-4" /> Dashboard එකට යන්න
            </Link>
            <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
              <Trophy className="w-7 h-7 text-amber-500" /> AISSA Leaderboard
            </h1>
            <p className="text-xs text-gray-500">පාසල් සහ සිසුන්ගේ සමස්ත දක්ෂතා වර්ගීකරණය</p>
          </div>

          {/* Toggle Tabs */}
          <div className="bg-gray-200 p-1 rounded-xl flex gap-1">
            <button
              onClick={() => setActiveTab("school")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "school"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <School className="w-4 h-4" /> පාසල් මට්ටමින් (School Rank)
            </button>
            <button
              onClick={() => setActiveTab("individual")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === "individual"
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Users className="w-4 h-4" /> ශිෂ්‍ය මට්ටමින් (Individual Rank)
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
        {/* School Rank View */}
        {activeTab === "school" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-blue-50/50 border-b flex justify-between items-center text-xs text-blue-900 font-semibold">
              <span>පාසලේ සහභාගීත්වය සහ සාමාන්‍ය ලකුණු මට්ටම අනුව</span>
              <span>Total Schools Active: {schoolLeaderboard.length}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b text-gray-700 uppercase text-xs font-semibold">
                  <tr>
                    <th className="p-4 w-16">Rank</th>
                    <th className="p-4">පාසලේ නම</th>
                    <th className="p-4">සහභාගී වූ සිසුන් ගණන</th>
                    <th className="p-4">සම්පූර්ණ කළ Quizzes</th>
                    <th className="p-4">පාසලේ Avg Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schoolLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-400">
                        තවම දත්ත නොමැත.
                      </td>
                    </tr>
                  ) : (
                    schoolLeaderboard.map((item) => (
                      <tr key={item.school} className={item.rank <= 3 ? "bg-amber-50/20 hover:bg-amber-50/40" : "hover:bg-gray-50"}>
                        <td className="p-4 font-bold text-center">
                          {item.rank === 1 && <span className="text-xl">🥇</span>}
                          {item.rank === 2 && <span className="text-xl">🥈</span>}
                          {item.rank === 3 && <span className="text-xl">🥉</span>}
                          {item.rank > 3 && `#${item.rank}`}
                        </td>
                        <td className="p-4 font-bold text-gray-900">{item.school}</td>
                        <td className="p-4 font-medium text-gray-700">{item.students_count} සිසුන්</td>
                        <td className="p-4 text-gray-600">{item.total_quizzes} Quizzes</td>
                        <td className="p-4 font-extrabold text-blue-700">
                          {item.avg_score != null ? `${item.avg_score}%` : "N/A"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Individual Student Rank View */}
        {activeTab === "individual" && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-green-50/50 border-b flex justify-between items-center text-xs text-green-900 font-semibold">
              <span>සාමාන්‍ය ලකුණු මට්ටම අනුව ශ්‍රේණිගත කිරීම</span>
              <span>All Island A/L Rank</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b text-gray-700 uppercase text-xs font-semibold">
                  <tr>
                    <th className="p-4 w-16">Rank</th>
                    <th className="p-4">ශිෂ්‍යයාගේ නම</th>
                    <th className="p-4">පාසල</th>
                    <th className="p-4">සම්පූර්ණ කළ Quizzes</th>
                    <th className="p-4">සාමාන්‍ය ලකුණු</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {individualLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-gray-400">
                        තවම දත්ත නොමැත.
                      </td>
                    </tr>
                  ) : (
                    individualLeaderboard.map((item) => (
                      <tr key={item.student_id} className={item.rank <= 3 ? "bg-amber-50/20 hover:bg-amber-50/40" : "hover:bg-gray-50"}>
                        <td className="p-4 font-bold text-center">
                          {item.rank === 1 && <span className="text-xl">🥇</span>}
                          {item.rank === 2 && <span className="text-xl">🥈</span>}
                          {item.rank === 3 && <span className="text-xl">🥉</span>}
                          {item.rank > 3 && `#${item.rank}`}
                        </td>
                        <td className="p-4 font-bold text-gray-900 flex items-center gap-2">
                          <Award className="w-4 h-4 text-blue-600" /> {item.full_name}
                        </td>
                        <td className="p-4 text-gray-600">{item.school}</td>
                        <td className="p-4 text-gray-500">{item.quizzes_completed}</td>
                        <td className="p-4 font-extrabold text-green-600">
                          {item.average_score != null ? `${item.average_score}%` : "N/A"}
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