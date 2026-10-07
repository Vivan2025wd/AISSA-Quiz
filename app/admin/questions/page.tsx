"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileQuestion,
  Plus,
  Search,
  Trash2,
  Edit3,
  Sparkles,
  Check,
  Loader2,
  X,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import QuestionEntryForm from "@/components/QuestionEntryForm";
import { QuestionEditModal, type EditableQuestion } from "@/components/QuestionEditModal";

const subjectFilters = ["All", "Physics", "Chemistry", "Biology", "ICT"];
const streamFilters = ["All", "Common", "Bio Science", "Maths"];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  const [filterSubject, setFilterSubject] = useState("All");
  const [filterStream, setFilterStream] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const [editingQuestion, setEditingQuestion] =
    useState<EditableQuestion | null>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("questions")
      .select(
        `id, subject, stream, topic, image_url, explanation_image_url,
         question_text, option_1, option_2, option_3, option_4, option_5, explanation, correct_option,
         question_text_en, option_1_en, option_2_en, option_3_en, option_4_en, option_5_en, explanation_en,
         question_text_ta, option_1_ta, option_2_ta, option_3_ta, option_4_ta, option_5_ta, explanation_ta`,
      )
      .order("created_at", { ascending: false });

    if (filterSubject !== "All") {
      query = query.eq("subject", filterSubject);
    }

    if (filterStream === "Common") {
      query = query.is("stream", null);
    } else if (filterStream !== "All") {
      query = query.eq("stream", filterStream);
    }

    const { data, error } = await query;
    if (!error && data) {
      setQuestions(data);
    }
    setLoading(false);
  }, [filterSubject, filterStream]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQuestions();
  }, [loadQuestions]);

  const handleDelete = async (id: string) => {
    if (
      !confirm(
        "මෙම ප්‍රශ්නය Question Bank එකෙන් සම්පූර්ණයෙන්ම ඉවත් කිරීමට තහවුරු කරන්න?",
      )
    )
      return;

    const { error } = await supabase.from("questions").delete().eq("id", id);
    if (error) {
      alert("ප්‍රශ්නය මකාදැමීම අසාර්ථක විය: " + error.message);
      return;
    }
    loadQuestions();
  };

  const filteredQuestions = questions.filter((q) => {
    if (!searchQuery.trim()) return true;
    const qText = q.question_text.toLowerCase();
    const topicText = (q.topic ?? "").toLowerCase();
    const search = searchQuery.toLowerCase();
    return qText.includes(search) || topicText.includes(search);
  });

  // ============================================================
  // Loading Screen — sized to fit the fixed layout shell
  // ============================================================
  if (loading && questions.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-gray-500 text-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loading-screen.png"
          alt="AISSA"
          className="w-20 h-20 sm:w-32 sm:h-32 object-contain animate-pulse"
        />
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          Question Bank එක Load වෙමින්...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto md:max-h-[calc(100vh-3rem)] flex flex-col gap-4 sm:gap-5">

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

        <div className="relative p-4 sm:p-6 md:p-7">
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
              <h1 className="text-base sm:text-xl md:text-2xl font-extrabold leading-tight tracking-tight flex items-center gap-1.5 sm:gap-2">
                <FileQuestion className="w-5 h-5 sm:w-7 sm:h-7 text-teal-300 shrink-0" />
                <span className="truncate">Central Question Bank</span>
              </h1>
              <p className="text-slate-300 text-[11px] sm:text-xs mt-1 leading-snug hidden sm:block">
                සියලුම MCQs මෙහි ගබඩා කර ඇත. Quiz සාදන විට මෙම ප්‍රශ්න බැංකුවෙන් උපරිම 20ක් තෝරාගත හැක.
              </p>
            </div>
          </div>

          {/* Add button — full-width on mobile, self-start on desktop */}
          <button
            onClick={() => setShowAddForm((prev) => !prev)}
            className={`mt-4 sm:mt-5 w-full sm:w-auto sm:self-start px-4 sm:px-5 py-2.5 font-bold rounded-xl text-xs sm:text-sm transition shadow-lg flex items-center justify-center gap-2 ${
              showAddForm
                ? "bg-teal-500/15 hover:bg-teal-500/25 backdrop-blur-md text-teal-200 border border-teal-400/30"
                : "bg-teal-500 text-slate-900 hover:bg-teal-400 hover:shadow-teal-500/30 hover:scale-[1.01]"
            }`}
          >
            {showAddForm ? <X className="w-4 h-4 shrink-0" /> : <Plus className="w-4 h-4 shrink-0" />}
            {showAddForm ? "Cancel" : "Add New Question"}
          </button>
        </div>
      </div>

      {/* ═══ Inline Add Form — shrink-0 with capped height + its own scroll ═══ */}
      {showAddForm && (
        <div className="shrink-0 md:max-h-[60vh] md:overflow-y-auto rounded-2xl">
          <QuestionEntryForm
            mode="bank"
            onSaved={() => {
              setShowAddForm(false);
              loadQuestions();
            }}
          />
        </div>
      )}

      {/* ═══ Filter Bar — MOBILE-TIGHTENED ═══ */}
      <div className="shrink-0 bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-2xl border border-white/70 shadow-sm grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
        {/* Search — spans both columns on mobile */}
        <div className="relative col-span-2 sm:col-span-1">
          <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 absolute left-3 top-3 sm:top-3.5" />
          <input
            type="text"
            placeholder="Search by text or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white/60 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 focus:bg-white transition-all"
          />
        </div>

        <div>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="w-full px-2 sm:px-3 py-2.5 bg-white/60 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 focus:bg-white transition-all"
          >
            {subjectFilters.map((s) => (
              <option key={s} value={s}>
                Subject: {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <select
            value={filterStream}
            onChange={(e) => setFilterStream(e.target.value)}
            className="w-full px-2 sm:px-3 py-2.5 bg-white/60 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 focus:bg-white transition-all"
          >
            {streamFilters.map((st) => (
              <option key={st} value={st}>
                Stream: {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ═══ Questions List — flex-1 + min-h-0 so ONLY this scrolls ═══ */}
      <div className="flex-1 min-h-0 bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm overflow-hidden flex flex-col">
        {/* Header strip */}
        <div className="shrink-0 px-3.5 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-lg font-bold text-gray-900">
            ප්‍රශ්න ලැයිස්තුව{" "}
            <span className="text-emerald-700">
              ({filteredQuestions.length})
            </span>
          </h2>
          <span className="text-[10px] sm:text-xs text-gray-400 whitespace-nowrap">
            <span className="hidden sm:inline">Total in Bank: </span>
            <strong className="text-gray-600">{questions.length}</strong>
          </span>
        </div>

        {loading ? (
          <div className="flex-1 min-h-0 flex items-center justify-center gap-2 text-gray-500 text-xs sm:text-sm">
            <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin text-emerald-600" />
            Question Bank එක Load වෙමින්...
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="flex-1 min-h-0 flex items-center justify-center text-gray-400 text-center px-4 text-xs sm:text-sm">
            ප්‍රශ්න කිසිවක් හමු නොවීය. නව ප්‍රශ්නයක් එකතු කිරීමට &quot;Add New Question&quot; ඔබන්න.
          </div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-5 space-y-3 sm:space-y-4">
              {filteredQuestions.map((q, idx) => {
                const optionsList = [
                  q.option_1,
                  q.option_2,
                  q.option_3,
                  q.option_4,
                  q.option_5,
                ].filter(
                  (opt): opt is string =>
                    opt !== null && opt !== undefined && opt.trim() !== "",
                );

                const streamBadgeClass = !q.stream
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : q.stream === "Bio Science"
                    ? "bg-purple-50 text-purple-700 border-purple-200"
                    : q.stream === "Maths"
                      ? "bg-cyan-50 text-cyan-700 border-cyan-200"
                      : "bg-gray-50 text-gray-700 border-gray-200";

                return (
                  <div
                    key={q.id}
                    className="p-3 sm:p-5 border border-gray-200 rounded-xl bg-white/60 hover:bg-white hover:border-emerald-300 hover:shadow-md transition space-y-2.5 sm:space-y-3"
                  >
                    <div className="flex justify-between items-start gap-2 sm:gap-4">
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <span className="px-1.5 sm:px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs font-bold rounded-md">
                            #{idx + 1}
                          </span>
                          {q.subject && (
                            <span className="px-1.5 sm:px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] sm:text-xs font-bold rounded-md border border-teal-200">
                              {q.subject}
                            </span>
                          )}
                          <span
                            className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded-md border ${streamBadgeClass}`}
                          >
                            {q.stream ?? "Common"}
                          </span>
                          {q.topic && (
                            <span className="px-1.5 sm:px-2 py-0.5 bg-gray-100 text-gray-700 text-[10px] sm:text-xs font-semibold rounded-md max-w-30 sm:max-w-none truncate">
                              {q.topic}
                            </span>
                          )}
                        </div>

                        <p className="text-sm sm:text-base font-medium text-gray-900 leading-snug sm:leading-relaxed pt-1 wrap-break-word">
                          {q.question_text}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                        <button
                          onClick={() => setEditingQuestion(q)}
                          className="p-1.5 sm:px-3 sm:py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition text-xs font-bold flex items-center gap-1.5"
                          title="Edit Question"
                          aria-label="Edit Question"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Delete Question"
                          aria-label="Delete Question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {q.image_url && (
                      <div className="pt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={q.image_url}
                          alt="Diagram"
                          className="max-h-40 sm:max-h-48 rounded-lg border border-gray-200 object-contain bg-white"
                        />
                      </div>
                    )}

                    {/* Options — 1-col on mobile (already), tighter padding */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 pt-2 border-t border-gray-200/60">
                      {optionsList.map((opt, optIdx) => {
                        const isCorrect = q.correct_option === optIdx;
                        return (
                          <div
                            key={optIdx}
                            className={`p-2 sm:p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 border transition ${
                              isCorrect
                                ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                                : "bg-white border-gray-200 text-gray-700"
                            }`}
                          >
                            <span
                              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                isCorrect
                                  ? "bg-emerald-600 text-white"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {optIdx + 1}
                            </span>
                            <span className="flex-1 wrap-break-word">{opt}</span>
                            {isCorrect && (
                              <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded flex items-center gap-0.5 shrink-0">
                                <Check className="w-3 h-3" />
                                <span className="hidden sm:inline">Correct</span>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Explanation + explanation diagram */}
                    {(q.explanation || q.explanation_image_url) && (
                      <div className="p-2 sm:p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900 space-y-2">
                        {q.explanation && (
                          <div>
                            <span className="font-bold flex items-center gap-1 mb-0.5 text-amber-950">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" /> Explanation:
                            </span>
                            <span className="wrap-break-word">{q.explanation}</span>
                          </div>
                        )}
                        {q.explanation_image_url && (
                          <div className="pt-1">
                            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1 mb-1">
                              <Sparkles className="w-3 h-3 text-amber-600 shrink-0" /> Diagram
                            </span>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={q.explanation_image_url}
                              alt="Explanation diagram"
                              loading="lazy"
                              decoding="async"
                              className="max-h-32 sm:max-h-40 rounded-lg border border-amber-200 bg-white object-contain"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer hint */}
            <div className="shrink-0 px-3 sm:px-4 py-2.5 bg-emerald-50/60 border-t border-emerald-100/60 text-[10px] sm:text-[11px] text-gray-500 text-center">
              ප්‍රශ්න{" "}
              <strong className="text-gray-700">
                {filteredQuestions.length}
              </strong>
              ක් පෙන්වයි · scroll කරලා බලන්න
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      <QuestionEditModal
        isOpen={Boolean(editingQuestion)}
        question={editingQuestion}
        onClose={() => setEditingQuestion(null)}
        onSaved={loadQuestions}
      />
    </div>
  );
}