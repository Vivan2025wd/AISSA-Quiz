"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Crown,
  School,
  Plus,
  Search,
  Loader2,
  Edit3,
  Trash2,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  MapPin,
  Users as UsersIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

type SchoolRow = {
  id: string;
  name: string;
  district: string | null;
  created_at: string;
};

const DISTRICTS = [
  "Colombo","Gampaha","Kalutara","Kandy","Matale","Nuwara Eliya","Galle",
  "Matara","Hambantota","Jaffna","Kilinochchi","Mannar","Vavuniya",
  "Mullaitivu","Batticaloa","Ampara","Trincomalee","Kurunegala","Puttalam",
  "Anuradhapura","Polonnaruwa","Badulla","Monaragala","Ratnapura","Kegalle",
];

export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<SchoolRow | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const flash = (kind: "ok" | "err", msg: string) => {
    setToast({ kind, msg });
    window.setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("schools")
      .select("id, name, district, created_at")
      .order("name", { ascending: true });

    if (error) {
      flash("err", error.message);
      setLoading(false);
      return;
    }

    setSchools((data as SchoolRow[]) ?? []);

    const { data: profileRows } = await supabase
      .from("profiles")
      .select("school_normalized")
      .eq("is_admin", false);

    if (profileRows) {
      const map: Record<string, number> = {};
      for (const r of profileRows as { school_normalized: string | null }[]) {
        const k = r.school_normalized ?? "";
        if (!k) continue;
        map[k] = (map[k] ?? 0) + 1;
      }
      setCounts(map);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.district ?? "").toLowerCase().includes(q),
    );
  }, [schools, search]);

  const handleDelete = async (row: SchoolRow) => {
    const count = counts[row.name.toLowerCase()] ?? 0;
    const warning =
      count > 0
        ? `\n\n⚠️ ${count} student(s) currently reference this school. They will keep their string value, but the school will no longer appear in the registration dropdown.`
        : "";

    if (!confirm(`Delete "${row.name}" from the directory?${warning}`)) return;

    const { error } = await supabase.from("schools").delete().eq("id", row.id);
    if (error) {
      flash("err", error.message);
    } else {
      flash("ok", "School deleted.");
      await load();
    }
  };

  return (
    // ── Outer shell: locked height on desktop so only the list scrolls ──
    <div className="max-w-6xl mx-auto md:max-h-[calc(100vh-3rem)] flex flex-col gap-3.5 sm:gap-5">
      {/* ═══ Header — MOBILE-TIGHTENED ═══ */}
      <div className="shrink-0 relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-amber-500/20">
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-amber-500/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />

        <div className="relative p-4 sm:p-6 flex items-start gap-3 sm:gap-4">
          <div className="shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400/25 blur-2xl rounded-full scale-110" />
              <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-amber-500/15 rounded-2xl border border-amber-400/40 flex items-center justify-center">
                <School className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300" />
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-500/20 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200 mb-1.5 sm:mb-2">
              <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Super Admin
            </span>
            <h1 className="text-base sm:text-2xl font-extrabold leading-tight">
              Schools Directory
            </h1>
            <p className="text-slate-300 text-[11px] sm:text-sm mt-1 leading-snug hidden sm:block">
              Official schools list used during student registration.
            </p>
          </div>
        </div>

        <div className="relative px-4 sm:px-6 pb-4 sm:pb-6">
          <button
            onClick={() => setShowAdd(true)}
            className="px-4 sm:px-5 py-2.5 sm:py-3 bg-amber-500 text-slate-900 hover:bg-amber-400 font-bold rounded-xl text-[11px] sm:text-sm transition shadow-lg shadow-amber-500/20 hover:scale-[1.01] flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> Add New School
          </button>
        </div>
      </div>

      {/* ═══ Toast — MOBILE-TIGHTENED ═══ */}
      {toast && (
        <div
          className={`shrink-0 p-2.5 sm:p-3 text-[11px] sm:text-xs font-semibold rounded-xl flex items-start gap-2 border ${
            toast.kind === "ok"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
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

      {/* ═══ Filter bar — MOBILE-TIGHTENED ═══ */}
      <div className="shrink-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 dark:text-gray-500 absolute left-3 top-3 sm:top-3.5" />
          <input
            type="text"
            placeholder="Search by name or district..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-gray-50 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:bg-white dark:focus:bg-slate-900 transition"
          />
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="px-3 sm:px-4 py-2.5 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-900 transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* ═══ Table — flex-1 + min-h-0 so ONLY this scrolls ═══ */}
      <div className="flex-1 min-h-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div className="shrink-0 px-3.5 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-bold text-gray-900 dark:text-gray-100">
            Schools{" "}
            <span className="text-amber-600 dark:text-amber-400">
              ({filtered.length} / {schools.length})
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="flex-1 min-h-0 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-amber-500" />
            Loading schools...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs sm:text-sm px-4 text-center">
            No schools match your search.
          </div>
        ) : (
          <ul className="flex-1 min-h-0 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.map((s) => {
              const key = s.name.toLowerCase();
              const count = counts[key] ?? 0;
              return (
                <li
                  key={s.id}
                  className="p-3 sm:p-5 flex flex-col gap-2.5 sm:gap-3 hover:bg-amber-50/20 dark:hover:bg-amber-950/10 transition"
                >
                  {/* Row 1: school name + district + student count */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate">
                      {s.name}
                    </p>
                    <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{s.district ?? "—"}</span>
                      {count > 0 && (
                        <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-semibold ml-1 sm:ml-2 shrink-0">
                          <UsersIcon className="w-3 h-3" /> {count} student{count === 1 ? "" : "s"}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Row 2: action buttons — full-width on mobile */}
                  <div className="flex items-center gap-1.5 sm:gap-2 sm:justify-end">
                    <button
                      onClick={() => setEditing(s)}
                      className="flex-1 sm:flex-none text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-950/70 text-amber-800 dark:text-amber-300 transition flex items-center justify-center gap-1 sm:gap-1.5 border border-amber-200 dark:border-amber-800"
                    >
                      <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Edit
                    </button>
                    <button
                      onClick={() => void handleDelete(s)}
                      className="flex-1 sm:flex-none text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 text-red-700 dark:text-red-300 transition flex items-center justify-center gap-1 sm:gap-1.5 border border-red-200 dark:border-red-800"
                    >
                      <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                      <span className="sm:hidden">Delete</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(showAdd || editing) && (
        <SchoolFormModal
          school={editing}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={async (msg) => {
            flash("ok", msg);
            setShowAdd(false);
            setEditing(null);
            await load();
          }}
          onError={(msg) => flash("err", msg)}
        />
      )}
    </div>
  );
}

// ============================================================
// Add / Edit modal — MOBILE-TIGHTENED
// ============================================================
function SchoolFormModal({
  school,
  onClose,
  onSaved,
  onError,
}: {
  school: SchoolRow | null;
  onClose: () => void;
  onSaved: (msg: string) => void | Promise<void>;
  onError: (msg: string) => void;
}) {
  const isEdit = Boolean(school);
  const [name, setName] = useState(school?.name ?? "");
  const [district, setDistrict] = useState(school?.district ?? DISTRICTS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("School name is required.");
      return;
    }

    setSaving(true);
    const { error: rpcErr } = await supabase.rpc("super_upsert_school", {
      p_name: name.trim(),
      p_district: district,
      p_id: school?.id ?? null,
    });
    setSaving(false);

    if (rpcErr) {
      setError(rpcErr.message);
      onError(rpcErr.message);
      return;
    }

    await onSaved(isEdit ? "School updated." : "School added.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full sm:max-w-lg bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/70 dark:border-slate-700 overflow-hidden max-h-[92vh] sm:my-8 flex flex-col">
        {/* Header */}
        <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-black text-white border-b border-amber-500/20 shrink-0">
          <div
            className="absolute inset-0 opacity-[0.15] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(251,191,36,0.6) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="pointer-events-none absolute -top-16 -right-20 w-56 h-56 bg-amber-500/20 rounded-full blur-3xl" />

          <div className="relative px-3.5 sm:px-6 py-3.5 sm:py-4 flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="shrink-0 p-1.5 sm:p-2 bg-amber-500/15 rounded-xl border border-amber-400/30">
                {isEdit ? (
                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
                ) : (
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-amber-200" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-lg font-bold truncate">
                  {isEdit ? "Edit School" : "Add New School"}
                </h3>
                <p className="text-slate-300 text-[10px] sm:text-xs mt-0.5 truncate">
                  Names are normalized automatically.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition disabled:opacity-60 shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {error && (
            <div className="p-2.5 sm:p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] sm:text-xs font-semibold rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
              School Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Royal College, Colombo"
              required
              disabled={saving}
              className="w-full p-2.5 sm:p-3 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl font-medium text-sm focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-amber-400 dark:focus:border-amber-500 outline-none disabled:opacity-60"
            />
            <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug">
              Format: <em>School Name, City</em>
              <span className="hidden sm:inline">
                {" "}— e.g. <em>Ananda College, Colombo</em>
              </span>
            </p>
          </div>

          <div>
            <label className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
              <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> District
            </label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={saving}
              className="w-full p-2.5 sm:p-3 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-xl font-medium text-sm focus:ring-2 focus:ring-amber-500 dark:focus:ring-amber-400 focus:border-amber-400 dark:focus:border-amber-500 outline-none cursor-pointer disabled:opacity-60"
            >
              {DISTRICTS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </form>

        {/* Footer */}
        <div className="px-3.5 sm:px-6 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/60 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 sm:flex-none px-4 sm:px-4 py-2.5 bg-white dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-200 text-[11px] sm:text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-[11px] sm:text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            <span>{isEdit ? "Save Changes" : "Add School"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}