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

  // Form toggles
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [showBankSelector, setShowBankSelector] = useState(false);

  // Edit Modal state
  const [editingQuestion, setEditingQuestion] = useState<EditableQuestion | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      // 1. Fetch Quiz Info
      const { data: quizData } = await supabase
        .from("quizzes")
        .select("id, title, subject, stream, total_questions")
        .eq("id", quizId)
        .single();

      setQuiz(quizData ?? null);

      // 2. Fetch questions via quiz_questions junction table
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
        // Fallback to legacy direct quiz_id
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

    let active = true;

    const fetchQuizData = async () => {
      setLoading(true);

      try {
        const { data: quizData } = await supabase
          .from("quizzes")
          .select("id, title, subject, stream, total_questions")
          .eq("id", quizId)
          .single();

        if (!active) return;
        setQuiz(quizData ?? null);

        const { data: qqData, error: qqError } = await supabase
          .from("quiz_questions")
          .select(
            "question_id, order_index, questions(id, quiz_id, subject, stream, question_text, topic, correct_option, option_1, option_2, option_3, option_4, option_5, image_url, explanation)"
          )
          .eq("quiz_id", quizId)
          .order("order_index", { ascending: true });

        if (!active) return;

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
        if (active) {
          setLoading(false);
        }
      }
    };

    void fetchQuizData();

    return () => {
      active = false;
    };
  }, [quizId]);

  // Remove question from this quiz (does NOT delete from the Question Bank)
  const handleRemoveFromQuiz = async (questionId: string) => {
    if (!confirm("මෙම ප්‍රශ්නය මෙම Quiz එකෙන් ඉවත් කිරීමට තහවුරු කරන්න? (Question Bank එකේ ප්‍රශ්නය තවදුරටත් සුරැකී පවතී)")) return;

    // Delete from junction table
    await supabase
      .from("quiz_questions")
      .delete()
      .eq("quiz_id", quizId)
      .eq("question_id", questionId);

    // Also null out direct quiz_id if set
    await supabase
      .from("questions")
      .update({ quiz_id: null })
      .eq("id", questionId)
      .eq("quiz_id", quizId);

    // Sync count
    await supabase
      .from("quizzes")
      .update({ total_questions: Math.max(0, questions.length - 1) })
      .eq("id", quizId);

    loadData();
  };

  // Sync selection from Question Bank modal
  const handleBankSelectionConfirm = async (selectedIds: string[]) => {
    if (selectedIds.length > 20) {
      alert("උපරිම ප්‍රශ්න 20ක් පමණක් තෝරාගත හැක.");
      return;
    }

    setLoading(true);

    // 1. Delete previous links for this quiz in junction table
    await supabase.from("quiz_questions").delete().eq("quiz_id", quizId);

    // 2. Insert new links
    if (selectedIds.length > 0) {
      const rows = selectedIds.map((qId, idx) => ({
        quiz_id: quizId,
        question_id: qId,
        order_index: idx + 1,
      }));
      await supabase.from("quiz_questions").insert(rows);
    }

    // 3. Update total_questions on quiz
    await supabase
      .from("quizzes")
      .update({ total_questions: selectedIds.length })
      .eq("id", quizId);

    setLoading(false);
    loadData();
  };

  if (loading && !quiz) {
    return <div className="p-8 text-center text-gray-500">Loading Quiz...</div>;
  }

  if (!quiz) {
    return <div className="p-8 text-center text-red-500">Quiz not found!</div>;
  }

  const quizLabel = `${quiz.title} — ${quiz.subject}${quiz.stream ? ` (${quiz.stream})` : ""}`;
  const isAtLimit = questions.length >= 20;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/admin/quizzes"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-2 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Quizzes
          </Link>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <ListChecks className="w-6 h-6 text-blue-600" /> {quiz.title}
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {quizLabel}
          </p>
        </div>

        {/* Capacity Badge & Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-3 py-2 rounded-xl text-xs font-extrabold ${
            isAtLimit ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}>
            {questions.length} / 20 Questions
          </span>

          <button
            onClick={() => setShowBankSelector(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5"
          >
            <FileQuestion className="w-4 h-4" /> Bank එකෙන් තෝරන්න
          </button>

          <button
            onClick={() => setShowEntryForm((v) => !v)}
            disabled={isAtLimit}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            {showEntryForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showEntryForm ? "Cancel" : "නව ප්‍රශ්නයක් ලියන්න"}
          </button>
        </div>
      </div>

      {isAtLimit && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          මෙම Quiz එකට උපරිම ප්‍රශ්න 20 සීමාව සම්පූර්ණ වී ඇත.
        </div>
      )}

      {/* Inline Add New Question Form */}
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

      {/* Added Questions List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            Quiz එකට ඇතුළත් කර ඇති ප්‍රශ්න ({questions.length} / 20)
          </h2>
          <span className="text-xs text-gray-400">ක්‍රියාකාරකම්: සංස්කරණය හෝ Quiz එකෙන් ඉවත් කිරීම</span>
        </div>

        {questions.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-3">
            <p className="text-sm">මෙම Quiz එකට තවම ප්‍රශ්න එකතු කර නොමැත.</p>
            <button
              onClick={() => setShowBankSelector(true)}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-xl text-xs inline-flex items-center gap-1.5"
            >
              <FileQuestion className="w-4 h-4" /> Question Bank එකෙන් ප්‍රශ්න තෝරන්න (උපරිම 20)
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const optionsList = [
                q.option_1,
                q.option_2,
                q.option_3,
                q.option_4,
                q.option_5,
              ].filter(
                (opt): opt is string => opt !== null && opt !== undefined && opt.trim() !== ""
              );

              return (
                <div
                  key={q.id}
                  className="p-5 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white hover:border-blue-200 transition space-y-3"
                >
                  {/* Top Bar: Question number, Topic, Action buttons */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-md">
                          #{idx + 1}
                        </span>
                        {q.topic && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs font-semibold rounded-md">
                            {q.topic}
                          </span>
                        )}
                      </div>
                      <p className="text-base font-medium text-gray-900 leading-relaxed pt-1">
                        {q.question_text}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setEditingQuestion(q)}
                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition text-xs font-bold flex items-center gap-1.5"
                        title="Edit Question"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleRemoveFromQuiz(q.id)}
                        className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg transition text-xs font-semibold flex items-center gap-1"
                        title="Remove from this quiz (keeps in Question Bank)"
                      >
                        <X className="w-3.5 h-3.5" /> Unlink
                      </button>
                    </div>
                  </div>

                  {/* Diagram / Image */}
                  {q.image_url && (
                    <div className="pt-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={q.image_url}
                        alt="Question diagram"
                        className="max-h-48 rounded-lg border border-gray-200 object-contain bg-white"
                      />
                    </div>
                  )}

                  {/* Options List */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-gray-200/60">
                    {optionsList.map((opt, optIdx) => {
                      const isCorrect = q.correct_option === optIdx;
                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition ${
                            isCorrect
                              ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                              : "bg-white border-gray-200 text-gray-700"
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isCorrect
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-200 text-gray-700"
                            }`}
                          >
                            {optIdx + 1}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {isCorrect && (
                            <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded flex items-center gap-0.5">
                              <Check className="w-3 h-3" /> Correct
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation if available */}
                  {q.explanation && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900">
                      <span className="font-bold flex items-center gap-1 mb-0.5 text-amber-950">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Solution / Explanation:
                      </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Question Bank Selector Modal */}
      <QuestionBankSelectorModal
        isOpen={showBankSelector}
        onClose={() => setShowBankSelector(false)}
        initialSelectedIds={questions.map((q) => q.id)}
        onConfirmSelection={handleBankSelectionConfirm}
        quizSubject={quiz.subject}
        quizStream={quiz.stream || undefined}
        maxLimit={20}
      />

      {/* Edit Question Modal */}
      <QuestionEditModal
        isOpen={Boolean(editingQuestion)}
        question={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        onSaved={loadData}
      />
    </div>
  );
}