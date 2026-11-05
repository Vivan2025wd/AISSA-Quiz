"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock, Hourglass, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatCountdown } from "@/lib/quiz-window";

type UpcomingQuiz = {
  id: string;
  title: string;
  subject: string;
  stream: string | null;
  scheduled_at: string;
  duration_minutes: number;
  total_questions: number | null;
};

function colomboDateKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function groupedByColomboDate(quizzes: UpcomingQuiz[]) {
  const groups = new Map<string, UpcomingQuiz[]>();
  for (const quiz of quizzes) {
    const date = colomboDateKey(quiz.scheduled_at);
    const group = groups.get(date) ?? [];
    group.push(quiz);
    groups.set(date, group);
  }
  return Array.from(groups.entries());
}

export default function UpcomingQuizzesTimetable() {
  const [quizzes, setQuizzes] = useState<UpcomingQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc(
          "get_upcoming_quizzes_for_user",
        );
        if (!active) return;
        if (rpcError) {
          setError(rpcError.message);
        } else {
          setQuizzes((data ?? []) as UpcomingQuiz[]);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unexpected timetable error.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/80 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100">
        <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        Upcoming quizzes
      </h2>

      {loading ? (
        <p className="flex items-center gap-2 py-5 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading timetable…
        </p>
      ) : error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Timetable could not be loaded: {error}
        </p>
      ) : quizzes.length === 0 ? (
        <p className="py-5 text-sm text-gray-500 dark:text-gray-400">
          No eligible upcoming quizzes are scheduled.
        </p>
      ) : (
        <div className="space-y-4">
          {groupedByColomboDate(quizzes).map(([date, dayQuizzes]) => (
            <div key={date}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {new Intl.DateTimeFormat("en-GB", {
                  timeZone: "Asia/Colombo",
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                }).format(new Date(`${date}T00:00:00+05:30`))}
              </h3>
              <ul className="space-y-2">
                {dayQuizzes.map((quiz) => {
                  const startsInMs =
                    new Date(quiz.scheduled_at).getTime() - now;
                  return (
                    <li key={quiz.id}>
                      <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/40 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-gray-900 dark:text-gray-100">
                            {quiz.title}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {quiz.subject}{quiz.stream ? ` · ${quiz.stream}` : ""}
                            {quiz.total_questions != null
                              ? ` · ${quiz.total_questions} questions`
                              : ""}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-xs font-semibold text-gray-600 dark:text-gray-300">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {new Intl.DateTimeFormat("en-GB", {
                              timeZone: "Asia/Colombo",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(quiz.scheduled_at))}
                          </span>
                          {quiz.duration_minutes} min
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                          <Hourglass className="h-3.5 w-3.5" />
                          {startsInMs > 0
                            ? `Starts in ${formatCountdown(startsInMs)}`
                            : "Starting now"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
