"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Clock, ArrowLeft, ArrowRight, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_QUIZ_DURATION_SECONDS = 1800; // 30 minutes, used if the quiz record has no duration set

type Quiz = {
  title: string;
  subject: string;
  stream?: string | null;
  duration_minutes?: number | null;
};

// Row shape from public.questions (see 001_schema.sql / 003_topic.sql)
type Question = {
  id: string;
  quiz_id: string;
  question_text: string;
  image_url: string | null;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string;
  correct_option: number; // 0-4, checked in DB
  explanation: string | null;
  topic: string | null;
};

type QuizQuestionRow = {
  order_index: number;
  questions: Question | Question[] | null;
};

export default function StudentQuizPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const quizId = params?.id ?? "";

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuiz, setLoadingQuiz] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [timeLeft, setTimeLeft] = useState(DEFAULT_QUIZ_DURATION_SECONDS);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch quiz metadata AND its real questions from Supabase
  useEffect(() => {
    async function fetchQuizAndQuestions() {
      setLoadingQuiz(true);
      setLoadError(null);

      try {
        const { data: quizData, error: quizError } = await supabase
          .from("quizzes")
          .select("*")
          .eq("id", quizId)
          .single();

        if (quizError || !quizData) {
          console.error("Error fetching quiz:", quizError);
          setLoadError("Quiz එක සොයාගත නොහැකි විය.");
          setLoadingQuiz(false);
          return;
        }

        setQuiz(quizData);
        if (quizData.duration_minutes) {
          setTimeLeft(quizData.duration_minutes * 60);
        }

        // Fetch questions via quiz_questions junction table first
        let loadedQuestions: Question[] = [];
        const { data: qqData, error: qqError } = await supabase
          .from("quiz_questions")
          .select("order_index, questions(*)")
          .eq("quiz_id", quizId)
          .order("order_index", { ascending: true });

        if (!qqError && qqData && qqData.length > 0) {
          loadedQuestions = qqData
            .map((row: QuizQuestionRow) => row.questions)
            .filter((question): question is Question => question !== null);
        } else {
          // Fallback to legacy direct quiz_id
          const { data: directData, error: directError } = await supabase
            .from("questions")
            .select("*")
            .eq("quiz_id", quizId)
            .order("created_at", { ascending: true });

          if (directError) {
            console.error("Error fetching questions:", directError);
            setLoadError("ප්‍රශ්න පූරණය කිරීමේදී දෝෂයක් ඇති විය.");
            setLoadingQuiz(false);
            return;
          }

          loadedQuestions = directData ?? [];
        }

        // Enforce maximum 20 questions limit
        setQuestions(loadedQuestions.slice(0, 20));
      } catch (err) {
        console.error("Unexpected quiz loading error:", err);
        setLoadError("දත්ත පූරණය කිරීමේදී දෝෂයක් ඇති විය.");
      } finally {
        setLoadingQuiz(false);
      }
    }

    if (quizId) {
      fetchQuizAndQuestions();
    }
  }, [quizId]);

  // Turn a question row into a renderable options array, skipping
  // any blank trailing option (some MCQs use 4 options, not 5).
  const getOptions = (q: Question) =>
    [q.option_1, q.option_2, q.option_3, q.option_4, q.option_5].filter(
      (opt) => opt !== null && opt !== undefined && opt.trim() !== ""
    );

  // Calculate score by comparing selected answers against correct_option
  const calculateScore = useCallback(() => {
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correct_option) {
        correctCount += 1;
      }
    });
    return correctCount;
  }, [questions, selectedAnswers]);

  // Sends the final result to Supabase, then routes to the leaderboard
  const submitQuizResult = useCallback(
    async (finalScore: number, totalMarks: number, timeSpent: number) => {
      setIsSubmitting(true);
      setSubmitError(null);

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        console.error("Error getting authenticated user:", authError);
        setSubmitError("පුරනය වී නොමැත. Result එක save කළ නොහැක.");
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
        console.error("Error submitting result:", error);
        setSubmitError("Result එක save කිරීමේදී දෝෂයක් ඇති විය.");
        return;
      }

      router.push("/student/leaderboard");
    },
    [quizId, router]
  );

  const startingDuration = quiz?.duration_minutes
    ? quiz.duration_minutes * 60
    : DEFAULT_QUIZ_DURATION_SECONDS;

  const finishQuiz = useCallback(async () => {
    setIsSubmitted(true);
    const finalScore = calculateScore();
    const totalMarks = questions.length;
    const timeSpent = startingDuration - timeLeft;
    await submitQuizResult(finalScore, totalMarks, timeSpent);
  }, [calculateScore, questions.length, timeLeft, startingDuration, submitQuizResult]);

  // Auto-submit when timer hits zero — only once questions are loaded
  useEffect(() => {
    if (isSubmitted || loadingQuiz || questions.length === 0) return;

    if (timeLeft <= 0) {
      const timerId = setTimeout(() => {
        finishQuiz();
        alert("කාලය අවසන්! Quiz එක Auto-Submit විය.");
      }, 0);
      return () => clearTimeout(timerId);
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, isSubmitted, loadingQuiz, questions.length, finishQuiz]);

  const handleSelectOption = (optionIndex: number) => {
    if (isSubmitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [currentQuestionIndex]: optionIndex,
    }));
  };

  const handleManualSubmit = async () => {
    const confirmSubmit = confirm("ඔබට Quiz එක Submit කිරීමට අවශ්‍යද?");
    if (!confirmSubmit) return;

    await finishQuiz();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (loadingQuiz) {
    return <div className="p-8 text-center text-gray-500">Loading Quiz...</div>;
  }

  if (loadError || !quiz) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <p className="text-red-600 font-medium">{loadError ?? "Quiz not found!"}</p>
        <button
          onClick={() => router.push("/student/dashboard")}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  // A live quiz exists but has no questions entered yet — don't crash,
  // show a clear message instead.
  if (questions.length === 0) {
    return (
      <div className="p-8 max-w-md mx-auto text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-gray-800">{quiz.title}</h2>
        <p className="text-gray-500">
          මෙම Quiz එකට තවම ප්‍රශ්න එකතු කර නොමැත. පසුව නැවත උත්සාහ කරන්න.
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

  const currentQ = questions[currentQuestionIndex];
  const currentOptions = getOptions(currentQ);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header Bar: Timer & Status */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {quiz.subject} - {quiz.title}
            </h1>
            <p className="text-sm text-gray-500">
              {quiz.stream ? `${quiz.stream} • ` : ""}ප්‍රශ්නය {currentQuestionIndex + 1} / {questions.length}
            </p>
          </div>

          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg font-bold ${
              timeLeft < 300 ? "bg-red-50 text-red-600 border border-red-200" : "bg-blue-50 text-blue-700"
            }`}
          >
            <Clock className="w-5 h-5" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {submitError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm p-3 rounded-lg">
            {submitError}
          </div>
        )}

        {isSubmitted ? (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
            <h2 className="text-xl font-bold text-gray-900">Quiz එක සම්පූර්ණ කර ඇත</h2>
            <p className="text-gray-600">
              ලකුණු: {calculateScore()} / {questions.length}
            </p>
            {isSubmitting && (
              <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Result එක save කරමින්...
              </p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Main Question & Options Area */}
            <div className="md:col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
              <h2 className="text-lg font-medium text-gray-900 leading-relaxed">
                {currentQuestionIndex + 1}. {currentQ.question_text}
              </h2>

              {currentQ.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentQ.image_url}
                  alt="Question illustration"
                  className="max-h-72 rounded-lg border border-gray-200 mx-auto"
                />
              )}

              <div className="space-y-3">
                {currentOptions.map((option, idx) => {
                  const isSelected = selectedAnswers[currentQuestionIndex] === idx;
                  return (
                    <button
                      key={idx}
                      disabled={isSubmitted}
                      onClick={() => handleSelectOption(idx)}
                      className={`w-full text-left p-4 rounded-lg border transition-all duration-150 ${
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

              {/* Navigation Controls */}
              <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                <button
                  disabled={currentQuestionIndex === 0}
                  onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-4 h-4" /> පෙර ප්‍රශ්නය
                </button>

                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
                  >
                    ඊළඟ ප්‍රශ්නය <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    disabled={isSubmitted || isSubmitting}
                    onClick={handleManualSubmit}
                    className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Submit Quiz
                  </button>
                )}
              </div>
            </div>

            {/* Question Palette Grid */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-fit space-y-4">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Question Navigation</h3>
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
                  <span className="w-3 h-3 bg-green-100 border border-green-300 rounded"></span> පිළිතුරු සපයා ඇත
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-gray-100 rounded"></span> නොකළ ප්‍රශ්න
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}