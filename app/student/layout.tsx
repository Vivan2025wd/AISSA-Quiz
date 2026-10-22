// app/student/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { clearAdminSession } from "@/lib/admin-session";

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!profile) {
        await supabase.auth.signOut();
        router.replace("/auth/login?reason=no_profile");
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // ============================================================
  // Logout — clear admin flag first (in case this tab was used
  // by an admin earlier), then sign out, then go home.
  // ============================================================
  const handleLogout = async () => {
    setLoggingOut(true);
    clearAdminSession();
    await supabase.auth.signOut();
    router.push("/");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 dark:text-gray-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Checking access...
      </div>
    );
  }

  if (!allowed) return null;

  // Hide the floating logout button during an active quiz — the
  // student is in the middle of an exam and shouldn't be tempted
  // to click it. It reappears once they navigate away.
  const isQuizInProgress = pathname?.startsWith("/student/quiz/");

  return (
    <>
      {children}

      {!isQuizInProgress && (
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-3.5 py-2 bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-gray-300 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold rounded-full shadow-md dark:shadow-black/30 transition disabled:opacity-60"
          title="Logout"
        >
          {loggingOut ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <LogOut className="w-3.5 h-3.5" />
          )}
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
      )}
    </>
  );
}