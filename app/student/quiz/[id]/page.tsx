"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Eye,
  Hourglass,
  Sparkles,
  Trophy,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import {
  getQuizWindowStatus,
  msUntilStart,
  msUntilEnd,
  formatCountdown,
} from "@/lib/quiz-window";

const DEFAULT_QUIZ_DURATION_SECONDS = 1800;

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------
type Medium = "sinhala" | "english" | "tamil";

type Quiz = {
  id: string;
  title: string;
  subject: string;
  stream?: string | null;
  duration_minutes: number;
  scheduled_at: string | null;
};

type Question = {
  id: string;
  quiz_id: string;
  image_url: string | null;
  correct_option: number;
  topic: string | null;

  question_text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string | null;
  explanation: string | null;

  question_text_en?: string | null;
  option_1_en?: string | null;
  option_2_en?: string | null;
  option_3_en?: string | null;
  option_4_en?: string | null;
  option_5_en?: string | null;
  explanation_en?: string | null;

  question_text_ta?: string | null;
  option_1_ta?: string | null;
  option_2_ta?: string | null;
  option_3_ta?: string | null;
  option_4_ta?: string | null;
  option_5_ta?: string | null;
  explanation_ta?: string | null;
};

type StudentResult = {
  id: string;
  score: number;
  total_marks: number;
  time_spent_seconds: number;
  submitted_at: string;
};

type MyAnswersMap = Record<string, number | null>;

// ------------------------------------------------------------
// Subject colors — used INSIDE QuizShell on the dark banner
// ------------------------------------------------------------
function subjectBadgeStyle(subject: string | null | undefined): string {
  const s = (subject ?? "").toLowerCase();
  if (s.includes("physics"))
    return "bg-blue-500/20 text-blue-100 border-blue-300/30";
  if (s.includes("chemistry"))
    return "bg-purple-500/20 text-purple-100 border-purple-300/30";
  if (s.includes("biology"))
    return "bg-emerald-500/20 text-emerald-100 border-emerald-300/30";
  if (s.includes("ict") || s.includes("information"))
    return "bg-cyan-500/20 text-cyan-100 border-cyan-300/30";
  return "bg-teal-500/20 text-teal-100 border-teal-300/30";
}

// ------------------------------------------------------------
// Stream → Subject rules
//   • Biology             → Bio Science stream only
//   • ICT                 → Maths (Physical Science) stream only
//   • Physics / Chemistry → Common (all science streams)
// ------------------------------------------------------------
type BlockReason = {
  subject: string;
  requiredStream: string;
  detail: string;
  allowedHint: string;
};

function getBlockReasonForStream(
  quizSubject: string | null | undefined,
  studentStream: string | null | undefined,
): BlockReason | null {
  if (!quizSubject || !studentStream) return null;

  const subj = quizSubject.toLowerCase();
  const s = studentStream.toLowerCase();

  const isBio = s.includes("bio");
  const isMaths = s.includes("physical") || s.includes("maths");

  if (subj.includes("biology") && !isBio) {
    return {
      subject: quizSubject,
      requiredStream: "Bio Science",
      detail: "Biology විෂය Bio Science stream එකට විතරයි.",
      allowedHint: "Physics · Chemistry · Biology",
    };
  }

  if ((subj.includes("ict") || subj.includes("information")) && !isMaths) {
    return {
      subject: quizSubject,
      requiredStream: "Maths (Physical Science)",
      detail: "ICT විෂය Maths (Physical Science) stream එකට විතරයි.",
      allowedHint: "Physics · Chemistry · ICT",
    };
  }

  return null;
}

// ------------------------------------------------------------
// Localization helpers
// ------------------------------------------------------------
function pickByMedium<T>(
  medium: Medium,
  si: T,
  en: T | null | undefined,
  ta: T | null | undefined,
): T {
  const isFilled = (v: unknown): boolean =>
    v !== null && v !== undefined && (typeof v !== "string" || v.trim() !== "");

  if (medium === "english" && isFilled(en)) return en as T;
  if (medium === "tamil" && isFilled(ta)) return ta as T;
  return si;
}

function localizeQuestion(q: Question, medium: Medium) {
  return {
    question_text: pickByMedium(medium, q.question_text, q.question_text_en, q.question_text_ta),
    option_1: pickByMedium(medium, q.option_1, q.option_1_en, q.option_1_ta),
    option_2: pickByMedium(medium, q.option_2, q.option_2_en, q.option_2_ta),
    option_3: pickByMedium(medium, q.option_3, q.option_3_en, q.option_3_ta),
    option_4: pickByMedium(medium, q.option_4, q.option_4_en, q.option_4_ta),
    option_5: pickByMedium(medium, q.option_5, q.option_5_en, q.option_5_ta),
    explanation: pickByMedium(medium, q.explanation, q.explanation_en, q.explanation_ta),
    image_url: q.image_url,
    correct_option: q.correct_option,
  };
}

type LocalizedQuestion = ReturnType<typeof localizeQuestion>;

function getLocalizedOptions(lq: LocalizedQuestion): string[] {
  return [
    lq.option_1,
    lq.option_2,
    lq.option_3,
    lq.option_4,
    lq.option_5,
  ].filter(
    (o): o is string => o !== null && o !== undefined && o.trim() !== "",
  );
}

// ------------------------------------------------------------
// Main component
// ------------------------------------------------------------
export default function StudentQuizPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quizId = params?.id ?? "";

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [myResult, setMyResult] = useState<StudentResult | null>(null);
  const [myAnswers, setMyAnswers] = useState<MyAnswersMap>({});
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [medium, setMedium] = useState<Medium>("sinhala");
  const [studentStream, setStudentStream] = useState<string | null>(null);

  const [blockReason, setBlockReason] = useState<BlockReason | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [timeLeft, setTimeLeft] = useState(DEFAULT_QUIZ_DURATION_SECONDS);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [startedAtMs, setStartedAtMs] = useState<number | null>(null);

  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;

    async function load() {
      setLoadingQuiz(true);
      setLoadError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let localStream: string | null = null;

      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("medium, stream")
          .eq("id", user.id)
          .maybeSingle();

        if (!cancelled && profileData?.medium) {
          setMedium(profileData.medium as Medium);
        }
        if (!cancelled && profileData?.stream) {
          setStudentStream(profileData.stream);
          localStream = profileData.stream;
        }
      }

      const cacheRes = await fetch(`/api/quiz/${quizId}`, {
        next: { revalidate: 60 },
      });

      if (cancelled) return;

      if (!cacheRes.ok) {
        setLoadError("Quiz එක සොයාගත නොහැකි විය.");
        setLoadingQuiz(false);
        return;
      }

      const payload = (await cacheRes.json()) as {
        quiz: Quiz;
        questions: Question[];
      };

      if (cancelled) return;

      const quizData = payload.quiz;
      const questionsData = payload.questions ?? [];

      if (!quizData) {
        setLoadError("Quiz එක සොයාගත නොහැකි විය.");
        setLoadingQuiz(false);
        return;
      }

      const reason = getBlockReasonForStream(quizData.subject, localStream);
      if (reason) {
        setQuiz(quizData as Quiz);
        setBlockReason(reason);
        setLoadingQuiz(false);
        return;
      }

      setQuiz(quizData as Quiz);

      const durationSec = (quizData.duration_minutes || 30) * 60;
      if (quizData.scheduled_at) {
        const startMs = new Date(quizData.scheduled_at).getTime();
        const endMs = startMs + durationSec * 1000;
        const remainingSec = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
        setTimeLeft(remainingSec);
      } else {
        setTimeLeft(durationSec);
      }
      setStartedAtMs(Date.now());

      setQuestions(questionsData.slice(0, 20));

      if (user) {
        const { data: resultData } = await supabase
          .from("quiz_results")
          .select("id, score, total_marks, time_spent_seconds, submitted_at")
          .eq("student_id", user.id)
          .eq("quiz_id", quizId)
          .maybeSingle();

        if (!cancelled) setMyResult(resultData ?? null);

        const { data: ansData } = await supabase
          .from("quiz_answers")
          .select("question_id, selected_option")
          .eq("student_id", user.id)
          .eq("quiz_id", quizId);

        if (!cancelled && ansData) {
          const map: MyAnswersMap = {};
          for (const a of ansData as { question_id: string; selected_option: number | null }[]) {
            map[a.question_id] = a.selected_option;
          }
          setMyAnswers(map);
        }
      }

      setLoadingQuiz(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [quizId]);

  const windowStatus = useMemo(
    () =>
      quiz
        ? getQuizWindowStatus({
            scheduled_at: quiz.scheduled_at,
            duration_minutes: quiz.duration_minutes,
          })
        : "active",
    [quiz],
  );

  const calculateScore = useCallback(() => {
    let correct = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_option) correct++;
    });
    return correct;
  }, [questions, selectedAnswers]);

  const submitQuizResult = useCallback(
    async (finalScore: number, totalMarks: number, timeSpent: number) => {
      setIsSubmitting(true);
      setSubmitError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubmitError("පුරනය වී නොමැත.");
        setIsSubmitting(false);
        router.push("/auth/login");
        return;
      }

      const { data: resultRow, error: resultErr } = await supabase
        .from("quiz_results")
        .insert([
          {
            student_id: user.id,
            quiz_id: quizId,
            score: finalScore,
            total_marks: totalMarks,
            time_spent_seconds: timeSpent,
          },
        ])
        .select("id")
        .single();

      if (resultErr || !resultRow) {
        setIsSubmitting(false);
        setSubmitError(
          "Result save කිරීමේදී දෝෂයක්: " + (resultErr?.message ?? "unknown"),
        );
        return;
      }

      const answerRows = questions.map((q, idx) => {
        const sel = selectedAnswers[idx];
        return {
          result_id: resultRow.id,
          student_id: user.id,
          quiz_id: quizId,
          question_id: q.id,
          selected_option: sel === undefined ? null : sel,
          is_correct: sel !== undefined && sel === q.correct_option,
        };
      });

      if (answerRows.length > 0) {
        const { error: answersErr } = await supabase
          .from("quiz_answers")
          .insert(answerRows);

        if (answersErr) {
          console.error("quiz_answers insert failed:", answersErr);
          setSubmitError(
            "Answers save කිරීමේදී දෝෂයක් (result save විය): " +
              answersErr.message,
          );
        }
      }

      setIsSubmitting(false);

      const { data: resultData } = await supabase
        .from("quiz_results")
        .select("id, score, total_marks, time_spent_seconds, submitted_at")
        .eq("student_id", user.id)
        .eq("quiz_id", quizId)
        .maybeSingle();
      setMyResult(resultData ?? null);

      const { data: ansData } = await supabase
        .from("quiz_answers")
        .select("question_id, selected_option")
        .eq("student_id", user.id)
        .eq("quiz_id", quizId);

      if (ansData) {
        const map: MyAnswersMap = {};
        for (const a of ansData as { question_id: string; selected_option: number | null }[]) {
          map[a.question_id] = a.selected_option;
        }
        setMyAnswers(map);
      }

      router.push("/student/leaderboard");
    },
    [quizId, router, questions, selectedAnswers],
  );

  const finishQuiz = useCallback(async () => {
    setIsSubmitted(true);
    const finalScore = calculateScore();
    const totalMarks = questions.length;
    const actualSeconds = startedAtMs
      ? Math.floor((Date.now() - startedAtMs) / 1000)
      : 0;
    await submitQuizResult(finalScore, totalMarks, Math.max(0, actualSeconds));
  }, [calculateScore, questions.length, startedAtMs, submitQuizResult]);

  useEffect(() => {
    if (windowStatus !== "active") return;
    if (isSubmitted || loadingQuiz || questions.length === 0) return;
    if (blockReason) return;

    if (timeLeft <= 0) {
      const t = setTimeout(() => {
        void finishQuiz();
        alert("කාලය අවසන්! Quiz එක Auto-Submit විය.");
      }, 0);
      return () => clearTimeout(t);
    }

    const interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, isSubmitted, loadingQuiz, questions.length, finishQuiz, windowStatus, blockReason]);

  const handleSelectOption = (i: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((p) => ({ ...p, [currentQuestionIndex]: i }));
  };

  const handleManualSubmit = async () => {
    if (!confirm("ඔබට Quiz එක Submit කිරීමට අවශ්‍යද?")) return;
    await finishQuiz();
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60)
      .toString()
      .padStart(2, "0")}`;

  // ============================================================
  // Loading / error / empty
  // ============================================================
  if (loadingQuiz) {
    return (
      <ThemedShell>
        <div className="flex flex-col items-center justify-center gap-4 text-gray-500 text-sm py-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/loading-screen.png"
            alt="AISSA"
            className="w-20 h-20 sm:w-24 sm:h-24 object-contain animate-pulse"
          />
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-600" /> Loading Quiz...
          </div>
        </div>
      </ThemedShell>
    );
  }

  if (loadError || !quiz) {
    return (
      <ThemedShell>
        <div className="max-w-md mx-auto text-center space-y-3 bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-8">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <p className="text-red-600 font-medium text-sm">
            {loadError ?? "Quiz not found!"}
          </p>
          <button
            onClick={() => router.push("/student/dashboard")}
            className="text-sm text-emerald-600 hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </ThemedShell>
    );
  }

  if (blockReason) {
    return (
      <ThemedShell>
        <div className="max-w-md mx-auto bg-white/80 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm border border-amber-200/70 text-center space-y-4">
          <div className="inline-flex p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <AlertTriangle className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900">
              ප්‍රවේශය සීමා කර ඇත
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed">
              {blockReason.detail}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-gray-500 flex-wrap">
              <span className="px-2 py-1 bg-gray-100 rounded-md">
                ඔබේ stream: {studentStream || "—"}
              </span>
              <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded-md">
                අවශ්‍ය: {blockReason.requiredStream}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 font-medium pt-1">
              මෙම Quiz එකට අදාළ: {blockReason.allowedHint}
            </p>
          </div>
          <button
            onClick={() => router.push("/student/dashboard")}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </ThemedShell>
    );
  }

  if (questions.length === 0) {
    return (
      <ThemedShell>
        <div className="max-w-md mx-auto text-center space-y-3 bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-8">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="text-base font-bold text-gray-800">{quiz.title}</h2>
          <p className="text-gray-500 text-sm">
            මෙම Quiz එකට තවම ප්‍රශ්න එකතු කර නැත.
          </p>
          <button
            onClick={() => router.push("/student/dashboard")}
            className="text-sm text-emerald-600 hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </ThemedShell>
    );
  }

  if (windowStatus === "upcoming") {
    const ms = msUntilStart({
      scheduled_at: quiz.scheduled_at,
      duration_minutes: quiz.duration_minutes,
    });
    const startsIn = ms != null && ms > 0 ? formatCountdown(ms) : null;
    return (
      <QuizShell title={quiz.title} subject={quiz.subject} stream={quiz.stream}>
        <div className="bg-white/80 backdrop-blur-md p-6 sm:p-8 rounded-2xl shadow-sm border border-amber-200/70 text-center space-y-4">
          <Hourglass className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500 mx-auto" />
          <h2 className="text-base sm:text-xl font-bold text-gray-900">
            මෙම Quiz එක තවම ආරම්භ වී නැත
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            ආරම්භ වන වේලාව:{" "}
            {quiz.scheduled_at
              ? new Date(quiz.scheduled_at).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </p>
          {startsIn && (
            <p className="text-xl sm:text-2xl font-extrabold text-amber-700">
              {startsIn} කින් ආරම්භ වේ
            </p>
          )}
          <button
            onClick={() => router.push("/student/dashboard")}
            className="text-sm text-emerald-600 hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </QuizShell>
    );
  }

  if (windowStatus === "expired") {
    return (
      <QuizShell title={quiz.title} subject={quiz.subject} stream={quiz.stream}>
        <ReviewMode
          quiz={quiz}
          questions={questions}
          medium={medium}
          myResult={myResult}
          myAnswers={myAnswers}
          reviewIndex={reviewIndex}
          setReviewIndex={setReviewIndex}
          onBack={() => router.push("/student/dashboard")}
        />
      </QuizShell>
    );
  }

  // ============================================================
  // ACTIVE
  // ============================================================
  const currentQ = questions[currentQuestionIndex];
  const localized = localizeQuestion(currentQ, medium);
  const currentOptions = getLocalizedOptions(localized);
  const msEnd = msUntilEnd(quiz);
  const endsIn = msEnd != null ? formatCountdown(msEnd) : null;

  return (
    <QuizShell title={quiz.title} subject={quiz.subject} stream={quiz.stream}>
      {/* Timer bar */}
      <div className="bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-xl shadow-sm border border-white/70 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 truncate">
            {quiz.stream ? `${quiz.stream} • ` : ""}ප්‍රශ්නය{" "}
            {currentQuestionIndex + 1} / {questions.length}
          </p>
          {endsIn && (
            <p className="text-[10px] sm:text-[11px] font-bold text-red-600 flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              අවසන් වන තෙක්: {endsIn}
            </p>
          )}
        </div>
        <div
          className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-mono text-base sm:text-lg font-bold shrink-0 ${
            timeLeft < 300
              ? "bg-red-50 text-red-600 border border-red-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm p-3 rounded-lg">
          {submitError}
        </div>
      )}

      {isSubmitted ? (
        <div className="bg-white/80 backdrop-blur-md p-6 sm:p-8 rounded-xl shadow-sm border border-white/70 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h2 className="text-lg sm:text-xl font-bold text-gray-900">
            Quiz එක සම්පූර්ණ කර ඇත
          </h2>
          <p className="text-gray-600 text-sm">
            ලකුණු: {calculateScore()} / {questions.length}
          </p>
          {isSubmitting && (
            <p className="text-xs sm:text-sm text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Result save කරමින්...
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Mobile palette */}
          <div className="md:hidden bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-sm border border-white/70 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-semibold">ප්‍රශ්න</span>
              <span className="text-[11px]">
                <span className="text-blue-700 font-bold">
                  {Object.keys(selectedAnswers).length}
                </span>{" "}
                / {questions.length}
              </span>
            </div>
            <div className="grid grid-cols-6 xs:grid-cols-8 sm:grid-cols-10 gap-1.5">
              {questions.map((_, idx) => {
                const isAnswered = selectedAnswers[idx] !== undefined;
                const isCurrent = currentQuestionIndex === idx;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`w-full aspect-square rounded-md text-xs font-semibold flex items-center justify-center transition ${
                      isCurrent
                        ? "ring-2 ring-emerald-600 bg-emerald-600 text-white"
                        : isAnswered
                          ? "bg-blue-100 text-blue-800 border border-blue-300"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="md:col-span-3 bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-xl shadow-sm border border-white/70 space-y-4 sm:space-y-6">
              <h2 className="text-base sm:text-lg font-medium text-gray-900 leading-relaxed">
                {currentQuestionIndex + 1}. {localized.question_text}
              </h2>

              {localized.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={localized.image_url}
                  alt="Question illustration"
                  className="max-h-64 sm:max-h-72 rounded-lg border border-gray-200 mx-auto"
                />
              )}

              <div className="space-y-2.5 sm:space-y-3">
                {currentOptions.map((option, idx) => {
                  const isSelected =
                    selectedAnswers[currentQuestionIndex] === idx;
                  return (
                    <button
                      key={idx}
                      disabled={isSubmitted}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-lg border transition-all duration-150 text-sm sm:text-base ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-medium ring-2 ring-emerald-500/20"
                          : "border-gray-200 bg-white/50 hover:bg-emerald-50/40 text-gray-700"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 pt-3 sm:pt-4 border-t border-gray-100">
                <button
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((p) => p - 1)}
                  className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm bg-white/50 transition"
                >
                  <ArrowLeft className="w-4 h-4" /> <span className="hidden xs:inline">පෙර</span>
                </button>

                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIndex((p) => p + 1)}
                    className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-sm shadow-sm"
                  >
                    ඊළඟ <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    disabled={isSubmitted || isSubmitting}
                    onClick={handleManualSubmit}
                    className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition disabled:opacity-50 text-sm shadow-sm"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Submit
                  </button>
                )}
              </div>
            </div>

            <div className="hidden md:block bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-sm border border-white/70 h-fit space-y-4">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">
                Question Navigation
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {questions.map((_, idx) => {
                  const isAnswered = selectedAnswers[idx] !== undefined;
                  const isCurrent = currentQuestionIndex === idx;
                  return (
                    <button
                      key={idx}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-10 h-10 rounded-lg text-sm font-semibold flex items-center justify-center transition ${
                        isCurrent
                          ? "ring-2 ring-emerald-600 ring-offset-2 bg-emerald-600 text-white"
                          : isAnswered
                            ? "bg-blue-100 text-blue-800 border border-blue-300"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <div className="pt-3 border-t text-xs space-y-2 text-gray-500">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" />
                  පිළිතුරු සපයා ඇත
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-gray-100 rounded" /> නොකළ ප්‍රශ්න
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </QuizShell>
  );
}

// ---------------------------------------------------------------------------
// Themed page wrapper
// ---------------------------------------------------------------------------
function ThemedShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 relative">
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed top-[35%] right-[15%] w-72 h-72 bg-green-100/60 rounded-full filter blur-3xl" />
      <div className="relative p-3 sm:p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuizShell with DARK banner + AISSA logo
// ---------------------------------------------------------------------------
function QuizShell({
  title,
  subject,
  stream,
  children,
}: {
  title: string;
  subject: string;
  stream?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-linear-to-br from-emerald-50 via-white to-teal-50 relative">
      <div className="pointer-events-none fixed top-[-15%] left-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-emerald-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-15%] right-[-10%] w-80 h-80 sm:w-md sm:h-112 bg-teal-200/50 rounded-full filter blur-3xl" />
      <div className="pointer-events-none fixed top-[35%] right-[15%] w-72 h-72 bg-green-100/60 rounded-full filter blur-3xl" />

      <div className="relative p-3 sm:p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* ═══════════ DARK BANNER with AISSA LOGO ═══════════ */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-slate-700/50">
            {/* dot grid */}
            <div
              className="absolute inset-0 opacity-[0.15] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(45, 212, 191, 0.5) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            {/* teal glows */}
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
                  <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
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
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border ${subjectBadgeStyle(
                      subject,
                    )}`}
                  >
                    {subject}
                  </span>
                  {stream && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
                      {stream}
                    </span>
                  )}
                </div>
                <h1 className="text-base sm:text-xl md:text-2xl font-extrabold leading-snug tracking-tight wrap-break-word">
                  {title}
                </h1>
              </div>
            </div>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review mode
// ---------------------------------------------------------------------------
function ReviewMode({
  questions,
  medium,
  myResult,
  myAnswers,
  reviewIndex,
  setReviewIndex,
  onBack,
}: {
  quiz: Quiz;
  questions: Question[];
  medium: Medium;
  myResult: StudentResult | null;
  myAnswers: MyAnswersMap;
  reviewIndex: number;
  setReviewIndex: (i: number) => void;
  onBack: () => void;
}) {
  const q = questions[reviewIndex];
  const localized = localizeQuestion(q, medium);
  const optionsList = getLocalizedOptions(localized);

  const studentSel = myAnswers[q.id];
  const studentAnswered = studentSel !== undefined && studentSel !== null;

  return (
    <div className="space-y-4">
      <div className="bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-xl shadow-sm border border-emerald-200/70 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Eye className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">
              Review Mode
            </h2>
            <p className="text-[11px] sm:text-xs text-gray-500">
              නිවැරදි පිළිතුරු සහ විස්තර
            </p>
          </div>
        </div>

        {myResult ? (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl self-start sm:self-auto">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-700">
                ඔබේ ලකුණු
              </p>
              <p className="font-extrabold text-emerald-900 text-base sm:text-lg leading-none">
                {myResult.score} / {myResult.total_marks}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-[11px] sm:text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
            සහභාගී වී නැත
          </span>
        )}
      </div>

      <div className="md:hidden bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-sm border border-white/70 space-y-2">
        <div className="grid grid-cols-6 xs:grid-cols-8 sm:grid-cols-10 gap-1.5">
          {questions.map((question, idx) => {
            const isCurrent = reviewIndex === idx;
            const sel = myAnswers[question.id];
            const answered = sel !== undefined && sel !== null;
            const correct = answered && sel === question.correct_option;
            const wrong = answered && !correct;

            let colorCls = "bg-gray-100 text-gray-600 border border-gray-200";
            if (correct)
              colorCls = "bg-emerald-100 text-emerald-800 border border-emerald-300";
            else if (wrong)
              colorCls = "bg-red-100 text-red-800 border border-red-300";

            return (
              <button
                key={idx}
                onClick={() => setReviewIndex(idx)}
                className={`w-full aspect-square rounded-md text-xs font-semibold flex items-center justify-center transition ${
                  isCurrent ? "ring-2 ring-emerald-600 bg-emerald-600 text-white" : colorCls
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
        <div className="md:col-span-3 bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-xl shadow-sm border border-white/70 space-y-4 sm:space-y-6">
          <h2 className="text-base sm:text-lg font-medium text-gray-900 leading-relaxed">
            {reviewIndex + 1}. {localized.question_text}
          </h2>

          {localized.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={localized.image_url}
              alt="Question illustration"
              loading="lazy"
              decoding="async"
              className="max-h-64 sm:max-h-72 rounded-lg border border-gray-200 mx-auto"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.onerror = null;
                el.style.display = "none";
              }}
            />
          )}

          {!studentAnswered && myResult && (
            <div className="text-[11px] sm:text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0" />
              ඔබ මෙම ප්‍රශ්නයට පිළිතුරු දී නැත.
            </div>
          )}

          <div className="space-y-2">
            {optionsList.map((opt, idx) => {
              const isCorrect = localized.correct_option === idx;
              const studentPicked = studentAnswered && studentSel === idx;
              const studentWrong = studentPicked && !isCorrect;

              let cardCls =
                "bg-white/60 border-gray-200 text-gray-700";
              if (isCorrect)
                cardCls =
                  "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold";
              else if (studentWrong)
                cardCls =
                  "bg-red-50 border-red-300 text-red-900 font-bold";

              let badgeCls = "bg-gray-200 text-gray-700";
              if (isCorrect) badgeCls = "bg-emerald-600 text-white";
              else if (studentWrong) badgeCls = "bg-red-600 text-white";

              return (
                <div
                  key={idx}
                  className={`p-3 sm:p-3.5 rounded-lg border flex items-start gap-2.5 sm:gap-3 text-sm ${cardCls}`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${badgeCls}`}
                  >
                    {isCorrect ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : studentWrong ? (
                      <XCircle className="w-4 h-4" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span className="flex-1 wrap-break-word">{opt}</span>

                  {isCorrect && (
                    <span className="hidden sm:inline px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded shrink-0">
                      Correct
                    </span>
                  )}
                  {studentWrong && (
                    <span className="hidden sm:inline px-2 py-0.5 bg-red-200 text-red-900 text-[10px] font-bold rounded shrink-0">
                      Your answer
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {localized.explanation && (
            <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="font-bold text-amber-950 text-xs sm:text-sm mb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" /> Explanation
              </p>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                {localized.explanation}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-3 sm:pt-4 border-t border-gray-100">
            <button
              disabled={reviewIndex === 0}
              onClick={() => setReviewIndex(reviewIndex - 1)}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm bg-white/50 transition"
            >
              <ArrowLeft className="w-4 h-4" /> <span className="hidden xs:inline">පෙර</span>
            </button>

            {reviewIndex < questions.length - 1 ? (
              <button
                onClick={() => setReviewIndex(reviewIndex + 1)}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-sm shadow-sm"
              >
                ඊළඟ <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onBack}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition text-sm shadow-sm"
              >
                Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="hidden md:block bg-white/80 backdrop-blur-md p-5 rounded-xl shadow-sm border border-white/70 h-fit space-y-4">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">
            ප්‍රශ්න ලැයිස්තුව
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {questions.map((question, idx) => {
              const isCurrent = reviewIndex === idx;
              const sel = myAnswers[question.id];
              const answered = sel !== undefined && sel !== null;
              const correct = answered && sel === question.correct_option;
              const wrong = answered && !correct;

              let colorCls = "bg-gray-100 text-gray-600 border border-gray-200";
              if (correct)
                colorCls = "bg-emerald-100 text-emerald-800 border border-emerald-300";
              else if (wrong)
                colorCls = "bg-red-100 text-red-800 border border-red-300";

              return (
                <button
                  key={idx}
                  onClick={() => setReviewIndex(idx)}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold flex items-center justify-center transition ${
                    isCurrent
                      ? "ring-2 ring-emerald-600 ring-offset-2 bg-emerald-600 text-white"
                      : colorCls
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t text-xs space-y-2 text-gray-500">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded" />
              නිවැරදි
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-100 border border-red-300 rounded" />
              වැරදි
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-gray-100 border border-gray-200 rounded" />
              නොකළ
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-full text-xs font-semibold text-gray-500 hover:text-emerald-600 pt-2 transition"
          >
            ← Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}