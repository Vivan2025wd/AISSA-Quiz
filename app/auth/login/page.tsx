"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  LogIn,
  Lock,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  Loader2,
  IdCard,
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

// ============================================================
// Fallback loading state — light page + dark banner
// ============================================================
function LoginPageFallback() {
  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative flex items-center justify-center p-4 overflow-hidden">
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/50 dark:bg-emerald-500/10 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 dark:bg-teal-500/10 rounded-full filter blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black border border-slate-700/50 shadow-xl shadow-black/40 mb-4">
          <div
            className="absolute inset-0 opacity-[0.15] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl" />

          <div className="relative flex flex-col items-center text-center px-5 py-7 space-y-3">
            <div className="relative">
              <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/loading-screen.png"
                  alt="AISSA Logo"
                  className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(45,212,191,0.5)] animate-pulse"
                />
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
              <ShieldCheck className="w-3.5 h-3.5" />
              AISSA
            </span>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black border border-slate-700/50 shadow-xl shadow-black/40 p-6 sm:p-8">
          <div
            className="absolute inset-0 opacity-[0.12] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative flex justify-center py-6">
            <Loader2 className="w-6 h-6 text-teal-400 animate-spin" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main login form
// ============================================================
function StudentLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const [needsAdminCode, setNeedsAdminCode] = useState(false);
  const [adminCode, setAdminCode] = useState("");

  const [error, setError] = useState(
    reason === "no_profile"
      ? "ඔබගේ ගිණුම සම්පූර්ණ නැත — කරුණාකර නැවත ලියාපදිංචි වන්න."
      : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const looksLikeEmail = (v: string) => v.includes("@");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    clearAdminSession();

    let email = identifier.trim();

    if (!looksLikeEmail(identifier)) {
      const { data: resolved, error: rpcErr } = await supabase.rpc(
        "get_email_by_ais_id",
        { p_ais_id: identifier.trim().toUpperCase() },
      );

      if (rpcErr) {
        setIsSubmitting(false);
        setError("AISSA ID lookup error: " + rpcErr.message);
        return;
      }

      if (!resolved) {
        setIsSubmitting(false);
        setError(
          "මෙම AISSA ID එකට අදාළ ගිණුමක් නොමැත. (No account found for this AISSA ID)",
        );
        return;
      }

      email = resolved as string;
    }

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
      setNeedsAdminCode(true);
      return;
    }

    router.push("/student/dashboard");
  };

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

    markAdminVerified(user.id);
    router.push("/admin/dashboard");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative flex items-center justify-center p-4 overflow-hidden">
      {/* Light page aurora — dimmed in dark mode */}
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/50 dark:bg-emerald-500/10 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 dark:bg-teal-500/10 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed top-[35%] right-[15%] w-72 h-72 bg-green-100/60 dark:bg-green-500/5 rounded-full filter blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* ═══════════ DARK BANNER — like dashboard ═══════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-slate-700/50 mb-4">
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

          <div className="relative flex flex-col items-center text-center px-5 sm:px-6 py-6 sm:py-7 space-y-3">
            {/* ✨ AISSA Logo — NO BOX, sits directly on dark bg */}
            <div className="relative">
              <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aissa-logo.png"
                  alt="AISSA Logo"
                  className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(45,212,191,0.5)]"
                />
              </div>
            </div>

            {/* Badges */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
                <ShieldCheck className="w-3.5 h-3.5" />
                AISSA
              </span>
              {needsAdminCode && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200">
                  <KeyRound className="w-3.5 h-3.5" />
                  Admin Step
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-slate-300 text-sm sm:text-base font-semibold leading-snug max-w-xs">
              {needsAdminCode
                ? "Admin ගිණුමක් හඳුනාගන්නා ලදී — Access Code එක ඇතුළත් කරන්න"
                : "AISSA ID හෝ Email එකෙන් ඇතුළු වන්න"}
            </p>
          </div>
        </div>

        {/* ═══════════ Login Card — now DARK, matching the banner ═══════════ */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-slate-700/50 p-6 sm:p-8">
          {/* dot grid */}
          <div
            className="absolute inset-0 opacity-[0.12] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          {/* teal glows */}
          <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-teal-500/15 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
          {/* decorative rings */}
          <div className="pointer-events-none absolute -bottom-20 -right-20 w-56 h-56 rounded-full border-[1.5px] border-teal-400/10" />
          {/* shine */}
          <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/5" />

          <div className="relative space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-200 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm backdrop-blur-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {!needsAdminCode ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5 tracking-wide">
                    AISSA ID හෝ Email
                  </label>
                  <div className="relative">
                    <IdCard className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="R25THENUMI-SBVC-AWC  හෝ  your@email.com"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl font-medium text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none disabled:opacity-60 transition backdrop-blur-sm"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    AISSA සාමාජිකයින්ට ID එකෙන්, අනිත් අයට Email එකෙන්.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wide">
                      මුරපදය (Password)
                    </label>
                    <a
                      href="#"
                      className="text-xs font-semibold text-teal-300 hover:text-teal-200 hover:underline"
                    >
                      Password අමතකද?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 text-white placeholder-slate-500 rounded-xl font-medium text-sm focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none disabled:opacity-60 transition backdrop-blur-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl flex justify-center items-center gap-2 shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all mt-2 disabled:opacity-60 disabled:hover:scale-100"
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
                <div className="p-4 bg-teal-500/10 border border-teal-400/25 rounded-xl space-y-1.5 backdrop-blur-sm">
                  <label className="flex text-xs font-extrabold text-teal-100 uppercase items-center gap-1.5 tracking-wide">
                    <KeyRound className="w-4 h-4 text-teal-300" /> Admin Access Code
                  </label>
                  <input
                    type="password"
                    value={adminCode}
                    onChange={(e) => setAdminCode(e.target.value)}
                    required
                    autoFocus
                    disabled={isSubmitting}
                    placeholder="••••••••"
                    className="w-full px-3 py-3 bg-white/5 border border-teal-400/30 rounded-xl font-bold text-sm text-white focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 outline-none placeholder:font-normal placeholder:text-slate-500 disabled:opacity-60 transition"
                  />
                  <p className="text-[11px] text-teal-200/80 font-medium">
                    * ඔබට Admin Access Code එක ලබාදී ඇති නම් පමණක් ඉදිරියට යන්න.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl flex justify-center items-center gap-2 shadow-md shadow-teal-500/20 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-60 disabled:hover:scale-100"
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
              <div className="pt-4 border-t border-white/10 text-center text-xs text-slate-400">
                ගිණුමක් තවම නැද්ද?{" "}
                <Link
                  href="/auth/register"
                  className="font-bold text-teal-300 hover:text-teal-200 hover:underline inline-flex items-center gap-0.5"
                >
                  ලියාපදිංචි වන්න <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}