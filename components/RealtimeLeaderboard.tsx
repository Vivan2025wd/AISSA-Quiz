"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Trophy, Medal, Loader2 } from "lucide-react";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
interface LeaderboardEntry {
  id: string;
  score: number;
  total_marks: number;
  time_spent_seconds: number;
  student_name: string;
  school: string;
}

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
  is_admin: boolean | null;
}

export default function RealtimeLeaderboard({ quizId }: { quizId: string }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);

      const { data: resultsData, error: resultsError } = await supabase
        .from("quiz_results")
        .select("id, student_id, score, total_marks, time_spent_seconds")
        .eq("quiz_id", quizId)
        .order("score", { ascending: false })
        .order("time_spent_seconds", { ascending: true })
        .limit(40);

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

      const studentIds = Array.from(new Set(results.map((r) => r.student_id)));

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, school, is_admin")
        .in("id", studentIds);

      if (profilesError) {
        console.error("Realtime leaderboard profiles error:", profilesError);
      }

      const profileMap = new Map<string, ProfileRow>();
      (profilesData as ProfileRow[] | null)?.forEach((p) =>
        profileMap.set(p.id, p),
      );

      const merged: LeaderboardEntry[] = [];
      for (const r of results) {
        const p = profileMap.get(r.student_id);

        if (p?.is_admin === true) continue;

        merged.push({
          id: r.id,
          score: r.score ?? 0,
          total_marks: r.total_marks ?? 0,
          time_spent_seconds: r.time_spent_seconds ?? 0,
          student_name: p?.full_name || "Unknown Student",
          school: p?.school || "—",
        });

        if (merged.length >= 10) break;
      }

      setLeaderboard(merged);
      setLoading(false);
    };

    void fetchLeaderboard();

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
    <div className="relative overflow-hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-2xl shadow-sm dark:shadow-black/30 border border-white/70 dark:border-slate-700">
      {/* ═══════════ HEADER ═══════════ */}
      <div className="relative overflow-hidden bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white px-5 py-4">
        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        {/* glows */}
        <div className="pointer-events-none absolute -top-16 -right-12 w-48 h-48 bg-emerald-300/30 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 w-40 h-40 bg-teal-300/25 rounded-full blur-3xl" />

        <div className="relative flex items-center justify-between gap-3">
          <h2 className="text-base sm:text-lg font-extrabold flex items-center gap-2 leading-tight">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-amber-300/40 blur-md rounded-lg" />
              <div className="relative w-8 h-8 bg-white/15 backdrop-blur-md rounded-lg border border-white/25 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-300" />
              </div>
            </div>
            <span className="wrap-break-word">Real-time Leaderboard</span>
          </h2>

          {/* Live indicator */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full border border-white/20 shrink-0">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300"></span>
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              Live
            </span>
          </div>
        </div>
      </div>

      {/* ═══════════ BODY ═══════════ */}
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 py-8 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />{" "}
            Loading leaderboard...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-8">
            <div className="inline-flex p-3 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-2xl mb-2">
              <Trophy className="w-6 h-6" />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              තවම කිසිවෙක් මෙම Quiz එකට සහභාගී වී නැත.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {leaderboard.map((entry, index) => {
              const isFirst = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition ${
                    isFirst
                      ? "bg-linear-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 border-amber-300 dark:border-amber-800 shadow-sm"
                      : isSecond
                        ? "bg-linear-to-r from-gray-50 to-slate-50 dark:from-slate-900/60 dark:to-slate-800/60 border-gray-300 dark:border-slate-700 shadow-sm"
                        : isThird
                          ? "bg-linear-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/30 border-orange-300 dark:border-orange-800 shadow-sm"
                          : "bg-white/60 dark:bg-slate-900/40 border-gray-200 dark:border-slate-700 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 hover:border-emerald-200 dark:hover:border-emerald-800"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Rank badge */}
                    <span className="w-8 shrink-0 flex items-center justify-center">
                      {index < 3 ? (
                        <Medal
                          className={`w-5 h-5 ${
                            isFirst
                              ? "text-yellow-500"
                              : isSecond
                                ? "text-gray-400 dark:text-slate-400"
                                : "text-amber-600 dark:text-amber-400"
                          }`}
                        />
                      ) : (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                          #{index + 1}
                        </span>
                      )}
                    </span>

                    {/* Name + School */}
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">
                        {entry.student_name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {entry.school}
                      </p>
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                      {entry.score}
                      <span className="text-gray-400 dark:text-gray-500 font-semibold">
                        /{entry.total_marks}
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                      {entry.time_spent_seconds}s
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}