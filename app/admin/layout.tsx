"use client";

import React from "react";
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
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { clearAdminSession } from "@/lib/admin-session";
import AdminGuard from "./AdminGuard";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const navItems = [
    { name: "Overview",       href: "/admin/dashboard",   icon: LayoutDashboard },
    { name: "Question Bank",  href: "/admin/questions",   icon: FileQuestion },
    { name: "Quiz Scheduler", href: "/admin/quizzes",     icon: CalendarDays },
    { name: "Performance",    href: "/admin/performance", icon: BarChart3 },
  ];

  // Logout: clear admin verification FIRST, then sign out, then
  // go home. The order matters — if we sign out first and the
  // clear throws, the flag would outlive the session.
  const handleLogout = async () => {
    clearAdminSession();
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
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

        <nav className="p-4 space-y-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
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

        <div className="p-4 border-t border-slate-800 space-y-2">
          <Link
            href="/student/dashboard"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Student Portal එකට
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-slate-800 px-3 py-2 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content — NOW WRAPPED IN AdminGuard */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <AdminGuard>{children}</AdminGuard>
      </main>
    </div>
  );
}