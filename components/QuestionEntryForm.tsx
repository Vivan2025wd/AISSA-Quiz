"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Save,
  Sparkles,
  Loader2,
  AlertTriangle,
  Languages,
  GraduationCap,
  FileQuestion,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import ImageUploadField from "@/components/ImageUploadField";

// ============================================================
// Stream rules:
//   • Physics / Chemistry → Common (null) — all science streams
//   • Biology             → Bio Science only
//   • ICT                 → Maths stream only
// ============================================================
const subjects = ["Physics", "Chemistry", "Biology", "ICT"];
const BIO_STREAM = "Bio Science";
const MATHS_STREAM = "Maths";

function derivedStreamForSubject(subject: string): string | null {
  if (subject === "Biology") return BIO_STREAM;
  if (subject === "ICT") return MATHS_STREAM;
  return null; // Physics, Chemistry → Common
}

type Language = "si" | "en" | "ta";

type Props =
  | {
      mode: "standalone" | "bank";
      onSaved?: () => void;
    }
  | {
      mode: "locked";
      quizId: string;
      quizLabel: string;
      currentQuestionCount?: number;
      maxLimit?: number;
      onSaved?: () => void;
    };

interface LanguageContent {
  questionText: string;
  options: [string, string, string, string, string];
  explanation: string;
}

const emptyContent = (): LanguageContent => ({
  questionText: "",
  options: ["", "", "", "", ""],
  explanation: "",
});

const LANG_META: Record<
  Language,
  { label: string; nativeLabel: string; required: boolean; placeholder: string }
> = {
  si: {
    label: "Sinhala",
    nativeLabel: "සිංහල",
    required: true,
    placeholder: "ප්‍රශ්නය මෙතන සටහන් කරන්න...",
  },
  en: {
    label: "English",
    nativeLabel: "English",
    required: true,
    placeholder: "Type the question here...",
  },
  ta: {
    label: "Tamil",
    nativeLabel: "தமிழ்",
    required: false,
    placeholder: "கேள்வியை இங்கே தட்டச்சு செய்யவும்...",
  },
};

export default function QuestionEntryForm(props: Props) {
  const [subject, setSubject] = useState(subjects[0]);
  const [topic, setTopic] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [explanationImageUrl, setExplanationImageUrl] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState(0);

  const [si, setSi] = useState<LanguageContent>(emptyContent());
  const [en, setEn] = useState<LanguageContent>(emptyContent());
  const [ta, setTa] = useState<LanguageContent>(emptyContent());

  const [activeLang, setActiveLang] = useState<Language>("si");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isLocked = props.mode === "locked";
  const maxLimit = isLocked ? props.maxLimit ?? 20 : 20;
  const currentCount = isLocked ? props.currentQuestionCount ?? 0 : 0;
  const isAtLimit = isLocked && currentCount >= maxLimit;

  const derivedStream = derivedStreamForSubject(subject);

  const hasOption5 = si.options[4].trim() !== "";

  const getContent = (lang: Language): LanguageContent =>
    lang === "si" ? si : lang === "en" ? en : ta;

  const setContent = (lang: Language, patch: Partial<LanguageContent>) => {
    const setter = lang === "si" ? setSi : lang === "en" ? setEn : setTa;
    setter((prev) => ({ ...prev, ...patch }));
  };

  const handleOptionChange = (lang: Language, index: number, value: string) => {
    const content = getContent(lang);
    const updated = [...content.options] as LanguageContent["options"];
    updated[index] = value;

    if (lang === "si" && index === 4 && value.trim() === "" && correctAnswer === 4) {
      setCorrectAnswer(0);
    }

    setContent(lang, { options: updated });
  };

  const resetForm = () => {
    setTopic("");
    setImageUrl("");
    setExplanationImageUrl("");
    setCorrectAnswer(0);
    setSi(emptyContent());
    setEn(emptyContent());
    setTa(emptyContent());
    setActiveLang("si");
  };

  const validate = (): string | null => {
    if (!si.questionText.trim()) return "සිංහල ප්‍රශ්නය අවශ්‍යයි.";
    for (let i = 0; i < 4; i++) {
      if (!si.options[i].trim()) return `සිංහල විකල්පය ${i + 1} අවශ්‍යයි.`;
    }

    if (!en.questionText.trim()) return "English question text is required.";
    for (let i = 0; i < 4; i++) {
      if (!en.options[i].trim()) return `English option ${i + 1} is required.`;
    }

    const taStarted =
      ta.questionText.trim() !== "" ||
      ta.options.some((o) => o.trim() !== "");

    if (taStarted) {
      if (!ta.questionText.trim()) {
        return "Tamil question text is required once Tamil is started.";
      }
      for (let i = 0; i < 4; i++) {
        if (!ta.options[i].trim()) {
          return `Tamil option ${i + 1} is required once Tamil is started.`;
        }
      }
    }

    if (correctAnswer === 4 && !hasOption5) {
      return "විකල්පය 5 හිස්ව ඇති බැවින් එය නිවැරදි පිළිතුර ලෙස තෝරාගත නොහැක.";
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (isLocked && isAtLimit) {
      setError(
        `මෙම Quiz එකට උපරිම ප්‍රශ්න සීමාව (${maxLimit}) සම්පූර්ණ වී ඇත. තවත් ප්‍රශ්න එකතු කළ නොහැක.`,
      );
      return;
    }

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      const taStarted =
        ta.questionText.trim() !== "" ||
        ta.options.some((o) => o.trim() !== "");

      const payload: Record<string, unknown> = {
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
      };

      const { data: insertedData, error: insertError } = await supabase
        .from("questions")
        .insert([payload])
        .select("id")
        .single();

      if (insertError || !insertedData) {
        throw new Error(
          insertError?.message || "ප්‍රශ්නය සේව් කිරීමට අපොහොසත් විය.",
        );
      }

      if (isLocked) {
        const { error: linkError } = await supabase
          .from("quiz_questions")
          .insert([
            {
              quiz_id: props.quizId,
              question_id: insertedData.id,
              order_index: currentCount + 1,
            },
          ]);

        if (linkError) {
          console.warn("Could not insert into quiz_questions:", linkError);
        }
      }

      setIsSubmitting(false);
      setSuccess(true);
      resetForm();
      props.onSaved?.();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError((err as Error).message || "Save Error");
    }
  };

  const tabs: Language[] = ["si", "en", "ta"];

  const isTabFilled = (lang: Language) => {
    const c = getContent(lang);
    return c.questionText.trim() !== "" || c.options.some((o) => o.trim() !== "");
  };

  const activeContent = getContent(activeLang);
  const activeMeta = LANG_META[activeLang];

  return (
    <form
      onSubmit={handleSubmit}
      className="relative overflow-hidden rounded-2xl bg-white/80 backdrop-blur-md border border-white/70 shadow-xl shadow-emerald-900/5"
    >
      {/* ═══════════════ HEADER BANNER — DARK THEME (matches dashboard) ═══════════════ */}
      <div className="relative overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-black text-white border-b border-slate-700/50">
        {/* dot grid */}
        <div
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        {/* teal glows — matches logo color */}
        <div className="pointer-events-none absolute -top-24 -right-20 w-72 h-72 bg-teal-500/20 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl" />
        {/* rings */}
        <div className="pointer-events-none absolute -top-16 -right-16 w-48 h-48 rounded-full border-18 border-teal-400/10" />
        <div className="pointer-events-none absolute top-1/2 -right-24 w-72 h-72 rounded-full border-[1.5px] border-teal-400/10 hidden md:block" />
        {/* shine */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/5" />

        <div className="relative p-5 sm:p-6 md:p-7 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
          {/* ✨ AISSA Logo — no box, sits directly on dark bg */}
          <div className="shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
              <div className="relative w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/aissa-logo.png"
                  alt="AISSA Logo"
                  className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(45,212,191,0.5)]"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
                <GraduationCap className="w-3.5 h-3.5" />
                AISSA
              </span>
              {isLocked ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-amber-400/30 text-amber-200">
                  <FileQuestion className="w-3.5 h-3.5" />
                  Quiz Locked
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Question Bank
                </span>
              )}
            </div>

            <h3 className="text-base sm:text-lg md:text-xl font-extrabold leading-tight tracking-tight flex items-center gap-2">
              <FileQuestion className="w-5 h-5 sm:w-6 sm:h-6 text-teal-300 shrink-0" />
              <span className="wrap-break-word">
                {isLocked
                  ? "Quiz එකට නව ප්‍රශ්නයක් එකතු කරන්න"
                  : "Question Bank එකට නව ප්‍රශ්නයක් එකතු කරන්න"}
              </span>
            </h3>
            <p className="text-slate-300 text-[11px] sm:text-xs mt-1">
              {isLocked
                ? `ප්‍රශ්න සීමාව: ${currentCount} / ${maxLimit}`
                : "මෙහි එකතු කරන සියලුම ප්‍රශ්න Central Question Bank එකේ තැන්පත් වන අතර ඕනෑම Quiz එකකට තෝරාගත හැක."}
            </p>
          </div>

          {isLocked && (
            <span
              className={`self-start sm:self-center px-3 py-1.5 rounded-full text-xs font-extrabold shrink-0 backdrop-blur-sm border ${
                isAtLimit
                  ? "bg-amber-500/25 text-amber-100 border-amber-300/30"
                  : "bg-teal-500/15 text-teal-200 border-teal-400/30"
              }`}
            >
              {currentCount} / {maxLimit} Qs
            </span>
          )}
        </div>
      </div>

      {/* ═══════════════ BODY ═══════════════ */}
      <div className="p-5 sm:p-6 md:p-8 space-y-6">

        {isAtLimit && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            මෙම Quiz එකට උපරිම ප්‍රශ්න 20 සම්පූර්ණ වී ඇත. නව ප්‍රශ්නයක් එකතු කිරීමට පෙර දැනට ඇති ප්‍රශ්නයක් ඉවත් කරන්න.
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start gap-2 shadow-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4" /> ප්‍රශ්නය සාර්ථකව Question Bank එකට එකතු කරන ලදී!
          </div>
        )}

        {/* ---------- Locked target info ---------- */}
        {isLocked ? (
          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <p className="text-xs font-bold text-emerald-900 uppercase flex items-center gap-1.5">
              <FileQuestion className="w-3.5 h-3.5" />
              Selected Quiz
            </p>
            <p className="text-sm font-semibold text-emerald-800 mt-0.5">
              {props.quizLabel}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subject */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                විෂය (Subject)
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSubmitting}
                className="w-full p-3 bg-white/60 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
              >
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Stream — read-only, auto-derived from subject */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                Stream (Auto)
              </label>
              <div
                className={`w-full p-3 rounded-xl font-medium text-sm border ${
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
              <p className="text-[11px] text-gray-500 mt-1">
                {derivedStream === null
                  ? "* Physics සහ Chemistry හැම science stream එකකටම පොදුයි."
                  : derivedStream === BIO_STREAM
                    ? "* Biology Bio Science stream එකට විතරයි."
                    : "* ICT Maths stream එකට විතරයි (Physics + ICT හෝ Physics + Chemistry)."}
              </p>
            </div>
          </div>
        )}

        {/* ---------- Topic ---------- */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
            පාඩම / මාතෘකාව (Topic)
          </label>
          <input
            type="text"
            placeholder="උදා: තාපය (Thermal Physics)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isSubmitting || isAtLimit}
            className="w-full p-3 bg-white/60 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
          />
        </div>

        {/* ---------- Question Diagram ---------- */}
        <ImageUploadField
          value={imageUrl}
          onChange={setImageUrl}
          disabled={isSubmitting || isAtLimit}
        />

        {/* ═══════════════ LANGUAGE TABS ═══════════════ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase">
              <Languages className="w-4 h-4 text-emerald-600" />
              භාෂාව අනුව ප්‍රශ්නය
            </label>
            <span className="text-[11px] text-gray-500">
              <span className="text-red-500">*</span> සිංහල · English &nbsp;|&nbsp; Tamil optional
            </span>
          </div>

          {/* Tab bar */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100/80 backdrop-blur-sm rounded-xl border border-white/60">
            {tabs.map((lang) => {
              const meta = LANG_META[lang];
              const filled = isTabFilled(lang);
              const isActive = activeLang === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setActiveLang(lang)}
                  className={`py-2.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isActive
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {meta.nativeLabel}
                  {meta.required && <span className="text-red-500">*</span>}
                  {filled && !isActive && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active tab content */}
          <div className="p-4 bg-emerald-50/40 border border-emerald-100/60 rounded-xl space-y-4">
            {/* Question text */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                ප්‍රශ්නය — {activeMeta.nativeLabel}
              </label>
              <textarea
                rows={3}
                placeholder={activeMeta.placeholder}
                value={activeContent.questionText}
                onChange={(e) =>
                  setContent(activeLang, { questionText: e.target.value })
                }
                required={activeMeta.required}
                disabled={isSubmitting || isAtLimit}
                className="w-full p-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
              />
            </div>

            {/* Options */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-700 uppercase">
                පිළිතුරු විකල්ප — {activeMeta.nativeLabel}
              </label>

              {activeContent.options.map((opt, idx) => {
                const isOptionalFifth = idx === 4;
                const showRadioHere = activeLang === "si";
                const radioDisabled =
                  isSubmitting ||
                  isAtLimit ||
                  (isOptionalFifth && !hasOption5) ||
                  !showRadioHere;

                return (
                  <div key={idx} className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="correctAnswer"
                      checked={correctAnswer === idx}
                      onChange={() => showRadioHere && setCorrectAnswer(idx)}
                      disabled={radioDisabled}
                      title={
                        showRadioHere
                          ? "නිවැරදි පිළිතුර තෝරන්න"
                          : "Correct answer is set on the Sinhala tab"
                      }
                      className={`w-5 h-5 text-emerald-600 focus:ring-emerald-500 ${
                        showRadioHere && !radioDisabled
                          ? "cursor-pointer"
                          : "cursor-not-allowed opacity-30"
                      }`}
                    />
                    <span className="w-7 font-bold text-gray-700 text-sm">
                      ({idx + 1})
                    </span>
                    <input
                      type="text"
                      placeholder={
                        isOptionalFifth
                          ? `Option 5 (optional) — ${activeMeta.nativeLabel}`
                          : `Option ${idx + 1} — ${activeMeta.nativeLabel}`
                      }
                      value={opt}
                      onChange={(e) =>
                        handleOptionChange(activeLang, idx, e.target.value)
                      }
                      required={!isOptionalFifth && activeMeta.required}
                      disabled={isSubmitting || isAtLimit}
                      className="flex-1 p-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
                    />
                  </div>
                );
              })}

              {activeLang === "si" ? (
                <p className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  නිවැරදි පිළිතුර ඉදිරියෙන් ඇති Radio Button එක මෙතන තෝරන්න. එය සියලු භාෂා වලට apply වේ. විකල්පය 5 හිස්ව තැබිය හැක.
                </p>
              ) : (
                <p className="text-[11px] text-gray-500 font-medium">
                  නිවැරදි පිළිතුර සිංහල tab එකේ තෝරන ලද්දකි. මෙතන ඇති විකල්ප පිළිවෙලම සමාන විය යුතුයි
                  (Option 1 = Option 1 in Sinhala, etc.).
                </p>
              )}
            </div>

            {/* Explanation */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                විස්තරාත්මක විසඳීම — {activeMeta.nativeLabel} (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="විසඳන ආකාරය..."
                value={activeContent.explanation}
                onChange={(e) =>
                  setContent(activeLang, { explanation: e.target.value })
                }
                disabled={isSubmitting || isAtLimit}
                className="w-full p-3 bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-400 outline-none disabled:opacity-60 transition"
              />
            </div>
          </div>

          {/* Progress indicator */}
          <div className="flex items-center gap-2 text-[11px] text-gray-500 flex-wrap">
            <span className="font-semibold">සම්පූර්ණ කළ භාෂා:</span>
            {tabs.map((lang) => (
              <span
                key={lang}
                className={`px-2 py-0.5 rounded-md font-bold ${
                  isTabFilled(lang)
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                {LANG_META[lang].nativeLabel}
              </span>
            ))}
          </div>
        </div>

        {/* ── Explanation diagram (shared across all languages) ── */}
        <div className="pt-2">
          <ImageUploadField
            value={explanationImageUrl}
            onChange={setExplanationImageUrl}
            disabled={isSubmitting || isAtLimit}
            label="විස්තරයේ රූපසටහන (Explanation Diagram - Optional)"
            hint="* මෙම රූපය Explanation එක සමඟ Review Screen එකේ පෙන්වයි. සියලු භාෂාවන්ට පොදුයි."
          />
        </div>

        {/* ---------- Submit ---------- */}
        <button
          type="submit"
          disabled={isSubmitting || isAtLimit}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-sm hover:shadow-md transition disabled:opacity-60"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" /> ප්‍රශ්නය සේව් කරන්න
            </>
          )}
        </button>
      </div>
    </form>
  );
}