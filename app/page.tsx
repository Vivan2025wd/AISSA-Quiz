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

      // Determine admin status so we can render the right admin CTA
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.is_admin) {
        setIsAdmin(true);
      }

      setLoading(false);
    }

    void checkUser();
  }, []);

  // ============================================================
  // Admin CTA — one element, three states
  // ============================================================
  const renderAdminCTA = () => {
    if (loading) return null;

    // Logged-in admin → prominent button to the panel
    if (isLoggedIn && isAdmin) {
      return (
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-xl shadow-sm transition"
        >
          <BarChart3 className="w-4 h-4" /> Go to Admin Panel
        </Link>
      );
    }

    // Logged-in student → admin CTA hidden entirely
    if (isLoggedIn && !isAdmin) {
      return null;
    }

    // Not logged in → small subtle link to login (which will
    // auto-prompt for the admin code if the account is an admin)
    return (
      <Link
        href="/auth/login"
        className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 font-medium transition"
      >
        <ShieldCheck className="w-4 h-4" /> Admin Access Portal
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-6 text-center">
      <div className="max-w-2xl bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-gray-200 space-y-6">
        {/* Logo Badge */}
        <div className="inline-flex p-4 bg-blue-50 text-blue-600 rounded-2xl">
          <GraduationCap className="w-12 h-12" />
        </div>

        {/* Title & Subtitle */}
        <div className="space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 tracking-tight">
            All Island School Science Association
          </h1>
          <p className="text-blue-600 font-semibold text-sm tracking-wide uppercase">
            AISSA Quiz Platform
          </p>
        </div>

        <p className="text-gray-600 text-base sm:text-lg leading-relaxed">
          A/L විද්‍යා අංශයේ (Bio & Maths) සිසුන් සඳහා සජීවී ඔන්ලයින් ප්‍රශ්න පත්‍ර, ක්ෂණික ලකුණු විශ්ලේෂණය සහ දිවයිනේ හා පාසල් මට්ටමේ Real-time Leaderboards.
        </p>

        {/* Primary Action Buttons */}
        {!loading && (
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
            {isLoggedIn ? (
              <>
                <Link
                  href="/student/dashboard"
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                >
                  <LayoutDashboard className="w-5 h-5" /> Go to Dashboard
                </Link>
                <Link
                  href="/student/leaderboard"
                  className="px-6 py-3.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/auth/register"
                  className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-5 h-5" /> Register Now
                </Link>
                <Link
                  href="/auth/login"
                  className="px-6 py-3.5 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <LogIn className="w-5 h-5" /> Login
                </Link>
              </>
            )}
          </div>
        )}

        {/* Admin CTA — one element, conditionally rendered */}
        <div className="pt-6 border-t border-gray-100 mt-6 min-h-10 flex items-center justify-center">
          {renderAdminCTA()}
        </div>
      </div>
    </div>
  );
}