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
const subjects = ["All", "Physics", "Chemistry", "Biology", "ICT"];

export default function QuestionBankSelectorModal({
  isOpen,
  onClose,
  initialSelectedIds,
  onConfirmSelection,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  quizSubject: _quizSubject,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  quizStream: _quizStream,
  maxLimit = 20,
}: QuestionBankSelectorModalProps) {
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);

  // ✅ Default to "All" so questions ALWAYS show up
  const [selectedSubject, setSelectedSubject] = useState<string>("All");
  const [selectedStream, setSelectedStream] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;

    if (justOpened) {
      setSelectedIds(initialSelectedIds);
      setSelectedSubject("All");
      setSelectedStream("All");
      setSearchQuery("");
      setSelectedTopic("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const loadBankQuestions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      // ✅ select("*") — column issues නැහැ
      let query = supabase
        .from("questions")
        .select("*")
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

      if (error) {
        console.error("[Bank] Query error:", error);
        setLoadError("Query error: " + error.message);
        setQuestions([]);
      } else {
        console.log("[Bank] Loaded:", data?.length ?? 0, "questions");
        setQuestions((data ?? []) as BankQuestion[]);
      }
    } catch (err) {
      console.error("[Bank] Unexpected error:", err);
      setLoadError(
        "Unexpected error: " + (err instanceof Error ? err.message : String(err)),
      );
      setQuestions([]);
    } finally {
      setLoading(false);
    }
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
      const matchText = q.question_text?.toLowerCase().includes(s);
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
    <div className="fixed inset-0 z-50 bg-emerald-950/60 dark:bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-4xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/70 dark:border-slate-700 overflow-hidden flex flex-col h-[90vh] max-h-[90vh]">

        {/* ═══════════════ HEADER BANNER ═══════════════ */}
        <div className="relative overflow-hidden bg-linear-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shrink-0">
          <div
            className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="pointer-events-none absolute -top-20 -right-16 w-56 h-56 bg-emerald-300/30 rounded-full blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-12 w-48 h-48 bg-teal-300/25 rounded-full blur-3xl" />

          <div className="relative flex items-start justify-between gap-3 px-5 sm:px-6 py-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
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
                  <span className="wrap-break-word">
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
              ? "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800"
              : "bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-800"
          }`}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold tabular-nums shadow-sm ${
                isAtLimit ? "bg-amber-600 text-white" : "bg-emerald-600 text-white"
              }`}
            >
              තෝරාගත්: {selectedIds.length} / {maxLimit}
            </span>
            <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
              {isAtLimit ? (
                <span className="text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> උපරිම සීමාවට ({maxLimit}) ළඟා වී ඇත.
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
              className="text-xs font-semibold px-2.5 py-1.5 bg-white dark:bg-slate-900/60 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-700 text-emerald-700 dark:text-emerald-300 disabled:opacity-50 transition"
            >
              Select All Shown ({Math.min(filteredQuestions.length, remaining)})
            </button>
            <button
              onClick={handleClearSelection}
              disabled={selectedIds.length === 0}
              className="text-xs font-semibold px-2.5 py-1.5 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 hover:border-red-300 dark:hover:border-red-800 text-red-600 dark:text-red-300 disabled:opacity-50 transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* ═══════════════ FILTER CONTROLS ═══════════════ */}
        <div className="px-4 sm:px-6 py-3 bg-emerald-50/40 dark:bg-emerald-950/20 border-b border-emerald-100/60 dark:border-emerald-900/50 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Filter className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
              Filter Questions
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-normal normal-case">
              (default: All — සියලු ප්‍රශ්න පෙන්වයි)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search question text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl text-xs text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-400 dark:focus:border-emerald-500 transition"
              />
            </div>

            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-400 dark:focus:border-emerald-500 cursor-pointer transition"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  Subject: {s}
                </option>
              ))}
            </select>

            <select
              value={selectedStream}
              onChange={(e) => setSelectedStream(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-400 dark:focus:border-emerald-500 cursor-pointer transition"
            >
              {streams.map((st) => (
                <option key={st} value={st}>
                  Stream: {st}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Filter by topic..."
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-emerald-400 dark:focus:border-emerald-500 transition"
            />
          </div>

          {selectedStream === "Common" && (
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold mt-2 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              Physics සහ Chemistry ප්‍රශ්න — හැම science stream එකකටම පොදුයි.
            </p>
          )}
        </div>

        {/* ═══════════════ QUESTION LIST (scrollable) ═══════════════ */}
        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 space-y-3">
            {loading ? (
              <div className="p-12 text-center text-gray-500 dark:text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400" />
                Question Bank එකෙන් ප්‍රශ්න ලෝඩ් වෙමින්...
              </div>
            ) : loadError ? (
              <div className="p-8 text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-red-500 dark:text-red-400 mx-auto" />
                <p className="text-red-600 dark:text-red-300 font-medium text-sm">{loadError}</p>
                <button
                  onClick={() => loadBankQuestions()}
                  className="px-4 py-2 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-bold rounded-xl"
                >
                  නැවත උත්සාහ කරන්න
                </button>
              </div>
            ) : filteredQuestions.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <FileQuestion className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto" />
                <p className="text-gray-500 dark:text-gray-400 font-semibold text-sm">
                  ප්‍රශ්න කිසිවක් හමු නොවුණි
                </p>
                {questions.length === 0 ? (
                  <>
                    <p className="text-gray-400 dark:text-gray-500 text-xs">
                      Supabase එකේ ප්‍රශ්න නැහැ.
                    </p>
                    <div className="inline-block text-left bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-200 max-w-md">
                      <p className="font-bold mb-1">Debug Info:</p>
                      <p>
                        DB rows: <strong>{questions.length}</strong>
                      </p>
                      <p>
                        Filters: subject={selectedSubject}, stream={selectedStream}
                      </p>
                      <p className="mt-2 text-[10px] text-amber-700 dark:text-amber-400">
                        → F12 Console එකේ [Bank] logs බලන්න
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 text-xs">
                    Filter වලට ගැලපෙන ප්‍රශ්න නැත (DB එකේ {questions.length}
                    ක් තියෙනවා).
                  </p>
                )}
                {(selectedSubject !== "All" ||
                  selectedStream !== "All" ||
                  selectedTopic ||
                  searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedSubject("All");
                      setSelectedStream("All");
                      setSelectedTopic("");
                      setSearchQuery("");
                    }}
                    className="mt-2 px-4 py-2 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-bold rounded-xl"
                  >
                    සියලු Filters Clear කරන්න
                  </button>
                )}
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
                        ? "bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-600 ring-1 ring-emerald-500/30 dark:ring-emerald-400/30 shadow-sm"
                        : disabledBecauseLimit
                          ? "bg-gray-100/60 dark:bg-slate-900/40 border-gray-200 dark:border-slate-700 opacity-60 cursor-not-allowed"
                          : "bg-white dark:bg-slate-900/40 border-gray-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={disabledBecauseLimit}
                      onChange={() => toggleSelect(q.id)}
                      className="mt-1 w-4 h-4 text-emerald-600 dark:text-emerald-400 rounded border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-emerald-500 dark:focus:ring-emerald-400 cursor-pointer disabled:cursor-not-allowed"
                    />

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                          #{idx + 1}
                        </span>
                        {q.subject && (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded">
                            {q.subject}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                            q.stream
                              ? "bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300"
                              : "bg-teal-100 dark:bg-teal-950/50 text-teal-800 dark:text-teal-300"
                          }`}
                        >
                          {q.stream ?? "Common"}
                        </span>
                        {q.topic && (
                          <span className="px-2 py-0.5 bg-gray-200 dark:bg-slate-900/60 text-gray-700 dark:text-gray-300 text-[10px] font-semibold rounded">
                            {q.topic}
                          </span>
                        )}
                        {disabledBecauseLimit && (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded">
                            Limit reached ({maxLimit}/{maxLimit})
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug wrap-break-word">
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
                                  ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 font-bold"
                                  : "bg-gray-100 dark:bg-slate-900/60 text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              ({oIdx + 1}) {opt}{" "}
                              {q.correct_option === oIdx && "✓"}
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom fade */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-linear-to-t from-white/95 dark:from-slate-800/95 via-white/60 dark:via-slate-800/60 to-transparent" />
        </div>

        {/* ═══════════════ FOOTER ═══════════════ */}
        <div className="px-4 sm:px-6 py-4 border-t border-emerald-100 dark:border-slate-700 bg-emerald-50/60 dark:bg-emerald-950/30 backdrop-blur-sm flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-3 shrink-0">
          <span className="text-xs text-gray-600 dark:text-gray-400 font-medium text-center sm:text-left">
            තෝරාගත් ගණන:{" "}
            <strong className="text-emerald-700 dark:text-emerald-300 tabular-nums">
              {selectedIds.length}
            </strong>{" "}
            / {maxLimit}
            {questions.length > 0 && (
              <span className="text-gray-400 dark:text-gray-500 ml-2">
                · මුළු Bank: {questions.length}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 bg-white dark:bg-slate-900/60 border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-900 text-gray-700 dark:text-gray-200 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-5 py-2 bg-emerald-600 dark:bg-emerald-500 hover:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md"
            >
              <Check className="w-4 h-4" />
              <span className="truncate">
                තෝරාගත් ({selectedIds.length}) එකතු කරන්න
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}