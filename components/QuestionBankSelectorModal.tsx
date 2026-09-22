"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Check,
  Search,
  Loader2,
  AlertTriangle,
  Filter,
  GraduationCap,
  FileQuestion,
} from "lucide-react";
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

const streams = ["All", "Common", "Bio Science"];
const subjects = ["All", "Physics", "Chemistry", "Biology"];

function initialStreamFilter(quizStream: string | undefined): string {
  if (quizStream === undefined) return "Common";
  return quizStream;
}

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

  const [selectedSubject, setSelectedSubject] = useState(quizSubject || "All");
  const [selectedStream, setSelectedStream] = useState<string>(
    initialStreamFilter(quizStream),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened) {
      setSelectedIds(initialSelectedIds);
      setSelectedSubject(quizSubject || "All");
      setSelectedStream(initialStreamFilter(quizStream));
      setSearchQuery("");
      setSelectedTopic("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadBankQuestions = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("questions")
      .select(
        "id, subject, stream, topic, question_text, image_url, option_1, option_2, option_3, option_4, option_5, correct_option, explanation",
      )
      .order("created_at", { ascending: false });

    if (selectedSubject && selectedSubject !== "All") {
      query = query.eq("subject", selectedSubject);
    }

    if (selectedStream === "Common") {
      query = query.is("stream", null);
    } else if (selectedStream && selectedStream !== "All") {
      query = query.eq("stream", selectedStream);
    }

    const { data, error } = await query;
    if (!error && data) {
      setQuestions(data as BankQuestion[]);
    }
    setLoading(false);
  }, [selectedSubject, selectedStream]);

  useEffect(() => {
    if (!isOpen) return;

    const loadTimer = window.setTimeout(() => {
      void loadBankQuestions();
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [isOpen, loadBankQuestions]);

  if (!isOpen) return null;

  const filteredQuestions = questions.filter((q) => {
    if (searchQuery.trim()) {
      const s = searchQuery.toLowerCase();
      const matchText = q.question_text.toLowerCase().includes(s);
      const matchTopic = q.topic?.toLowerCase().includes(s);
      if (!matchText && !matchTopic) return false;
    }
    if (selectedTopic.trim()) {
      if (!q.topic?.toLowerCase().includes(selectedTopic.toLowerCase()))
        return false;
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= maxLimit) {
        alert(
          `උපරිම ප්‍රශ්න ${maxLimit}ක් පමණක් තෝරාගත හැක (Maximum ${maxLimit} questions allowed per quiz).`,
        );
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
  const remaining = maxLimit - selectedIds.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-emerald-950/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/70 overflow-hidden my-4 sm:my-6 flex flex-col max-h-[94vh]">

        {/* ═══════════════ HEADER BANNER ═══════════════ */}
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shrink-0">
          {/* dot grid */}
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          {/* glows */}
          <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 bg-emerald-300/30 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-12 w-48 h-48 bg-teal-300/25 rounded-full blur-3xl" />

          <div className="relative flex items-start justify-between gap-3 px-5 sm:px-6 py-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Logo */}
              <div className="shrink-0 hidden sm:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-300/30 blur-lg rounded-xl" />
                  <div className="relative w-11 h-11 bg-white/15 backdrop-blur-md rounded-xl border border-white/25 shadow-lg flex items-center justify-center">
                    <FileQuestion className="w-5 h-5 text-amber-300" />
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-extrabold flex items-center gap-2 leading-tight">
                  <GraduationCap className="w-5 h-5 text-amber-300 shrink-0 sm:hidden" />
                  <span className="break-words">
                    Question Bank එකෙන් ප්‍රශ්න තෝරන්න
                  </span>
                </h3>
                <p className="text-emerald-50/90 text-[11px] sm:text-xs mt-1">
                  Quiz එකට අදාළ ප්‍රශ්න Question Bank එකෙන් Checkbox මඟින් තෝරන්න.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition shrink-0"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══════════════ COUNTER & LIMIT BANNER ═══════════════ */}
        <div
          className={`px-4 sm:px-6 py-3 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 ${
            isAtLimit
              ? "bg-amber-50 border-amber-200"
              : "bg-emerald-50/70 border-emerald-100"
          }`}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold tabular-nums shadow-sm ${
                isAtLimit
                  ? "bg-amber-600 text-white"
                  : "bg-emerald-600 text-white"
              }`}
            >
              තෝරාගත් ප්‍රශ්න: {selectedIds.length} / {maxLimit}
            </span>
            <span className="text-xs text-gray-600 font-medium">
              {isAtLimit ? (
                <span className="text-amber-800 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> උපරිම ප්‍රශ්න සීමාවට
                  ({maxLimit}) ළඟා වී ඇත.
                </span>
              ) : (
                `තව ${remaining}ක් තෝරාගත හැක.`
              )}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSelectAllFiltered}
              disabled={isAtLimit || filteredQuestions.length === 0}
              className="text-xs font-semibold px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-300 text-emerald-700 disabled:opacity-50 transition"
            >
              Select All Shown (
              {Math.min(filteredQuestions.length, remaining)})
            </button>
            <button
              onClick={handleClearSelection}
              disabled={selectedIds.length === 0}
              className="text-xs font-semibold px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg hover:bg-red-50 hover:border-red-300 text-red-600 disabled:opacity-50 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* ═══════════════ FILTER CONTROLS ═══════════════ */}
        <div className="px-4 sm:px-6 py-3 bg-emerald-50/40 border-b border-emerald-100/60 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Filter Questions
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search question text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition"
              />
            </div>

            {/* Subject */}
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 cursor-pointer transition"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  Subject: {s}
                </option>
              ))}
            </select>

            {/* Stream */}
            <select
              value={selectedStream}
              onChange={(e) => setSelectedStream(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 cursor-pointer transition"
            >
              {streams.map((st) => (
                <option key={st} value={st}>
                  Stream: {st}
                </option>
              ))}
            </select>

            {/* Topic */}
            <input
              type="text"
              placeholder="Filter by topic..."
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 transition"
            />
          </div>

          {/* Hint about common streams */}
          {selectedStream === "Common" && (
            <p className="text-[11px] text-emerald-700 font-semibold mt-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Physics සහ Chemistry ප්‍රශ්න — හැම science stream එකකටම පොදුයි.
            </p>
          )}
        </div>

        {/* ═══════════════ QUESTION LIST (scrollable) ═══════════════ */}
        <div className="relative flex-1 min-h-0">
          <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-3">
            {loading ? (
              <div className="p-12 text-center text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />{" "}
                Question Bank එකෙන් ප්‍රශ්න ලෝඩ් වෙමින්...
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
                        ? "bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500/30 shadow-sm"
                        : disabledBecauseLimit
                          ? "bg-gray-100/60 border-gray-200 opacity-60 cursor-not-allowed"
                          : "bg-white border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabledBecauseLimit}
                      onChange={() => toggleSelect(q.id)}
                      className="mt-1 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                    />

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-500">
                          #{idx + 1}
                        </span>
                        {q.subject && (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">
                            {q.subject}
                          </span>
                        )}
                        {/* Stream badge — "Common" for null stream */}
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            q.stream
                              ? "bg-purple-100 text-purple-800"
                              : "bg-teal-100 text-teal-800"
                          }`}
                        >
                          {q.stream ?? "Common"}
                        </span>
                        {q.topic && (
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-[10px] font-semibold rounded">
                            {q.topic}
                          </span>
                        )}
                        {disabledBecauseLimit && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                            Limit reached ({maxLimit}/{maxLimit})
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-gray-900 leading-snug break-words">
                        {q.question_text}
                      </p>

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

          {/* Bottom fade — indicates more content below */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/95 via-white/60 to-transparent" />
        </div>

        {/* ═══════════════ FOOTER ═══════════════ */}
        <div className="px-4 sm:px-6 py-4 border-t border-emerald-100 bg-emerald-50/60 backdrop-blur-sm flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 shrink-0">
          <span className="text-xs text-gray-600 font-medium text-center sm:text-left">
            තෝරාගත් ප්‍රශ්න ගණන:{" "}
            <strong className="text-emerald-700 tabular-nums">
              {selectedIds.length}
            </strong>{" "}
            / {maxLimit}
          </span>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
            >
              <Check className="w-4 h-4" />
              <span className="truncate">
                තෝරාගත් ප්‍රශ්න ({selectedIds.length}) එකතු කරන්න
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}