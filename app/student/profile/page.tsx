"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { isAissaDistrictCode } from "@/lib/aissa-id";
import {
  getAissaDistrict,
  SRI_LANKAN_DISTRICTS,
  type District,
} from "@/lib/constants/districts";

type StudentProfile = {
  id: string;
  full_name: string | null;
  district: string | null;
  aissa_district: string | null;
};

export default function StudentProfilePage() {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [district, setDistrict] = useState<District>(SRI_LANKAN_DISTRICTS[0]);
  const [aissaDistrict, setAissaDistrict] = useState<string>(
    getAissaDistrict(SRI_LANKAN_DISTRICTS[0]),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const loadProfile = useCallback(async () => {
    setError("");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    if (!user) {
      setError("Please sign in to update your profile.");
      setLoading(false);
      return;
    }

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, district, aissa_district")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setError("Profile not found.");
      setLoading(false);
      return;
    }

    const loadedProfile = data as StudentProfile;
    const loadedDistrict = SRI_LANKAN_DISTRICTS.find(
      (item) => item === loadedProfile.district,
    ) ?? SRI_LANKAN_DISTRICTS[0];
    setProfile(loadedProfile);
    setDistrict(loadedDistrict);
    const storedAissaDistrict = loadedProfile.aissa_district?.toUpperCase();
    setAissaDistrict(
      storedAissaDistrict && isAissaDistrictCode(storedAissaDistrict)
        ? storedAissaDistrict
        : getAissaDistrict(loadedDistrict),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      if (active) void loadProfile();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadProfile]);

  const handleDistrictChange = (value: string) => {
    const nextDistrict = SRI_LANKAN_DISTRICTS.find(
      (item) => item === value,
    );
    if (!nextDistrict) return;
    setDistrict(nextDistrict);
    setAissaDistrict(getAissaDistrict(nextDistrict));
    setSaved(false);
  };

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    if (!isAissaDistrictCode(aissaDistrict.trim())) {
      setError("Please enter a valid AISSA zone code.");
      return;
    }

    setSaving(true);
    setError("");
    setSaved(false);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ district, aissa_district: aissaDistrict.trim().toUpperCase() })
      .eq("id", profile.id);
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-gray-200 bg-white/90 p-6 shadow-lg dark:border-slate-700 dark:bg-slate-800/90">
        <Link
          href="/student/dashboard"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
        >
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>

        <h1 className="mb-1 flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-gray-100">
          <UserRound className="h-5 w-5 text-emerald-600" />
          Profile district
        </h1>
        <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          Update your residential district and AISSA zone code.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading profile…
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
            {saved && (
              <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Profile updated.
              </p>
            )}

            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              Residential district
              <select
                value={district}
                onChange={(event) => handleDistrictChange(event.target.value)}
                disabled={saving}
                required
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100"
              >
                {SRI_LANKAN_DISTRICTS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200">
              AISSA zone code
              <input
                type="text"
                value={aissaDistrict}
                onChange={(event) => {
                  setAissaDistrict(event.target.value);
                  setSaved(false);
                }}
                disabled={saving}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-gray-100"
              />
              <span className="mt-1 block text-xs font-normal text-gray-500 dark:text-gray-400">
                Auto-filled when the residential district changes.
              </span>
            </label>

            <button
              type="submit"
              disabled={saving || !profile}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
