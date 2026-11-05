"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Crown,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type TimetableRow = {
  id: string;
  day_of_week: number;
  subject: string;
  topic: string | null;
  start_time: string;
  duration_minutes: number;
  target_stream: string | null;
  created_at: string;
};

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
] as const;

const SUBJECTS = ["Physics", "Chemistry", "Biology", "ICT"] as const;

const STREAMS = [
  { value: "", label: "All streams" },
  { value: "Bio Science", label: "Bio Science" },
  { value: "Maths", label: "Maths" },
] as const;

function dayLabel(day: number): string {
  return DAYS.find((item) => item.value === day)?.label ?? `Day ${day}`;
}

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

export default function SuperAdminTimetablePage() {
  const [rows, setRows] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>("Physics");
  const [topic, setTopic] = useState("");
  const [startTime, setStartTime] = useState("20:00");
  const [duration, setDuration] = useState("60");
  const [targetStream, setTargetStream] = useState("");

  const flash = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("weekly_timetable")
      .select(
        "id, day_of_week, subject, topic, start_time, duration_minutes, target_stream, created_at",
      )
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      flash("err", error.message);
      setRows([]);
    } else {
      setRows((data as TimetableRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<number, TimetableRow[]>();
    for (const row of rows) {
      const list = map.get(row.day_of_week) ?? [];
      list.push(row);
      map.set(row.day_of_week, list);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [rows]);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const minutes = Number(duration);
    if (!startTime) {
      flash("err", "Choose a start time.");
      return;
    }
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 600) {
      flash("err", "Duration must be between 1 and 600 minutes.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("weekly_timetable").insert({
      day_of_week: dayOfWeek,
      subject,
      topic: topic.trim() || null,
      start_time: startTime,
      duration_minutes: minutes,
      target_stream: targetStream || null,
    });
    setSaving(false);

    if (error) {
      flash("err", error.message);
      return;
    }

    setTopic("");
    flash("ok", "Syllabus slot added.");
    await load();
  };

  const handleDelete = async (row: TimetableRow) => {
    const label = `${dayLabel(row.day_of_week)} ${formatClock(row.start_time)} · ${row.subject}`;
    if (!window.confirm(`Delete “${label}” from the weekly syllabus?`)) return;

    const { error } = await supabase.from("weekly_timetable").delete().eq("id", row.id);
    if (error) {
      flash("err", error.message);
      return;
    }
    flash("ok", "Syllabus slot deleted.");
    await load();
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-3.5 sm:gap-5">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-amber-500/20">
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="relative p-4 sm:p-6 flex items-start gap-3 sm:gap-4">
          <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-amber-500/15 rounded-2xl border border-amber-400/40 flex items-center justify-center shrink-0">
            <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300" />
          </div>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200 mb-2">
              <Crown className="w-3.5 h-3.5" /> Super Admin
            </span>
            <h1 className="text-base sm:text-2xl font-extrabold leading-tight">
              Weekly Syllabus
            </h1>
            <p className="text-slate-300 text-[11px] sm:text-sm mt-1 leading-snug">
              Recurring classes students see every week. This is separate from live quiz dates.
            </p>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`p-2.5 sm:p-3 text-[11px] sm:text-xs font-semibold rounded-xl flex items-start gap-2 border ${
            toast.kind === "ok"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
          }`}
        >
          {toast.kind === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      <form
        onSubmit={handleAdd}
        className="rounded-2xl border border-white/70 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm p-4 sm:p-5 space-y-4"
      >
        <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Plus className="w-4 h-4 text-amber-500" /> Add a class
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Day
            <select
              value={dayOfWeek}
              onChange={(event) => setDayOfWeek(Number(event.target.value))}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            >
              {DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Subject
            <select
              value={subject}
              onChange={(event) =>
                setSubject(event.target.value as (typeof SUBJECTS)[number])
              }
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            >
              {SUBJECTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Stream
            <select
              value={targetStream}
              onChange={(event) => setTargetStream(event.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            >
              {STREAMS.map((item) => (
                <option key={item.label} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 sm:col-span-2">
            Topic <span className="font-normal text-gray-400">(optional)</span>
            <input
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="e.g. Mechanics — Newton’s laws"
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Start time
            <input
              type="time"
              required
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Duration (minutes)
            <input
              type="number"
              min={1}
              max={600}
              required
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-900 shadow-lg shadow-amber-500/20 hover:bg-amber-400 disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add to syllabus
        </button>
      </form>

      <section className="rounded-2xl border border-white/70 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm p-4 sm:p-5">
        <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100 mb-4">
          Scheduled classes
        </h2>
        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading syllabus…
          </p>
        ) : rows.length === 0 ? (
          <p className="py-6 text-sm text-gray-500 dark:text-gray-400">
            No recurring classes yet.
          </p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([day, items]) => (
              <div key={day}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {dayLabel(day)}
                </h3>
                <ul className="space-y-2">
                  {items.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-col gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {row.subject}
                          {row.topic ? ` · ${row.topic}` : ""}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatClock(row.start_time)} · {row.duration_minutes} min
                          </span>
                          <span>{row.target_stream ?? "All streams"}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDelete(row)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-bold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
