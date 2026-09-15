"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  UserPlus,
  User,
  Mail,
  MapPin,
  School,
  IdCard,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  GraduationCap,
  Map,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const sriLankanSchools = [
  "Ananda College, Colombo",
  "Carey College, Colombo",
  "Debarawewa Central College",
  "Devi Balika Vidyalaya, Colombo",
  "Dharmaraja College, Kandy",
  "Maliyadeva College, Kurunegala",
  "Nalanda College, Colombo",
  "Richmond College, Galle",
  "Royal College, Colombo",
  "St. Thomas' College, Mount Lavinia",
  "Visakha Vidyalaya, Colombo",
  "වෙනත් පාසලක් (Other School)",
];

const sriLankanDistricts = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
];

const streams = ["Biological Science", "Physical Science", "Maths", "Commerce", "Arts", "Technology"];

export default function StudentRegisterPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    address: "",
    district: sriLankanDistricts[0],
    school: sriLankanSchools[0],
    stream: streams[0],
    indexNumber: "",
    aisId: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Password Validation
    if (formData.password !== formData.confirmPassword) {
      setError("ඇතුළත් කළ මුරපද (Passwords) දෙක සමාන නොවේ!");
      return;
    }

    if (formData.password.length < 6) {
      setError("මුරපදය අඩුම තරමින් අක්ෂර 6ක් විය යුතුය!");
      return;
    }

    setIsSubmitting(true);

    // Supabase Auth signUp — profile fields go through as user
    // metadata. The `handle_new_user` trigger (007_auto_profile.sql)
    // reads raw_user_meta_data and inserts the profiles row itself,
    // server-side, as soon as the auth.users row is created — even
    // if email confirmation is on and there's no client session yet.
    // We deliberately do NOT do a separate `.from("profiles").insert()`
    // here anymore: that call used to race against session/RLS
    // timing and silently fail, leaving orphaned auth users with no
    // profile row (see earlier fix).
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
          index_number: formData.indexNumber,
          ais_id: formData.aisId,
        },
      },
    });

    setIsSubmitting(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    if (!authData.user) {
      setError("ලියාපදිංචිය අසාර්ථක විය. නැවත උත්සාහ කරන්න.");
      return;
    }

    // If email confirmation is enabled on the project, signUp()
    // returns a user but no active session yet — the trigger still
    // creates the profile (it fires on the auth.users insert itself,
    // independent of session state), but the person can't be routed
    // straight into the dashboard until they confirm their email.
    if (!authData.session) {
      setNeedsEmailConfirm(true);
      return;
    }

    alert(`AIS ID: ${formData.aisId} මගින් සාර්ථකව ලියාපදිංචි විය!`);
    router.push("/student/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-xl bg-white rounded-2xl border border-gray-200 shadow-md p-6 sm:p-8 space-y-6">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 p-3 bg-blue-50 text-blue-600 rounded-2xl mb-1">
            <ShieldCheck className="w-8 h-8" />
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">AISSA සාමාජික ලියාපදිංචිය</h1>
          <p className="text-xs text-gray-500">
            ඔබගේ AISSA Member ID එක භාවිතයෙන් ලියාපදිංචි වන්න
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
              ඔබගේ email ලිපිනය තහවුරු කිරීමට එවා ඇති link එක click කරන්න, ඉන් පසු
              Login කරන්න.
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
          
          {/* Full Name */}
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

          {/* Email */}
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

          {/* Address */}
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

          {/* District */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
              දිස්ත්‍රික්කය (District)
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
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* School & Index Number Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                පාසල (School)
              </label>
              <div className="relative">
                <School className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  name="school"
                  value={formData.school}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer disabled:opacity-60"
                >
                  {sriLankanSchools.map((school, idx) => (
                    <option key={idx} value={school}>
                      {school}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-1.5">
                පාසල් ID / Index No
              </label>
              <div className="relative">
                <IdCard className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="indexNumber"
                  placeholder="උදා: CC-2026-88"
                  value={formData.indexNumber}
                  onChange={handleChange}
                  required
                  disabled={isSubmitting}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                />
              </div>
            </div>
          </div>

          {/* AISSA Member ID (Highlighting Field) */}
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
            <label className="flex text-xs font-extrabold text-blue-900 uppercase items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> AIS Member ID (සාමාජික අංකය)
            </label>
            <div className="relative">
              <IdCard className="w-5 h-5 text-blue-600 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="aisId"
                placeholder="AIS-2026-XXXX"
                value={formData.aisId}
                onChange={handleChange}
                required
                disabled={isSubmitting}
                className="w-full pl-10 pr-4 py-3 bg-white border border-blue-300 rounded-xl font-bold text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none placeholder:font-normal disabled:opacity-60"
              />
            </div>
            <p className="text-[11px] text-blue-700 font-medium">
              * AISSA සංගමය මගින් ඔබට ලබාදී ඇති Member ID එක ඇතුළත් කරන්න.
            </p>
          </div>

          {/* Password & Confirm Password Grid */}
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

        {/* Login Footer Link */}
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