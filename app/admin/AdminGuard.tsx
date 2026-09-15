"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Wrap every /admin/* page (or app/admin/layout.tsx) with this.
// Even though RLS already grants a logged-in admin real DB
// access, this stops the UI from being reachable just by typing
// a URL: it re-checks (a) is_admin is still true in the DB, and
// (b) this specific browser session already passed the code step
// on the login page. sessionStorage clears when the tab/browser
// closes, so the code really is required again next time they
// log in — not just the first time ever.
export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function check() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      const sessionVerified = sessionStorage.getItem("aissa_admin_verified") === "true";

      if (!profile?.is_admin || !sessionVerified) {
        router.replace("/auth/login");
        return;
      }

      setAllowed(true);
      setChecking(false);
    }
    check();
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