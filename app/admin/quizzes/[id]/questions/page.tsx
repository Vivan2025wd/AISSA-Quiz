"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ListChecks,
  Edit3,
  Sparkles,
  Check,
  Plus,
  FileQuestion,
  X,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import QuestionEntryForm from "@/components/QuestionEntryForm";
import { QuestionEditModal, type EditableQuestion } from "@/components/QuestionEditModal";
import QuestionBankSelectorModal from "@/components/QuestionBankSelectorModal";

type Quiz = {
  id: string;
  title: string;
  subject: string;
  stream: string | null;
  total_questions: number;
};

const QUESTION_COLUMNS = `
  id, subject, stream, topic, image_url, correct_option,
  question_text, option_1, option_2, option_3, option_4, option_5, explanation,
  question_text_en, option_1_en, option_2_en, option_3_en, option_4_en, option_5_en, explanation_en,
  question_text_ta, option_1_ta, option_2_ta, option_3_ta, option_4_ta, option_5_ta, explanation_ta
`;

export default function ManageQuizQuestionsPage() {
  const params = useParams<{ id: string }>();
  const quizId = params?.id ?? "";

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showBankSelector, setShowBankSelector] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<EditableQuestion | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: quizData } = await supabase
        .from("quizzes")
        .select("id, title, subject, stream, total_questions")
        .eq("id", quizId)
        .single();

      setQuiz(quizData ?? null);

      const { data: qqData, error: qqError } = await supabase
        .from("quiz_questions")
        .select(`question_id, order_index, questions(${QUESTION_COLUMNS})`)
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });

      if (!qqError && qqData && qqData.length > 0) {
        const flatQuestions = (
          qqData as Array<{ questions?: EditableQuestion[] | EditableQuestion | null }>
        )
          .flatMap((row) => {
            const question = row.questions;
            if (!question) return [];
            return Array.isArray(question) ? question.filter(Boolean) : [question];
          })
          .filter((question): question is EditableQuestion => Boolean(question));

        setQuestions(flatQuestions);
      } else {
        setQuestions([]);
      }
    } catch (err) {
      console.error("Error loading quiz questions:", err);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (!quizId) return;
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [quizId, loadData]);

  const handleRemoveFromQuiz = async (questionId: string) => {
    if (
      !confirm(
        "මෙම ප්‍රශ්නය මෙම Quiz එකෙන් ඉවත් කිරීමට තහවුරු කරන්න? (Question Bank එකේ ප්‍රශ්නය තවදුරටත් සුරැකී පවතී)"
      )
    )
      return;

    const { error: removeError } = await supabase
      .from("quiz_questions")
      .delete()
      .eq("quiz_id", quizId)
      .eq("question_id", questionId);

    if (removeError) {
      alert("Could not remove question from quiz: " + removeError.message);
      return;
    }

    const { error: countError } = await supabase.rpc(
      "admin_set_quiz_question_count",
      {
        p_quiz_id: quizId,
        p_total_questions: Math.max(0, questions.length - 1),
      },
    );
    if (countError) {
      alert("Could not update quiz question count: " + countError.message);
      return;
    }

    loadData();
  };

  const handleBankSelectionConfirm = async (selectedIds: string[]) => {
    if (selectedIds.length > 20) {
      alert("උපරිම ප්‍රශ්න 20ක් පමණක් තෝරාගත හැක.");
      return;
    }

    setLoading(true);

    const { error: deleteError } = await supabase
      .from("quiz_questions")
      .delete()
      .eq("quiz_id", quizId);
    if (deleteError) {
      setLoading(false);
      alert("Could not replace quiz questions: " + deleteError.message);
      return;
    }

    if (selectedIds.length > 0) {
      const rows = selectedIds.map((qId, idx) => ({
        quiz_id: quizId,
        question_id: qId,
        order_index: idx + 1,
      }));
      const { error: insertError } = await supabase
        .from("quiz_questions")
        .insert(rows);
      if (insertError) {
        setLoading(false);
        alert("Could not save quiz questions: " + insertError.message);
        return;
      }
    }

    const { error: countError } = await supabase.rpc(
      "admin_set_quiz_question_count",
      {
        p_quiz_id: quizId,
        p_total_questions: selectedIds.length,
      },
    );
    if (countError) {
      setLoading(false);
      alert("Could not update quiz question count: " + countError.message);
      return;
    }

    setLoading(false);
    loadData();
  };

  // ============================================================
  // Loading / not-found — sized for fixed shell
  // ============================================================
  if (loading && !quiz) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm">
        Loading Quiz...
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/70 dark:border-slate-700 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 dark:text-red-400 mx-auto mb-3" />
          <p className="text-red-600 dark:text-red-300 font-medium text-sm">Quiz not found!</p>
          <Link
            href="/admin/quizzes"
            className="mt-3 inline-block text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold"
          >
            ← Back to Quizzes
          </Link>
        </div>
      </div>
    );
  }

  const quizLabel = `${quiz.title} — ${quiz.subject}${quiz.stream ? ` (${quiz.stream})` : ""}`;
  const isAtLimit = questions.length >= 20;

  return (
    // ── Outer shell: fixed-height on desktop, only the list scrolls ──
    <div className="max-w-5xl mx-auto md:max-h-[calc(100vh-3rem)] flex flex-col gap-4 sm:gap-5">

      {/* ═══ Header Banner — MOBILE-TIGHTENED, shrink-0 ═══ */}
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

        <div className="relative p-4 sm:p-6 space-y-4 sm:space-y-5">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Icon — smaller on mobile */}
            <div className="shrink-0">
              <div className="relative">
                <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
                <div className="relative w-12 h-12 sm:w-16 sm:h-16 bg-teal-500/15 rounded-2xl border border-teal-400/30 flex items-center justify-center">
                  <ListChecks className="w-6 h-6 sm:w-8 sm:h-8 text-teal-300" />
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5">
                <Link
                  href="/admin/quizzes"
                  className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200 hover:bg-teal-500/25 transition"
                >
                  <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Back
                </Link>
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-500/20 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200">
                  <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Admin
                </span>
              </div>
              <h1 className="text-base sm:text-xl md:text-2xl font-extrabold leading-tight tracking-tight flex items-center gap-1.5 sm:gap-2">
                <ListChecks className="w-5 h-5 sm:w-7 sm:h-7 text-teal-300 shrink-0" />
                <span className="wrap-break-word truncate">{quiz.title}</span>
              </h1>
              <p className="text-slate-300 text-[10px] sm:text-xs mt-1 wrap-break-word hidden sm:block">
                {quizLabel}
              </p>
            </div>
          </div>

          {/* Action row — count + 2 buttons, mobile-tightened */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-2">
            <span
              className={`col-span-2 sm:col-auto px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-extrabold whitespace-nowrap border text-center sm:text-left ${
                isAtLimit
                  ? "bg-amber-500/25 text-amber-100 border-amber-300/30 backdrop-blur-sm"
                  : "bg-teal-500/15 text-teal-100 border-teal-400/30 backdrop-blur-sm"
              }`}
            >
              {questions.length} / 20 Qs
            </span>

            <button
              onClick={() => setShowBankSelector(true)}
              className="sm:flex-none px-2.5 sm:px-4 py-2 bg-teal-500 text-slate-900 hover:bg-teal-400 font-bold rounded-xl text-[11px] sm:text-xs transition shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap hover:scale-[1.01]"
            >
              <FileQuestion className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Bank</span>
              <span className="hidden sm:inline">එකෙන් තෝරන්න</span>
            </button>

            <button
              onClick={() => setShowEntryForm((v) => !v)}
              disabled={isAtLimit}
              className="sm:flex-none px-2.5 sm:px-4 py-2 bg-teal-500/15 hover:bg-teal-500/25 backdrop-blur-md text-teal-100 font-bold rounded-xl text-[11px] sm:text-xs transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap border border-teal-400/30"
            >
              {showEntryForm ? (
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              ) : (
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              )}
              <span className="truncate">
                {showEntryForm ? "Cancel" : "නව ප්‍රශ්නයක්"}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ At-limit warning — shrink-0 ═══ */}
      {isAtLimit && (
        <div className="shrink-0 p-2.5 sm:p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-[11px] sm:text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          මෙම Quiz එකට උපරිම ප්‍රශ්න 20 සීමාව සම්පූර්ණ වී ඇත.
        </div>
      )}

      {/* ═══ Inline entry form — shrink-0 with capped height ═══ */}
      {showEntryForm && !isAtLimit && (
        <div className="shrink-0 md:max-h-[60vh] md:overflow-y-auto rounded-2xl">
          <QuestionEntryForm
            mode="locked"
            quizId={quiz.id}
            quizLabel={quizLabel}
            currentQuestionCount={questions.length}
            maxLimit={20}
            onSaved={() => {
              setShowEntryForm(false);
              loadData();
            }}
          />
        </div>
      )}

      {/* ═══ Questions list — flex-1 min-h-0 so ONLY this scrolls ═══ */}
      <div className="flex-1 min-h-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl border border-white/70 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
        <div className="shrink-0 px-3.5 sm:px-5 py-3 sm:py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100">
            ප්‍රශ්න{" "}
            <span className="text-emerald-700 dark:text-emerald-400">
              ({questions.length} / 20)
            </span>
          </h2>
          <span className="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap hidden sm:inline">
            Edit හෝ Unlink
          </span>
        </div>

        {questions.length === 0 ? (
          <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-3 px-4 text-center">
            <p className="text-xs sm:text-sm">
              මෙම Quiz එකට තවම ප්‍රශ්න එකතු කර නොමැත.
            </p>
            <button
              onClick={() => setShowBankSelector(true)}
              className="px-4 py-2 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-semibold rounded-xl text-[11px] sm:text-xs inline-flex items-center gap-1.5 transition shadow-sm"
            >
              <FileQuestion className="w-4 h-4" /> Bank එකෙන් තෝරන්න
            </button>
          </div>
        ) : (
          <>
            {/* Scrollable list */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-4">
              {questions.map((q, idx) => {
                const optionsList = [
                  q.option_1,
                  q.option_2,
                  q.option_3,
                  q.option_4,
                  q.option_5,
                ].filter(
                  (opt): opt is string =>
                    opt !== null && opt !== undefined && opt.trim() !== ""
                );

                return (
                  <div
                    key={q.id}
                    className="p-3 sm:p-5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white/60 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-900/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition space-y-2.5 sm:space-y-3"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-start sm:gap-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="px-1.5 sm:px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-[10px] sm:text-xs font-bold rounded-md">
                            #{idx + 1}
                          </span>
                          {q.topic && (
                            <span className="px-1.5 sm:px-2 py-0.5 bg-gray-100 dark:bg-slate-900/60 text-gray-700 dark:text-gray-300 text-[10px] sm:text-[11px] font-semibold rounded-md max-w-40 sm:max-w-none truncate">
                              {q.topic}
                            </span>
                          )}
                        </div>
                        <p className="text-sm sm:text-base font-medium text-gray-900 dark:text-gray-100 leading-snug sm:leading-relaxed pt-1 wrap-break-word">
                          {q.question_text}
                        </p>
                      </div>

                      {/* Edit / Unlink — 2-col grid on mobile, flex on desktop */}
                      <div className="grid grid-cols-2 gap-1.5 sm:flex sm:items-center sm:gap-2 shrink-0">
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="px-2.5 sm:px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 rounded-lg transition text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5"
                        >
                          <Edit3 className="w-3.5 h-3.5 shrink-0" /> Edit
                        </button>
                        <button
                          onClick={() => handleRemoveFromQuiz(q.id)}
                          className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-950/70 text-amber-800 dark:text-amber-300 rounded-lg transition text-[11px] sm:text-xs font-semibold flex items-center justify-center gap-1"
                        >
                          <X className="w-3.5 h-3.5 shrink-0" /> Unlink
                        </button>
                      </div>
                    </div>

                    {q.image_url && (
                      <div className="pt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={q.image_url}
                          alt="Question diagram"
                          className="max-h-40 sm:max-h-48 w-auto rounded-lg border border-gray-200 dark:border-slate-700 object-contain bg-white dark:bg-slate-900"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 pt-2 border-t border-gray-200/60 dark:border-slate-700">
                      {optionsList.map((opt, optIdx) => {
                        const isCorrect = q.correct_option === optIdx;
                        return (
                          <div
                            key={optIdx}
                            className={`p-2 sm:p-2.5 rounded-lg text-xs font-medium flex items-start gap-2 border transition ${
                              isCorrect
                                ? "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold"
                                : "bg-white dark:bg-slate-900/40 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                isCorrect
                                  ? "bg-emerald-600 dark:bg-emerald-500 text-white"
                                  : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-200"
                              }`}
                            >
                              {optIdx + 1}
                            </span>
                            <span className="flex-1 wrap-break-word">{opt}</span>
                            {isCorrect && (
                              <span className="px-1.5 py-0.5 bg-emerald-200 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-[10px] font-bold rounded flex items-center gap-0.5 shrink-0">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {q.explanation && (
                      <div className="p-2 sm:p-2.5 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/60 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                        <span className="font-bold flex items-center gap-1 mb-0.5 text-amber-950 dark:text-amber-100">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" /> Solution:
                        </span>
                        <span className="wrap-break-word">{q.explanation}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="shrink-0 px-3 sm:px-4 py-2 sm:py-2.5 bg-emerald-50/60 dark:bg-emerald-950/30 border-t border-emerald-100/60 dark:border-emerald-900/50 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 text-center">
              ප්‍රශ්න{" "}
              <strong className="text-gray-700 dark:text-gray-300">{questions.length}</strong>ක්
              පෙන්වයි
            </div>
          </>
        )}
      </div>

      <QuestionBankSelectorModal
        isOpen={showBankSelector}
        onClose={() => setShowBankSelector(false)}
        initialSelectedIds={questions.map((q) => q.id)}
        onConfirmSelection={handleBankSelectionConfirm}
        quizSubject={quiz.subject}
        quizStream={quiz.stream || undefined}
        quizId={quizId}
        maxLimit={20}
      />

      <QuestionEditModal
        isOpen={Boolean(editingQuestion)}
        question={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        onSaved={loadData}
      />
    </div>
  );
}