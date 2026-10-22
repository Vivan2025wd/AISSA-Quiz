"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Trophy,
  LayoutDashboard,
  UserPlus,
  LogIn,
  ShieldCheck,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function HomePage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      setIsLoggedIn(true);

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.is_admin) setIsAdmin(true);
      setLoading(false);
    }

    void checkUser();
  }, []);

  const renderAdminCTA = () => {
    if (loading) return null;

    if (isLoggedIn && isAdmin) {
      return (
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-teal-500 hover:bg-teal-400 text-slate-900 text-xs sm:text-sm font-bold rounded-xl shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 transition"
        >
          <BarChart3 className="w-4 h-4" /> Go to Admin Panel
        </Link>
      );
    }

    if (isLoggedIn && !isAdmin) return null;

    return (
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-teal-300 font-medium transition"
      >
        <ShieldCheck className="w-4 h-4" /> Admin Access Portal
      </Link>
    );
  };

  return (
    // Light page aurora — the card itself carries the dark theme.
    // In dark mode, the page background goes neutral slate and the auroras dim.
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Decorative blobs behind the card — dimmed in dark mode */}
      <div className="pointer-events-none absolute top-[-10%] left-[-10%] w-72 h-72 sm:w-96 sm:h-96 bg-emerald-200 dark:bg-emerald-500/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-40 dark:opacity-100" />
      <div
        className="pointer-events-none absolute bottom-[-10%] right-[-10%] w-72 h-72 sm:w-96 sm:h-96 bg-teal-200 dark:bg-teal-500/10 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-40 dark:opacity-100"
        style={{ animationDelay: "2s" }}
      />
      <div className="pointer-events-none absolute top-[20%] right-[10%] w-60 h-60 bg-green-100 dark:bg-green-500/5 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-30 dark:opacity-100" />

      {/* ═══════════ DARK CARD — same treatment as dashboard banner ═══════════ */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-slate-700/50">
        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* teal glows */}
        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl" />
        {/* decorative rings */}
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-teal-400/10" />
        <div className="pointer-events-none absolute top-1/2 -right-24 w-72 h-72 rounded-full border-[1.5px] border-teal-400/10 hidden md:block" />
        {/* shine */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/5" />

        <div className="relative p-6 sm:p-8 md:p-10 space-y-5 sm:space-y-6 text-center">
          {/* ✨ Logo */}
          <div className="relative flex justify-center pt-2">
            <div className="relative">
              <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
              <div className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aissa-logo.png"
                  alt="AISSA 1 to 50"
                  className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(45,212,191,0.5)]"
                />
              </div>
            </div>
          </div>

          {/* Small badge above the title */}
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
              <Sparkles className="w-3.5 h-3.5" />
              AISSA Quiz Engine
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-tight text-white">
              All Island School Science Association
            </h1>
          </div>

          <p className="text-slate-300 text-sm sm:text-base md:text-lg leading-relaxed">
            විද්‍යා විෂය සිසුන්ට සවියක් — ඔන්ලයින් ප්‍රශ්න පත්‍ර, ක්ෂණික ලකුණු සහ Real-time Leaderboards.
          </p>

          {!loading && (
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {isLoggedIn ? (
                <>
                  <Link
                    href="/student/dashboard"
                    className="px-5 sm:px-6 py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl transition shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <LayoutDashboard className="w-5 h-5" /> Dashboard
                  </Link>
                  <Link
                    href="/student/leaderboard"
                    className="px-5 sm:px-6 py-3.5 border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm sm:text-base backdrop-blur-sm"
                  >
                    <Trophy className="w-5 h-5 text-teal-300" /> Leaderboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/register"
                    className="px-5 sm:px-6 py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl transition shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 text-sm sm:text-base"
                  >
                    <UserPlus className="w-5 h-5" /> Register
                  </Link>
                  <Link
                    href="/auth/login"
                    className="px-5 sm:px-6 py-3.5 border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm sm:text-base backdrop-blur-sm"
                  >
                    <LogIn className="w-5 h-5 text-teal-300" /> Login
                  </Link>
                </>
              )}
            </div>
          )}

          <div className="pt-5 sm:pt-6 border-t border-white/10 mt-4 sm:mt-6 min-h-10 flex items-center justify-center">
            {renderAdminCTA()}
          </div>
        </div>
      </div>
    </div>
  );
}