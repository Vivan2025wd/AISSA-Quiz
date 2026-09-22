"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileQuestion,
  CalendarDays,
  ArrowLeft,
  ShieldCheck,
  BarChart3,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { clearAdminSession } from "@/lib/admin-session";
import AdminGuard from "./AdminGuard";

const navItems = [
  { name: "Overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { name: "Question Bank", href: "/admin/questions", icon: FileQuestion },
  { name: "Quiz Scheduler", href: "/admin/quizzes", icon: CalendarDays },
  { name: "Performance", href: "/admin/performance", icon: BarChart3 },
];

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate: () => void;
}) {
  return (
    <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
              isActive
                ? "bg-white text-emerald-900 shadow-md shadow-emerald-950/30"
                : "text-emerald-50/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                isActive ? "text-emerald-700" : ""
              }`}
            />
            <span className="truncate">{item.name}</span>
            {isActive && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="p-3 border-t border-emerald-950/50 space-y-1.5">
      <Link
        href="/student/dashboard"
        className="flex items-center gap-2 text-xs font-semibold text-emerald-100/80 hover:text-white hover:bg-white/10 px-3 py-2 rounded-lg transition"
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

// Shared sidebar brand block
function SidebarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden border-b border-emerald-950/50 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      {/* subtle glow */}
      <div className="pointer-events-none absolute -top-12 -right-12 w-32 h-32 bg-amber-300/10 rounded-full blur-2xl" />

      <div className="relative flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="absolute inset-0 bg-amber-300/30 blur-lg rounded-xl" />
          <div className="relative w-11 h-11 bg-white/10 backdrop-blur-md rounded-xl border border-white/15 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-amber-300" />
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="font-extrabold text-white text-sm tracking-wide leading-none">
            AISSA Admin
          </h1>
          <p className="text-[10px] text-emerald-200/70 mt-1 tracking-wide uppercase font-semibold">
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

  return (
    <div className="min-h-screen bg-linear-to-brrom-emerald-50 via-white to-teal-50 flex flex-col md:flex-row relative">
      {/* ============ MOBILE TOP BAR ============ */}
      <header className="md:hidden sticky top-0 z-30 bg-linear-to-r from-emerald-700 via-emerald-800 to-teal-900 text-white border-b border-emerald-950/50 flex items-center justify-between px-4 py-3 shrink-0 shadow-lg shadow-emerald-950/20">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="absolute inset-0 bg-amber-300/30 blur-md rounded-lg" />
            <div className="relative w-8 h-8 bg-white/10 backdrop-blur-md rounded-lg border border-white/15 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
            </div>
          </div>
          <span className="font-extrabold text-sm tracking-wide">
            AISSA Admin
          </span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 -mr-2 rounded-lg hover:bg-white/10 transition"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ============ DESKTOP SIDEBAR ============ */}
      <aside className="hidden md:flex md:w-60 bg-linear-to-brom-emerald-800 via-emerald-900 to-teal-950 text-emerald-50 border-r border-emerald-950/50 flex-col shrink-0 shadow-xl shadow-emerald-950/10">
        <SidebarBrand />
        <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
        <SidebarFooter onLogout={handleLogout} />
      </aside>

      {/* ============ MOBILE DRAWER ============ */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-emerald-950/60 backdrop-blur-sm"
            aria-hidden
          />
          {/* Drawer panel */}
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-linear-to-b from-emerald-800 via-emerald-900 to-teal-950 text-emerald-50 border-r border-emerald-950/50 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="border-b border-emerald-950/50 flex items-center justify-between pr-2">
              <div className="flex-1">
                <SidebarBrand compact />
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition shrink-0"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
            <SidebarFooter onLogout={handleLogout} />
          </aside>
        </>
      )}

      {/* ============ MAIN CONTENT ============ */}
      <main className="flex-1 overflow-y-auto relative">
        {/* Aurora blobs for the content area */}
        <div className="pointer-events-none fixed top-[-15%] left-[15%] w-80 h-80 sm:w-md-sm:h-112merald-200/40 rounded-full filter blur-3xl" />
        <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/40 rounded-full filter blur-3xl" />

        <div className="relative p-3 sm:p-4 md:p-6">
          <AdminGuard>{children}</AdminGuard>
        </div>
      </main>
    </div>
  );
}