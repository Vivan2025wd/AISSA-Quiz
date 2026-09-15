"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  User,
  Mail,
  Lock,
  KeyRound,
  Loader2,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function AdminRegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [adminCode, setAdminCode] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("ඇතුළත් කළ මුරපද (Passwords) දෙක සමාන නොවේ!");
      return;
    }
    if (password.length < 6) {
      setError("මුරපදය අඩුම තරමින් අක්ෂර 6ක් විය යුතුය!");
      return;
    }

    setIsSubmitting(true);

    // 1. Create the auth user. Profile fields go through as
    // metadata — the handle_new_user trigger creates the
    // profiles row server-side, the same as the student flow.
    // We deliberately do NOT also call .from("profiles").insert()
    // here: doing both races the trigger and can throw a duplicate
    // key error on ais_id / primary key if the trigger wins first.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          school: "AISSA Admin",
          stream: "N/A",
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setIsSubmitting(false);
      return;
    }
    if (!authData.user) {
      setError("ලියාපදිංචිය අසාර්ථක විය. නැවත උත්සාහ කරන්න.");
      setIsSubmitting(false);
      return;
    }

    // 2. If email confirmation is enabled, there's no session yet.
    // claim_admin() checks auth.uid() server-side, which is null
    // without a session — calling it now would silently fail even
    // with the correct code. Stop here and ask them to confirm
    // their email first, then come back and enter the code once
    // they're actually logged in.
    if (!authData.session) {
      setIsSubmitting(false);
      setNeedsEmailConfirm(true);
      return;
    }

    // 3. Attempt to claim admin using the code. This is checked
    // server-side against a bcrypt hash — the real code is never
    // sent to or comparable from the browser.
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_admin",
      { p_code: adminCode }
    );

    setIsSubmitting(false);

    if (claimError) {
      setError("Admin Claim Error: " + claimError.message);
      return;
    }

    if (!claimed) {
      // Account exists but as a regular (non-admin) profile —
      // don't reveal whether the code was close or wildly wrong.
      setError(
        "ගිණුම සාදන ලදී, නමුත් Admin Access Code එක වැරදිය. Admin ලෙස ප්‍රවේශ විය නොහැක."
      );
      return;
    }

    // Success: is_admin is now true in the DB. Mark this browser
    // session as having passed the code step, so AdminGuard lets
    // it straight into /admin/* without asking again until the
    // tab/browser closes and sessionStorage clears.
    sessionStorage.setItem("aissa_admin_verified", "true");

    router.push("/admin/quizzes");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-md p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-2xl mb-1">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">Admin ගිණුම සාදන්න</h1>
          <p className="text-xs text-gray-500">
            AISSA කමිටු සාමාජිකයින් සඳහා පමණි. Access Code එකක් අවශ්‍යයි.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {needsEmailConfirm ? (
          <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-green-600" />
            <p className="font-bold">ගිණුම සාදන ලදී!</p>
            <p className="text-xs">
              ඔබගේ email ලිපිනය තහවුරු කිරීමට එවා ඇති link එක click කරන්න. ඉන් පසු
              Login වී, Admin Access Code එක ඇතුළත් කිරීමට නැවත මෙම පිටුවට එන්න.
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline mt-2"
            >
              ඇතුළු වන්න (Login) <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">සම්පූර්ණ නම</label>
            <div className="relative">
              <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">ඊමේල්</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">මුරපදය</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">තහවුරු කරන්න</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1.5">
            <label className="flex text-xs font-extrabold text-indigo-900 uppercase items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-indigo-600" /> Admin Access Code
            </label>
            <input
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              required
              disabled={isSubmitting}
              placeholder="Committee එකෙන් ලබාදුන් Code එක"
              className="w-full px-3 py-3 bg-white border border-indigo-300 rounded-xl font-bold text-sm text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:font-normal disabled:opacity-60"
            />
            <p className="text-[11px] text-indigo-700 font-medium">
              * වැරදි Code එකක් නම් ගිණුම සාදනු ලබන්නේ සාමාන්‍ය (Non-Admin) ලෙසයි.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm transition mt-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Admin ලෙස ලියාපදිංචි වන්න <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
        )}

        {!needsEmailConfirm && (
        <div className="pt-4 border-t text-center text-xs text-gray-600">
          <Link href="/auth/login" className="font-bold text-indigo-600 hover:underline">
            දැනටමත් ගිණුමක් තිබේද? ඇතුළු වන්න
          </Link>
        </div>
        )}
      </div>
    </div>
  );
}