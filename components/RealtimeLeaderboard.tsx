"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Trophy, Medal } from "lucide-react";

interface LeaderboardEntry {
  id: string;
  score: number;
  time_spent_seconds: number;
  profiles: {
    full_name: string;
    school: string;
  };
}

export default function RealtimeLeaderboard({ quizId }: { quizId: string }) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    // 1. Initial Data Fetching (moved inside the effect so it isn't
    // recreated on every render and doesn't trigger exhaustive-deps /
    // set-state-in-effect lint warnings)
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .from("quiz_results")
        .select(`
          id,
          score,
          time_spent_seconds,
          profiles (
            full_name,
            school
          )
        `)
        .eq("quiz_id", quizId)
        .order("score", { ascending: false })
        .order("time_spent_seconds", { ascending: true })
        .limit(10);

      if (!error && data) {
        setLeaderboard(data as unknown as LeaderboardEntry[]);
      }
    };

    fetchLeaderboard();

    // 2. Real-time Subscription Setup
    const channel = supabase
      .channel("realtime-quiz-results")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quiz_results",
          filter: `quiz_id=eq.${quizId}`,
        },
        () => {
          // New submission detected, re-fetch rankings
          fetchLeaderboard();
        }
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
              <div>
                <p className="font-bold text-gray-800 text-sm">{entry.profiles?.full_name}</p>
                <p className="text-xs text-gray-500">{entry.profiles?.school}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-extrabold text-blue-600 text-sm">{entry.score} pts</p>
              <p className="text-[10px] text-gray-400">{entry.time_spent_seconds}s</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}