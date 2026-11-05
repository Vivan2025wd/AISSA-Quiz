"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type SyllabusEntry = {
  id: string;
  day_of_week: number;
  subject: string;
  topic: string | null;
  start_time: string;
  duration_minutes: number;
  target_stream: string | null;
};

type DayGroup = {
  day: number;
  label: string;
  entries: SyllabusEntry[];
};

const DAY_LABELS = [
  "",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function formatClock(value: string): string {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRange(start: string, durationMinutes: number): string {
  const [hourText, minuteText] = start.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return formatClock(start);
  const startDate = new Date(2000, 0, 1, hour, minute);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);
  const fmt = (date: Date) =>
    date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

/** Keep only days that have classes, ordered Monday → Sunday, then by start time. */
function groupByDay(entries: SyllabusEntry[]): DayGroup[] {
  const map = new Map<number, SyllabusEntry[]>();
  for (const entry of entries) {
    if (entry.day_of_week < 1 || entry.day_of_week > 7) continue;
    const list = map.get(entry.day_of_week) ?? [];
    list.push(entry);
    map.set(entry.day_of_week, list);
  }

  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([day, items]) => ({
      day,
      label: DAY_LABELS[day],
      entries: [...items].sort((a, b) => a.start_time.localeCompare(b.start_time)),
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

export default function WeeklyTimetableCard() {
  const [entries, setEntries] = useState<SyllabusEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc("get_student_timetable");
        if (!active) return;
        if (rpcError) {
          setError(rpcError.message);
        } else {
          setEntries((data ?? []) as SyllabusEntry[]);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error ? loadError.message : "Unexpected syllabus error.",
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

  const days = useMemo(() => groupByDay(entries), [entries]);
  const today = new Date().getDay();
  const todayIso = today === 0 ? 7 : today;

  return (
    <section className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur-md dark:border-slate-700 dark:bg-slate-800/80 sm:p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-lg">
            <CalendarDays className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Weekly syllabus
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Recurring classes for the subjects you take
          </p>
        </div>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 py-5 text-sm text-gray-500 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading syllabus…
        </p>
      ) : error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          Syllabus could not be loaded: {error}
        </p>
      ) : days.length === 0 ? (
        <p className="py-5 text-sm text-gray-500 dark:text-gray-400">
          No classes are scheduled for your subjects this week.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {days.map((day) => (
            <article
              key={day.day}
              className={`overflow-hidden rounded-xl border bg-white/70 dark:bg-slate-900/40 ${
                day.day === todayIso
                  ? "border-teal-300 dark:border-teal-700"
                  : "border-emerald-100/80 dark:border-slate-700"
              }`}
            >
              <header className="flex items-center justify-between gap-2 border-b border-emerald-100/80 bg-linear-to-r from-emerald-50/90 to-teal-50/70 px-3 py-2.5 dark:border-slate-700 dark:from-emerald-950/40 dark:to-teal-950/20">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{day.label}</p>
                {day.day === todayIso && (
                  <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Today
                  </span>
                )}
              </header>
              <ul className="space-y-2 p-3">
                {day.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-lg border border-gray-200/80 bg-white/80 p-2.5 dark:border-slate-700 dark:bg-slate-950/40"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <p className="min-w-0 text-sm font-bold leading-snug text-gray-900 dark:text-gray-100">
                        {entry.topic?.trim() || entry.subject}
                      </p>
                      <span
                        className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${subjectChipClass(entry.subject)}`}
                      >
                        {entry.subject}
                      </span>
                    </div>
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 dark:text-gray-300">
                      <Clock className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                      {formatRange(entry.start_time, entry.duration_minutes)}
                      <span className="font-medium text-gray-400 dark:text-gray-500">
                        · {entry.duration_minutes} min
                      </span>
                    </p>
                    {entry.target_stream && (
                      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        {entry.target_stream}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
