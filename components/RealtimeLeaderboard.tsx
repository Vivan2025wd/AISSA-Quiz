"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Trophy, Medal } from "lucide-react";

interface LeaderboardEntry {
  id: string;
  score: number;
  total_marks: number;
  time_spent_seconds: number;
  student_name: string;
  school: string;
}

// Flat shapes returned by our split queries (no nested select)
interface ResultRow {
  id: string;
  student_id: string;
  score: number | null;
  total_marks: number | null;
  time_spent_seconds: number | null;
}

interface ProfileRow {
  id: string;
  full_name: string | null;
  school: string | null;
}

export default function RealtimeLeaderboard({ quizId }: { quizId: string }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ------------------------------------------------------------
    // Flat-query + client-side join. Same pattern as the fixed
    // admin performance page — avoids PostgREST's nested-select
    // inference returning the embedded row as an array (which
    // leaves entry.profiles undefined and blanks the UI).
    // ------------------------------------------------------------
    const fetchLeaderboard = async () => {
      // 1. Fetch raw results for this quiz (score desc, time asc)
      const { data: resultsData, error: resultsError } = await supabase
        .from("quiz_results")
        .select("id, student_id, score, total_marks, time_spent_seconds")
        .eq("quiz_id", quizId)
        .order("score", { ascending: false })
        .order("time_spent_seconds", { ascending: true })
        .limit(10);

      if (resultsError) {
        console.error("Realtime leaderboard results error:", resultsError);
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      if (!resultsData || resultsData.length === 0) {
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      const results = resultsData as ResultRow[];

      // 2. Fetch the profiles for the students in that top-10
      const studentIds = Array.from(new Set(results.map((r) => r.student_id)));

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, school")
        .in("id", studentIds);

      if (profilesError) {
        console.error("Realtime leaderboard profiles error:", profilesError);
      }

      const profileMap = new Map<string, ProfileRow>();
      (profilesData as ProfileRow[] | null)?.forEach((p) =>
        profileMap.set(p.id, p),
      );

      // 3. Merge
      const merged: LeaderboardEntry[] = results.map((r) => {
        const p = profileMap.get(r.student_id);
        return {
          id: r.id,
          score: r.score ?? 0,
          total_marks: r.total_marks ?? 0,
          time_spent_seconds: r.time_spent_seconds ?? 0,
          student_name: p?.full_name || "Unknown Student",
          school: p?.school || "—",
        };
      });

      setLeaderboard(merged);
      setLoading(false);
    };

    void fetchLeaderboard();

    // ------------------------------------------------------------
    // Realtime subscription — refetch on any new submission for
    // this quiz. (quiz_results is in the supabase_realtime
    // publication per the master schema.)
    // ------------------------------------------------------------
    const channel = supabase
      .channel(`realtime-quiz-results-${quizId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quiz_results",
          filter: `quiz_id=eq.${quizId}`,
        },
        () => {
          void fetchLeaderboard();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [quizId]);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" /> Real-time Leaderboard
        </h2>
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
      </div>

      {loading ? (
        <div className="text-center text-xs text-gray-400 py-6">
          Loading leaderboard...
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="text-center text-xs text-gray-400 py-6">
          තවම කිසිවෙක් මෙම Quiz එකට සහභාගී වී නැත.
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                index === 0
                  ? "bg-yellow-50 border-yellow-200"
                  : index === 1
                    ? "bg-gray-50 border-gray-200"
                    : index === 2
                      ? "bg-amber-50 border-amber-200"
                      : "bg-white border-gray-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 font-bold text-gray-500 text-sm">
                  {index < 3 ? (
                    <Medal
                      className={`w-5 h-5 ${
                        index === 0
                          ? "text-yellow-500"
                          : index === 1
                            ? "text-gray-400"
                            : "text-amber-600"
                      }`}
                    />
                  ) : (
                    `#${index + 1}`
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-gray-800 text-sm truncate">
                    {entry.student_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {entry.school}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="font-extrabold text-blue-600 text-sm">
                  {entry.score}/{entry.total_marks}
                </p>
                <p className="text-[10px] text-gray-400">
                  {entry.time_spent_seconds}s
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}