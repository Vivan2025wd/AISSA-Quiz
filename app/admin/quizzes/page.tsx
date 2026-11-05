"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Trash2,
  BarChart3,
  Clock,
  HelpCircle,
  Calendar,
  Loader2,
  CheckCircle2,
  X,
  Eye,
  FileQuestion,
  Globe2,
  ShieldCheck,
  GraduationCap,
  RefreshCw,
  Edit3,
  Save,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { QuestionEditModal, type EditableQuestion } from "@/components/QuestionEditModal";
import QuestionBankSelectorModal from "@/components/QuestionBankSelectorModal";

// ------------------------------------------------------------
// Stream rules
// ------------------------------------------------------------
const BIO_STREAM = "Bio Science";
const MATHS_STREAM = "Maths";

function derivedStreamForSubject(subject: string): string | null {
  if (subject === "Biology") return BIO_STREAM;
  if (subject === "ICT") return MATHS_STREAM;
  return null;
}

const START_BUFFER_MINUTES = 5;
const COLOMBO_OFFSET = "+05:30";
const COLOMBO_OFFSET_MINUTES = 330;

function getDefaultColomboDateTime(): string {
  const timestamp =
    Date.now() +
    START_BUFFER_MINUTES * 60_000 +
    COLOMBO_OFFSET_MINUTES * 60_000;
  return new Date(timestamp).toISOString().slice(0, 16);
}

function isoToColomboDateTime(iso: string | null | undefined): string {
  if (!iso) return getDefaultColomboDateTime();
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return getDefaultColomboDateTime();
  return new Date(timestamp + COLOMBO_OFFSET_MINUTES * 60_000)
    .toISOString()
    .slice(0, 16);
}

function colomboDateTimeToUtc(value: string): string | null {
  const timestamp = new Date(`${value}:00${COLOMBO_OFFSET}`).getTime();
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

interface Quiz {
  id: string;
  title: string;
  description?: string;
  subject: string;
  stream?: string | null;
  scheduled_at?: string;
  duration_minutes: number;
  total_questions?: number;
  is_live: boolean;
  created_at: string;
}

type QuizQuestionRow = {
  question_id: string;
  order_index: number;
  questions: EditableQuestion | null;
};

const QUESTION_COLUMNS = `
  id, subject, stream, topic, image_url, correct_option,
  question_text, option_1, option_2, option_3, option_4, option_5, explanation,
  question_text_en, option_1_en, option_2_en, option_3_en, option_4_en, option_5_en, explanation_en,
  question_text_ta, option_1_ta, option_2_ta, option_3_ta, option_4_ta, option_5_ta, explanation_ta
`;

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState(false);

  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<EditableQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<EditableQuestion | null>(null);

  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);

  const [subject, setSubject] = useState("Physics");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAtLocal, setScheduledAtLocal] = useState(
    getDefaultColomboDateTime(),
  );
  const [duration, setDuration] = useState("45");
  const [isLive, setIsLive] = useState(true);

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [showBankSelector, setShowBankSelector] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [roleChecked, setRoleChecked] = useState(false);

  const derivedStream = derivedStreamForSubject(subject);

  useEffect(() => {
    fetchQuizzes();
    void checkSuperAdmin();
  }, []);

  async function checkSuperAdmin() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError) {
      console.error("Could not verify scheduler role:", authError.message);
      setRoleChecked(true);
      return;
    }
    if (!user) {
      setRoleChecked(true);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Could not load scheduler role:", profileError.message);
    } else {
      setIsSuperAdmin(profile?.is_super_admin === true);
    }
    setRoleChecked(true);
  }

  async function fetchQuizzes() {
    setLoading(true);
    const { data, error } = await supabase
      .from("quizzes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching quizzes:", error);
    } else {
      setQuizzes(data || []);
    }
    setLoading(false);
  }

  async function toggleQuizStatus(id: string, currentStatus: boolean) {
    const { error } = await supabase.rpc("admin_set_quiz_live", {
      p_quiz_id: id,
      p_is_live: !currentStatus,
    });

    if (error) {
      alert("Status update කිරීමට අපොහොසත් විය.");
    } else {
      fetchQuizzes();
    }
  }

  async function deleteQuiz(id: string) {
    if (
      !confirm(
        "මෙම Quiz එක සහ ඊට අදාළ සියලුම සම්බන්ධතා ඉවත් කිරීමට තහවුරු කරන්න? (Question Bank එකේ ප්‍රශ්න ඉවත් නොවේ)"
      )
    )
      return;

    const { error } = await supabase.from("quizzes").delete().eq("id", id);

    if (error) {
      alert("Quiz එක Delete කිරීමට අපොහොසත් විය: " + error.message);
    } else {
      fetchQuizzes();
    }
  }

  const openQuestionsModal = async (quiz: Quiz) => {
    setViewingQuiz(quiz);
    setLoadingQuestions(true);

    try {
      const { data: qqData, error: qqError } = await supabase
        .from("quiz_questions")
        .select(`question_id, order_index, questions(${QUESTION_COLUMNS})`)
        .eq("quiz_id", quiz.id)
        .order("order_index", { ascending: true });

      if (!qqError && qqData && qqData.length > 0) {
        const flatList = (qqData as unknown as QuizQuestionRow[])
          .map((row) => row.questions)
          .filter((q): q is EditableQuestion => q !== null);
        setQuizQuestions(flatList);
      } else {
        setQuizQuestions([]);
      }
    } catch (err) {
      console.error("Error loading quiz questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const removeQuestionFromQuiz = async (questionId: string) => {
    if (!viewingQuiz) return;
    if (
      !confirm(
        "මෙම ප්‍රශ්නය මෙම Quiz එකෙන් ඉවත් කරන්න? (Question Bank එකේ ප්‍රශ්නය තවදුරටත් සුරැකී පවතී)"
      )
    )
      return;

    await supabase
      .from("quiz_questions")
      .delete()
      .eq("quiz_id", viewingQuiz.id)
      .eq("question_id", questionId);

    openQuestionsModal(viewingQuiz);
    fetchQuizzes();
  };

  const resetForm = () => {
    setTopic("");
    setDescription("");
    setScheduledAtLocal(getDefaultColomboDateTime());
    setDuration("45");
    setIsLive(true);
    setSelectedQuestionIds([]);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!isSuperAdmin) {
      setError("Only a super admin can schedule quizzes.");
      return;
    }
    if (!subject.trim() || !topic.trim()) {
      setError("Subject, topic, and stream are required.");
      return;
    }
    const scheduledAt = colomboDateTimeToUtc(scheduledAtLocal);
    if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
      setError("Schedule time must be in the future (Asia/Colombo time).");
      return;
    }
    if (selectedQuestionIds.length > 20) {
      setError("උපරිම ප්‍රශ්න 20ක් පමණක් Quiz එකකට තෝරාගත හැක.");
      return;
    }

    setIsSubmitting(true);

    const { data: createdQuiz, error: insertError } = await supabase
      .from("quizzes")
      .insert([
        {
          title: topic,
          description: description,
          subject: subject,
          stream: derivedStream,
          scheduled_at: scheduledAt,
          duration_minutes: parseInt(duration, 10),
          total_questions: selectedQuestionIds.length,
          is_live: isLive,
        },
      ])
      .select("id")
      .single();

    if (insertError || !createdQuiz) {
      setIsSubmitting(false);
      setError("Quiz Schedule Error: " + (insertError?.message || ""));
      return;
    }

    if (selectedQuestionIds.length > 0) {
      const links = selectedQuestionIds.map((qId, index) => ({
        quiz_id: createdQuiz.id,
        question_id: qId,
        order_index: index + 1,
      }));

      const { error: linkError } = await supabase.from("quiz_questions").insert(links);
      if (linkError) {
        console.warn("quiz_questions link error:", linkError);
      }
    }

    setIsSubmitting(false);
    setSuccess(true);
    resetForm();
    setShowForm(false);
    fetchQuizzes();
  };

  // ============================================================
  // Loading Screen — sized to fit the fixed layout shell
  // ============================================================
  if (loading && quizzes.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-gray-500 dark:text-gray-400 text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loading-screen.png"
          alt="AISSA"
          className="w-20 h-20 sm:w-32 sm:h-32 object-contain animate-pulse"
        />
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" />
          Loading Quizzes...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto md:max-h-[calc(100vh-3rem)] flex flex-col gap-3.5 sm:gap-5">

      {/* ═══ Header Banner — MOBILE-TIGHTENED ═══ */}
      <div className="shrink-0 relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-slate-700/50">
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-teal-400/10" />
        <div className="pointer-events-none absolute top-1/2 -right-24 w-72 h-72 rounded-full border-[1.5px] border-teal-400/10 hidden md:block" />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/5" />

        <div className="relative p-4 sm:p-6 md:p-7 space-y-4 sm:space-y-5">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
                <div className="relative w-14 h-14 sm:w-20 sm:h-20 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/aissa-logo.png"
                    alt="AISSA Logo"
                    className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(45,212,191,0.5)]"
                  />
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5">
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
                  <GraduationCap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  AISSA
                </span>
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-500/20 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200">
                  <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Admin
                </span>
              </div>
              <h1 className="text-base sm:text-xl md:text-2xl font-extrabold leading-tight tracking-tight">
                AISSA Quiz Management
              </h1>
              <p className="text-slate-300 text-[10px] sm:text-xs mt-1 leading-snug hidden sm:block">
                ප්‍රශ්න පත්‍ර සාදන්න, Question Bank එකෙන් ප්‍රශ්න (උපරිම 20) තෝරන්න, සහ සිසුන්ගේ ප්‍රගතිය බලන්න.
              </p>
            </div>
          </div>

          {/* Action buttons — 2-col grid on mobile */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <Link
              href="/admin/questions"
              className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-teal-500/15 hover:bg-teal-500/25 backdrop-blur-md text-teal-100 font-semibold rounded-xl text-[11px] sm:text-sm transition border border-teal-400/30 flex items-center justify-center gap-1.5 sm:gap-2"
            >
              <FileQuestion className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Question Bank</span>
            </Link>

            <Link
              href="/admin/performance"
              className="px-2.5 sm:px-4 py-2 sm:py-2.5 bg-teal-500/15 hover:bg-teal-500/25 backdrop-blur-md text-teal-100 font-semibold rounded-xl text-[11px] sm:text-sm transition border border-teal-400/30 flex items-center justify-center gap-1.5 sm:gap-2"
            >
              <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Performance</span>
            </Link>

            {isSuperAdmin && (
              <button
                onClick={() => setShowForm((v) => !v)}
                className={`col-span-2 sm:col-auto px-2.5 sm:px-4 py-2 sm:py-2.5 font-bold rounded-xl text-[11px] sm:text-sm transition flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm ${
                  showForm
                    ? "bg-teal-500/15 hover:bg-teal-500/25 backdrop-blur-md text-teal-100 border border-teal-400/30"
                    : "bg-teal-500 text-slate-900 hover:bg-teal-400 hover:shadow-lg hover:shadow-teal-500/30 hover:scale-[1.01]"
                }`}
              >
                {showForm ? <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> : <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />}
                <span className="truncate">{showForm ? "Cancel" : "Create New Quiz"}</span>
              </button>
            )}
          </div>
          {roleChecked && !isSuperAdmin && (
            <p className="relative text-xs text-amber-200">
              Quiz scheduling is available to super admins only.
            </p>
          )}
        </div>
      </div>

      {/* ═══ Scheduler Form — shrink-0 with capped height ═══ */}
      {showForm && isSuperAdmin && (
        <div className="shrink-0 md:max-h-[70vh] md:overflow-y-auto rounded-2xl">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-3.5 sm:p-6 md:p-8 rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm space-y-4 sm:space-y-6">
            <div>
              <h2 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400 shrink-0" /> Live Quiz Scheduler
              </h2>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                ඉරිදා දිනවල සජීවීව පැවැත්වෙන A/L Quizzes වෙලාව සහ විෂයයන් සකසන්න.
              </p>
            </div>

            {error && (
              <div className="p-2.5 sm:p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] sm:text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="p-2.5 sm:p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-[11px] sm:text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
                <CheckCircle2 className="w-4 h-4" /> Live Quiz එක සාර්ථකව Database එකට එකතු විය!
              </div>
            )}

            <form onSubmit={handleSchedule} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                    විෂය (Subject)
                  </label>
                  <select
                    value={subject}
                    required
                    onChange={(e) => {
                      setSubject(e.target.value);
                      setSelectedQuestionIds([]);
                    }}
                    disabled={isSubmitting}
                    className="w-full p-2.5 sm:p-3 bg-white/60 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none disabled:opacity-60 transition"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                    <option value="ICT">ICT</option>
                  </select>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                    <Globe2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Stream (Auto)
                  </label>
                  <div
                    className={`w-full p-2.5 sm:p-3 rounded-xl font-medium text-xs sm:text-sm border ${
                      derivedStream === null
                        ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                        : derivedStream === BIO_STREAM
                          ? "bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300"
                          : "bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300"
                    }`}
                  >
                    {derivedStream === null ? (
                      <span className="font-bold">Common — All Science Streams</span>
                    ) : derivedStream === BIO_STREAM ? (
                      <span className="font-bold">Bio Science only</span>
                    ) : (
                      <span className="font-bold">Maths stream only</span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-snug hidden sm:block">
                    {derivedStream === null
                      ? "* Physics සහ Chemistry හැම science stream එකකටම පොදුයි."
                      : derivedStream === BIO_STREAM
                        ? "* Biology Bio Science stream එකට විතරයි."
                        : "* ICT Maths stream එකට විතරයි."}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                  Quiz Topic
                </label>
                <input
                  type="text"
                  placeholder="උදා: තාපය (Thermal Physics)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="w-full p-2.5 sm:p-3 bg-white/60 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                  විස්තරය (Description)
                </label>
                <input
                  type="text"
                  placeholder="Optional short description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-2.5 sm:p-3 bg-white/60 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none disabled:opacity-60 transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Schedule time (Asia/Colombo)
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledAtLocal}
                    onChange={(e) => setScheduledAtLocal(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full p-2.5 sm:p-3 bg-white/60 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none disabled:opacity-60 transition"
                  />
                </div>

                <div>
                  <label className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                    <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> මිනිත්තු
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    required
                    min={1}
                    disabled={isSubmitting}
                    className="w-full p-2.5 sm:p-3 bg-white/60 dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none disabled:opacity-60 transition"
                  />
                </div>
              </div>

              <div className="p-3 sm:p-4 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-[10px] sm:text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase flex items-center gap-1.5">
                      <FileQuestion className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Question Bank එකෙන් ප්‍රශ්න
                    </h4>
                    <p className="text-[11px] sm:text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                      ප්‍රශ්න {selectedQuestionIds.length}ක් තෝරා ඇත (උපරිම 20).
                    </p>
                  </div>
                  <span
                    className={`px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-extrabold self-start sm:self-auto whitespace-nowrap ${
                      selectedQuestionIds.length >= 20
                        ? "bg-amber-600 text-white"
                        : "bg-emerald-600 text-white"
                    }`}
                  >
                    {selectedQuestionIds.length} / 20
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBankSelector(true)}
                  disabled={isSubmitting}
                  className="w-full py-2.5 sm:py-3 bg-white dark:bg-slate-900/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-bold rounded-xl text-[11px] sm:text-xs transition flex items-center justify-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">
                    {selectedQuestionIds.length > 0
                      ? `වෙනස් කරන්න (${selectedQuestionIds.length} තෝරා ඇත)`
                      : "Bank එකෙන් ප්‍රශ්න තෝරන්න"}
                  </span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isLive"
                  checked={isLive}
                  onChange={(e) => setIsLive(e.target.checked)}
                  disabled={isSubmitting}
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded focus:ring-emerald-500 disabled:opacity-60"
                />
                <label
                  htmlFor="isLive"
                  className="text-[11px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase"
                >
                  Make Live Immediately
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 sm:py-3.5 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm hover:shadow-md transition disabled:opacity-60 text-xs sm:text-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    <span className="truncate">
                      Quiz Schedule ({selectedQuestionIds.length} ප්‍රශ්න)
                    </span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ═══ Quizzes List — flex-1 + min-h-0 ═══ */}
      <div className="flex-1 min-h-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div className="shrink-0 px-3.5 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100">
            All Quizzes{" "}
            <span className="text-emerald-700 dark:text-emerald-400">({quizzes.length})</span>
          </h2>
          <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
            card එකක් ඔබලා විස්තර බලන්න
          </span>
        </div>

        {loading ? (
          <div className="flex-1 min-h-0 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600 dark:text-emerald-400" /> Loading quizzes...
          </div>
        ) : quizzes.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs sm:text-sm text-center px-4">
            තවමත් කිසිදු Quiz එකක් නැත. &quot;Create New Quiz&quot; ඔබා එකතු කරන්න.
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-4">
                {quizzes.map((quiz) => {
                  const isCommon = !quiz.stream;
                  const isBio = quiz.stream === BIO_STREAM;
                  const isMaths = quiz.stream === MATHS_STREAM;

                  const streamBadgeClass = isCommon
                    ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
                    : isBio
                      ? "bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300"
                      : isMaths
                        ? "bg-cyan-100 dark:bg-cyan-950/50 text-cyan-800 dark:text-cyan-300"
                        : "bg-gray-100 dark:bg-slate-900/60 text-gray-700 dark:text-gray-300";

                  return (
                    <div
                      key={quiz.id}
                      className="p-3 sm:p-5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white/60 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition flex flex-col justify-between gap-2.5 sm:gap-4"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
                          <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] sm:text-[11px] rounded-lg uppercase">
                            {quiz.subject}
                          </span>
                          <button
                            onClick={() => toggleQuizStatus(quiz.id, quiz.is_live)}
                            className={`px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-semibold rounded-lg transition whitespace-nowrap ${
                              quiz.is_live
                                ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                                : "bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-slate-600"
                            }`}
                          >
                            {quiz.is_live ? "● Live" : "○ Draft"}
                          </button>
                        </div>

                        <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2">
                          {quiz.title}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 text-[11px] sm:text-sm mt-1 line-clamp-2">
                          {quiz.description || "No description provided."}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1 text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 mt-2 sm:mt-3 font-medium">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> {quiz.duration_minutes} Mins
                          </span>

                          <span
                            className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${streamBadgeClass}`}
                          >
                            {isCommon ? "Common" : quiz.stream}
                          </span>

                          {quiz.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                              {new Date(quiz.scheduled_at).toLocaleString("en-GB", {
                                timeZone: "Asia/Colombo",
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {quiz.total_questions ?? 0} / 20 Qs
                          </span>
                        </div>
                      </div>

                      <div className="pt-2.5 sm:pt-3 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-x-2.5 sm:gap-x-3 gap-y-1">
                          <button
                            onClick={() => openQuestionsModal(quiz)}
                            className="text-[10px] sm:text-xs font-bold text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 flex items-center gap-1 transition"
                          >
                            <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> View
                          </button>

                          {isSuperAdmin && (
                            <button
                              onClick={() => setEditingQuiz(quiz)}
                              className="text-[10px] sm:text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 transition"
                            >
                              <Edit3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Edit
                            </button>
                          )}

                          <Link
                            href={`/admin/quizzes/${quiz.id}/questions`}
                            className="text-[10px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 flex items-center gap-1 transition"
                          >
                            <HelpCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Manage
                          </Link>
                        </div>

                        <button
                          onClick={() => deleteQuiz(quiz.id)}
                          className="p-1.5 sm:p-2 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition shrink-0"
                          title="Delete Quiz"
                          aria-label="Delete Quiz"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 border-t border-emerald-100/60 dark:border-emerald-900/50 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 text-center">
              Quizzes{" "}
              <strong className="text-gray-700 dark:text-gray-300">{quizzes.length}</strong>ක්
              පෙන්වයි
            </div>
          </>
        )}
      </div>

      {/* ============ Quick preview modal — MOBILE-TIGHTENED ============ */}
      {viewingQuiz && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-emerald-950/40 dark:bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full sm:max-w-4xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/70 dark:border-slate-700 overflow-hidden max-h-[92vh] sm:my-8 flex flex-col">
            <div className="flex items-start justify-between gap-2 sm:gap-3 px-3.5 sm:px-6 py-3 sm:py-4 border-b border-emerald-100 dark:border-slate-700 bg-emerald-50/70 dark:bg-emerald-950/40 backdrop-blur-sm shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                  {viewingQuiz.title}
                </h3>
                <p className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {viewingQuiz.subject} •{" "}
                  {viewingQuiz.stream ?? "Common"} • {quizQuestions.length} / 20
                </p>
              </div>
              <button
                onClick={() => setViewingQuiz(null)}
                className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-6 overflow-y-auto space-y-2.5 sm:space-y-4 flex-1">
              {loadingQuestions ? (
                <div className="p-6 sm:p-8 text-center text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2 text-xs sm:text-sm">
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-emerald-600 dark:text-emerald-400" /> Loading questions...
                </div>
              ) : quizQuestions.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm">
                    මෙම Quiz එකට තවම ප්‍රශ්න නැත.
                  </p>
                  <Link
                    href={`/admin/quizzes/${viewingQuiz.id}/questions`}
                    className="mt-3 inline-block px-4 py-2 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-[11px] sm:text-xs font-semibold rounded-xl transition shadow-sm"
                  >
                    Manage Questions
                  </Link>
                </div>
              ) : (
                quizQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-2.5 sm:p-4 border border-gray-200 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/40 space-y-2 sm:space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-1.5 mb-1">
                          <span className="text-[11px] sm:text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            #{idx + 1}
                          </span>
                          {q.topic && (
                            <span className="px-1.5 sm:px-2 py-0.5 bg-gray-100 dark:bg-slate-900/60 text-gray-700 dark:text-gray-300 text-[9px] sm:text-[10px] font-semibold rounded max-w-30 sm:max-w-none truncate">
                              {q.topic}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                          {q.question_text}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="px-2 sm:px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/50 hover:bg-emerald-200 dark:hover:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] sm:text-[11px] font-bold rounded-lg transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeQuestionFromQuiz(q.id)}
                          className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40 rounded-lg transition"
                          title="Remove"
                          aria-label="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-1.5 text-[11px] sm:text-xs">
                      {[q.option_1, q.option_2, q.option_3, q.option_4, q.option_5]
                        .filter((o): o is string => Boolean(o && o.trim()))
                        .map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-1.5 sm:p-2 rounded border ${
                              q.correct_option === oIdx
                                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold"
                                : "bg-white dark:bg-slate-900/40 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            ({oIdx + 1}) {opt}{" "}
                            {q.correct_option === oIdx && "✓"}
                          </div>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-t border-emerald-100 dark:border-slate-700 bg-emerald-50/70 dark:bg-emerald-950/40 backdrop-blur-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shrink-0">
              <Link
                href={`/admin/quizzes/${viewingQuiz.id}/questions`}
                className="text-[11px] sm:text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline order-2 sm:order-1"
              >
                + Manage Questions →
              </Link>
              <button
                onClick={() => setViewingQuiz(null)}
                className="order-1 sm:order-2 px-3.5 sm:px-4 py-2 bg-white dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-200 text-[11px] sm:text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <QuizEditModal
        key={editingQuiz?.id ?? "empty"}
        quiz={editingQuiz}
        onClose={() => setEditingQuiz(null)}
        onSaved={() => {
          setEditingQuiz(null);
          fetchQuizzes();
        }}
      />

      <QuestionBankSelectorModal
        isOpen={showBankSelector}
        onClose={() => setShowBankSelector(false)}
        initialSelectedIds={selectedQuestionIds}
        onConfirmSelection={(ids) => setSelectedQuestionIds(ids)}
        quizSubject={subject}
        quizStream={derivedStream ?? undefined}
        maxLimit={20}
      />

      <QuestionEditModal
        isOpen={Boolean(editingQuestion)}
        question={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        onSaved={() => {
          if (viewingQuiz) openQuestionsModal(viewingQuiz);
          fetchQuizzes();
        }}
      />
    </div>
  );
}

// ============================================================
// Quiz Edit Modal — MOBILE-TIGHTENED
// ============================================================
function QuizEditModal({
  quiz,
  onClose,
  onSaved,
}: {
  quiz: Quiz | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const getInitialFormState = (currentQuiz: Quiz | null) => {
    if (!currentQuiz) {
      return {
        title: "",
        description: "",
        subject: "Physics",
        scheduledAtLocal: getDefaultColomboDateTime(),
        duration: "45",
        isLive: true,
      };
    }

    return {
      title: currentQuiz.title ?? "",
      description: currentQuiz.description ?? "",
      subject: currentQuiz.subject ?? "Physics",
      scheduledAtLocal: isoToColomboDateTime(currentQuiz.scheduled_at),
      duration: String(currentQuiz.duration_minutes ?? 45),
      isLive: currentQuiz.is_live ?? true,
    };
  };

  const initialForm = getInitialFormState(quiz);
  const [title, setTitle] = useState(initialForm.title);
  const [description, setDescription] = useState(initialForm.description);
  const [subject, setSubject] = useState(initialForm.subject);
  const [scheduledAtLocal, setScheduledAtLocal] = useState(
    initialForm.scheduledAtLocal,
  );
  const [duration, setDuration] = useState(initialForm.duration);
  const [isLive, setIsLive] = useState(initialForm.isLive);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!quiz) return null;

  const derivedStream = derivedStreamForSubject(subject);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!title.trim() || !subject.trim()) {
      setError("Subject and title are required.");
      return;
    }
    const scheduledAt = colomboDateTimeToUtc(scheduledAtLocal);
    if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
      setError("Schedule time must be in the future (Asia/Colombo time).");
      return;
    }
    setIsSaving(true);

    const { error: updateError } = await supabase.rpc(
      "super_admin_update_quiz_schedule",
      {
        p_quiz_id: quiz.id,
        p_title: title.trim(),
        p_description: description.trim() || null,
        p_subject: subject,
        p_stream: derivedStream,
        p_scheduled_at: scheduledAt,
        p_duration_minutes: Number.parseInt(duration, 10),
        p_is_live: isLive,
      },
    );

    setIsSaving(false);

    if (updateError) {
      setError("Update Error: " + updateError.message);
      return;
    }

    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full sm:max-w-2xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/70 dark:border-slate-700 overflow-hidden max-h-[92vh] sm:my-8 flex flex-col">

        <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-black text-white border-b border-slate-700/50 shrink-0">
          <div
            className="absolute inset-0 opacity-[0.15] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="pointer-events-none absolute -top-16 -right-20 w-56 h-56 bg-teal-500/20 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 w-48 h-48 bg-emerald-500/15 rounded-full blur-3xl" />

          <div className="relative px-3.5 sm:px-6 py-3.5 sm:py-4 flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="shrink-0 p-1.5 sm:p-2 bg-teal-500/15 rounded-xl border border-teal-400/30">
                <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-teal-200" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-lg font-bold truncate">
                  Edit Quiz Schedule
                </h3>
                <p className="text-slate-300 text-[10px] sm:text-xs mt-0.5 truncate">
                  දිනය · වේලාව · කාලය · විස්තර
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition shrink-0 disabled:opacity-60"
              aria-label="Close"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-3.5 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {error && (
            <div className="p-2.5 sm:p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] sm:text-xs font-semibold rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                විෂය (Subject)
              </label>
              <select
                value={subject}
                required
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSaving}
                className="w-full p-2.5 sm:p-3 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none disabled:opacity-60 transition"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
                <option value="ICT">ICT</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                <Globe2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Stream (Auto)
              </label>
              <div
                className={`w-full p-2.5 sm:p-3 rounded-xl font-medium text-xs sm:text-sm border ${
                  derivedStream === null
                    ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : derivedStream === BIO_STREAM
                      ? "bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300"
                      : "bg-cyan-50 dark:bg-cyan-950/50 border-cyan-200 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300"
                }`}
              >
                {derivedStream === null ? (
                  <span className="font-bold">Common</span>
                ) : derivedStream === BIO_STREAM ? (
                  <span className="font-bold">Bio Science only</span>
                ) : (
                  <span className="font-bold">Maths stream only</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
              Quiz Topic
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isSaving}
              className="w-full p-2.5 sm:p-3 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none disabled:opacity-60 transition"
            />
          </div>

          <div>
            <label className="block text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
              විස්තරය (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSaving}
              placeholder="Optional short description"
              className="w-full p-2.5 sm:p-3 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none disabled:opacity-60 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> Schedule time (Asia/Colombo)
              </label>
              <input
                type="datetime-local"
                value={scheduledAtLocal}
                onChange={(e) => setScheduledAtLocal(e.target.value)}
                required
                disabled={isSaving}
                className="w-full p-2.5 sm:p-3 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none disabled:opacity-60 transition"
              />
            </div>

            <div>
              <label className="flex items-center gap-1 text-[10px] sm:text-xs font-bold text-gray-700 dark:text-gray-300 uppercase mb-1.5 sm:mb-2">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" /> මිනිත්තු
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
                min={1}
                disabled={isSaving}
                className="w-full p-2.5 sm:p-3 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-gray-100 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 dark:focus:border-emerald-500 outline-none disabled:opacity-60 transition"
              />
            </div>
          </div>

          <div className="p-3 sm:p-3.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2">
            <input
              type="checkbox"
              id="editIsLive"
              checked={isLive}
              onChange={(e) => setIsLive(e.target.checked)}
              disabled={isSaving}
              className="w-4 h-4 text-emerald-600 dark:text-emerald-400 border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded focus:ring-emerald-500 disabled:opacity-60"
            />
            <label
              htmlFor="editIsLive"
              className="text-[11px] sm:text-xs font-bold text-emerald-900 dark:text-emerald-200 uppercase"
            >
              Quiz එක Live කරන්න
            </label>
          </div>
        </form>

        <div className="px-3.5 sm:px-6 py-3 border-t border-gray-100 dark:border-slate-700 bg-gray-50/80 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 sm:flex-none px-4 py-2.5 bg-white dark:bg-slate-900/60 hover:bg-gray-100 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-200 text-[11px] sm:text-xs font-semibold rounded-xl border border-gray-200 dark:border-slate-700 transition disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-teal-600 dark:bg-teal-500 hover:bg-teal-700 dark:hover:bg-teal-600 text-white text-[11px] sm:text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4 shrink-0" />
            )}
            <span>Save Changes</span>
          </button>
        </div>
      </div>
    </div>
  );
}