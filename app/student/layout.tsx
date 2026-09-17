// app/student/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function StudentLayout({
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

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