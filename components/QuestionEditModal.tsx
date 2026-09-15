"use client";

import React, { useState} from "react";
import { X, Save, Loader2, Sparkles, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

export type EditableQuestion = {
  id: string;
  quiz_id?: string | null;
  subject?: string | null;
  stream?: string | null;
  question_text: string;
  topic: string | null;
  correct_option: number;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string | null;
  image_url: string | null;
  explanation: string | null;
};

interface QuestionEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: EditableQuestion | null;
  onSaved: () => void;
}

const streams = ["Bio Science", "Physical Science", "Maths", "Commerce", "Arts", "Technology"];

const getInitialFormState = (question: EditableQuestion | null) => ({
  subject: question?.subject ?? "Physics",
  stream: question?.stream ?? streams[0],
  topic: question?.topic ?? "",
  questionText: question?.question_text ?? "",
  imageUrl: question?.image_url ?? "",
  options: [
    question?.option_1 ?? "",
    question?.option_2 ?? "",
    question?.option_3 ?? "",
    question?.option_4 ?? "",
    question?.option_5 ?? "",
  ],
  correctAnswer: question?.correct_option ?? 0,
  explanation: question?.explanation ?? "",
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
  const [stream, setStream] = useState(initialState.stream);
  const [topic, setTopic] = useState(initialState.topic);
  const [questionText, setQuestionText] = useState(initialState.questionText);
  const [imageUrl, setImageUrl] = useState(initialState.imageUrl);
  const [options, setOptions] = useState(initialState.options);
  const [correctAnswer, setCorrectAnswer] = useState(initialState.correctAnswer);
  const [explanation, setExplanation] = useState(initialState.explanation);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const hasOption5 = options[4].trim() !== "";

  const handleOptionChange = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    if (index === 4 && value.trim() === "" && correctAnswer === 4) {
      setCorrectAnswer(0);
    }
    setOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!questionText.trim()) {
      setError("ප්‍රශ්න විස්තරය (Question Text) හිස් විය නොහැක.");
      return;
    }

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

    const { error: updateError } = await supabase
      .from("questions")
      .update({
        subject: subject,
        stream: stream,
        question_text: questionText.trim(),
        topic: topic.trim() || null,
        image_url: imageUrl.trim() || null,
        option_1: options[0].trim(),
        option_2: options[1].trim(),
        option_3: options[2].trim(),
        option_4: options[3].trim(),
        option_5: hasOption5 ? options[4].trim() : null,
        correct_option: correctAnswer,
        explanation: explanation.trim() || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">ප්‍රශ්නය සංස්කරණය (Edit Question)</h3>
            <p className="text-xs text-gray-500">Question Bank එකේ ඇති ප්‍රශ්නය අවශ්‍ය පරිදි වෙනස් කරන්න.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase mb-2">විෂය (Subject)</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSubmitting}
                className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Biology">Biology</option>
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

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              පාඩම / මාතෘකාව (Topic - Optional)
            </label>
            <input
              type="text"
              placeholder="උදා: තාපය (Thermal Physics)"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={isSubmitting}
              className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
              ප්‍රශ්නය (Question Text)
            </label>
            <textarea
              rows={4}
              placeholder="ප්‍රශ්නය මෙතන සටහන් කරන්න..."
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              required
              disabled={isSubmitting}
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
              disabled={isSubmitting}
              className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
            />
            {imageUrl && (
              <div className="mt-2 p-2 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-[11px] text-gray-500 mb-1">Image Preview:</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl}
                  alt="Diagram preview"
                  className="max-h-40 rounded-lg object-contain mx-auto"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>

          {/* Options with Radio Selection for Correct Answer */}
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
                    name="editCorrectAnswer"
                    checked={correctAnswer === idx}
                    onChange={() => setCorrectAnswer(idx)}
                    disabled={isSubmitting || (isOptionalFifth && !hasOption5)}
                    className="w-5 h-5 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30"
                  />
                  <span className="w-7 font-bold text-gray-700 text-sm">({idx + 1})</span>
                  <input
                    type="text"
                    placeholder={isOptionalFifth ? "විකල්පය 5 (Optional — හිස්ව තැබිය හැක)" : `විකල්පය ${idx + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    required={!isOptionalFifth}
                    disabled={isSubmitting}
                    className="flex-1 p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                  />
                </div>
              );
            })}
            <p className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> නිවැරදි පිළිතුර ඉදිරියෙන් ඇති Radio Button එක Select කරන්න.
            </p>
          </div>

          {/* Explanation */}
          <div className="pt-2">
            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase mb-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> විස්තරාත්මක විසඳීම (Solution Explanation - Optional)
            </label>
            <textarea
              rows={3}
              placeholder="මෙම ප්‍රශ්නය විසඳන ආකාරය සහ නිවැරදි පිළිතුරට පැමිණෙන ආකාරය..."
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              disabled={isSubmitting}
              className="w-full p-3 bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 rounded-xl font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
            />
          </div>

          {/* Modal Footer / Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition disabled:opacity-60 text-sm"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// The actual exported component page.tsx imports. It owns the
// isOpen / null-question guard so callers can render it
// unconditionally (as page.tsx does) without worrying about a
// null `question`. `key={question.id}` forces QuestionEditorForm
// to remount — and therefore reset its internal useState fields —
// whenever the admin switches which question they're editing,
// instead of the form carrying over the previous question's values.
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