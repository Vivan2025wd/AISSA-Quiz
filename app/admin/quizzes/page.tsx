"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  BookOpen,
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
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { QuestionEditModal, type EditableQuestion } from "@/components/QuestionEditModal";
import QuestionBankSelectorModal from "@/components/QuestionBankSelectorModal";

// ------------------------------------------------------------
// Stream rules:
//   • Physics / Chemistry → Common (null) — all science streams
//   • Biology             → Bio Science only
//   • ICT                 → Maths stream only
// ------------------------------------------------------------
const BIO_STREAM = "Bio Science";
const MATHS_STREAM = "Maths";

function derivedStreamForSubject(subject: string): string | null {
  if (subject === "Biology") return BIO_STREAM;
  if (subject === "ICT") return MATHS_STREAM;
  return null; // Physics, Chemistry → Common
}

// ------------------------------------------------------------
// ✅ Default date / time helpers — CURRENT value with buffer
// ------------------------------------------------------------
const START_BUFFER_MINUTES = 5;   // start time default = now + 5 min

function getDefaultDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getDefaultTime(): string {
  const d = new Date(Date.now() + START_BUFFER_MINUTES * 60_000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
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

// ─── Shared column list for question fetches ───
const QUESTION_COLUMNS = `
  id, quiz_id, subject, stream, topic, image_url, correct_option,
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

  const [subject, setSubject] = useState("Physics");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  // ✅ Auto-populated
  const [date, setDate] = useState(getDefaultDate());
  const [startTime, setStartTime] = useState(getDefaultTime());
  const [duration, setDuration] = useState("45");
  const [isLive, setIsLive] = useState(true);

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [showBankSelector, setShowBankSelector] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const derivedStream = derivedStreamForSubject(subject);

  useEffect(() => {
    fetchQuizzes();
  }, []);

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
    const { error } = await supabase
      .from("quizzes")
      .update({ is_live: !currentStatus })
      .eq("id", id);

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
        const { data: directData } = await supabase
          .from("questions")
          .select(QUESTION_COLUMNS)
          .eq("quiz_id", quiz.id)
          .order("created_at", { ascending: true });

        setQuizQuestions((directData as EditableQuestion[]) || []);
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

    await supabase
      .from("questions")
      .update({ quiz_id: null })
      .eq("id", questionId)
      .eq("quiz_id", viewingQuiz.id);

    openQuestionsModal(viewingQuiz);
    fetchQuizzes();
  };

  const resetForm = () => {
    setTopic("");
    setDescription("");
    // ✅ Refresh to current date/time on reset
    setDate(getDefaultDate());
    setStartTime(getDefaultTime());
    setDuration("45");
    setIsLive(true);
    setSelectedQuestionIds([]);
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (selectedQuestionIds.length > 20) {
      setError("උපරිම ප්‍රශ්න 20ක් පමණක් Quiz එකකට තෝරාගත හැක.");
      return;
    }

    setIsSubmitting(true);

    const scheduledAt = new Date(`${date}T${startTime}:00`).toISOString();

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

  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 relative">
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed top-[35%] right-[15%] w-72 h-72 bg-green-100/60 rounded-full filter blur-3xl" />

      <div className="relative p-3 sm:p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">

          {/* ============ Header Banner ============ */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl shadow-emerald-900/20">
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-teal-300/25 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-white/5" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/8" />

            <div className="relative p-5 sm:p-6 md:p-7 space-y-5">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-300/40 blur-xl rounded-full" />
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white/15 backdrop-blur-md rounded-2xl border border-white/25 shadow-lg flex items-center justify-center overflow-hidden">
                      <BookOpen className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow" />
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-white/15">
                      <GraduationCap className="w-3.5 h-3.5" />
                      AISSA
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/25 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-300/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Admin
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold leading-tight tracking-tight flex items-center gap-2">
                    <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300 shrink-0" />
                    AISSA Quiz Management
                  </h1>
                  <p className="text-emerald-50/90 text-[11px] sm:text-xs mt-1">
                    ප්‍රශ්න පත්‍ර සාදන්න, Question Bank එකෙන් ප්‍රශ්න (උපරිම 20) තෝරන්න, සහ සිසුන්ගේ ප්‍රගතිය බලන්න.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                <Link
                  href="/admin/questions"
                  className="px-3 sm:px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white font-semibold rounded-xl text-xs sm:text-sm transition border border-white/20 flex items-center justify-center gap-2"
                >
                  <FileQuestion className="w-4 h-4 shrink-0" />
                  <span className="truncate">Question Bank</span>
                </Link>

                <Link
                  href="/admin/performance"
                  className="px-3 sm:px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-md text-white font-semibold rounded-xl text-xs sm:text-sm transition border border-white/20 flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span className="truncate">Performance</span>
                </Link>

                <button
                  onClick={() => setShowForm((v) => !v)}
                  className={`col-span-2 sm:col-auto px-3 sm:px-4 py-2.5 font-bold rounded-xl text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-sm ${
                    showForm
                      ? "bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border border-white/20"
                      : "bg-white text-emerald-900 hover:bg-emerald-50 hover:shadow-md hover:scale-[1.01]"
                  }`}
                >
                  {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showForm ? "Cancel" : "Create New Quiz"}
                </button>
              </div>
            </div>
          </div>

          {/* ============ Scheduler form ============ */}
          {showForm && (
            <div className="bg-white/80 backdrop-blur-md p-4 sm:p-6 md:p-8 rounded-2xl border border-white/70 shadow-sm space-y-5 sm:space-y-6">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-600" /> Live Quiz Scheduler
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  ඉරිදා දිනවල සජීවීව පැවැත්වෙන A/L Quizzes වෙලාව සහ විෂයයන් සකසන්න.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
                  <CheckCircle2 className="w-4 h-4" /> Live Quiz එක සාර්ථකව Database එකට එකතු විය!
                </div>
              )}

              <form onSubmit={handleSchedule} className="space-y-5 sm:space-y-6">
                {/* ---- Subject + auto stream indicator ---- */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                      විෂය (Subject)
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => {
                        setSubject(e.target.value);
                        setSelectedQuestionIds([]);
                      }}
                      disabled={isSubmitting}
                      className="w-full p-3 bg-white/60 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                    >
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Biology">Biology</option>
                      <option value="ICT">ICT</option>
                    </select>
                  </div>

                  {/* Stream — auto-derived, read-only */}
                  <div>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-2">
                      <Globe2 className="w-3.5 h-3.5" /> Stream (Auto)
                    </label>
                    <div
                      className={`w-full p-3 rounded-xl font-medium text-sm border ${
                        derivedStream === null
                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                          : derivedStream === BIO_STREAM
                            ? "bg-purple-50 border-purple-200 text-purple-800"
                            : "bg-cyan-50 border-cyan-200 text-cyan-800"
                      }`}
                    >
                      {derivedStream === null ? (
                        <span className="font-bold">
                          Common — All Science Streams
                        </span>
                      ) : derivedStream === BIO_STREAM ? (
                        <span className="font-bold">Bio Science only</span>
                      ) : (
                        <span className="font-bold">Maths stream only</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {derivedStream === null
                        ? "* Physics සහ Chemistry හැම science stream එකකටම පොදුයි."
                        : derivedStream === BIO_STREAM
                          ? "* Biology Bio Science stream එකට විතරයි."
                          : "* ICT Maths stream එකට විතරයි (Physics + Chemistry හෝ Physics + ICT)."}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                    Quiz Topic
                  </label>
                  <input
                    type="text"
                    placeholder="උදා: තාපය (Thermal Physics)"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="w-full p-3 bg-white/60 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                    විස්තරය (Description)
                  </label>
                  <input
                    type="text"
                    placeholder="Optional short description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full p-3 bg-white/60 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-gray-700 uppercase mb-2">
                      <Calendar className="w-3.5 h-3.5" /> පැවැත්වෙන දිනය
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full p-3 bg-white/60 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">

                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-gray-700 uppercase mb-2">
                      <Clock className="w-3.5 h-3.5" /> ආරම්භක වේලාව
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      disabled={isSubmitting}
                      className="w-full p-3 bg-white/60 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                    </p>
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-gray-700 uppercase mb-2">
                      <Clock className="w-3.5 h-3.5" /> කාලය (මිනිත්තු)
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      required
                      min={1}
                      disabled={isSubmitting}
                      className="w-full p-3 bg-white/60 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                    />
                  </div>
                </div>

                <div className="p-3.5 sm:p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
                        <FileQuestion className="w-4 h-4 text-emerald-600 shrink-0" />
                        Question Bank එකෙන් ප්‍රශ්න
                      </h4>
                      <p className="text-xs text-emerald-700 mt-0.5">
                        ප්‍රශ්න {selectedQuestionIds.length}ක් තෝරා ඇත (උපරිම 20).
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-extrabold self-start sm:self-auto whitespace-nowrap ${
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
                    className="w-full py-3 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {selectedQuestionIds.length > 0
                      ? `වෙනස් කරන්න (${selectedQuestionIds.length} තෝරා ඇත)`
                      : "Bank එකෙන් ප්‍රශ්න තෝරන්න"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isLive"
                    checked={isLive}
                    onChange={(e) => setIsLive(e.target.checked)}
                    disabled={isSubmitting}
                    className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 disabled:opacity-60"
                  />
                  <label
                    htmlFor="isLive"
                    className="text-xs font-bold text-gray-700 uppercase"
                  >
                    Make Live Immediately
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm hover:shadow-md transition disabled:opacity-60 text-sm"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-5 h-5" /> Quiz Schedule කරන්න (
                      {selectedQuestionIds.length} ප්‍රශ්න)
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ============ Quizzes list ============ */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                All Created Quizzes{" "}
                <span className="text-emerald-700">({quizzes.length})</span>
              </h2>
              <span className="text-xs text-gray-400 hidden sm:inline">
                card එකක් ඔබලා විස්තර බලන්න
              </span>
            </div>

            {loading ? (
              <div className="p-6 sm:p-8 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" /> Loading quizzes...
              </div>
            ) : quizzes.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-gray-400 text-sm">
                තවමත් කිසිදු Quiz එකක් නැත. &quot;Create New Quiz&quot; ඔබා එකතු කරන්න.
              </div>
            ) : (
              <>
                <div className="relative">
                  <div className="overflow-y-auto max-h-[65vh] p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {quizzes.map((quiz) => {
                        const isCommon = !quiz.stream;
                        const isBio = quiz.stream === BIO_STREAM;
                        const isMaths = quiz.stream === MATHS_STREAM;

                        const streamBadgeClass = isCommon
                          ? "bg-emerald-100 text-emerald-800"
                          : isBio
                            ? "bg-purple-100 text-purple-800"
                            : isMaths
                              ? "bg-cyan-100 text-cyan-800"
                              : "bg-gray-100 text-gray-700";

                        return (
                          <div
                            key={quiz.id}
                            className="p-4 sm:p-5 border border-gray-200 rounded-xl bg-white/60 hover:bg-white hover:border-emerald-300 hover:shadow-md transition flex flex-col justify-between gap-3 sm:gap-4"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg uppercase">
                                  {quiz.subject}
                                </span>
                                <button
                                  onClick={() => toggleQuizStatus(quiz.id, quiz.is_live)}
                                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition whitespace-nowrap ${
                                    quiz.is_live
                                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                      : "bg-gray-200 text-gray-600 border border-gray-300"
                                  }`}
                                >
                                  {quiz.is_live ? "● Live" : "○ Draft"}
                                </button>
                              </div>

                              <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-snug">
                                {quiz.title}
                              </h3>
                              <p className="text-gray-500 text-xs sm:text-sm mt-1 line-clamp-2">
                                {quiz.description || "No description provided."}
                              </p>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400 mt-3 font-medium">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5" /> {quiz.duration_minutes} Mins
                                </span>

                                <span
                                  className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wide ${streamBadgeClass}`}
                                >
                                  {isCommon ? "Common" : quiz.stream}
                                </span>

                                {quiz.scheduled_at && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(quiz.scheduled_at).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "short",
                                    })}
                                  </span>
                                )}
                                <span className="font-bold text-emerald-600">
                                  {quiz.total_questions ?? 0} / 20 Qs
                                </span>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-gray-200 flex flex-col xs:flex-row sm:flex-row items-stretch sm:items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-3">
                                <button
                                  onClick={() => openQuestionsModal(quiz)}
                                  className="text-xs font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 transition"
                                >
                                  <Eye className="w-3.5 h-3.5" /> View ({quiz.total_questions ?? 0})
                                </button>

                                <Link
                                  href={`/admin/quizzes/${quiz.id}/questions`}
                                  className="text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 transition"
                                >
                                  <HelpCircle className="w-3.5 h-3.5" /> Manage
                                </Link>
                              </div>

                              <button
                                onClick={() => deleteQuiz(quiz.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition self-end sm:self-auto"
                                title="Delete Quiz"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-white/95 via-white/60 to-transparent" />
                </div>

                <div className="px-4 py-2.5 bg-emerald-50/60 border-t border-emerald-100/60 text-[11px] text-gray-500 text-center">
                  Quizzes{" "}
                  <strong className="text-gray-700">{quizzes.length}</strong>ක්
                  පෙන්වයි · scroll කරලා බලන්න
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ============ Quick preview modal ============ */}
      {viewingQuiz && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-emerald-950/40 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full sm:max-w-4xl bg-white/95 backdrop-blur-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/70 overflow-hidden max-h-[92vh] sm:my-8 flex flex-col">
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-emerald-100 bg-emerald-50/70 backdrop-blur-sm shrink-0">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  {viewingQuiz.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-emerald-700 mt-0.5">
                  {viewingQuiz.subject} •{" "}
                  {viewingQuiz.stream ?? "Common"} • {quizQuestions.length} / 20 ප්‍රශ්න
                </p>
              </div>
              <button
                onClick={() => setViewingQuiz(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4 flex-1">
              {loadingQuestions ? (
                <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> Loading questions...
                </div>
              ) : quizQuestions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">
                    මෙම Quiz එකට තවම ප්‍රශ්න නැත.
                  </p>
                  <Link
                    href={`/admin/quizzes/${viewingQuiz.id}/questions`}
                    className="mt-3 inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl transition shadow-sm"
                  >
                    Manage Questions
                  </Link>
                </div>
              ) : (
                quizQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-3 sm:p-4 border border-gray-200 rounded-xl bg-white/70 space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-1.5 mb-1">
                          <span className="text-xs font-bold text-emerald-700">
                            #{idx + 1}
                          </span>
                          {q.topic && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] font-semibold rounded">
                              {q.topic}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 leading-snug">
                          {q.question_text}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[11px] font-bold rounded-lg transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeQuestionFromQuiz(q.id)}
                          className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                      {[q.option_1, q.option_2, q.option_3, q.option_4, q.option_5]
                        .filter((o): o is string => Boolean(o && o.trim()))
                        .map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`p-2 rounded border ${
                              q.correct_option === oIdx
                                ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                                : "bg-white border-gray-200 text-gray-600"
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

            <div className="px-4 sm:px-6 py-3 border-t border-emerald-100 bg-emerald-50/70 backdrop-blur-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shrink-0">
              <Link
                href={`/admin/quizzes/${viewingQuiz.id}/questions`}
                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
              >
                + Manage Questions පිටුවට යන්න →
              </Link>
              <button
                onClick={() => setViewingQuiz(null)}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-xl border border-gray-200 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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