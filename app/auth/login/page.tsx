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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-md p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-2xl mb-1">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            AISSA Quiz Platform
          </h1>
        </div>
        <div className="flex justify-center py-6">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-md p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-blue-50 text-blue-600 rounded-2xl mb-1">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            AISSA Quiz Platform
          </h1>
          <p className="text-xs text-gray-500">
            {needsAdminCode
              ? "Admin ගිණුමක් හඳුනාගන්නා ලදී — Access Code එක ඇතුළත් කරන්න"
              : "ඔබගේ ගිණුමට ඇතුළත් වී Quizzes සඳහා සහභාගී වන්න"}
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
            {error}
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
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
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
                  className="text-xs font-semibold text-blue-600 hover:underline"
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
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm transition mt-2 disabled:opacity-60"
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
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
              <label className="flex text-xs font-extrabold text-indigo-900 uppercase items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-600" /> Admin Access Code
              </label>
              <input
                type="password"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                required
                autoFocus
                disabled={isSubmitting}
                placeholder="••••••••"
                className="w-full px-3 py-3 bg-white border border-indigo-300 rounded-xl font-bold text-sm text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:font-normal disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm transition disabled:opacity-60"
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
          <div className="pt-4 border-t text-center text-xs text-gray-600">
            ගිණුමක් තවම නැද්ද?{" "}
            <Link
              href="/auth/register"
              className="font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              ලියාපදිංචි වන්න <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}