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
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import QuestionEntryForm from "@/components/QuestionEntryForm";
import { QuestionEditModal, type EditableQuestion } from "@/components/QuestionEditModal";

const subjects = ["All", "Physics", "Chemistry", "Biology"];
const streams = ["All", "Bio Science", "Physical Science", "Maths", "Commerce", "Arts", "Technology"];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  // Filters
  const [filterSubject, setFilterSubject] = useState("All");
  const [filterStream, setFilterStream] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Editing state
  const [editingQuestion, setEditingQuestion] = useState<EditableQuestion | null>(null);

  const loadQuestions = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("questions")
      .select(
        "id, quiz_id, subject, stream, topic, question_text, image_url, option_1, option_2, option_3, option_4, option_5, correct_option, explanation"
      )
      .order("created_at", { ascending: false });

    if (filterSubject !== "All") {
      query = query.eq("subject", filterSubject);
    }
    if (filterStream !== "All") {
      query = query.eq("stream", filterStream);
    }

    const { data, error } = await query;
    if (!error && data) {
      setQuestions(data);
    }
    setLoading(false);
  }, [filterSubject, filterStream]);

  useEffect(() => {
    // Data fetching is intentionally initiated when the filter dependencies change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQuestions();
  }, [loadQuestions]);

  const handleDelete = async (id: string) => {
    if (!confirm("මෙම ප්‍රශ්නය Question Bank එකෙන් සම්පූර්ණයෙන්ම ඉවත් කිරීමට තහවුරු කරන්න?")) return;

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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 flex items-center gap-2.5">
            <FileQuestion className="w-8 h-8 text-blue-600" />
            Central Question Bank
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            සියලුම MCQs මෙහි ගබඩා කර ඇත. Quiz සාදන විට මෙම ප්‍රශ්න බැංකුවෙන් උපරිම 20ක් තෝරාගත හැක.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm((prev) => !prev)}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-sm flex items-center gap-2 shrink-0"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? "Cancel" : "Add New Question to Bank"}
        </button>
      </div>

      {/* Inline Add Form */}
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

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
          <input
            type="text"
            placeholder="Search by text or topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all"
          />
        </div>

        <div>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all"
          >
            {subjects.map((s) => (
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
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white focus:border-blue-500 transition-all"
          >
            {streams.map((st) => (
              <option key={st} value={st}>
                Stream: {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Questions List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            ප්‍රශ්න ලැයිස්තුව ({filteredQuestions.length})
          </h2>
          <span className="text-xs text-gray-400">Total in Bank: {questions.length}</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Question Bank එක Load වෙමින්...
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            ප්‍රශ්න කිසිවක් හමු නොවීය. නව ප්‍රශ්නයක් එකතු කිරීමට &quot;Add New Question to Bank&quot; ඔබන්න.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQuestions.map((q, idx) => {
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
                  className="p-5 border border-gray-200 rounded-xl bg-gray-50/50 hover:bg-white hover:border-blue-300 transition space-y-3"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-md">
                          #{idx + 1}
                        </span>
                        {q.subject && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md border border-indigo-200">
                            {q.subject}
                          </span>
                        )}
                        {q.stream && (
                          <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-md border border-purple-200">
                            {q.stream}
                          </span>
                        )}
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

                  {q.explanation && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded-lg text-xs text-amber-900">
                      <span className="font-bold flex items-center gap-1 mb-0.5 text-amber-950">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Explanation / Solution:
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