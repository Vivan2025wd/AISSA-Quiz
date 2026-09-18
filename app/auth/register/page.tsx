"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  User,
  Mail,
  MapPin,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  GraduationCap,
  Map,
  AlertCircle,
  IdCard,
  Calendar,
  Hash,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import SchoolAutocomplete from "@/components/SchoolAutocomplete";
import {
  AISSA_DISTRICT_CODES,
  AISSA_DISTRICT_LABELS,
  type AissaDistrictCode,
  generateNonAissaId,
  validateAissaId,
} from "@/lib/aissa-id";

const sriLankanDistricts = [
  "Colombo","Gampaha","Kalutara","Kandy","Matale","Nuwara Eliya","Galle",
  "Matara","Hambantota","Jaffna","Kilinochchi","Mannar","Vavuniya",
  "Mullaitivu","Batticaloa","Ampara","Trincomalee","Kurunegala","Puttalam",
  "Anuradhapura","Polonnaruwa","Badulla","Monaragala","Ratnapura","Kegalle",
];

const streams = [
  "Biological Science","Physical Science","Maths","Commerce","Arts","Technology",
];

type IdMode = "has-aissa" | "no-aissa";

export default function StudentRegisterPage() {
  const router = useRouter();

  const [idMode, setIdMode] = useState<IdMode>("has-aissa");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    address: "",
    district: sriLankanDistricts[0],
    school: "",
    stream: streams[0],
    aissaIdInput: "",
    aissaDistrict: "AWC" as AissaDistrictCode,
    schoolYear: String(new Date().getFullYear()),
    studentNumber: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [numberLoading, setNumberLoading] = useState(false);
  const [numberError, setNumberError] = useState<string | null>(null);

  const aissaValidation = useMemo(
    () => (idMode === "has-aissa" ? validateAissaId(formData.aissaIdInput) : null),
    [idMode, formData.aissaIdInput],
  );

  const finalAisId = useMemo(() => {
    if (idMode === "has-aissa") return aissaValidation?.parsed?.raw ?? "";

    if (
      !formData.fullName.trim() ||
      !formData.school.trim() ||
      !formData.schoolYear.trim() ||
      !formData.studentNumber.trim()
    ) {
      return "";
    }

    try {
      const yearNum = Number(formData.schoolYear);
      if (!Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2099) {
        return "";
      }
      return generateNonAissaId(
        formData.fullName,
        formData.school,
        formData.aissaDistrict,
        {
          year: yearNum,
          studentNumber: formData.studentNumber,
        },
      );
    } catch {
      return "";
    }
  }, [
    idMode,
    aissaValidation,
    formData.fullName,
    formData.school,
    formData.aissaDistrict,
    formData.schoolYear,
    formData.studentNumber,
  ]);

  const effectiveAissaDistrict: AissaDistrictCode | null = useMemo(() => {
    if (idMode === "has-aissa") return aissaValidation?.parsed?.districtCode ?? null;
    return formData.aissaDistrict;
  }, [idMode, aissaValidation, formData.aissaDistrict]);

  useEffect(() => {
    if (idMode !== "no-aissa") return;

    const school = formData.school.trim();
    const yearStr = formData.schoolYear.trim();
    const yearNum = Number(yearStr);

    if (!school || !yearStr || !Number.isFinite(yearNum)) {
      const resetTimer = window.setTimeout(() => {
        setNextNumber(null);
        setNumberError(null);
        setNumberLoading(false);
      }, 0);
      return () => window.clearTimeout(resetTimer);
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setNumberLoading(true);
      setNumberError(null);

      const { data, error } = await supabase.rpc("get_next_student_number", {
        p_school: school,
        p_school_year: yearNum,
      });

      if (cancelled) return;

      setNumberLoading(false);

      if (error) {
        console.warn("Could not fetch next student number:", error.message);
        setNumberError("Auto-number ලබාගත නොහැක — අතින් ඇතුළත් කරන්න.");
        setNextNumber(null);
        return;
      }

      const n = typeof data === "number" ? data : Number(data);
      if (Number.isFinite(n) && n > 0) {
        setNextNumber(n);
        setFormData((prev) => {
          const userTouched = prev.studentNumber.trim() !== "";
          if (userTouched) return prev;
          return { ...prev, studentNumber: String(n).padStart(3, "0") };
        });
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [idMode, formData.school, formData.schoolYear]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "studentNumber"
          ? value.replace(/[^0-9]/g, "").slice(0, 4)
          : name === "schoolYear"
            ? value.replace(/[^0-9]/g, "").slice(0, 4)
            : value,
    }));
  };

  const handleSchoolChange = (value: string) => {
    setFormData((prev) => ({ ...prev, school: value, studentNumber: "" }));
  };

  const handleAissaIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, aissaIdInput: e.target.value.toUpperCase() }));
  };

  const refreshNextNumber = async () => {
    const school = formData.school.trim();
    const yearNum = Number(formData.schoolYear.trim());
    if (!school || !Number.isFinite(yearNum)) return;

    setNumberLoading(true);
    const { data, error } = await supabase.rpc("get_next_student_number", {
      p_school: school,
      p_school_year: yearNum,
    });
    setNumberLoading(false);

    if (error) {
      setNumberError("Auto-number ලබාගත නොහැක.");
      return;
    }
    const n = typeof data === "number" ? data : Number(data);
    if (Number.isFinite(n) && n > 0) {
      setNextNumber(n);
      setFormData((prev) => ({ ...prev, studentNumber: String(n).padStart(3, "0") }));
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("ඇතුළත් කළ මුරපද (Passwords) දෙක සමාන නොවේ!");
      return;
    }
    if (formData.password.length < 6) {
      setError("මුරපදය අඩුම තරමින් අක්ෂර 6ක් විය යුතුය!");
      return;
    }
    if (!formData.school.trim()) {
      setError("පාසලේ නම ඇතුළත් කරන්න.");
      return;
    }

    if (idMode === "has-aissa") {
      if (!aissaValidation?.valid) {
        setError(aissaValidation?.error || "AISSA ID එක වලංගු නොවේ.");
        return;
      }
    } else {
      const yearNum = Number(formData.schoolYear.trim());
      if (!Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2099) {
        setError("පාසල් වර්ෂය වලංගු අගයක් නොවේ (2000–2099).");
        return;
      }
      if (!formData.studentNumber.trim()) {
        setError("පාසල් අංකය ඇතුළත් කරන්න.");
        return;
      }
      if (!finalAisId) {
        setError("Non-AISSA Quiz ID එක Auto-Generate කළ නොහැක. විස්තර පරීක්ෂා කරන්න.");
        return;
      }
    }

    setIsSubmitting(true);
    const isAissaMember = idMode === "has-aissa";

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        data: {
          full_name: formData.fullName,
          address: formData.address,
          district: formData.district,
          school: formData.school,
          stream: formData.stream,
          ais_id: finalAisId,
          aissa_district: effectiveAissaDistrict,
          is_aissa_member: isAissaMember,
          school_year: isAissaMember ? null : Number(formData.schoolYear),
          student_number: isAissaMember
            ? null
            : Number(formData.studentNumber) || null,
        },
      },
    });

    if (authError) {
      setIsSubmitting(false);
      setError(authError.message);
      return;
    }
    if (!authData.user) {
      setIsSubmitting(false);
      setError("ලියාපදිංචිය අසාර්ථක විය. නැවත උත්සාහ කරන්න.");
      return;
    }

    if (!isAissaMember) {
      void fetch("/api/send-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          fullName: formData.fullName,
          aisId: finalAisId,
        }),
      }).catch((err) => console.warn("ID email dispatch failed:", err));
    }

    setIsSubmitting(false);

    if (!authData.session) {
      setNeedsEmailConfirm(true);
      return;
    }

    alert(
      isAissaMember
        ? `AISSA ID ${finalAisId} මගින් සාර්ථකව ලියාපදිංචි විය!`
        : `ඔබගේ Non-AISSA Quiz ID: ${finalAisId} — එය ඔබගේ email ලිපිනයට යවා ඇත.`,
    );
    router.push("/student/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-md p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-2xl mb-1">
            <ShieldCheck className="w-8 h-8" />
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">
            AISSA සාමාජික ලියාපදිංචිය
          </h1>
          <p className="text-xs text-gray-500">
            AISSA ID එකක් ඇත්නම් හෝ නොමැති නම් — දෙකටම ලියාපදිංචි විය හැක.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
            {error}
          </div>
        )}

        {needsEmailConfirm ? (
          <div className="p-4 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 mx-auto text-green-600" />
            <p className="font-bold">ලියාපදිංචිය සාර්ථකයි!</p>
            <p className="text-xs">
              ඔබගේ email ලිපිනය තහවුරු කිරීමට එවා ඇති link එක click කරන්න, ඉන් පසු Login කරන්න.
              {idMode === "no-aissa" && (
                <>
                  <br />
                  ඔබගේ නව Quiz ID එකද එම ඊමේල් එකේ අඩංගු වේ.
                </>
              )}
            </p>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline mt-2"
            >
              ඇතුළු වන්න (Login) <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            {/* ---------- Mode Toggle ---------- */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                onClick={() => setIdMode("has-aissa")}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  idMode === "has-aissa"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> මට AISSA ID එකක් ඇත
              </button>
              <button
                type="button"
                onClick={() => setIdMode("no-aissa")}
                className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  idMode === "no-aissa"
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <IdCard className="w-4 h-4" /> මට AISSA ID එකක් නැත
              </button>
            </div>

            {/* ---------- Full Name ---------- */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                සම්පූර්ණ නම (Full Name)
              </label>
              <div className="relative">
                <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="fullName"
                  placeholder="උදා: Adhikarige Vivan Perera"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                />
              </div>
            </div>

            {/* ---------- Email ---------- */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                විද්‍යුත් තැපෑල (Email)
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  placeholder="udaharana@gmail.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                />
              </div>
            </div>

            {/* ---------- Address ---------- */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                ලිපිනය (Address)
              </label>
              <div className="relative">
                <MapPin className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="address"
                  placeholder="උදා: Gampaha, Sri Lanka"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                />
              </div>
            </div>

            {/* ---------- Residential District ---------- */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                පදිංචි දිස්ත්‍රික්කය (Residential District)
              </label>
              <div className="relative">
                <Map className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer disabled:opacity-60"
                >
                  {sriLankanDistricts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* ---------- School (autocomplete) ---------- */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                පාසල (School)
              </label>
              <SchoolAutocomplete
                value={formData.school}
                onChange={handleSchoolChange}
                disabled={isSubmitting}
                placeholder="පාසලේ නම ලියන්න — උදා: Royal"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                * Database එකේ ඇති පාසල් ලැයිස්තුවෙන් Suggestions පෙන්වයි.
              </p>
            </div>

            {/* ---------- Stream ---------- */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                විෂය ධාරාව (Stream)
              </label>
              <select
                name="stream"
                value={formData.stream}
                onChange={handleChange}
                disabled={isSubmitting}
                className="w-full px-3 py-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer disabled:opacity-60"
              >
                {streams.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* ============================================================ */}
            {/* AISSA ID / Non-AISSA BLOCK                                   */}
            {/* ============================================================ */}
            {idMode === "has-aissa" ? (
              <div
                className={`p-4 border rounded-xl space-y-1.5 ${
                  !formData.aissaIdInput
                    ? "bg-blue-50/70 border-blue-200"
                    : aissaValidation?.valid
                      ? "bg-emerald-50 border-emerald-300"
                      : "bg-red-50 border-red-200"
                }`}
              >
                <label className="flex text-xs font-extrabold uppercase items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> AISSA Member ID
                </label>
                <div className="relative">
                  <IdCard className="w-5 h-5 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={formData.aissaIdInput}
                    onChange={handleAissaIdChange}
                    placeholder="R25THENUMI-SBVC-AWC"
                    required
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-blue-300 rounded-xl font-bold text-sm tracking-wider text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none placeholder:font-normal placeholder:tracking-normal disabled:opacity-60"
                  />
                </div>
                {formData.aissaIdInput && aissaValidation?.valid && (
                  <p className="text-[11px] text-emerald-800 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    වලංගුයි · කලාපය:{" "}
                    <span className="font-mono">{aissaValidation.parsed?.districtCode}</span>
                  </p>
                )}
                {formData.aissaIdInput && !aissaValidation?.valid && (
                  <p className="text-[11px] text-red-700 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {aissaValidation?.error}
                  </p>
                )}
                <p className="text-[11px] text-blue-700 font-medium">
                  * ආරම්භය <strong>R, T, O, හෝ M</strong> අක්ෂරයක් විය යුතුය
                </p>
              </div>
            ) : (
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-4">
                {/* Info header */}
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-extrabold text-indigo-900 uppercase">
                      Non-AISSA Quiz ID — විස්තර
                    </p>
                    <p className="text-[11px] text-indigo-700 mt-0.5">
                      පහත විස්තර පුරවන්න — අපි ඔබට නව Quiz ID එකක් Auto-Generate කර ඊමේල් කරන්නෙමු.
                    </p>
                  </div>
                </div>

                {/* School Year + Student Number */}
                <div className="grid grid-cols-2 gap-3">
                  {/* School Year */}
                  <div>
                    <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-1.5">
                      පාසල් වර්ෂය
                    </label>
                    <div className="relative">
                      <Calendar className="w-4 h-4 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        inputMode="numeric"
                        name="schoolYear"
                        placeholder="2025"
                        value={formData.schoolYear}
                        onChange={handleChange}
                        required
                        disabled={isSubmitting}
                        maxLength={4}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-indigo-300 rounded-xl font-bold text-sm text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:font-normal placeholder:text-indigo-300 disabled:opacity-60"
                      />
                    </div>
                    <p className="text-[10px] text-indigo-600 mt-1">
                      ඔබ A/L ආරම්භ කළ වර්ෂය
                    </p>
                  </div>

                  {/* Student Number — auto */}
                  <div>
                    <label className="flex items-center justify-between text-[11px] font-bold text-indigo-900 uppercase mb-1.5">
                      <span>පාසල් අංකය</span>
                      <button
                        type="button"
                        onClick={refreshNextNumber}
                        disabled={numberLoading || !formData.school || !formData.schoolYear}
                        className="text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
                        title="Auto-number refresh"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${numberLoading ? "animate-spin" : ""}`}
                        />
                      </button>
                    </label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        inputMode="numeric"
                        name="studentNumber"
                        placeholder="001"
                        value={formData.studentNumber}
                        onChange={handleChange}
                        required
                        disabled={isSubmitting}
                        maxLength={4}
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-indigo-300 rounded-xl font-bold text-sm text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none placeholder:font-normal placeholder:text-indigo-300 disabled:opacity-60"
                      />
                      {numberLoading && (
                        <Loader2 className="w-3.5 h-3.5 text-indigo-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
                      )}
                    </div>
                    {numberError ? (
                      <p className="text-[10px] text-red-600 mt-1">{numberError}</p>
                    ) : nextNumber !== null ? (
                      <p className="text-[10px] text-indigo-600 mt-1">
                        Auto: ඊළඟ අංකය{" "}
                        <strong className="font-mono">
                          {String(nextNumber).padStart(3, "0")}
                        </strong>
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* AISSA District */}
                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 uppercase mb-1.5">
                    AISSA කලාපය
                  </label>
                  <select
                    name="aissaDistrict"
                    value={formData.aissaDistrict}
                    onChange={handleChange}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2.5 bg-white border border-indigo-300 rounded-xl font-bold text-sm text-indigo-900 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer disabled:opacity-60"
                  >
                    {AISSA_DISTRICT_CODES.map((code) => (
                      <option key={code} value={code}>
                        {AISSA_DISTRICT_LABELS[code]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Live preview */}
                <div className="p-3 bg-white border border-indigo-200 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-indigo-500 tracking-wider">
                    Auto-Generated Quiz ID
                  </p>
                  <p className="mt-1 font-mono font-extrabold text-sm text-indigo-900 break-all">
                    {finalAisId || (
                      <span className="text-indigo-300 font-sans font-medium">
                        නම, පාසල, වර්ෂය සහ අංකය පිරවූ පසු මෙහි දිස්වේ...
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* ---------- Password ---------- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  මුරපදය (Password)
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                  මුරපදය නැවත තහවුරු කරන්න
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    name="confirmPassword"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm transition mt-2 disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  ලියාපදිංචි වන්න (Register) <UserPlus className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {!needsEmailConfirm && (
          <div className="pt-4 border-t text-center text-xs text-gray-600">
            දැනටමත් AISSA ගිණුමක් තිබේද?{" "}
            <Link
              href="/auth/login"
              className="font-bold text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              ඇතුළු වන්න (Login) <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}