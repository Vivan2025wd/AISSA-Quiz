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

// ------------------------------------------------------------
// Filters
//   • "Common" = Physics / Chemistry (stream IS NULL in DB)
//   • "Bio Science" = Biology only
// ------------------------------------------------------------
const subjectFilters = ["All", "Physics", "Chemistry", "Biology"];
const streamFilters = ["All", "Common", "Bio Science"];

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
        "id, quiz_id, subject, stream, topic, question_text, image_url, option_1, option_2, option_3, option_4, option_5, correct_option, explanation",
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

  return (
    // ============ Modern green/white background ============
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 relative">
      {/* Aurora blobs */}
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed top-[35%] right-[15%] w-72 h-72 bg-green-100/60 rounded-full filter blur-3xl" />

      <div className="relative p-3 sm:p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">

          {/* ============ Header Banner ============ */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl shadow-emerald-900/20">
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
            <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-white/5" />
            {/* shine */}
            <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/8" />

            <div className="relative p-5 sm:p-6 md:p-7 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0 flex-1">
                {/* Logo */}
                <div className="shrink-0">
                  <div className="relative">
                    <div className="absolute inset-0 bg-emerald-300/40 blur-xl rounded-full" />
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-white/15 backdrop-blur-md rounded-2xl border border-white/25 shadow-lg flex items-center justify-center overflow-hidden">
                      <FileQuestion className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow" />
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="min-w-0">
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
                    <FileQuestion className="w-6 h-6 sm:w-7 sm:h-7 text-amber-300 shrink-0" />
                    Central Question Bank
                  </h1>
                  <p className="text-emerald-50/90 text-[11px] sm:text-xs mt-1">
                    සියලුම MCQs මෙහි ගබඩා කර ඇත. Quiz සාදන විට මෙම ප්‍රශ්න බැංකුවෙන් උපරිම 20ක් තෝරාගත හැක.
                  </p>
                </div>
              </div>

              {/* Add button */}
              <button
                onClick={() => setShowAddForm((prev) => !prev)}
                className={`self-start shrink-0 px-5 py-2.5 font-bold rounded-xl text-sm transition shadow-sm flex items-center gap-2 ${
                  showAddForm
                    ? "bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border border-white/20"
                    : "bg-white text-emerald-900 hover:bg-emerald-50 hover:shadow-md hover:scale-[1.01]"
                }`}
              >
                {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showAddForm ? "Cancel" : "Add New Question"}
              </button>
            </div>
          </div>

          {/* ============ Inline Add Form ============ */}
          {showAddForm && (
            <div className="space-y-4">
              <QuestionEntryForm
                mode="bank"
                onSaved={() => {
                  setShowAddForm(false);
                  loadQuestions();
                }}
              />
            </div>
          )}

          {/* ============ Filter Bar ============ */}
          <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/70 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
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
                className="w-full px-3 py-2.5 bg-white/60 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 focus:bg-white transition-all"
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
                className="w-full px-3 py-2.5 bg-white/60 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 focus:bg-white transition-all"
              >
                {streamFilters.map((st) => (
                  <option key={st} value={st}>
                    Stream: {st}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ============ Questions List ============ */}
          <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm overflow-hidden">
            {/* Header strip */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                ප්‍රශ්න ලැයිස්තුව{" "}
                <span className="text-emerald-700">
                  ({filteredQuestions.length})
                </span>
              </h2>
              <span className="text-xs text-gray-400">
                Total in Bank:{" "}
                <strong className="text-gray-600">{questions.length}</strong>
              </span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> Question Bank එක Load වෙමින්...
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                ප්‍රශ්න කිසිවක් හමු නොවීය. නව ප්‍රශ්නයක් එකතු කිරීමට &quot;Add New Question&quot; ඔබන්න.
              </div>
            ) : (
              <>
                {/* ===== Scrollable list with fade shadow ===== */}
                <div className="relative">
                  <div className="overflow-y-auto max-h-[65vh] p-4 sm:p-5 space-y-4">
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

                      return (
                        <div
                          key={q.id}
                          className="p-4 sm:p-5 border border-gray-200 rounded-xl bg-white/60 hover:bg-white hover:border-emerald-300 hover:shadow-md transition space-y-3"
                        >
                          <div className="flex justify-between items-start gap-3 sm:gap-4">
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-md">
                                  #{idx + 1}
                                </span>
                                {q.subject && (
                                  <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-xs font-bold rounded-md border border-teal-200">
                                    {q.subject}
                                  </span>
                                )}
                                {/* Stream badge — "Common" (emerald) if NULL, purple if Bio Science */}
                                <span
                                  className={`px-2 py-0.5 text-xs font-semibold rounded-md border ${
                                    q.stream
                                      ? "bg-purple-50 text-purple-700 border-purple-200"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  }`}
                                >
                                  {q.stream ?? "Common"}
                                </span>
                                {q.topic && (
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-md">
                                    {q.topic}
                                  </span>
                                )}
                              </div>

                              <p className="text-sm sm:text-base font-medium text-gray-900 leading-relaxed pt-1 wrap-break-word">
                                {q.question_text}
                              </p>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => setEditingQuestion(q)}
                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition text-xs font-bold flex items-center gap-1.5"
                                title="Edit Question"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                              <button
                                onClick={() => handleDelete(q.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                title="Delete Question"
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
                                className="max-h-48 rounded-lg border border-gray-200 object-contain bg-white"
                              />
                            </div>
                          )}

                          {/* Options */}
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

                          {q.explanation && (
                            <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900">
                              <span className="font-bold flex items-center gap-1 mb-0.5 text-amber-950">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Explanation / Solution:
                              </span>
                              <span className="wrap-break-word">{q.explanation}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Bottom fade — indicates more content below */}
                  <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-white/95 via-white/60 to-transparent" />
                </div>

                {/* Footer hint */}
                <div className="px-4 py-2.5 bg-emerald-50/60 border-t border-emerald-100/60 text-[11px] text-gray-500 text-center">
                  ප්‍රශ්න{" "}
                  <strong className="text-gray-700">
                    {filteredQuestions.length}
                  </strong>
                  ක් පෙන්වයි · scroll කරලා බලන්න
                </div>
              </>
            )}
          </div>
        </div>
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