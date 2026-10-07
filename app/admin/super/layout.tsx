"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  School,
  ArrowLeft,
  Crown,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import SuperAdminGuard from "./SuperAdminGuard";

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navItems = [
    { name: "Overview", href: "/admin/super/dashboard", icon: LayoutDashboard },
    { name: "Administrators", href: "/admin/super/admins", icon: Users },
    { name: "Schools Directory", href: "/admin/super/schools", icon: School },
  ];

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

  // NOTE: No useEffect to close the drawer on pathname change — every
  // nav <Link> below already calls `onNavigate` which closes it on click.
  // Keeping the effect caused a `react-hooks/set-state-in-effect` warning
  // without adding any real behaviour.

  const navContent = (onNavigate?: () => void) => (
    <>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3.5 sm:px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
              isActive
                ? "bg-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                : "text-slate-400 hover:bg-amber-500/10 hover:text-amber-100"
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{item.name}</span>
          </Link>
        );
      })}
    </>
  );

  const footerContent = (onNavigate?: () => void) => (
    <>
      <Link
        href="/admin/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-amber-100 transition px-1 py-1.5"
      >
        <ShieldCheck className="w-4 h-4 shrink-0" /> Regular Admin Panel
      </Link>
      <Link
        href="/student/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100 transition px-1 py-1.5"
      >
        <ArrowLeft className="w-4 h-4 shrink-0" /> Student Portal
      </Link>
    </>
  );

  const brandContent = (compact = false) => (
    <div className="flex items-center gap-2.5">
      <div className="relative shrink-0">
        <div className="absolute inset-0 bg-amber-400/30 blur-xl rounded-full" />
        <div
          className={`relative ${
            compact ? "w-9 h-9" : "w-10 h-10"
          } bg-amber-500/15 rounded-xl border border-amber-400/30 flex items-center justify-center`}
        >
          <Crown
            className={`${
              compact ? "w-4 h-4" : "w-5 h-5"
            } text-amber-300`}
          />
        </div>
      </div>
      <div className="min-w-0">
        <h1 className="font-extrabold text-white text-sm sm:text-base tracking-wide leading-none">
          AISSA Super
        </h1>
        <p className="text-[9px] sm:text-[10px] text-amber-300/80 font-bold uppercase tracking-wider mt-1">
          Chief Administrator
        </p>
      </div>
    </div>
  );

  return (
    <SuperAdminGuard>
      {/* ── Outer shell: locked height on desktop so only <main> scrolls ── */}
      <div className="min-h-screen md:h-screen md:overflow-hidden bg-gray-100 flex flex-col md:flex-row">
        {/* ═══ MOBILE TOP BAR — amber themed ═══
            `sticky` alone provides the positioning context for the inner
            absolute children — no `relative` needed (was causing a
            Tailwind CSS conflict warning). */}
        <header className="md:hidden sticky top-0 z-30 overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-black text-white border-b border-amber-500/20 flex items-center justify-between px-4 py-3 shrink-0 shadow-lg shadow-black/40">
          <div
            className="absolute inset-0 opacity-[0.15] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          <div className="pointer-events-none absolute -top-16 -right-12 w-40 h-40 bg-amber-500/20 rounded-full blur-3xl" />

          <div className="relative">{brandContent(true)}</div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative p-2 -mr-2 rounded-lg hover:bg-amber-500/15 transition"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-amber-200" />
          </button>
        </header>

        {/* ═══ DESKTOP SIDEBAR — amber theme, pinned at 100vh ═══ */}
        <aside className="hidden md:flex md:w-64 relative overflow-hidden bg-linear-to-b from-slate-950 via-slate-900 to-black text-slate-200 border-r border-amber-500/20 flex-col shrink-0">
          {/* dot grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          {/* Ambient glows */}
          <div className="pointer-events-none absolute -top-24 -right-20 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 -left-16 w-56 h-56 bg-orange-500/10 rounded-full blur-3xl" />

          <div className="relative flex flex-col flex-1 min-h-0">
            <div className="relative p-5 border-b border-amber-500/20 shrink-0">
              {brandContent()}
            </div>

            <nav className="relative p-4 space-y-1 flex-1 overflow-y-auto">
              {navContent()}
            </nav>

            <div className="relative p-4 border-t border-amber-500/20 space-y-2 shrink-0">
              {footerContent()}
            </div>
          </div>
        </aside>

        {/* ═══ MOBILE DRAWER — amber theme ═══
            `fixed` alone provides the positioning context — no `relative`
            needed (was causing a Tailwind CSS conflict warning). */}
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setDrawerOpen(false)}
              className="md:hidden fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm"
              aria-hidden
            />
            {/* Drawer panel */}
            <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] overflow-hidden bg-linear-to-br from-slate-950 via-slate-900 to-black text-slate-200 border-r border-amber-500/20 flex flex-col shadow-2xl shadow-black/60 animate-in slide-in-from-left duration-200">
              {/* dot grid */}
              <div
                className="absolute inset-0 opacity-[0.05] pointer-events-none"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)",
                  backgroundSize: "22px 22px",
                }}
              />
              {/* Ambient glows */}
              <div className="pointer-events-none absolute -top-24 -right-20 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 -left-16 w-56 h-56 bg-orange-500/10 rounded-full blur-3xl" />

              <div className="relative flex flex-col flex-1 min-h-0">
                <div className="relative p-4 border-b border-amber-500/20 flex items-center justify-between gap-2 shrink-0">
                  <div className="flex-1 min-w-0">{brandContent(true)}</div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-2 rounded-lg hover:bg-amber-500/15 transition shrink-0 text-amber-200"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="relative p-4 space-y-1 flex-1 overflow-y-auto">
                  {navContent(() => setDrawerOpen(false))}
                </nav>

                <div className="relative p-4 border-t border-amber-500/20 space-y-2 shrink-0">
                  {footerContent(() => setDrawerOpen(false))}
                </div>
              </div>
            </aside>
          </>
        )}

        {/* ═══ MAIN CONTENT — scrolls internally on desktop ═══ */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8">
          {children}
        </main>
      </div>
    </SuperAdminGuard>
  );
}