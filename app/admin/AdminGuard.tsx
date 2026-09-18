"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
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
      <div className="min-h-screen flex items-center justify-center text-gray-500 gap-2">
        <Loader2 className="w-5 h-5 animate-spin" /> Checking access...
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}