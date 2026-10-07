"use client";

import React, { useState } from "react";
import {
  X,
  Save,
  Loader2,
  Sparkles,
  CheckCircle2,
  Edit3,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import ImageUploadField from "@/components/ImageUploadField";

export type EditableQuestion = {
  id: string;
  quiz_id?: string | null;
  subject?: string | null;
  stream?: string | null;
  topic: string | null;
  correct_option: number;
  image_url: string | null;

  // ---- Sinhala (base columns — existing) ----
  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string | null;
  explanation: string | null;

  // ---- English (new, required) ----
  question_text_en?: string | null;
  option_1_en?: string | null;
  option_2_en?: string | null;
  option_3_en?: string | null;
  option_4_en?: string | null;
  option_5_en?: string | null;
  explanation_en?: string | null;

  // ---- Tamil (new, optional) ----
  question_text_ta?: string | null;
  option_1_ta?: string | null;
  option_2_ta?: string | null;
  option_3_ta?: string | null;
  option_4_ta?: string | null;
  option_5_ta?: string | null;
  explanation_ta?: string | null;

  // ✱ Shared explanation diagram (language-agnostic)
  explanation_image_url?: string | null;
};

interface QuestionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: EditableQuestion | null;
  onSaved: () => void;
}

const subjects = ["Physics", "Chemistry", "Biology", "ICT"];
const BIO_STREAM = "Bio Science";
const MATHS_STREAM = "Maths";

function derivedStreamForSubject(subject: string): string | null {
  if (subject === "Biology") return BIO_STREAM;
  if (subject === "ICT") return MATHS_STREAM;
  return null;
}

type Language = "si" | "en" | "ta";

interface LanguageContent {
  questionText: string;
  options: [string, string, string, string, string];
  explanation: string;
}

const getInitialFormState = (question: EditableQuestion | null) => ({
  subject: question?.subject ?? "Physics",
  topic: question?.topic ?? "",
  imageUrl: question?.image_url ?? "",
  explanationImageUrl: question?.explanation_image_url ?? "",
  correctAnswer: question?.correct_option ?? 0,

  si: {
    questionText: question?.question_text ?? "",
    options: [
      question?.option_1 ?? "",
      question?.option_2 ?? "",
      question?.option_3 ?? "",
      question?.option_4 ?? "",
      question?.option_5 ?? "",
    ] as LanguageContent["options"],
    explanation: question?.explanation ?? "",
  },
  en: {
    questionText: question?.question_text_en ?? "",
    options: [
      question?.option_1_en ?? "",
      question?.option_2_en ?? "",
      question?.option_3_en ?? "",
      question?.option_4_en ?? "",
      question?.option_5_en ?? "",
    ] as LanguageContent["options"],
    explanation: question?.explanation_en ?? "",
  },
  ta: {
    questionText: question?.question_text_ta ?? "",
    options: [
      question?.option_1_ta ?? "",
      question?.option_2_ta ?? "",
      question?.option_3_ta ?? "",
      question?.option_4_ta ?? "",
      question?.option_5_ta ?? "",
    ] as LanguageContent["options"],
    explanation: question?.explanation_ta ?? "",
  },
});

function QuestionEditorForm({
  question,
  onClose,
  onSaved,
}: {
  question: EditableQuestion;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialState = getInitialFormState(question);

  const [subject, setSubject] = useState(initialState.subject);
  const [topic, setTopic] = useState(initialState.topic);
  const [imageUrl, setImageUrl] = useState(initialState.imageUrl);
  const [explanationImageUrl, setExplanationImageUrl] = useState(
    initialState.explanationImageUrl,
  );
  const [correctAnswer, setCorrectAnswer] = useState(initialState.correctAnswer);

  const [si, setSi] = useState<LanguageContent>(initialState.si);
  const [en, setEn] = useState<LanguageContent>(initialState.en);
  const [ta, setTa] = useState<LanguageContent>(initialState.ta);

  const [activeLang, setActiveLang] = useState<Language>("si");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const derivedStream = derivedStreamForSubject(subject);

  const getContent = (lang: Language): LanguageContent =>
    lang === "si" ? si : lang === "en" ? en : ta;

  const setContent = (lang: Language, patch: Partial<LanguageContent>) => {
    const setter = lang === "si" ? setSi : lang === "en" ? setEn : setTa;
    setter((prev) => ({ ...prev, ...patch }));
  };

  const hasOption5 = si.options[4].trim() !== "";

  const handleOptionChange = (lang: Language, index: number, value: string) => {
    const content = getContent(lang);
    const updated = [...content.options] as LanguageContent["options"];
    updated[index] = value;

    if (index === 4 && value.trim() === "" && correctAnswer === 4) {
      setCorrectAnswer(0);
    }
    setContent(lang, { options: updated });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!si.questionText.trim()) {
      setError("සිංහල ප්‍රශ්නය අවශ්‍යයි.");
      setActiveLang("si");
      return;
    }
    for (let i = 0; i < 4; i++) {
      if (!si.options[i].trim()) {
        setError(`සිංහල විකල්පය ${i + 1} අවශ්‍යයි.`);
        setActiveLang("si");
        return;
      }
    }

    if (!en.questionText.trim()) {
      setError("English question text is required.");
      setActiveLang("en");
      return;
    }
    for (let i = 0; i < 4; i++) {
      if (!en.options[i].trim()) {
        setError(`English option ${i + 1} is required.`);
        setActiveLang("en");
        return;
      }
    }

    const taStarted = ta.questionText.trim() || ta.options.some((o) => o.trim());
    if (taStarted) {
      if (!ta.questionText.trim()) {
        setError("Tamil question text is required if Tamil option is filled.");
        setActiveLang("ta");
        return;
      }
      for (let i = 0; i < 4; i++) {
        if (!ta.options[i].trim()) {
          setError(`Tamil option ${i + 1} is required.`);
          setActiveLang("ta");
          return;
        }
      }
    }

    if (correctAnswer === 4 && !hasOption5) {
      setError("විකල්පය 5 හිස්ව ඇති බැවින් එය නිවැරදි පිළිතුර ලෙස තෝරාගත නොහැක.");
      return;
    }

    setIsSubmitting(true);

    const { error: updateError } = await supabase
      .from("questions")
      .update({
        subject,
        stream: derivedStream,
        topic: topic.trim() || null,
        image_url: imageUrl.trim() || null,
        explanation_image_url: explanationImageUrl.trim() || null,
        correct_option: correctAnswer,

        question_text: si.questionText.trim(),
        option_1: si.options[0].trim(),
        option_2: si.options[1].trim(),
        option_3: si.options[2].trim(),
        option_4: si.options[3].trim(),
        option_5: si.options[4].trim() || null,
        explanation: si.explanation.trim() || null,

        question_text_en: en.questionText.trim(),
        option_1_en: en.options[0].trim(),
        option_2_en: en.options[1].trim(),
        option_3_en: en.options[2].trim(),
        option_4_en: en.options[3].trim(),
        option_5_en: en.options[4].trim() || null,
        explanation_en: en.explanation.trim() || null,

        question_text_ta: taStarted ? ta.questionText.trim() : null,
        option_1_ta: taStarted ? ta.options[0].trim() : null,
        option_2_ta: taStarted ? ta.options[1].trim() : null,
        option_3_ta: taStarted ? ta.options[2].trim() : null,
        option_4_ta: taStarted ? ta.options[3].trim() : null,
        option_5_ta: taStarted ? ta.options[4].trim() || null : null,
        explanation_ta: taStarted ? ta.explanation.trim() || null : null,
      })
      .eq("id", question.id);

    setIsSubmitting(false);

    if (updateError) {
      setError("සංස්කරණය අසාර්ථකයි: " + updateError.message);
      return;
    }

    onSaved();
    onClose();
  };

  const tabs: { key: Language; label: string; required: boolean }[] = [
    { key: "si", label: "සිංහල", required: true },
    { key: "en", label: "English", required: true },
    { key: "ta", label: "தமிழ்", required: false },
  ];

  const current = getContent(activeLang);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white/95 backdrop-blur-md rounded-t-2xl sm:rounded-2xl shadow-2xl border border-white/70 overflow-hidden max-h-[94vh] sm:my-8 flex flex-col">

        {/* ═══════════════ HEADER BANNER — DARK THEME ═══════════════ */}
        <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shrink-0 border-b border-slate-700/50">
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
          <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/5" />

          <div className="relative flex items-start justify-between gap-3 px-4 sm:px-6 py-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Icon — hidden on mobile */}
              <div className="shrink-0 hidden sm:block">
                <div className="relative">
                  <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
                  <div className="relative w-11 h-11 bg-teal-500/15 backdrop-blur-md rounded-xl border border-teal-400/30 flex items-center justify-center">
                    <Edit3 className="w-5 h-5 text-teal-300" />
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1.5 sm:mb-2">
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
                    <GraduationCap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    AISSA
                  </span>
                  <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-amber-500/20 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200">
                    <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    Edit
                  </span>
                </div>

                <h3 className="text-sm sm:text-lg font-extrabold leading-snug sm:leading-tight flex items-center gap-1.5 sm:gap-2">
                  <Edit3 className="w-4 h-4 sm:hidden text-teal-300 shrink-0" />
                  <span className="wrap-break-word">
                    ප්‍රශ්නය සංස්කරණය කරන්න
                  </span>
                </h3>
                <p className="text-slate-300 text-[10px] sm:text-xs mt-1 leading-snug hidden sm:block">
                  භාෂා 3කින්ම ප්‍රශ්නය සංස්කරණය කරන්න · සිංහල සහ English අනිවාර්යයි
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ═══════════════ FORM ═══════════════ */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 min-h-0"
        >
          {/* Scrollable body */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-5">
            {error && (
              <div className="p-2.5 sm:p-3 bg-red-50 border border-red-200 text-red-700 text-[11px] sm:text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* Metadata row — Subject + auto-derived Stream */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700 uppercase mb-1.5 sm:mb-2">
                  විෂය (Subject)
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-2.5 sm:p-3 bg-white/60 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                >
                  {subjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700 uppercase mb-1.5 sm:mb-2">
                  Stream (Auto)
                </label>
                <div
                  className={`w-full p-2.5 sm:p-3 rounded-xl font-medium text-xs sm:text-sm border ${
                    derivedStream === null
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                      : derivedStream === BIO_STREAM
                        ? "bg-purple-50 border-purple-200 text-purple-800"
                        : "bg-cyan-50 border-cyan-200 text-cyan-800"
                  }`}
                >
                  {derivedStream === null
                    ? "Common — All Science Streams"
                    : derivedStream === BIO_STREAM
                      ? "Bio Science only"
                      : "Maths stream only"}
                </div>
                <p className="text-[10px] sm:text-[11px] text-gray-500 mt-1 leading-snug hidden sm:block">
                  {derivedStream === null
                    ? "* Physics සහ Chemistry හැම science stream එකකටම පොදුයි."
                    : derivedStream === BIO_STREAM
                      ? "* Biology Bio Science stream එකට විතරයි."
                      : "* ICT Maths stream එකට විතරයි."}
                </p>
              </div>
            </div>

            {/* Topic */}
            <div>
              <label className="block text-[10px] sm:text-xs font-bold text-gray-700 uppercase mb-1.5 sm:mb-2">
                පාඩම / මාතෘකාව (Topic - Optional)
              </label>
              <input
                type="text"
                placeholder="උදා: තාපය (Thermal Physics)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isSubmitting}
                className="w-full p-2.5 sm:p-3 bg-white/60 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
              />
            </div>

            {/* Question Diagram */}
            <ImageUploadField
              value={imageUrl}
              onChange={setImageUrl}
              disabled={isSubmitting}
            />

            {/* ═══ LANGUAGE TABS — MOBILE-TIGHTENED ═══ */}
            <div>
              <div className="flex items-center justify-between mb-1.5 sm:mb-2 gap-2 flex-wrap">
                <label className="block text-[10px] sm:text-xs font-bold text-gray-700 uppercase">
                  භාෂාව අනුව ප්‍රශ්නය
                </label>
                <span className="text-[10px] sm:text-[11px] text-gray-500">
                  * SI · EN අනිවාර්යයි · Tamil optional
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 p-1 bg-gray-100/80 backdrop-blur-sm rounded-xl border border-white/60">
                {tabs.map((t) => {
                  const content = getContent(t.key);
                  const filled = content.questionText.trim().length > 0;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveLang(t.key)}
                      className={`py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 ${
                        activeLang === t.key
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      {t.label}
                      {t.required && <span className="text-red-500">*</span>}
                      {filled && activeLang !== t.key && (
                        <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Content for active tab */}
              <div className="mt-3 sm:mt-4 space-y-3 sm:space-y-4 p-3 sm:p-4 bg-emerald-50/40 border border-emerald-100/60 rounded-xl">
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 uppercase mb-1.5 sm:mb-2">
                    ප්‍රශ්නය ({tabs.find((t) => t.key === activeLang)?.label})
                  </label>
                  <textarea
                    rows={3}
                    placeholder="ප්‍රශ්නය මෙතන සටහන් කරන්න..."
                    value={current.questionText}
                    onChange={(e) =>
                      setContent(activeLang, { questionText: e.target.value })
                    }
                    required={activeLang !== "ta"}
                    disabled={isSubmitting}
                    className="w-full p-2.5 sm:p-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <label className="block text-[10px] sm:text-xs font-bold text-gray-700 uppercase">
                    පිළිතුරු විකල්ප —{" "}
                    {tabs.find((t) => t.key === activeLang)?.label}
                  </label>
                  {current.options.map((opt, idx) => {
                    const isOptionalFifth = idx === 4;
                    return (
                      <div key={idx} className="flex items-center gap-2 sm:gap-3">
                        <input
                          type="radio"
                          name="editCorrectAnswer"
                          checked={correctAnswer === idx && activeLang === "si"}
                          onChange={() =>
                            activeLang === "si" && setCorrectAnswer(idx)
                          }
                          disabled={
                            isSubmitting ||
                            (isOptionalFifth && !hasOption5) ||
                            activeLang !== "si"
                          }
                          className={`w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 focus:ring-emerald-500 shrink-0 ${
                            activeLang === "si"
                              ? "cursor-pointer"
                              : "opacity-30 cursor-not-allowed"
                          }`}
                          title={
                            activeLang === "si"
                              ? "නිවැරදි පිළිතුර තෝරන්න"
                              : "Correct answer is selected in the Sinhala tab"
                          }
                        />
                        <span className="w-5 sm:w-7 font-bold text-gray-700 text-xs sm:text-sm shrink-0">
                          ({idx + 1})
                        </span>
                        <input
                          type="text"
                          placeholder={
                            isOptionalFifth
                              ? "විකල්පය 5 (Optional)"
                              : `විකල්පය ${idx + 1}`
                          }
                          value={opt}
                          onChange={(e) =>
                            handleOptionChange(activeLang, idx, e.target.value)
                          }
                          required={!isOptionalFifth && activeLang !== "ta"}
                          disabled={isSubmitting}
                          className="flex-1 min-w-0 p-2.5 sm:p-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                        />
                      </div>
                    );
                  })}
                  <p className="text-[10px] sm:text-[11px] text-emerald-700 font-semibold flex items-start gap-1 leading-snug">
                    <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 mt-0.5" />
                    <span>
                      <span className="hidden sm:inline">
                        නිවැරදි පිළිතුර තෝරන්නේ සිංහල tab එකේ — එය සියලු භාෂා වලට apply වේ.
                      </span>
                      <span className="sm:hidden">
                        නිවැරදි පිළිතුර සිංහල tab එකේ තෝරයි.
                      </span>
                    </span>
                  </p>
                </div>

                <div>
                  <label className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-gray-700 uppercase mb-1.5 sm:mb-2">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                    <span className="truncate">
                      විස්තරය
                      <span className="hidden sm:inline"> — Optional</span>
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="විසඳන ආකාරය..."
                    value={current.explanation}
                    onChange={(e) =>
                      setContent(activeLang, { explanation: e.target.value })
                    }
                    disabled={isSubmitting}
                    className="w-full p-2.5 sm:p-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                  />
                </div>
              </div>
            </div>

            {/* Explanation Diagram */}
            <ImageUploadField
              value={explanationImageUrl}
              onChange={setExplanationImageUrl}
              disabled={isSubmitting}
              label="විස්තරයේ රූපසටහන (Explanation Diagram - Optional)"
              hint="* Review Screen එකේ Explanation එක සමඟ පෙන්වයි. සියලු භාෂාවන්ට පොදුයි."
            />
          </div>

          {/* ═══ FOOTER (fixed at bottom) ═══ */}
          <div className="shrink-0 px-3.5 sm:px-6 py-3 sm:py-4 border-t border-gray-100 bg-gray-50/80 backdrop-blur-sm flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-semibold rounded-xl text-xs sm:text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm hover:shadow-md transition disabled:opacity-60 text-xs sm:text-sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4 shrink-0" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function QuestionEditModal({
  isOpen,
  question,
  onClose,
  onSaved,
}: QuestionEditModalProps) {
  if (!isOpen || !question) return null;

  return (
    <QuestionEditorForm
      key={question.id}
      question={question}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}