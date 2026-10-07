"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Crown,
  ShieldCheck,
  ShieldOff,
  Users,
  Search,
  Loader2,
  UserCog,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type Profile = {
  id: string;
  full_name: string | null;
  school: string | null;
  stream: string | null;
  is_admin: boolean;
  is_super_admin: boolean;
  created_at: string;
};

type Filter = "all" | "admins" | "super" | "students";

export default function AdminsPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id ?? null);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, school, stream, is_admin, is_super_admin, created_at")
      .order("is_super_admin", { ascending: false })
      .order("is_admin", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      setToast({ kind: "err", msg: error.message });
    } else {
      setProfiles((data as Profile[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const flash = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3500);
  };

  const callRpc = async (
    rpc: "promote_to_admin" | "revoke_admin" | "grant_super_admin" | "revoke_super_admin",
    userId: string,
    successMsg: string,
  ) => {
    if (!confirm(`Are you sure? ${successMsg}`)) return;
    setActionId(userId);
    const { error } = await supabase.rpc(rpc, { p_user_id: userId });
    setActionId(null);
    if (error) {
      flash("err", error.message);
    } else {
      flash("ok", successMsg);
      await load();
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return profiles.filter((p) => {
      if (filter === "admins" && !p.is_admin) return false;
      if (filter === "super" && !p.is_super_admin) return false;
      if (filter === "students" && p.is_admin) return false;
      if (!q) return true;
      return (
        (p.full_name ?? "").toLowerCase().includes(q) ||
        (p.school ?? "").toLowerCase().includes(q)
      );
    });
  }, [profiles, search, filter]);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-amber-500/20">
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="relative p-5 sm:p-6 flex items-start gap-4">
          <div className="shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400/25 blur-2xl rounded-full scale-110" />
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-amber-500/15 rounded-2xl border border-amber-400/40 flex items-center justify-center">
                <UserCog className="w-7 h-7 text-amber-300" />
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200 mb-2">
              <Crown className="w-3.5 h-3.5" /> Super Admin
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold leading-tight">
              Administrator Management
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1">
              Promote users to admin, grant super admin, or revoke access.
            </p>
          </div>
        </div>
      </div>

      {toast && (
        <div
          className={`p-3 text-xs font-semibold rounded-xl flex items-start gap-2 border ${
            toast.kind === "ok"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-700"
          }`}
        >
          {toast.kind === "ok" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/70 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
            <input
              type="text"
              placeholder="Search by name or school..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition"
            />
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="px-4 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto">
          {(
            [
              { key: "all", label: "All", icon: <Users className="w-3.5 h-3.5" /> },
              { key: "admins", label: "Admins", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
              { key: "super", label: "Super Admins", icon: <Crown className="w-3.5 h-3.5" /> },
              { key: "students", label: "Students", icon: <GraduationCap className="w-3.5 h-3.5" /> },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                filter === tab.key
                  ? "bg-amber-500 text-slate-900 shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2 text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-amber-500" />
            Loading users...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No users match your filters.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((p) => {
              const isSelf = p.id === currentUserId;
              const busy = actionId === p.id;

              return (
                <li
                  key={p.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-amber-50/20 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-sm ${
                        p.is_super_admin
                          ? "bg-amber-500 text-slate-900"
                          : p.is_admin
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {(p.full_name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate flex items-center gap-1.5">
                        {p.full_name ?? "Unnamed"}
                        {isSelf && (
                          <span className="text-[9px] font-bold uppercase bg-slate-800 text-white px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {p.school ?? "—"}
                        {p.stream ? ` · ${p.stream}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Role badges */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {p.is_super_admin && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                        <Crown className="w-3 h-3" /> Super
                      </span>
                    )}
                    {p.is_admin && !p.is_super_admin && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-blue-100 text-blue-800 border border-blue-300">
                        <ShieldCheck className="w-3 h-3" /> Admin
                      </span>
                    )}
                    {!p.is_admin && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-md bg-gray-100 text-gray-700 border border-gray-300">
                        <GraduationCap className="w-3 h-3" /> Student
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                    ) : (
                      <>
                        {!p.is_admin && (
                          <button
                            onClick={() =>
                              void callRpc(
                                "promote_to_admin",
                                p.id,
                                "User promoted to admin.",
                              )
                            }
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition flex items-center gap-1"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" /> Promote
                          </button>
                        )}

                        {p.is_admin && !isSelf && (
                          <button
                            onClick={() =>
                              void callRpc(
                                "revoke_admin",
                                p.id,
                                "Admin access revoked.",
                              )
                            }
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-red-100 text-red-700 transition flex items-center gap-1"
                          >
                            <ShieldOff className="w-3.5 h-3.5" /> Revoke
                          </button>
                        )}

                        {p.is_admin && !p.is_super_admin && (
                          <button
                            onClick={() =>
                              void callRpc(
                                "grant_super_admin",
                                p.id,
                                "Super admin granted.",
                              )
                            }
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 transition flex items-center gap-1"
                          >
                            <Crown className="w-3.5 h-3.5" /> Make Super
                          </button>
                        )}

                        {p.is_super_admin && !isSelf && (
                          <button
                            onClick={() =>
                              void callRpc(
                                "revoke_super_admin",
                                p.id,
                                "Super admin revoked.",
                              )
                            }
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-800 transition flex items-center gap-1"
                          >
                            <Crown className="w-3.5 h-3.5" /> Demote
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}