"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { isAdminVerificationValid } from "@/lib/admin-session";

export default function AdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // 1. Must be signed in
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      // 2. Must have is_admin = true in the DB
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (!profile?.is_admin) {
        router.replace("/auth/login");
        return;
      }

      // 3. Must have passed the code step in THIS tab, for THIS user,
      //    within the last 30 minutes (helper handles all three checks).
      if (!isAdminVerificationValid(user.id)) {
        router.replace("/auth/login");
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

  if (checking) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/70 dark:border-slate-700 shadow-xl dark:shadow-black/30 px-8 py-10">
          {/* Logo box with amber glow */}
          <div className="relative">
            <div className="absolute inset-0 bg-amber-300/40 dark:bg-amber-400/20 blur-xl rounded-2xl" />
            <div className="relative w-14 h-14 bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl border border-white/20 dark:border-slate-600/40 shadow-lg flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-amber-300" />
            </div>
          </div>

          {/* Spinner + text */}
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Checking access...
            </span>
          </div>

          {/* Subtle pulse bar */}
          <div className="w-32 h-1 bg-emerald-100 dark:bg-emerald-950/50 rounded-full overflow-hidden">
            <div className="h-full w-1/2 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}