"use client";

import React, { useState } from "react";
import { Image as ImageIcon, CheckCircle2, Save, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const streams = ["Bio Science", "Physical Science", "Maths", "Commerce", "Arts", "Technology"];
const subjects = ["Physics", "Chemistry", "Biology"];

type Props =
  | {
      // Standalone/Bank mode: adding directly to the central Question Bank
      mode: "standalone" | "bank";
      onSaved?: () => void;
    }
  | {
      // Locked mode: adding directly to a specific quiz (links via quiz_questions)
      mode: "locked";
      quizId: string;
      quizLabel: string;
      currentQuestionCount?: number;
      maxLimit?: number;
      onSaved?: () => void;
    };

export default function QuestionEntryForm(props: Props) {
  const [subject, setSubject] = useState(subjects[0]);
  const [stream, setStream] = useState(streams[0]);
  const [topic, setTopic] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [options, setOptions] = useState(["", "", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState(0);
  const [explanation, setExplanation] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isLocked = props.mode === "locked";
  const maxLimit = isLocked ? props.maxLimit ?? 20 : 20;
  const currentCount = isLocked ? props.currentQuestionCount ?? 0 : 0;
  const isAtLimit = isLocked && currentCount >= maxLimit;

  const hasOption5 = options[4].trim() !== "";

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    if (index === 4 && value.trim() === "" && correctAnswer === 4) {
      setCorrectAnswer(0);
    }
    setOptions(updated);
  };

  const resetForm = () => {
    setTopic("");
    setQuestionText("");
    setImageUrl("");
    setOptions(["", "", "", "", ""]);
    setCorrectAnswer(0);
    setExplanation("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (isLocked && isAtLimit) {
      setError(`මෙම Quiz එකට උපරිම ප්‍රශ්න සීමාව (${maxLimit}) සම්පූර්ණ වී ඇත. තවත් ප්‍රශ්න එකතු කළ නොහැක.`);
      return;
    }

    // Validate 4 options
    for (let i = 0; i < 4; i++) {
      if (!options[i].trim()) {
        setError(`විකල්පය ${i + 1} හිස් තැබිය නොහැක.`);
        return;
      }
    }

    if (correctAnswer === 4 && !hasOption5) {
      setError("විකල්පය 5 හිස්ව ඇති බැවින් එය නිවැරදි පිළිතුර ලෙස තෝරාගත නොහැක.");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Insert question into Question Bank
      const { data: insertedData, error: insertError } = await supabase
        .from("questions")
        .insert([
          {
            subject: subject,
            stream: stream,
            question_text: questionText.trim(),
            image_url: imageUrl.trim() || null,
            option_1: options[0].trim(),
            option_2: options[1].trim(),
            option_3: options[2].trim(),
            option_4: options[3].trim(),
            option_5: hasOption5 ? options[4].trim() : null,
            correct_option: correctAnswer,
            explanation: explanation.trim() || null,
            topic: topic.trim() || null,
            quiz_id: isLocked ? props.quizId : null,
          },
        ])
        .select("id")
        .single();

      if (insertError || !insertedData) {
        throw new Error(insertError?.message || "ප්‍රශ්නය සේව් කිරීමට අපොහොසත් විය.");
      }

      // 2. If locked to a quiz, also link via quiz_questions junction table
      if (isLocked) {
        const { error: linkError } = await supabase.from("quiz_questions").insert([
          {
            quiz_id: props.quizId,
            question_id: insertedData.id,
            order_index: currentCount + 1,
          },
        ]);

        if (linkError) {
          // If the quiz_questions table doesn't exist yet or had a constraint, log warning
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

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900">
            {isLocked ? "Quiz එකට නව ප්‍රශ්නයක් එකතු කරන්න" : "Question Bank එකට නව ප්‍රශ්නයක් එකතු කරන්න"}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {isLocked
              ? `ප්‍රශ්න සීමාව: ${currentCount} / ${maxLimit}`
              : "මෙහි එකතු කරන සියලුම ප්‍රශ්න Central Question Bank එකේ තැන්පත් වන අතර ඕනෑම Quiz එකකට තෝරාගත හැක."}
          </p>
        </div>

        {isLocked && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isAtLimit ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
          }`}>
            {currentCount} / {maxLimit} Qs
          </span>
        )}
      </div>

      {isAtLimit && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          මෙම Quiz එකට උපරිම ප්‍රශ්න 20 සම්පූර්ණ වී ඇත. නව ප්‍රශ්නයක් එකතු කිරීමට පෙර දැනට ඇති ප්‍රශ්නයක් ඉවත් කරන්න.
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> ප්‍රශ්නය සාර්ථකව Question Bank එකට එකතු කරන ලදී!
        </div>
      )}

      {/* Target Info */}
      {isLocked ? (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-xs font-bold text-blue-900 uppercase">Selected Quiz</p>
          <p className="text-sm font-semibold text-blue-800">{props.quizLabel}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">විෂය (Subject)</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              disabled={isSubmitting}
              className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Stream</label>
            <select
              value={stream}
              onChange={(e) => setStream(e.target.value)}
              disabled={isSubmitting}
              className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {streams.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase mb-2">පාඩම / මාතෘකාව (Topic)</label>
        <input
          type="text"
          placeholder="උදා: තාපය (Thermal Physics)"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          disabled={isSubmitting || isAtLimit}
          className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-gray-700 uppercase mb-2">ප්‍රශ්නය (Question Text)</label>
        <textarea
          rows={4}
          placeholder="ප්‍රශ්නය මෙතන සටහන් කරන්න..."
          value={questionText}
          onChange={(e) => setQuestionText(e.target.value)}
          required
          disabled={isSubmitting || isAtLimit}
          className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-2">
          <ImageIcon className="w-4 h-4 text-gray-500" /> ප්‍රස්ථාරය / රූපසටහන (Diagram URL - Optional)
        </label>
        <input
          type="text"
          placeholder="https://example.com/diagram.png"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          disabled={isSubmitting || isAtLimit}
          className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
        />
      </div>

      {/* Options */}
      <div className="space-y-3 pt-2">
        <label className="block text-xs font-bold text-gray-700 uppercase">
          පිළිතුරු විකල්ප සහ නිවැරදි පිළිතුර තෝරන්න
        </label>

        {options.map((option, idx) => {
          const isOptionalFifth = idx === 4;
          return (
            <div key={idx} className="flex items-center gap-3">
              <input
                type="radio"
                name="correctAnswer"
                checked={correctAnswer === idx}
                onChange={() => setCorrectAnswer(idx)}
                disabled={isSubmitting || isAtLimit || (isOptionalFifth && !hasOption5)}
                className="w-5 h-5 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30"
              />
              <span className="w-7 font-bold text-gray-700 text-sm">({idx + 1})</span>
              <input
                type="text"
                placeholder={isOptionalFifth ? "විකල්පය 5 (Optional — හිස්ව තැබිය හැක)" : `විකල්පය ${idx + 1}`}
                value={option}
                onChange={(e) => handleOptionChange(idx, e.target.value)}
                required={!isOptionalFifth}
                disabled={isSubmitting || isAtLimit}
                className="flex-1 p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
              />
            </div>
          );
        })}
        <p className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> නිවැරදි පිළිතුර ඉදිරියෙන් ඇති Radio Button එක Select කරන්න. විකල්පය 5 හිස්ව තැබිය හැක (4-විකල්ප ප්‍රශ්න සඳහා).
        </p>
      </div>

      <div className="pt-2">
        <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-2">
          <Sparkles className="w-4 h-4 text-amber-500" /> විස්තරාත්මක විසඳීම (Solution Explanation - Optional)
        </label>
        <textarea
          rows={3}
          placeholder="මෙම ප්‍රශ්නය විසඳන ආකාරය සහ නිවැරදි පිළිතුරට පැමිණෙන ආකාරය පැහැදිලි කරන්න..."
          value={explanation}
          onChange={(e) => setExplanation(e.target.value)}
          disabled={isSubmitting || isAtLimit}
          className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || isAtLimit}
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex justify-center items-center gap-2 shadow-md transition disabled:opacity-60"
      >
        {isSubmitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Save className="w-5 h-5" /> ප්‍රශ්නය සේව් කරන්න
          </>
        )}
      </button>
    </form>
  );
}