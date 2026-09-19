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
    <nav className="p-4 space-y-1 flex-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition ${
              isActive
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            }`}
          >
            <Icon className="w-4 h-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="p-4 border-t border-slate-800 space-y-2">
      <Link
        href="/student/dashboard"
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 transition py-1"
      >
        <ArrowLeft className="w-4 h-4" /> Student Portal එකට
      </Link>
      <button
        type="button"
        onClick={onLogout}
        className="w-full flex items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-slate-800 px-3 py-2 rounded-lg transition"
      >
        <LogOut className="w-4 h-4" /> Logout
      </button>
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
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* ============ MOBILE TOP BAR ============ */}
      <header className="md:hidden sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-blue-400" />
          <span className="font-extrabold text-sm tracking-wide">AISSA Admin</span>
        </div>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="p-2 -mr-2 rounded-lg hover:bg-slate-800 transition"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ============ DESKTOP SIDEBAR ============ */}
      <aside className="hidden md:flex md:w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex-col shrink-0">
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="font-extrabold text-white text-base tracking-wide">
                AISSA Admin
              </h1>
              <p className="text-[10px] text-slate-400">Control Panel</p>
            </div>
          </div>
        </div>
        <NavLinks pathname={pathname} onNavigate={() => setDrawerOpen(false)} />
        <SidebarFooter onLogout={handleLogout} />
      </aside>

      {/* ============ MOBILE DRAWER ============ */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            className="md:hidden fixed inset-0 z-40 bg-slate-900/70 backdrop-blur-sm"
            aria-hidden
          />
          {/* Drawer panel */}
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
                <div>
                  <h1 className="font-extrabold text-white text-base tracking-wide">
                    AISSA Admin
                  </h1>
                  <p className="text-[10px] text-slate-400">Control Panel</p>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 -mr-1 rounded-lg hover:bg-slate-800 transition"
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
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        <AdminGuard>{children}</AdminGuard>
      </main>
    </div>
  );
}