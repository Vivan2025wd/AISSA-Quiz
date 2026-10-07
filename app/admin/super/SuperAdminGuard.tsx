"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {  Crown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export default function SuperAdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
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
        .select("is_admin, is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      const sessionVerified =
        sessionStorage.getItem("aissa_admin_verified") === "true";

      if (!profile?.is_super_admin || !sessionVerified) {
        router.replace("/admin/dashboard");
        return;
      }

      setAllowed(true);
      setChecking(false);
    }
    void check();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-500 gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loading-screen.png"
          alt="Loading"
          className="w-20 h-20 object-contain animate-pulse"
        />
        <div className="flex items-center gap-2 text-sm">
          <Crown className="w-4 h-4 animate-pulse text-amber-500" />
          Verifying super admin access...
        </div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}