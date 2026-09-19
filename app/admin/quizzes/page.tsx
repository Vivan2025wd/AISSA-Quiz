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
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { QuestionEditModal, type EditableQuestion } from "@/components/QuestionEditModal";
import QuestionBankSelectorModal from "@/components/QuestionBankSelectorModal";

const streams = ["Bio Science", "Physical Science", "Maths", "Commerce", "Arts", "Technology"];

interface Quiz {
  id: string;
  title: string;
  description?: string;
  subject: string;
  stream?: string;
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

export default function AdminQuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showForm, setShowForm] = useState(false);

  const [viewingQuiz, setViewingQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<EditableQuestion[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<EditableQuestion | null>(null);

  const [subject, setSubject] = useState("Physics");
  const [stream, setStream] = useState(streams[0]);
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("2026-09-20");
  const [startTime, setStartTime] = useState("20:00");
  const [duration, setDuration] = useState("45");
  const [isLive, setIsLive] = useState(true);

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [showBankSelector, setShowBankSelector] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

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
        .select(
          "question_id, order_index, questions(id, quiz_id, subject, stream, question_text, topic, correct_option, option_1, option_2, option_3, option_4, option_5, image_url, explanation)"
        )
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
          .select(
            "id, quiz_id, subject, stream, question_text, topic, correct_option, option_1, option_2, option_3, option_4, option_5, image_url, explanation"
          )
          .eq("quiz_id", quiz.id)
          .order("created_at", { ascending: true });

        setQuizQuestions(directData || []);
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
    setDate("2026-09-20");
    setStartTime("20:00");
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
          stream: stream,
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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
        {/* ============ Header ============ */}
        <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 shrink-0" />
              AISSA Quiz Management
            </h1>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">
              ප්‍රශ්න පත්‍ර සාදන්න, Question Bank එකෙන් ප්‍රශ්න (උපරිම 20) තෝරන්න, සහ සිසුන්ගේ ප්‍රගතිය බලන්න.
            </p>
          </div>

          {/* Actions — grid on mobile, row on tablet+ */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
            <Link
              href="/admin/questions"
              className="px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              <FileQuestion className="w-4 h-4 shrink-0" />
              <span className="truncate">Question Bank</span>
            </Link>

            <Link
              href="/admin/performance"
              className="px-3 sm:px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="truncate">Performance</span>
            </Link>

            <button
              onClick={() => setShowForm((v) => !v)}
              className="col-span-2 sm:col-auto px-3 sm:px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition shadow-sm flex items-center justify-center gap-2"
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? "Cancel" : "Create New Quiz"}
            </button>
          </div>
        </div>

        {/* ============ Scheduler form ============ */}
        {showForm && (
          <div className="bg-white p-4 sm:p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-5 sm:space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> Live Quiz Scheduler
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                ඉරිදා දිනවල සජීවීව පැවැත්වෙන A/L Quizzes වෙලාව සහ විෂයයන් සකසන්න.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Live Quiz එක සාර්ථකව Database එකට එකතු විය!
              </div>
            )}

            <form onSubmit={handleSchedule} className="space-y-5 sm:space-y-6">
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
                    className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                  >
                    <option value="Physics">Physics</option>
                    <option value="Chemistry">Chemistry</option>
                    <option value="Biology">Biology</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                    Stream
                  </label>
                  <select
                    value={stream}
                    onChange={(e) => {
                      setStream(e.target.value);
                      setSelectedQuestionIds([]);
                    }}
                    disabled={isSubmitting}
                    className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                  >
                    {streams.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
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
                  className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none"
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
                  className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                />
              </div>

              {/* Date / time / duration — single column on mobile */}
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
                    className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                  />
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
                    className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                  />
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
                    className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                  />
                </div>
              </div>

              {/* Question bank picker */}
              <div className="p-3.5 sm:p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-blue-900 uppercase flex items-center gap-1.5">
                      <FileQuestion className="w-4 h-4 text-blue-600 shrink-0" />
                      Question Bank එකෙන් ප්‍රශ්න
                    </h4>
                    <p className="text-xs text-blue-700 mt-0.5">
                      ප්‍රශ්න {selectedQuestionIds.length}ක් තෝරා ඇත (උපරිම 20).
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold self-start sm:self-auto whitespace-nowrap ${
                      selectedQuestionIds.length >= 20
                        ? "bg-amber-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    {selectedQuestionIds.length} / 20
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setShowBankSelector(true)}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-white hover:bg-blue-50 border border-blue-300 text-blue-700 font-bold rounded-xl text-xs transition flex items-center justify-center gap-2"
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
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded disabled:opacity-60"
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
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-md transition disabled:opacity-60 text-sm"
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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4">
            All Created Quizzes
          </h2>

          {loading ? (
            <div className="p-6 sm:p-8 text-center text-gray-500 text-sm">
              Loading quizzes...
            </div>
          ) : quizzes.length === 0 ? (
            <div className="p-6 sm:p-8 text-center text-gray-400 text-sm">
              තවමත් කිසිදු Quiz එකක් නැත. &quot;Create New Quiz&quot; ඔබා එකතු කරන්න.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="p-4 sm:p-5 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white hover:border-blue-300 transition flex flex-col justify-between gap-3 sm:gap-4"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg uppercase">
                        {quiz.subject}
                      </span>
                      <button
                        onClick={() => toggleQuizStatus(quiz.id, quiz.is_live)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition whitespace-nowrap ${
                          quiz.is_live
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {quiz.is_live ? "Live" : "Draft"}
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
                      {quiz.stream && <span>{quiz.stream}</span>}
                      {quiz.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {new Date(quiz.scheduled_at).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      )}
                      <span className="font-bold text-blue-600">
                        {quiz.total_questions ?? 0} / 20 Qs
                      </span>
                    </div>
                  </div>

                  {/* Actions — stack on very small screens */}
                  <div className="pt-3 border-t border-gray-200 flex flex-col xs:flex-row sm:flex-row items-stretch sm:items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={() => openQuestionsModal(quiz)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" /> View ({quiz.total_questions ?? 0})
                      </button>

                      <Link
                        href={`/admin/quizzes/${quiz.id}/questions`}
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ============ Quick preview modal (mobile-optimized) ============ */}
      {viewingQuiz && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full sm:max-w-4xl bg-white rounded-t-2xl sm:rounded-2xl shadow-xl border border-gray-200 overflow-hidden max-h-[92vh] sm:my-8 flex flex-col">
            <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  {viewingQuiz.title}
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-500 mt-0.5">
                  {viewingQuiz.subject} • {quizQuestions.length} / 20 ප්‍රශ්න
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
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading questions...
                </div>
              ) : quizQuestions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 text-sm">
                    මෙම Quiz එකට තවම ප්‍රශ්න නැත.
                  </p>
                  <Link
                    href={`/admin/quizzes/${viewingQuiz.id}/questions`}
                    className="mt-3 inline-block px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-xl"
                  >
                    Manage Questions
                  </Link>
                </div>
              ) : (
                quizQuestions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-3 sm:p-4 border border-gray-200 rounded-xl bg-gray-50/60 space-y-2.5"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-1.5 mb-1">
                          <span className="text-xs font-bold text-blue-700">
                            #{idx + 1}
                          </span>
                          {q.topic && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px] font-semibold rounded">
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
                          className="px-2.5 py-1 bg-blue-100 hover:bg-blue-200 text-blue-800 text-[11px] font-bold rounded-lg transition"
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

            <div className="px-4 sm:px-6 py-3 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 shrink-0">
              <Link
                href={`/admin/quizzes/${viewingQuiz.id}/questions`}
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                + Manage Questions පිටුවට යන්න →
              </Link>
              <button
                onClick={() => setViewingQuiz(null)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-xl"
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
        quizStream={stream}
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