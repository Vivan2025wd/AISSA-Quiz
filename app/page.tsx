"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  GraduationCap,
  Trophy,
  LayoutDashboard,
  UserPlus,
  LogIn,
  ShieldCheck,
  BarChart3,
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
          className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition"
        >
          <BarChart3 className="w-4 h-4" /> Go to Admin Panel
        </Link>
      );
    }

    if (isLoggedIn && !isAdmin) return null;

    return (
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-emerald-600 font-medium transition"
      >
        <ShieldCheck className="w-4 h-4" /> Admin Access Portal
      </Link>
    );
  };

  return (
    // 1. Modern Soft Gradient & Blob Background
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 flex flex-col justify-center items-center p-4 sm:p-6 text-center relative overflow-hidden">
      
      {/* Decorative floating blobs for a modern "Aurora" effect */}
      <div className="absolute top-[-10%] left-[-10%] w-72 h-72 sm:w-96 sm:h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-72 h-72 sm:w-96 sm:h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-pulse" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-[20%] right-[10%] w-60 h-60 bg-green-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30"></div>

      {/* 2. Glassmorphism Card */}
      <div className="relative w-full max-w-2xl bg-white/80 backdrop-blur-md p-6 sm:p-8 md:p-10 rounded-3xl shadow-xl border border-white/60 space-y-5 sm:space-y-6">
        
        <div className="inline-flex p-3 sm:p-4 bg-emerald-50 text-emerald-600 rounded-2xl shadow-sm">
          <GraduationCap className="w-10 h-10 sm:w-12 sm:h-12" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-tight">
            All Island School Science Association
          </h1>
          <p className="text-emerald-600 font-semibold text-xs sm:text-sm tracking-wide uppercase">
            AISSA Quiz Platform
          </p>
        </div>

        <p className="text-gray-600 text-sm sm:text-base md:text-lg leading-relaxed">
          A/L විද්‍යා අංශයේ සිසුන් සඳහා සජීවී ඔන්ලයින් ප්‍රශ්න පත්‍ර, ක්ෂණික ලකුණු විශ්ලේෂණය සහ Real-time Leaderboards.
        </p>

        {!loading && (
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {isLoggedIn ? (
              <>
                <Link
                  href="/student/dashboard"
                  className="px-5 sm:px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <LayoutDashboard className="w-5 h-5" /> Dashboard
                </Link>
                <Link
                  href="/student/leaderboard"
                  className="px-5 sm:px-6 py-3.5 border border-gray-200 bg-white/50 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/auth/register"
                  className="px-5 sm:px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <UserPlus className="w-5 h-5" /> Register
                </Link>
                <Link
                  href="/auth/login"
                  className="px-5 sm:px-6 py-3.5 border border-gray-200 bg-white/50 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <LogIn className="w-5 h-5" /> Login
                </Link>
              </>
            )}
          </div>
        )}

        <div className="pt-5 sm:pt-6 border-t border-gray-100/50 mt-4 sm:mt-6 min-h-10 flex items-center justify-center">
          {renderAdminCTA()}
        </div>
      </div>
    </div>
  );
}