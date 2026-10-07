"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown,
  Users,
  School,
  FileQuestion,
  RefreshCw,
  ShieldCheck,
  GraduationCap,
  ArrowUpRight,
  UserCog,
  BookOpen,
  Tag,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Stats = {
  total_users: number;
  total_admins: number;
  total_super_admins: number;
  total_students: number;
  total_schools: number;
  total_aliases: number;
  total_quizzes: number;
  total_questions: number;
};

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("get_super_admin_stats");
    if (rpcErr) {
      setError(rpcErr.message);
    } else {
      setStats(data as Stats);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const run = async () => {
      await load();
    };

    void run();
  }, [load]);

  if (loading && !stats) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3 text-gray-500">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/loading-screen.png" alt="Loading" className="w-24 h-24 object-contain animate-pulse" />
        <div className="flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
          Loading Super Admin data...
        </div>
      </div>
    );
  }

  const cards = [
    {
      icon: <Users className="w-6 h-6" />,
      label: "Total Users",
      value: stats?.total_users ?? 0,
      accent: "bg-teal-50 text-teal-600",
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      label: "Administrators",
      value: stats?.total_admins ?? 0,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      icon: <Crown className="w-6 h-6" />,
      label: "Super Admins",
      value: stats?.total_super_admins ?? 0,
      accent: "bg-amber-50 text-amber-600",
    },
    {
      icon: <GraduationCap className="w-6 h-6" />,
      label: "Students",
      value: stats?.total_students ?? 0,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: <School className="w-6 h-6" />,
      label: "Schools",
      value: stats?.total_schools ?? 0,
      accent: "bg-purple-50 text-purple-600",
    },
    {
      icon: <Tag className="w-6 h-6" />,
      label: "Aliases",
      value: stats?.total_aliases ?? 0,
      accent: "bg-cyan-50 text-cyan-600",
    },
    {
      icon: <BookOpen className="w-6 h-6" />,
      label: "Quizzes",
      value: stats?.total_quizzes ?? 0,
      accent: "bg-rose-50 text-rose-600",
    },
    {
      icon: <FileQuestion className="w-6 h-6" />,
      label: "Questions",
      value: stats?.total_questions ?? 0,
      accent: "bg-indigo-50 text-indigo-600",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Header Banner ── */}
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
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />

        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400/30 blur-2xl rounded-full scale-110" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 bg-amber-500/15 rounded-2xl border border-amber-400/40 flex items-center justify-center">
                <Crown className="w-8 h-8 sm:w-10 sm:h-10 text-amber-300 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200">
                <Crown className="w-3.5 h-3.5" /> Chief Administrator
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight tracking-tight">
              Super Admin Control Center
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5">
              Manage system administrators and the official schools directory.
            </p>
          </div>

          <button
            onClick={() => void load()}
            disabled={loading}
            className="self-start sm:self-auto px-4 py-2.5 bg-amber-500/15 hover:bg-amber-500/25 backdrop-blur-md text-amber-100 text-xs font-bold rounded-xl flex items-center gap-2 transition border border-amber-400/30 disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="relative px-6 sm:px-8 pb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/admin/super/admins"
            className="px-4 py-3 bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold rounded-xl text-sm transition shadow-lg shadow-amber-500/20 hover:scale-[1.01] flex items-center justify-center gap-2"
          >
            <UserCog className="w-4 h-4" /> Manage Administrators
            <ArrowUpRight className="w-4 h-4" />
          </Link>
          <Link
            href="/admin/super/schools"
            className="px-4 py-3 bg-amber-500/15 hover:bg-amber-500/25 backdrop-blur-md text-amber-100 font-bold rounded-xl text-sm transition border border-amber-400/30 flex items-center justify-center gap-2"
          >
            <School className="w-4 h-4" /> Schools Directory
            <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ── Stat cards grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-xl border border-white/70 shadow-sm hover:shadow-md transition"
          >
            <div className={`p-2.5 w-fit rounded-lg mb-3 ${card.accent}`}>
              {card.icon}
            </div>
            <p className="text-xs text-gray-500 font-medium">{card.label}</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}