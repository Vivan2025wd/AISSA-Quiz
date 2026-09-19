"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Clock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
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
  question_text: string;
  image_url: string | null;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string | null;
  correct_option: number;
  explanation: string | null;
  topic: string | null;
};

type QuizQuestionRow = {
  order_index: number;
  questions: Question | Question[] | null;
};

type StudentResult = {
  id: string;
  score: number;
  total_marks: number;
  time_spent_seconds: number;
  submitted_at: string;
};

export default function StudentQuizPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quizId = params?.id ?? "";

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [myResult, setMyResult] = useState<StudentResult | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [timeLeft, setTimeLeft] = useState(DEFAULT_QUIZ_DURATION_SECONDS);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => {
    if (!quizId) return;
    let cancelled = false;

    async function load() {
      setLoadingQuiz(true);
      setLoadError(null);

      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("id, title, subject, stream, duration_minutes, scheduled_at")
        .eq("id", quizId)
        .single();

      if (cancelled) return;

      if (quizError || !quizData) {
        setLoadError("Quiz එක සොයාගත නොහැකි විය.");
        setLoadingQuiz(false);
        return;
      }

      setQuiz(quizData as Quiz);
      setTimeLeft((quizData.duration_minutes || 30) * 60);

      let loaded: Question[] = [];
      const { data: qqData, error: qqError } = await supabase
        .from("quiz_questions")
        .select("order_index, questions(*)")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true });

      if (!qqError && qqData && qqData.length > 0) {
        loaded = qqData
          .map((row: QuizQuestionRow) => row.questions)
          .filter((q): q is Question => q !== null);
      } else {
        const { data: directData } = await supabase
          .from("questions")
          .select("*")
          .eq("quiz_id", quizId)
          .order("created_at", { ascending: true });
        loaded = directData ?? [];
      }

      if (cancelled) return;
      setQuestions(loaded.slice(0, 20));

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: resultData } = await supabase
          .from("quiz_results")
          .select("id, score, total_marks, time_spent_seconds, submitted_at")
          .eq("student_id", user.id)
          .eq("quiz_id", quizId)
          .maybeSingle();

        if (!cancelled) setMyResult(resultData ?? null);
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

  const getOptions = (q: Question) =>
    [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5].filter(
      (o): o is string => o !== null && o !== undefined && o.trim() !== "",
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

      const { error } = await supabase.from("quiz_results").insert([
        {
          student_id: user.id,
          quiz_id: quizId,
          score: finalScore,
          total_marks: totalMarks,
          time_spent_seconds: timeSpent,
        },
      ]);

      setIsSubmitting(false);

      if (error) {
        setSubmitError("Result save කිරීමේදී දෝෂයක්: " + error.message);
        return;
      }

      const { data: resultData } = await supabase
        .from("quiz_results")
        .select("id, score, total_marks, time_spent_seconds, submitted_at")
        .eq("student_id", user.id)
        .eq("quiz_id", quizId)
        .maybeSingle();
      setMyResult(resultData ?? null);

      router.push("/student/leaderboard");
    },
    [quizId, router],
  );

  const startingDuration = (quiz?.duration_minutes ?? 30) * 60;
  const finishQuiz = useCallback(async () => {
    setIsSubmitted(true);
    const finalScore = calculateScore();
    const totalMarks = questions.length;
    const timeSpent = startingDuration - timeLeft;
    await submitQuizResult(finalScore, totalMarks, timeSpent);
  }, [calculateScore, questions.length, timeLeft, startingDuration, submitQuizResult]);

  useEffect(() => {
    if (windowStatus !== "active") return;
    if (isSubmitted || loadingQuiz || questions.length === 0) return;

    if (timeLeft <= 0) {
      const t = setTimeout(() => {
        void finishQuiz();
        alert("කාලය අවසන්! Quiz එක Auto-Submit විය.");
      }, 0);
      return () => clearTimeout(t);
    }

    const interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, isSubmitted, loadingQuiz, questions.length, finishQuiz, windowStatus]);

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
      <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2 text-sm">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading Quiz...
      </div>
    );
  }

  if (loadError || !quiz) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <p className="text-red-600 font-medium text-sm">
          {loadError ?? "Quiz not found!"}
        </p>
        <button
          onClick={() => router.push("/student/dashboard")}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-6 max-w-md mx-auto text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-gray-800">{quiz.title}</h2>
        <p className="text-gray-500 text-sm">
          මෙම Quiz එකට තවම ප්‍රශ්න එකතු කර නොමැත.
        </p>
        <button
          onClick={() => router.push("/student/dashboard")}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // ============================================================
  // UPCOMING
  // ============================================================
  if (windowStatus === "upcoming") {
    const ms = msUntilStart({
      scheduled_at: quiz.scheduled_at,
      duration_minutes: quiz.duration_minutes,
    });
    const startsIn = ms != null && ms > 0 ? formatCountdown(ms) : null;
    return (
      <QuizShell title={quiz.title} subject={quiz.subject} stream={quiz.stream}>
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-amber-200 text-center space-y-4">
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
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </QuizShell>
    );
  }

  // ============================================================
  // EXPIRED — Review mode
  // ============================================================
  if (windowStatus === "expired") {
    return (
      <QuizShell title={quiz.title} subject={quiz.subject} stream={quiz.stream}>
        <ReviewMode
          quiz={quiz}
          questions={questions}
          myResult={myResult}
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
  const currentOptions = getOptions(currentQ);
  const msEnd = msUntilEnd(quiz);
  const endsIn = msEnd != null ? formatCountdown(msEnd) : null;

  return (
    <QuizShell title={quiz.title} subject={quiz.subject} stream={quiz.stream}>
      {/* Timer bar */}
      <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between gap-3">
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
              : "bg-blue-50 text-blue-700"
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
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-gray-200 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
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
          {/* -------- Mobile: palette collapsible top strip -------- */}
          <div className="md:hidden bg-white p-3 rounded-xl shadow-sm border border-gray-200 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-semibold">ප්‍රශ්න</span>
              <span className="text-[11px]">
                <span className="text-green-700 font-bold">
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
                        ? "ring-2 ring-blue-600 bg-blue-600 text-white"
                        : isAnswered
                          ? "bg-green-100 text-green-800 border border-green-300"
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
            {/* -------- Question panel -------- */}
            <div className="md:col-span-3 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 sm:space-y-6">
              <h2 className="text-base sm:text-lg font-medium text-gray-900 leading-relaxed">
                {currentQuestionIndex + 1}. {currentQ.question_text}
              </h2>

              {currentQ.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentQ.image_url}
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
                          ? "border-blue-600 bg-blue-50 text-blue-900 font-medium ring-2 ring-blue-500/20"
                          : "border-gray-200 hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-2 pt-3 sm:pt-4 border-t border-gray-100">
                <button
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((p) => p - 1)}
                  className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <ArrowLeft className="w-4 h-4" /> <span className="hidden xs:inline">පෙර</span>
                </button>

                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIndex((p) => p + 1)}
                    className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
                  >
                    ඊළඟ <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    disabled={isSubmitted || isSubmitting}
                    onClick={handleManualSubmit}
                    className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50 text-sm"
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

            {/* -------- Desktop palette -------- */}
            <div className="hidden md:block bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-fit space-y-4">
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
                          ? "ring-2 ring-blue-600 ring-offset-2 bg-blue-600 text-white"
                          : isAnswered
                            ? "bg-green-100 text-green-800 border border-green-300"
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
                  <span className="w-3 h-3 bg-green-100 border border-green-300 rounded" />
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
// Shell
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
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-gray-200">
          <h1 className="text-base sm:text-xl font-bold text-gray-800 leading-snug wrap-break-word">
            {subject} - {title}
          </h1>
          {stream && (
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{stream}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review mode
// ---------------------------------------------------------------------------
function ReviewMode({
  questions,
  myResult,
  reviewIndex,
  setReviewIndex,
  onBack,
}: {
  quiz: Quiz;
  questions: Question[];
  myResult: StudentResult | null;
  reviewIndex: number;
  setReviewIndex: (i: number) => void;
  onBack: () => void;
}) {
  const q = questions[reviewIndex];
  const optionsList = [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5].filter(
    (o): o is string => o !== null && o !== undefined && o.trim() !== "",
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-indigo-200 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
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

      {/* Mobile palette */}
      <div className="md:hidden bg-white p-3 rounded-xl shadow-sm border border-gray-200 space-y-2">
        <div className="grid grid-cols-6 xs:grid-cols-8 sm:grid-cols-10 gap-1.5">
          {questions.map((_, idx) => {
            const isCurrent = reviewIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => setReviewIndex(idx)}
                className={`w-full aspect-square rounded-md text-xs font-semibold flex items-center justify-center transition ${
                  isCurrent
                    ? "ring-2 ring-blue-600 bg-blue-600 text-white"
                    : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 sm:gap-6">
        <div className="md:col-span-3 bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-200 space-y-4 sm:space-y-6">
          <h2 className="text-base sm:text-lg font-medium text-gray-900 leading-relaxed">
            {reviewIndex + 1}. {q.question_text}
          </h2>

          {q.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={q.image_url}
              alt="Question illustration"
              className="max-h-64 sm:max-h-72 rounded-lg border border-gray-200 mx-auto"
            />
          )}

          <div className="space-y-2">
            {optionsList.map((opt, idx) => {
              const isCorrect = q.correct_option === idx;
              return (
                <div
                  key={idx}
                  className={`p-3 sm:p-3.5 rounded-lg border flex items-start gap-2.5 sm:gap-3 text-sm ${
                    isCorrect
                      ? "bg-emerald-50 border-emerald-300 text-emerald-900 font-bold"
                      : "bg-white border-gray-200 text-gray-700"
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5 ${
                      isCorrect
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {isCorrect ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </span>
                  <span className="flex-1 wrap-break-word">{opt}</span>
                  {isCorrect && (
                    <span className="hidden sm:inline px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded shrink-0">
                      Correct
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {q.explanation && (
            <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="font-bold text-amber-950 text-xs sm:text-sm mb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" /> Explanation
              </p>
              <p className="text-xs sm:text-sm text-amber-900 leading-relaxed">
                {q.explanation}
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 pt-3 sm:pt-4 border-t border-gray-100">
            <button
              disabled={reviewIndex === 0}
              onClick={() => setReviewIndex(reviewIndex - 1)}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> <span className="hidden xs:inline">පෙර</span>
            </button>

            {reviewIndex < questions.length - 1 ? (
              <button
                onClick={() => setReviewIndex(reviewIndex + 1)}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
              >
                ඊළඟ <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onBack}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition text-sm"
              >
                Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Desktop palette */}
        <div className="hidden md:block bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-fit space-y-4">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">
            ප්‍රශ්න ලැයිස්තුව
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {questions.map((_, idx) => {
              const isCurrent = reviewIndex === idx;
              return (
                <button
                  key={idx}
                  onClick={() => setReviewIndex(idx)}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold flex items-center justify-center transition ${
                    isCurrent
                      ? "ring-2 ring-blue-600 ring-offset-2 bg-blue-600 text-white"
                      : "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
          <button
            onClick={onBack}
            className="w-full text-xs font-semibold text-gray-500 hover:text-blue-600 pt-2"
          >
            ← Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}