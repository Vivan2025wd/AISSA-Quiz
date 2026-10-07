"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileQuestion,
  CalendarDays,
  ArrowLeft,
  BarChart3,
  LogOut,
  Menu,
  X,
  Crown,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { clearAdminSession } from "@/lib/admin-session";
import AdminGuard from "./AdminGuard";

// Base nav items — everyone with is_admin = true sees these
const baseNavItems = [
  { name: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Question Bank", href: "/admin/questions", icon: FileQuestion },
  { name: "Quiz Scheduler", href: "/admin/quizzes", icon: CalendarDays },
  { name: "Performance", href: "/admin/performance", icon: BarChart3 },
];

function NavLinks({
  pathname,
  onNavigate,
  isSuperAdmin,
}: {
  pathname: string;
  onNavigate: () => void;
  isSuperAdmin: boolean;
}) {
  // ✅ Super Admin link is appended only for super admins
  const items = isSuperAdmin
    ? [
        ...baseNavItems,
        {
          name: "Super Admin",
          href: "/admin/super/dashboard",
          icon: Crown,
          isSuper: true,
        },
      ]
    : baseNavItems;

  return (
    <nav className="p-3 space-y-1.5 flex-1 overflow-y-auto">
      {items.map((item) => {
        const Icon = item.icon;
        const isSuper = "isSuper" in item && item.isSuper === true;
        const isActive = pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
              isActive
                ? isSuper
                  ? "bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/30"
                  : "bg-teal-500 text-slate-900 shadow-lg shadow-teal-500/30"
                : isSuper
                  ? "text-amber-200 hover:bg-amber-500/15 hover:text-amber-50"
                  : "text-slate-300 hover:bg-teal-500/15 hover:text-teal-100"
            }`}
          >
            {/* Active indicator bar */}
            {isActive && (
              <span
                className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full ${
                  isSuper ? "bg-slate-900" : "bg-slate-900/70"
                }`}
              />
            )}

            <Icon
              className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                isActive
                  ? isSuper
                    ? "text-slate-900"
                    : "text-slate-900"
                  : isSuper
                    ? "text-amber-300"
                    : "text-teal-300"
              }`}
            />
            <span className="truncate">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="p-3 border-t border-slate-700/50 space-y-1.5">
      <Link
        href="/student/dashboard"
        className="flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-teal-500/15 px-3 py-2 rounded-lg transition"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Student Portal
      </Link>
      <button
        type="button"
        onClick={onLogout}
        className="w-full flex items-center gap-2 text-xs font-semibold text-red-300 hover:text-red-200 hover:bg-red-500/15 px-3 py-2 rounded-lg transition"
      >
        <LogOut className="w-3.5 h-3.5" /> Logout
      </button>
    </div>
  );
}

/**
 * Shared sidebar brand block — dark slate banner with the AISSA logo,
 * matching the login / register / dashboard aesthetic.
 */
function SidebarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden border-b border-slate-700/50 bg-linear-to-br from-slate-900 via-slate-800 to-black ${
        compact ? "p-4" : "p-5"
      }`}
    >
      {/* dot grid */}
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />
      {/* teal glow */}
      <div className="pointer-events-none absolute -top-16 -right-12 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 w-32 h-32 bg-emerald-500/15 rounded-full blur-3xl" />
      {/* ring */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 rounded-full border-12 border-teal-400/10" />

      <div className="relative flex items-center gap-3">
        {/* ✨ AISSA Logo — no box, sits directly on dark bg */}
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
          <div
            className={`relative flex items-center justify-center ${
              compact ? "w-10 h-10" : "w-12 h-12"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/aissa-logo.png"
              alt="AISSA Logo"
              className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(45,212,191,0.5)]"
            />
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="font-extrabold text-white text-sm tracking-wide leading-none">
            AISSA Admin
          </h1>
          <p className="text-[10px] text-teal-200/70 mt-1 tracking-wide uppercase font-semibold">
            Control Panel
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // ✅ Fetch super admin flag once. The value drives the "Super Admin"
  //    link visibility only — all auth enforcement still happens inside
  //    AdminGuard / SuperAdminGuard.
  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_super_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setIsSuperAdmin(Boolean(profile?.is_super_admin));
      }
    }

    void loadRole();
    return () => {
      cancelled = true;
    };
  }, []);

  // Lock body scroll while the mobile drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  const handleLogout = async () => {
    clearAdminSession();
    await supabase.auth.signOut();
    router.push("/");
  };

  // ✅ Super admin routes have their own shell — do not wrap them
  //    with this layout, or two sidebars will stack.
  if (pathname.startsWith("/admin/super")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 flex flex-col md:flex-row relative">
      {/* ============ MOBILE TOP BAR — DARK THEME ============ */}
      <header className="md:hidden sticky top-0 z-30 relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-black text-white border-b border-slate-700/50 flex items-center justify-between px-4 py-3 shrink-0 shadow-lg shadow-black/40">
        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />
        <div className="pointer-events-none absolute -top-16 -right-12 w-40 h-40 bg-teal-500/20 rounded-full blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <div className="relative w-8 h-8 flex items-center justify-center">
            <div className="absolute inset-0 bg-teal-400/25 blur-md rounded-full scale-110" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/aissa-logo.png"
              alt="AISSA Logo"
              className="relative w-full h-full object-contain drop-shadow-[0_0_12px_rgba(45,212,191,0.5)]"
            />
          </div>
          <span className="font-extrabold text-sm tracking-wide">
            AISSA Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="relative p-2 -mr-2 rounded-lg hover:bg-teal-500/15 transition"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-teal-200" />
        </button>
      </header>

      {/* ============ DESKTOP SIDEBAR — DARK SLATE ============ */}
      <aside className="hidden md:flex md:w-60 relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-black text-slate-200 border-r border-slate-700/50 flex-col shrink-0 shadow-xl shadow-black/40">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-24 -right-20 w-56 h-56 bg-teal-500/15 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 -left-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl" />
        {/* Decorative ring */}
        <div className="pointer-events-none absolute top-1/3 -right-24 w-56 h-56 rounded-full border-[1.5px] border-teal-400/10 hidden md:block" />

        <div className="relative flex flex-col flex-1 min-h-0">
          <SidebarBrand />
          <NavLinks
            pathname={pathname}
            onNavigate={() => setDrawerOpen(false)}
            isSuperAdmin={isSuperAdmin}
          />
          <SidebarFooter onLogout={handleLogout} />
        </div>
      </aside>

      {/* ============ MOBILE DRAWER — DARK SLATE ============ */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
            aria-hidden
          />
          {/* Drawer panel */}
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-black text-slate-200 border-r border-slate-700/50 flex flex-col shadow-2xl shadow-black/60 animate-in slide-in-from-left duration-200">
            {/* Ambient glows */}
            <div className="pointer-events-none absolute -top-24 -right-20 w-56 h-56 bg-teal-500/15 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 -left-16 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl" />

            <div className="relative flex flex-col flex-1 min-h-0">
              <div className="border-b border-slate-700/50 flex items-center justify-between pr-2">
                <div className="flex-1">
                  <SidebarBrand compact />
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-2 rounded-lg hover:bg-teal-500/15 transition shrink-0 text-teal-200"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <NavLinks
                pathname={pathname}
                onNavigate={() => setDrawerOpen(false)}
                isSuperAdmin={isSuperAdmin}
              />
              <SidebarFooter onLogout={handleLogout} />
            </div>
          </aside>
        </>
      )}

      {/* ============ MAIN CONTENT ============ */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Aurora blobs for the content area */}
        <div className="pointer-events-none fixed top-[-15%] left-[15%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/40 rounded-full filter blur-3xl" />
        <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/40 rounded-full filter blur-3xl" />

        <div className="relative p-3 sm:p-4 md:p-6">
          <AdminGuard>{children}</AdminGuard>
        </div>
      </main>
    </div>
  );
}