"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  School,
  ArrowLeft,
  Crown,
  ShieldCheck,
} from "lucide-react";
import SuperAdminGuard from "./SuperAdminGuard";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: "Overview", href: "/admin/super/dashboard", icon: LayoutDashboard },
    { name: "Administrators", href: "/admin/super/admins", icon: Users },
    { name: "Schools Directory", href: "/admin/super/schools", icon: School },
  ];

  return (
    <SuperAdminGuard>
      <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
        {/* ── Super admin sidebar — amber theme to distinguish from regular admin ── */}
        <aside className="w-full md:w-64 bg-linear-to-b from-slate-950 via-slate-900 to-black text-slate-200 border-r border-amber-500/20 flex flex-col shrink-0">
          {/* dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05] hidden md:block"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />

          <div className="relative p-5 border-b border-amber-500/20 flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-amber-400/30 blur-xl rounded-full" />
              <div className="relative w-10 h-10 bg-amber-500/15 rounded-xl border border-amber-400/30 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-300" />
              </div>
            </div>
            <div>
              <h1 className="font-extrabold text-white text-base tracking-wide">
                AISSA Super
              </h1>
              <p className="text-[10px] text-amber-300/80 font-bold uppercase tracking-wider">
                Chief Administrator
              </p>
            </div>
          </div>

          <nav className="relative p-4 space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                    isActive
                      ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                      : "text-slate-400 hover:bg-amber-500/10 hover:text-amber-100"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="relative p-4 border-t border-amber-500/20 space-y-2">
            <Link
              href="/admin/dashboard"
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-100 transition"
            >
              <ShieldCheck className="w-4 h-4" /> Regular Admin Panel
            </Link>
            <Link
              href="/student/dashboard"
              className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Student Portal
            </Link>
          </div>
        </aside>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </SuperAdminGuard>
  );
}