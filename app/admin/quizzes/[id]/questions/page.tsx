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
        .select(
          "question_id, order_index, questions(id, quiz_id, subject, stream, question_text, topic, correct_option, option_1, option_2, option_3, option_4, option_5, image_url, explanation)"
        )
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
        const { data: directData } = await supabase
          .from("questions")
          .select(
            "id, quiz_id, subject, stream, question_text, topic, correct_option, option_1, option_2, option_3, option_4, option_5, image_url, explanation"
          )
          .eq("quiz_id", quizId)
          .order("created_at", { ascending: true });

        setQuestions(directData || []);
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

    await supabase
      .from("quiz_questions")
      .delete()
      .eq("quiz_id", quizId)
      .eq("question_id", questionId);

    await supabase
      .from("questions")
      .update({ quiz_id: null })
      .eq("id", questionId)
      .eq("quiz_id", quizId);

    await supabase
      .from("quizzes")
      .update({ total_questions: Math.max(0, questions.length - 1) })
      .eq("id", quizId);

    loadData();
  };

  const handleBankSelectionConfirm = async (selectedIds: string[]) => {
    if (selectedIds.length > 20) {
      alert("උපරිම ප්‍රශ්න 20ක් පමණක් තෝරාගත හැක.");
      return;
    }

    setLoading(true);

    await supabase.from("quiz_questions").delete().eq("quiz_id", quizId);

    if (selectedIds.length > 0) {
      const rows = selectedIds.map((qId, idx) => ({
        quiz_id: quizId,
        question_id: qId,
        order_index: idx + 1,
      }));
      await supabase.from("quiz_questions").insert(rows);
    }

    await supabase
      .from("quizzes")
      .update({ total_questions: selectedIds.length })
      .eq("id", quizId);

    setLoading(false);
    loadData();
  };

  if (loading && !quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center gap-2 text-gray-500 text-sm">
        Loading Quiz...
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/70 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <p className="text-red-600 font-medium text-sm">Quiz not found!</p>
          <Link
            href="/admin/quizzes"
            className="mt-3 inline-block text-xs text-emerald-600 hover:underline font-bold"
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
    // ============ Modern green/white background ============
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 relative">
      {/* Aurora blobs */}
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-[28rem] sm:h-[28rem] bg-emerald-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-[28rem] sm:h-[28rem] bg-teal-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed top-[35%] right-[15%] w-72 h-72 bg-green-100/60 rounded-full filter blur-3xl" />

      <div className="relative p-3 sm:p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6">

          {/* ============ Header Banner ============ */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl shadow-emerald-900/20">
            {/* dot grid */}
            <div
              className="absolute inset-0 opacity-[0.08] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, white 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            {/* glows */}
            <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-emerald-300/30 rounded-full blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-teal-300/25 rounded-full blur-3xl" />
            {/* rings */}
            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-[18px] border-white/5" />
            {/* shine */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.08]" />

            <div className="relative p-5 sm:p-6 space-y-5">
              <div className="flex items-start gap-4">
                {/* Logo */}
                <div className="shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-300/40 blur-xl rounded-full" />
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white/15 backdrop-blur-md rounded-2xl border border-white/25 shadow-lg flex items-center justify-center overflow-hidden">
                      <ListChecks className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <Link
                      href="/admin/quizzes"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-white/15 hover:bg-white/25 transition"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to Quizzes
                    </Link>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/25 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-300/30">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Admin
                    </span>
                  </div>
                  <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold leading-tight tracking-tight flex items-center gap-2">
                    <ListChecks className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300 shrink-0" />
                    <span className="break-words">{quiz.title}</span>
                  </h1>
                  <p className="text-emerald-50/90 text-[11px] sm:text-xs mt-1 break-words">
                    {quizLabel}
                  </p>
                </div>
              </div>

              {/* Capacity + actions */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-3 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap border ${
                    isAtLimit
                      ? "bg-amber-500/25 text-amber-100 border-amber-300/30 backdrop-blur-sm"
                      : "bg-white/15 text-white border-white/20 backdrop-blur-sm"
                  }`}
                >
                  {questions.length} / 20 Questions
                </span>

                <button
                  onClick={() => setShowBankSelector(true)}
                  className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-xl text-xs transition shadow-sm hover:shadow-md flex items-center justify-center gap-1.5 whitespace-nowrap hover:scale-[1.01]"
                >
                  <FileQuestion className="w-4 h-4" /> Bank එකෙන් තෝරන්න
                </button>

                <button
                  onClick={() => setShowEntryForm((v) => !v)}
                  disabled={isAtLimit}
                  className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap border ${
                    showEntryForm
                      ? "bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border-white/20"
                      : "bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border-white/20"
                  }`}
                >
                  {showEntryForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  {showEntryForm ? "Cancel" : "නව ප්‍රශ්නයක්"}
                </button>
              </div>
            </div>
          </div>

          {isAtLimit && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              මෙම Quiz එකට උපරිම ප්‍රශ්න 20 සීමාව සම්පූර්ණ වී ඇත.
            </div>
          )}

          {showEntryForm && !isAtLimit && (
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
          )}

          {/* ============ Questions list ============ */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm overflow-hidden">
            {/* Header strip */}
            <div className="px-5 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                Quiz එකට ඇතුළත් ප්‍රශ්න{" "}
                <span className="text-emerald-700">
                  ({questions.length} / 20)
                </span>
              </h2>
              <span className="text-[11px] sm:text-xs text-gray-400">
                සංස්කරණය හෝ Quiz එකෙන් ඉවත් කිරීම
              </span>
            </div>

            {questions.length === 0 ? (
              <div className="p-8 sm:p-12 text-center text-gray-400 space-y-3">
                <p className="text-sm">මෙම Quiz එකට තවම ප්‍රශ්න එකතු කර නොමැත.</p>
                <button
                  onClick={() => setShowBankSelector(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs inline-flex items-center gap-1.5 transition shadow-sm"
                >
                  <FileQuestion className="w-4 h-4" /> Bank එකෙන් ප්‍රශ්න තෝරන්න (උපරිම 20)
                </button>
              </div>
            ) : (
              <>
                {/* ===== Scrollable list with fade shadow ===== */}
                <div className="relative">
                  <div className="overflow-y-auto max-h-[65vh] p-4 sm:p-5 space-y-3 sm:space-y-4">
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
                          className="p-3.5 sm:p-5 border border-gray-200 rounded-xl bg-white/60 hover:bg-white hover:border-emerald-300 hover:shadow-md transition space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">
                                  #{idx + 1}
                                </span>
                                {q.topic && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-semibold rounded-md">
                                    {q.topic}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm sm:text-base font-medium text-gray-900 leading-relaxed pt-1 break-words">
                                {q.question_text}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto w-full sm:w-auto">
                              <button
                                onClick={() => setEditingQuestion(q)}
                                className="flex-1 sm:flex-none px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition text-xs font-bold flex items-center justify-center gap-1.5"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit
                              </button>
                              <button
                                onClick={() => handleRemoveFromQuiz(q.id)}
                                className="flex-1 sm:flex-none px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition text-xs font-semibold flex items-center justify-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Unlink
                              </button>
                            </div>
                          </div>

                          {q.image_url && (
                            <div className="pt-1">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={q.image_url}
                                alt="Question diagram"
                                className="max-h-40 sm:max-h-48 w-auto rounded-lg border border-gray-200 object-contain bg-white"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200/60">
                            {optionsList.map((opt, optIdx) => {
                              const isCorrect = q.correct_option === optIdx;
                              return (
                                <div
                                  key={optIdx}
                                  className={`p-2.5 rounded-lg text-xs font-medium flex items-start gap-2 border transition ${
                                    isCorrect
                                      ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                                      : "bg-white border-gray-200 text-gray-700"
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                                      isCorrect
                                        ? "bg-emerald-600 text-white"
                                        : "bg-gray-200 text-gray-700"
                                    }`}
                                  >
                                    {optIdx + 1}
                                  </span>
                                  <span className="flex-1 break-words">{opt}</span>
                                  {isCorrect && (
                                    <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded flex items-center gap-0.5 shrink-0">
                                      <Check className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {q.explanation && (
                            <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900">
                              <span className="font-bold flex items-center gap-1 mb-0.5 text-amber-950">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Solution:
                              </span>
                              <span className="break-words">{q.explanation}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom fade */}
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/95 via-white/60 to-transparent" />
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2.5 bg-emerald-50/60 border-t border-emerald-100/60 text-[11px] text-gray-500 text-center">
                  ප්‍රශ්න{" "}
                  <strong className="text-gray-700">{questions.length}</strong>ක්
                  පෙන්වයි · scroll කරලා බලන්න
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <QuestionBankSelectorModal
        isOpen={showBankSelector}
        onClose={() => setShowBankSelector(false)}
        initialSelectedIds={questions.map((q) => q.id)}
        onConfirmSelection={handleBankSelectionConfirm}
        quizSubject={quiz.subject}
        quizStream={quiz.stream || undefined}
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