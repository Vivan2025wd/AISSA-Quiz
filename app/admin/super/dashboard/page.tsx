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
        <img
          src="/loading-screen.png"
          alt="Loading"
          className="w-20 h-20 sm:w-24 sm:h-24 object-contain animate-pulse"
        />
        <div className="flex items-center gap-2 text-xs sm:text-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
          Loading Super Admin data...
        </div>
      </div>
    );
  }

  const cards = [
    {
      icon: <Users className="w-4 h-4 sm:w-6 sm:h-6" />,
      label: "Total Users",
      labelShort: "Users",
      value: stats?.total_users ?? 0,
      accent: "bg-teal-50 text-teal-600",
    },
    {
      icon: <ShieldCheck className="w-4 h-4 sm:w-6 sm:h-6" />,
      label: "Administrators",
      labelShort: "Admins",
      value: stats?.total_admins ?? 0,
      accent: "bg-blue-50 text-blue-600",
    },
    {
      icon: <Crown className="w-4 h-4 sm:w-6 sm:h-6" />,
      label: "Super Admins",
      labelShort: "Super",
      value: stats?.total_super_admins ?? 0,
      accent: "bg-amber-50 text-amber-600",
    },
    {
      icon: <GraduationCap className="w-4 h-4 sm:w-6 sm:h-6" />,
      label: "Students",
      labelShort: "Students",
      value: stats?.total_students ?? 0,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: <School className="w-4 h-4 sm:w-6 sm:h-6" />,
      label: "Schools",
      labelShort: "Schools",
      value: stats?.total_schools ?? 0,
      accent: "bg-purple-50 text-purple-600",
    },
    {
      icon: <Tag className="w-4 h-4 sm:w-6 sm:h-6" />,
      label: "Aliases",
      labelShort: "Aliases",
      value: stats?.total_aliases ?? 0,
      accent: "bg-cyan-50 text-cyan-600",
    },
    {
      icon: <BookOpen className="w-4 h-4 sm:w-6 sm:h-6" />,
      label: "Quizzes",
      labelShort: "Quizzes",
      value: stats?.total_quizzes ?? 0,
      accent: "bg-rose-50 text-rose-600",
    },
    {
      icon: <FileQuestion className="w-4 h-4 sm:w-6 sm:h-6" />,
      label: "Questions",
      labelShort: "Questions",
      value: stats?.total_questions ?? 0,
      accent: "bg-indigo-50 text-indigo-600",
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* ═══ Header Banner — MOBILE-TIGHTENED ═══ */}
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
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-amber-400/10" />

        <div className="relative p-4 sm:p-8 flex items-start gap-3 sm:gap-5">
          {/* Icon — smaller on mobile */}
          <div className="shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400/30 blur-2xl rounded-full scale-110" />
              <div className="relative w-12 h-12 sm:w-20 sm:h-20 bg-amber-500/15 rounded-2xl border border-amber-400/40 flex items-center justify-center">
                <Crown className="w-6 h-6 sm:w-10 sm:h-10 text-amber-300 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5 sm:mb-2">
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-500/20 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200">
                <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Chief Administrator
              </span>
            </div>
            <h1 className="text-base sm:text-3xl font-extrabold leading-tight tracking-tight">
              Super Admin Control Center
            </h1>
            <p className="text-slate-300 text-[11px] sm:text-sm mt-1 sm:mt-1.5 leading-snug hidden sm:block">
              Manage system administrators and the official schools directory.
            </p>
          </div>

          <button
            onClick={() => void load()}
            disabled={loading}
            className="shrink-0 p-2 sm:px-4 sm:py-2.5 bg-amber-500/15 hover:bg-amber-500/25 backdrop-blur-md text-amber-100 text-xs font-bold rounded-xl flex items-center gap-2 transition border border-amber-400/30 disabled:opacity-60"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* Action buttons — 2-col on mobile */}
        <div className="relative px-4 sm:px-8 pb-4 sm:pb-6 grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3">
          <Link
            href="/admin/super/admins"
            className="px-3 sm:px-4 py-2.5 sm:py-3 bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold rounded-xl text-[11px] sm:text-sm transition shadow-lg shadow-amber-500/20 hover:scale-[1.01] flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <UserCog className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Manage Admins</span>
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 hidden sm:inline" />
          </Link>
          <Link
            href="/admin/super/schools"
            className="px-3 sm:px-4 py-2.5 sm:py-3 bg-amber-500/15 hover:bg-amber-500/25 backdrop-blur-md text-amber-100 font-bold rounded-xl text-[11px] sm:text-sm transition border border-amber-400/30 flex items-center justify-center gap-1.5 sm:gap-2"
          >
            <School className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">Schools Directory</span>
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 hidden sm:inline" />
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-2.5 sm:p-3 bg-red-50 border border-red-200 text-red-700 text-[11px] sm:text-xs font-semibold rounded-xl flex items-start gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* ═══ Stat cards grid — 2-col on mobile, tighter padding ═══ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="bg-white/80 backdrop-blur-md p-2.5 sm:p-5 rounded-xl border border-white/70 shadow-sm hover:shadow-md transition"
          >
            <div className={`p-1.5 sm:p-2.5 w-fit rounded-lg mb-2 sm:mb-3 ${card.accent}`}>
              {card.icon}
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium leading-tight">
              <span className="hidden sm:inline">{card.label}</span>
              <span className="sm:hidden">{card.labelShort}</span>
            </p>
            <p className="text-lg sm:text-2xl font-extrabold text-gray-900 mt-0.5 sm:mt-1 leading-tight">
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}