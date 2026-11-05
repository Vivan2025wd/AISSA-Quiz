"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Hourglass, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { formatCountdown } from "@/lib/quiz-window";

const COLOMBO = "Asia/Colombo";

type WeeklyQuiz = {
  id: string;
  title: string;
  subject: string;
  stream: string | null;
  scheduled_at: string;
  duration_minutes: number;
  total_questions: number | null;
};

type DayGroup = {
  dateKey: string;
  weekday: string;
  dateLabel: string;
  isToday: boolean;
  quizzes: WeeklyQuiz[];
};

function colomboDateKey(instant: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COLOMBO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function colomboWeekday(instant: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO,
    weekday: "long",
  }).format(instant);
}

function colomboDateLabel(instant: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO,
    day: "2-digit",
    month: "short",
  }).format(instant);
}

function colomboTime(instant: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: COLOMBO,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}

/** Group already-filtered quizzes by Colombo calendar day. Empty days are omitted. */
function groupByWeekday(quizzes: WeeklyQuiz[], now: number): DayGroup[] {
  const todayKey = colomboDateKey(new Date(now));
  const groups = new Map<string, DayGroup>();

  for (const quiz of quizzes) {
    const start = new Date(quiz.scheduled_at);
    if (Number.isNaN(start.getTime())) continue;

    const dateKey = colomboDateKey(start);
    const existing = groups.get(dateKey);
    if (existing) {
      existing.quizzes.push(quiz);
      continue;
    }

    groups.set(dateKey, {
      dateKey,
      weekday: colomboWeekday(start),
      dateLabel: colomboDateLabel(start),
      isToday: dateKey === todayKey,
      quizzes: [quiz],
    });
  }

  return Array.from(groups.values())
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .map((group) => ({
      ...group,
      quizzes: [...group.quizzes].sort(
        (a, b) =>
          new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime(),
      ),
    }));
}

function subjectChipClass(subject: string): string {
  const value = subject.toLowerCase();
  if (value.includes("physics")) {
    return "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300";
  }
  if (value.includes("chemistry")) {
    return "bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300";
  }
  if (value.includes("biology")) {
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  }
  if (value.includes("ict") || value.includes("information")) {
    return "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300";
  }
  return "bg-gray-100 text-gray-700 dark:bg-slate-900/60 dark:text-gray-300";
}

export default function WeeklyTimetable() {
  const [quizzes, setQuizzes] = useState<WeeklyQuiz[]>([]);
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
        const { data, error: rpcError } = await supabase.rpc("get_weekly_timetable");
        if (!active) return;
        if (rpcError) {
          setError(rpcError.message);
        } else {
          setQuizzes((data ?? []) as WeeklyQuiz[]);
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

  const days = useMemo(() => groupByWeekday(quizzes, now), [quizzes, now]);

  return (
    <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/80 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
            <CalendarDays className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Upcoming quizzes
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Live quizzes scheduled in the next 7 days for your subjects
          </p>
        </div>
        {!loading && !error && days.length > 0 && (
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
            {quizzes.length} upcoming
          </span>
        )}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-5 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading timetable…
        </p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          Timetable could not be loaded: {error}
        </p>
      ) : days.length === 0 ? (
        <p className="py-5 text-sm text-gray-500 dark:text-gray-400">
          No quizzes for your subjects are scheduled in the next 7 days.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {days.map((day) => (
            <article
              key={day.dateKey}
              className="overflow-hidden rounded-xl border border-emerald-100/80 bg-white/70 dark:border-slate-700 dark:bg-slate-900/40"
            >
              <header className="flex items-center justify-between gap-2 border-b border-emerald-100/80 bg-emerald-50/70 px-3 py-2.5 dark:border-slate-700 dark:bg-emerald-950/30">
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    {day.weekday}
                  </p>
                  <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    {day.dateLabel}
                  </p>
                </div>
                {day.isToday && (
                  <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Today
                  </span>
                )}
              </header>
              <ul className="space-y-2 p-3">
                {day.quizzes.map((quiz) => {
                  const startsInMs = new Date(quiz.scheduled_at).getTime() - now;
                  return (
                    <li
                      key={quiz.id}
                      className="rounded-lg border border-gray-200/80 bg-white/80 p-2.5 dark:border-slate-700 dark:bg-slate-950/40"
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">
                          {quiz.title}
                        </p>
                        <span
                          className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${subjectChipClass(quiz.subject)}`}
                        >
                          {quiz.subject}
                        </span>
                      </div>
                      <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {quiz.stream ? `${quiz.stream} · ` : ""}
                        {quiz.duration_minutes} min
                        {quiz.total_questions != null
                          ? ` · ${quiz.total_questions} questions`
                          : ""}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold">
                        <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                          <Clock className="h-3.5 w-3.5" />
                          {colomboTime(new Date(quiz.scheduled_at))}
                        </span>
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
