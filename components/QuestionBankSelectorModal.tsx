"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Check, Search, Filter, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type BankQuestion = {
  id: string;
  subject?: string | null;
  stream?: string | null;
  topic: string | null;
  question_text: string;
  image_url: string | null;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string | null;
  correct_option: number;
  explanation: string | null;
};

interface QuestionBankSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedIds: string[];
  onConfirmSelection: (selectedIds: string[]) => void;
  quizSubject?: string;
  quizStream?: string;
  maxLimit?: number;
}

const streams = ["All", "Bio Science", "Physical Science", "Maths", "Commerce", "Arts", "Technology"];
const subjects = ["All", "Physics", "Chemistry", "Biology"];

export default function QuestionBankSelectorModal({
  isOpen,
  onClose,
  initialSelectedIds,
  onConfirmSelection,
  quizSubject,
  quizStream,
  maxLimit = 20,
}: QuestionBankSelectorModalProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  // Filters
  const [selectedSubject, setSelectedSubject] = useState(quizSubject || "All");
  const [selectedStream, setSelectedStream] = useState(quizStream || "All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  const loadBankQuestions = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("questions")
      .select("id, subject, stream, topic, question_text, image_url, option_1, option_2, option_3, option_4, option_5, correct_option, explanation")
      .order("created_at", { ascending: false });

    if (selectedSubject && selectedSubject !== "All") {
      query = query.eq("subject", selectedSubject);
    }
    if (selectedStream && selectedStream !== "All") {
      query = query.eq("stream", selectedStream);
    }

    const { data, error } = await query;
    if (!error && data) {
      setQuestions(data);
    }
    setLoading(false);
  }, [selectedSubject, selectedStream]);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelectedIds);
      if (quizSubject) setSelectedSubject(quizSubject);
      if (quizStream) setSelectedStream(quizStream);
    }
  }, [isOpen, initialSelectedIds, quizSubject, quizStream]);

  useEffect(() => {
    if (isOpen) {
      loadBankQuestions();
    }
  }, [isOpen, loadBankQuestions]);

  if (!isOpen) return null;

  // Client-side search and topic filtering
  const filteredQuestions = questions.filter((q) => {
    if (searchQuery.trim()) {
      const matchText = q.question_text.toLowerCase().includes(searchQuery.toLowerCase());
      const matchTopic = q.topic?.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchText && !matchTopic) return false;
    }
    if (selectedTopic.trim()) {
      if (!q.topic?.toLowerCase().includes(selectedTopic.toLowerCase())) return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= maxLimit) {
        alert(`උපරිම ප්‍රශ්න ${maxLimit}ක් පමණක් තෝරාගත හැක (Maximum ${maxLimit} questions allowed per quiz).`);
        return;
      }
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAllFiltered = () => {
    const newSelected = new Set(selectedIds);
    for (const q of filteredQuestions) {
      if (newSelected.size >= maxLimit) break;
      newSelected.add(q.id);
    }
    setSelectedIds(Array.from(newSelected));
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  const handleConfirm = () => {
    if (selectedIds.length > maxLimit) {
      alert(`කරුණාකර ප්‍රශ්න ${maxLimit}කට හෝ ඊට අඩුවෙන් තෝරන්න.`);
      return;
    }
    onConfirmSelection(selectedIds);
    onClose();
  };

  const isAtLimit = selectedIds.length >= maxLimit;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden my-6 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-slate-900 text-white shrink-0">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              Question Bank එකෙන් ප්‍රශ්න තෝරන්න
            </h3>
            <p className="text-xs text-slate-300">
              Quiz එකට අදාළ ප්‍රශ්න Question Bank එකෙන් Checkbox මඟින් තෝරන්න.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Counter & Limit Banner */}
        <div className={`px-6 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 ${
          isAtLimit ? "bg-amber-50 border-amber-200" : "bg-blue-50 border-blue-100"
        }`}>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${
              isAtLimit ? "bg-amber-600 text-white" : "bg-blue-600 text-white"
            }`}>
              තෝරාගත් ප්‍රශ්න: {selectedIds.length} / {maxLimit}
            </span>
            <span className="text-xs text-gray-600 font-medium">
              {isAtLimit ? (
                <span className="text-amber-800 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> උපරිම ප්‍රශ්න සීමාවට ({maxLimit}) ළඟා වී ඇත.
                </span>
              ) : (
                `තව ${maxLimit - selectedIds.length}ක් තෝරාගත හැක.`
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllFiltered}
              disabled={isAtLimit || filteredQuestions.length === 0}
              className="text-xs font-semibold px-2.5 py-1 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50"
            >
              Select All Shown ({Math.min(filteredQuestions.length, maxLimit - selectedIds.length)})
            </button>
            <button
              onClick={handleClearSelection}
              disabled={selectedIds.length === 0}
              className="text-xs font-semibold px-2.5 py-1 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-red-600 disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 grid grid-cols-1 sm:grid-cols-4 gap-3 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search question text..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
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
              value={selectedStream}
              onChange={(e) => setSelectedStream(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
            >
              {streams.map((st) => (
                <option key={st} value={st}>
                  Stream: {st}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="text"
              placeholder="Filter by Topic (e.g. තාපය)..."
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Question List */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {loading ? (
            <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" /> Question Bank එකෙන් ප්‍රශ්න ලෝඩ් වෙමින්...
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              මෙම Filter වලට ගැලපෙන ප්‍රශ්න Question Bank එකේ නැත.
            </div>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isSelected = selectedIds.includes(q.id);
              const disabledBecauseLimit = !isSelected && isAtLimit;

              return (
                <div
                  key={q.id}
                  onClick={() => !disabledBecauseLimit && toggleSelect(q.id)}
                  className={`p-4 rounded-xl border transition cursor-pointer flex items-start gap-4 ${
                    isSelected
                      ? "bg-blue-50/70 border-blue-500 ring-1 ring-blue-500/30"
                      : disabledBecauseLimit
                      ? "bg-gray-100/60 border-gray-200 opacity-60 cursor-not-allowed"
                      : "bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={disabledBecauseLimit}
                    onChange={() => toggleSelect(q.id)}
                    className="mt-1 w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed"
                  />

                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-gray-500">#{idx + 1}</span>
                      {q.subject && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded">
                          {q.subject}
                        </span>
                      )}
                      {q.stream && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-bold rounded">
                          {q.stream}
                        </span>
                      )}
                      {q.topic && (
                        <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px] font-semibold rounded">
                          {q.topic}
                        </span>
                      )}
                      {disabledBecauseLimit && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                          Limit reached (20/20)
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                      {q.question_text}
                    </p>

                    {/* Compact options view */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 text-xs">
                      {[q.option_1, q.option_2, q.option_3, q.option_4, q.option_5]
                        .filter((o): o is string => Boolean(o && o.trim()))
                        .map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className={`px-2 py-1 rounded text-[11px] truncate ${
                              q.correct_option === oIdx
                                ? "bg-emerald-100 text-emerald-900 font-bold"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            ({oIdx + 1}) {opt} {q.correct_option === oIdx && "✓"}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
          <span className="text-xs text-gray-500 font-medium">
            තෝරාගත් ප්‍රශ්න ගණන: <strong className="text-gray-900">{selectedIds.length}</strong> / {maxLimit}
          </span>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-sm"
            >
              <Check className="w-4 h-4" /> තෝරාගත් ප්‍රශ්න ({selectedIds.length}) Quiz එකට එකතු කරන්න
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
