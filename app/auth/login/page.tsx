"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LogIn,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Loader2,
  GraduationCap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  clearAdminSession,
  markAdminVerified,
} from "@/lib/admin-session";

export default function StudentLoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <StudentLoginPageInner />
    </Suspense>
  );
}

function LoginPageFallback() {
  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 relative flex items-center justify-center p-4">
      {/* Aurora blobs */}
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 rounded-full filter blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl shadow-emerald-900/20 mb-4">
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-teal-300/25 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-white/5" />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/8" />

          <div className="relative p-5 sm:p-6 flex items-center gap-4">
            <div className="shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-300/40 blur-xl rounded-full" />
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white/15 backdrop-blur-md rounded-2xl border border-white/25 shadow-lg flex items-center justify-center overflow-hidden">
                  <GraduationCap className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow" />
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-white/15">
                <ShieldCheck className="w-3.5 h-3.5" />
                AISSA
              </span>
              <h1 className="text-lg sm:text-xl font-extrabold leading-tight tracking-tight mt-1.5">
                AISSA Quiz Platform
              </h1>
            </div>
          </div>
        </div>

        {/* Loading card */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-xl p-6 sm:p-8">
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [needsAdminCode, setNeedsAdminCode] = useState(false);
  const [adminCode, setAdminCode] = useState("");

  const [error, setError] = useState(
    reason === "no_profile"
      ? "ඔබගේ ගිණුම සම්පූර්ණ නැත — කරුණාකර නැවත ලියාපදිංචි වන්න."
      : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ============================================================
  // Step 1 — email + password
  // ============================================================
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // 🔑 Clear any admin-verified flag from a PREVIOUS session
    // BEFORE attempting login. Otherwise an admin who used this
    // browser earlier leaves a stale flag that lets the NEXT user
    // skip the code prompt — even if they were only just granted
    // admin rights in the DB.
    clearAdminSession();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setIsSubmitting(false);
      setError(authError.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user?.id)
      .maybeSingle();

    if (profileError) {
      setIsSubmitting(false);
      setError("Profile Lookup Error: " + profileError.message);
      await supabase.auth.signOut();
      return;
    }

    if (!profile) {
      setIsSubmitting(false);
      setError(
        "ඔබගේ ගිණුම සම්පූර්ණ නැත — Profile එකක් සොයාගත නොහැක. කරුණාකර නැවත ලියාපදිංචි වන්න හෝ Admin අමතන්න.",
      );
      await supabase.auth.signOut();
      return;
    }

    setIsSubmitting(false);

    if (profile.is_admin) {
      // Force the code prompt — flag cleared above, so always fresh.
      setNeedsAdminCode(true);
      return;
    }

    router.push("/student/dashboard");
  };

  // ============================================================
  // Step 2 — admin code
  // ============================================================
  const handleAdminCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    const { data: verified, error: verifyError } = await supabase.rpc(
      "verify_admin_code",
      { p_code: adminCode },
    );

    if (verifyError) {
      setIsSubmitting(false);
      setError("Verification Error: " + verifyError.message);
      return;
    }

    if (!verified) {
      setIsSubmitting(false);
      setError("Admin Access Code එක වැරදිය. නැවත උත්සාහ කරන්න.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    setIsSubmitting(false);

    if (!user) {
      setError("Session expired — කරුණාකර නැවත login වන්න.");
      return;
    }

    // Bind the flag to the current user id + timestamp
    markAdminVerified(user.id);
    router.push("/admin/quizzes");
  };

  return (
    // ============ Modern green/white background ============
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 relative flex items-center justify-center p-4">
      {/* Aurora blobs */}
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed top-[35%] right-[15%] w-72 h-72 bg-green-100/60 rounded-full filter blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* ============ Header banner ============ */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl shadow-emerald-900/20 mb-4">
          {/* dot grid */}
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          {/* glows */}
          <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-teal-300/25 rounded-full blur-3xl" />
          {/* rings */}
          <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-white/5" />
          {/* shine */}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/8" />

          <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            {/* Logo */}
            <div className="shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-300/40 blur-xl rounded-full" />
                <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white/15 backdrop-blur-md rounded-2xl border border-white/25 shadow-lg flex items-center justify-center overflow-hidden">
                  <GraduationCap className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow" />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-white/15">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  AISSA
                </span>
                {needsAdminCode && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/25 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-300/30">
                    <KeyRound className="w-3.5 h-3.5" />
                    Admin Step
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold leading-tight tracking-tight">
                {needsAdminCode ? "Admin Verification" : "AISSA Quiz Platform"}
              </h1>
              <p className="text-emerald-50/90 text-[11px] sm:text-xs mt-1">
                {needsAdminCode
                  ? "Admin ගිණුමක් හඳුනාගන්නා ලදී — Access Code එක ඇතුළත් කරන්න"
                  : "ඔබගේ ගිණුමට ඇතුළත් වී Quizzes සඳහා සහභාගී වන්න"}
              </p>
            </div>
          </div>
        </div>

        {/* ============ Main Card (glass) ============ */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-xl p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {!needsAdminCode ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  ඊමේල් ලිපිනය (Email)
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    placeholder="student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 bg-white/60 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-gray-700 uppercase">
                    මුරපදය (Password)
                  </label>
                  <a
                    href="#"
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
                  >
                    Password අමතකද?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 bg-white/60 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm hover:shadow-md transition mt-2 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    ඇතුළු වන්න (Login) <LogIn className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminCodeSubmit} className="space-y-4">
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                <label className="flex text-xs font-extrabold text-amber-900 uppercase items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600" /> Admin Access Code
                </label>
                <input
                  type="password"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  required
                  autoFocus
                  disabled={isSubmitting}
                  placeholder="••••••••"
                  className="w-full px-3 py-3 bg-white border border-amber-300 rounded-xl font-bold text-sm text-amber-900 focus:ring-2 focus:ring-amber-500 outline-none placeholder:font-normal disabled:opacity-60"
                />
                <p className="text-[11px] text-amber-700 font-medium">
                  * ඔබට Admin Access Code එක ලබාදී ඇති නම් පමණක් ඉදිරියට යන්න.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm hover:shadow-md transition disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    තහවුරු කර ඇතුළත් වන්න <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {!needsAdminCode && (
            <div className="pt-4 border-t border-gray-100 text-center text-xs text-gray-600">
              ගිණුමක් තවම නැද්ද?{" "}
              <Link
                href="/auth/register"
                className="font-bold text-emerald-600 hover:text-emerald-700 hover:underline inline-flex items-center gap-0.5"
              >
                ලියාපදිංචි වන්න <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}