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
  Flag,
  Maximize2,
  Minimize2,
  ShieldAlert,
  Check,
  X,
  RotateCcw,
  FileText,
  HelpCircle,
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

  explanation_image_url?: string | null;
  correct_option?: number;
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
// Subject colors
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
    explanation_image_url: q.explanation_image_url ?? null,
    image_url: q.image_url,
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
  const [isCorrectMap, setIsCorrectMap] = useState<Record<string, boolean>>({});
  const [confirmedScore, setConfirmedScore] = useState<number | null>(null);

  const [flaggedQuestions, setFlaggedQuestions] = useState<{ [key: number]: boolean }>({});
  const [paletteFilter, setPaletteFilter] = useState<"all" | "answered" | "unanswered" | "flagged">("all");
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabSwitchWarning, setShowTabSwitchWarning] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

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
          .select("question_id, selected_option, is_correct")
          .eq("student_id", user.id)
          .eq("quiz_id", quizId);

        if (!cancelled && ansData) {
          const map: MyAnswersMap = {};
          const corrMap: Record<string, boolean> = {};
          for (const a of ansData as {
            question_id: string;
            selected_option: number | null;
            is_correct: boolean;
          }[]) {
            map[a.question_id] = a.selected_option;
            corrMap[a.question_id] = a.is_correct;
          }
          setMyAnswers(map);
          setIsCorrectMap(corrMap);
        }

        if (!resultData && typeof window !== "undefined") {
          try {
            const draftRaw = sessionStorage.getItem(`aissa_draft_${quizId}`);
            if (draftRaw) {
              const draft = JSON.parse(draftRaw);
              if (draft?.selectedAnswers && Object.keys(draft.selectedAnswers).length > 0) {
                setSelectedAnswers(draft.selectedAnswers);
              }
              if (draft?.flaggedQuestions) {
                setFlaggedQuestions(draft.flaggedQuestions);
              }
            }
          } catch {
            // ignore JSON parse error
          }
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

  const submitQuizResult = useCallback(
    async (timeSpent: number) => {
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

      const answers = questions.map((q, idx) => ({
        question_id: q.id,
        selected_option: selectedAnswers[idx] !== undefined ? selectedAnswers[idx] : null,
      }));

      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_id: quizId,
          answers,
          time_spent_seconds: timeSpent,
        }),
      });

      if (!res.ok) {
        setIsSubmitting(false);
        setSubmitError("Result save කිරීමේදී දෝෂයක් (" + res.status + ").");
        return;
      }

      const result = (await res.json()) as {
        score?: number;
        total_marks?: number;
        already_submitted?: boolean;
        per_question?: Array<{ question_id: string; is_correct: boolean }>;
      };

      setConfirmedScore(result.score ?? 0);

      if (result.per_question) {
        const map: Record<string, boolean> = {};
        for (const pq of result.per_question) {
          map[pq.question_id] = pq.is_correct;
        }
        setIsCorrectMap(map);
      }

      const { data: resultData } = await supabase
        .from("quiz_results")
        .select("id, score, total_marks, time_spent_seconds, submitted_at")
        .eq("student_id", user.id)
        .eq("quiz_id", quizId)
        .maybeSingle();
      setMyResult(resultData ?? null);

      const { data: ansData } = await supabase
        .from("quiz_answers")
        .select("question_id, selected_option, is_correct")
        .eq("student_id", user.id)
        .eq("quiz_id", quizId);

      if (ansData) {
        const map2: MyAnswersMap = {};
        const corrMap: Record<string, boolean> = {};
        for (const a of ansData as {
          question_id: string;
          selected_option: number | null;
          is_correct: boolean;
        }[]) {
          map2[a.question_id] = a.selected_option;
          corrMap[a.question_id] = a.is_correct;
        }
        setMyAnswers(map2);
        setIsCorrectMap(corrMap);
      }

      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem(`aissa_draft_${quizId}`);
        } catch {
          // ignore
        }
      }

      setIsSubmitting(false);
      setShowSubmitModal(false);
      router.push("/student/leaderboard");
    },
    [quizId, router, questions, selectedAnswers],
  );

  const finishQuiz = useCallback(async () => {
    setIsSubmitted(true);
    setShowSubmitModal(false);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(`aissa_draft_${quizId}`);
      } catch {
        // ignore
      }
    }
    const actualSeconds = startedAtMs
      ? Math.floor((Date.now() - startedAtMs) / 1000)
      : 0;
    await submitQuizResult(Math.max(0, actualSeconds));
  }, [startedAtMs, submitQuizResult, quizId]);

  useEffect(() => {
    if (!quizId || isSubmitted || loadingQuiz || windowStatus !== "active") return;
    if (Object.keys(selectedAnswers).length > 0 || Object.keys(flaggedQuestions).length > 0) {
      try {
        sessionStorage.setItem(
          `aissa_draft_${quizId}`,
          JSON.stringify({ selectedAnswers, flaggedQuestions })
        );

        let hideTimer: ReturnType<typeof setTimeout> | undefined;
        const showTimer = setTimeout(() => {
          setDraftSaved(true);
          hideTimer = setTimeout(() => setDraftSaved(false), 2000);
        }, 0);

        return () => {
          clearTimeout(showTimer);
          if (hideTimer) clearTimeout(hideTimer);
        };
      } catch {
        // ignore storage errors
      }
    }
  }, [quizId, selectedAnswers, flaggedQuestions, isSubmitted, loadingQuiz, windowStatus]);

  const handleSelectOption = useCallback(
    (i: number) => {
      if (isSubmitted) return;
      setSelectedAnswers((p) => {
        if (p[currentQuestionIndex] === i) {
          const copy = { ...p };
          delete copy[currentQuestionIndex];
          return copy;
        }
        return { ...p, [currentQuestionIndex]: i };
      });
    },
    [currentQuestionIndex, isSubmitted],
  );

  useEffect(() => {
    if (windowStatus !== "active" || isSubmitted || loadingQuiz || showSubmitModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (["1", "2", "3", "4", "5"].includes(e.key)) {
        const optIdx = parseInt(e.key, 10) - 1;
        handleSelectOption(optIdx);
      }
      if (["a", "b", "c", "d", "e"].includes(e.key.toLowerCase())) {
        const charMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4 };
        handleSelectOption(charMap[e.key.toLowerCase()]);
      }
      if (e.key === "ArrowLeft" && currentQuestionIndex > 0) {
        setCurrentQuestionIndex((prev) => prev - 1);
      }
      if (e.key === "ArrowRight" && currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex((prev) => prev + 1);
      }
      if (e.key.toLowerCase() === "f" || e.key.toLowerCase() === "m") {
        e.preventDefault();
        setFlaggedQuestions((prev) => ({
          ...prev,
          [currentQuestionIndex]: !prev[currentQuestionIndex],
        }));
      }
      if (e.key === "Escape" && showSubmitModal) {
        setShowSubmitModal(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [windowStatus, isSubmitted, loadingQuiz, showSubmitModal, currentQuestionIndex, questions.length, handleSelectOption]);

  useEffect(() => {
    if (windowStatus !== "active" || isSubmitted || loadingQuiz) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchCount((c) => {
          const next = c + 1;
          setShowTabSwitchWarning(true);
          return next;
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [windowStatus, isSubmitted, loadingQuiz]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const toggleFlag = (idx: number) => {
    if (isSubmitted) return;
    setFlaggedQuestions((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  useEffect(() => {
    if (windowStatus !== "active") return;
    if (isSubmitted || loadingQuiz || questions.length === 0) return;
    if (blockReason) return;

    if (timeLeft <= 0) {
      const t = setTimeout(() => {
        void finishQuiz();
      }, 0);
      return () => clearTimeout(t);
    }

    const interval = setInterval(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearInterval(interval);
  }, [timeLeft, isSubmitted, loadingQuiz, questions.length, finishQuiz, windowStatus, blockReason]);

  const handleManualSubmit = () => {
    setShowSubmitModal(true);
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
        <div className="max-w-md mx-auto text-center space-y-3 bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-6 sm:p-8">
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
        <div className="max-w-md mx-auto bg-white/80 backdrop-blur-md p-5 sm:p-8 rounded-2xl shadow-sm border border-amber-200/70 text-center space-y-4">
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
        <div className="max-w-md mx-auto text-center space-y-3 bg-white/80 backdrop-blur-md rounded-2xl border border-white/70 shadow-sm p-6 sm:p-8">
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
        <div className="bg-white/80 backdrop-blur-md p-5 sm:p-8 rounded-2xl shadow-sm border border-amber-200/70 text-center space-y-4">
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
          isCorrectMap={isCorrectMap}
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

  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const flaggedCount = Object.values(flaggedQuestions).filter(Boolean).length;
  const progressPct = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;
  const isCurrentFlagged = Boolean(flaggedQuestions[currentQuestionIndex]);
  const isCurrentAnswered = selectedAnswers[currentQuestionIndex] !== undefined;

  const filteredQuestionIndices = questions.map((_, idx) => idx).filter((idx) => {
    if (paletteFilter === "all") return true;
    const isAns = selectedAnswers[idx] !== undefined;
    const isFlg = Boolean(flaggedQuestions[idx]);
    if (paletteFilter === "answered") return isAns;
    if (paletteFilter === "unanswered") return !isAns;
    if (paletteFilter === "flagged") return isFlg;
    return true;
  });

  return (
    <QuizShell title={quiz.title} subject={quiz.subject} stream={quiz.stream}>
      {/* ── Tab Switch Integrity Notice — MOBILE-TIGHTENED ── */}
      {showTabSwitchWarning && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 rounded-xl p-3 sm:p-4 text-xs sm:text-sm flex items-start justify-between gap-2 sm:gap-3 shadow-sm backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex items-start gap-2 sm:gap-2.5">
            <ShieldAlert className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[11px] sm:text-sm">
                අවධානයයි: Tab Switch #{tabSwitchCount}
              </p>
              <p className="text-amber-800/80 text-[10px] sm:text-xs mt-0.5">
                තරඟයේ සාධාරණත්වය වෙනුවෙන් කරුණාකර Quiz එක අවසන් වන තෙක් මෙම තිරය තුළම රැඳී සිටින්න.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowTabSwitchWarning(false)}
            className="text-amber-700 hover:text-amber-900 text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-1 hover:bg-amber-500/10 rounded-lg transition shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* ── Top Bar: Progress, Timer & Controls — MOBILE-TIGHTENED ── */}
      <div className="bg-white/80 backdrop-blur-md p-3 sm:p-4 rounded-xl shadow-sm border border-white/70 space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="text-[11px] sm:text-sm font-bold text-gray-800">
                Q {currentQuestionIndex + 1}/{questions.length}
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                {answeredCount} ({progressPct}%)
              </span>
              {draftSaved && (
                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-600 flex items-center gap-1 animate-pulse">
                  <Check className="w-3 h-3" />
                  <span className="hidden sm:inline">Auto-saved</span>
                </span>
              )}
            </div>
            {endsIn && (
              <p className="text-[9px] sm:text-[11px] font-bold text-red-600 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                අවසන්: {endsIn}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 sm:px-3 sm:py-1.5 rounded-lg border border-gray-200 bg-white/70 hover:bg-white text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs"
              title={isFullscreen ? "Exit Fullscreen" : "Enter Focus Fullscreen"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Focus</span>
                </>
              )}
            </button>

            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg font-mono text-sm sm:text-lg font-bold shrink-0 transition-all ${
                timeLeft < 300
                  ? "bg-red-50 text-red-600 border border-red-200 shadow-sm shadow-red-100"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              <Clock className={`w-3.5 h-3.5 sm:w-5 sm:h-5 ${timeLeft < 300 ? "animate-pulse text-red-500" : ""}`} />
              <span>{formatTime(timeLeft)}</span>
            </div>
          </div>
        </div>

        <div className="w-full bg-gray-100 rounded-full h-1 sm:h-1.5 overflow-hidden">
          <div
            className="bg-linear-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] sm:text-sm p-3 sm:p-3.5 rounded-xl shadow-2xs">
          {submitError}
        </div>
      )}

      {isSubmitted ? (
        <div className="bg-white/80 backdrop-blur-md p-5 sm:p-8 rounded-xl shadow-sm border border-white/70 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <h2 className="text-base sm:text-xl font-bold text-gray-900">
            Quiz එක සාර්ථකව Submit විය!
          </h2>
          <p className="text-gray-600 text-sm">
            ලකුණු: {confirmedScore !== null ? confirmedScore : "…"} / {questions.length}
          </p>
          {isSubmitting && (
            <p className="text-xs sm:text-sm text-gray-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> ප්‍රතිඵල සුරකිමින්...
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Mobile palette — MOBILE-TIGHTENED */}
          <div className="md:hidden bg-white/80 backdrop-blur-md p-3 rounded-xl shadow-sm border border-white/70 space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="font-bold flex items-center gap-1.5 text-[11px]">
                <FileText className="w-3.5 h-3.5 text-emerald-600" /> ප්‍රශ්න
              </span>
              <span className="text-[10px] font-semibold text-gray-500">
                {answeredCount} / {questions.length}
              </span>
            </div>

            <div className="grid grid-cols-8 xs:grid-cols-10 sm:grid-cols-12 gap-1 sm:gap-1.5">
              {questions.map((_, idx) => {
                const isAnswered = selectedAnswers[idx] !== undefined;
                const isCurrent = currentQuestionIndex === idx;
                const isFlagged = Boolean(flaggedQuestions[idx]);

                let btnClass = "bg-gray-100 text-gray-600 border border-gray-200";
                if (isCurrent) {
                  btnClass = "ring-2 ring-emerald-600 ring-offset-1 bg-emerald-600 text-white font-extrabold";
                } else if (isFlagged && isAnswered) {
                  btnClass = "bg-blue-100 text-blue-900 border-2 border-amber-400 font-bold";
                } else if (isFlagged) {
                  btnClass = "bg-amber-100 text-amber-900 border border-amber-300 font-bold";
                } else if (isAnswered) {
                  btnClass = "bg-blue-100 text-blue-800 border border-blue-300 font-semibold";
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`relative w-full aspect-square rounded-md text-[10px] sm:text-xs flex items-center justify-center transition active:scale-95 ${btnClass}`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-500 rounded-full border border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-6">
            {/* ── Main Question Card — MOBILE-TIGHTENED ── */}
            <div className="md:col-span-3 bg-white/80 backdrop-blur-md p-3 sm:p-6 rounded-xl shadow-sm border border-white/70 space-y-3 sm:space-y-6">
              {/* Question Header & Action Row */}
              <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5 sm:pb-3">
                <div className="min-w-0">
                  <span className="text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 px-1.5 sm:px-2 py-0.5 rounded-md border border-emerald-200">
                    Q {currentQuestionIndex + 1}
                  </span>
                  {currentQ.topic && (
                    <span className="ml-1.5 sm:ml-2 text-[10px] sm:text-xs font-medium text-gray-400 truncate">
                      • {currentQ.topic}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleFlag(currentQuestionIndex)}
                    className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition border ${
                      isCurrentFlagged
                        ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
                        : "bg-gray-50 text-gray-600 hover:text-amber-800 hover:bg-amber-50 border-gray-200"
                    }`}
                    title="Mark for review (Shortcut: F)"
                  >
                    <Flag className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isCurrentFlagged ? "fill-amber-600 text-amber-600" : ""}`} />
                    <span className="hidden sm:inline">
                      {isCurrentFlagged ? "Flagged" : "Mark for Review"}
                    </span>
                  </button>

                  {isCurrentAnswered && (
                    <button
                      type="button"
                      onClick={() => handleSelectOption(selectedAnswers[currentQuestionIndex])}
                      className="inline-flex items-center gap-1 p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold text-gray-400 hover:text-red-600 hover:bg-red-50 transition border border-transparent hover:border-red-200"
                      title="Clear answer selection"
                    >
                      <RotateCcw className="w-3 h-3 sm:w-3" />
                      <span className="hidden sm:inline">Clear</span>
                    </button>
                  )}
                </div>
              </div>

              <h2 className="text-sm sm:text-lg font-medium text-gray-900 leading-snug sm:leading-relaxed">
                {currentQuestionIndex + 1}. {localized.question_text}
              </h2>

              {localized.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={localized.image_url}
                  alt="Question illustration"
                  className="max-h-56 sm:max-h-72 rounded-lg border border-gray-200 mx-auto object-contain"
                />
              )}

              <div className="space-y-2 sm:space-y-3">
                {currentOptions.map((option, idx) => {
                  const isSelected = selectedAnswers[currentQuestionIndex] === idx;
                  const optionLetters = ["A", "B", "C", "D", "E"];
                  return (
                    <button
                      key={idx}
                      disabled={isSubmitted}
                      onClick={() => handleSelectOption(idx)}
                      className={`group w-full text-left p-2.5 sm:p-4 rounded-xl border transition-all duration-150 text-sm sm:text-base flex items-start gap-2.5 sm:gap-3 ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-medium ring-2 ring-emerald-500/25 shadow-2xs"
                          : "border-gray-200 bg-white/60 hover:bg-emerald-50/40 text-gray-700 hover:border-emerald-300"
                      }`}
                    >
                      <span
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 border transition ${
                          isSelected
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-2xs"
                            : "bg-gray-100 text-gray-600 border-gray-200 group-hover:bg-emerald-100 group-hover:border-emerald-300 group-hover:text-emerald-800"
                        }`}
                      >
                        {isSelected ? <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : idx + 1}
                      </span>
                      <span className="flex-1 wrap-break-word">{option}</span>
                      <span className="hidden sm:inline text-[10px] font-mono text-gray-300 group-hover:text-gray-400 shrink-0">
                        [{optionLetters[idx] ?? idx + 1}]
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Navigation — MOBILE-TIGHTENED */}
              <div className="space-y-2 sm:space-y-0 sm:flex sm:items-center sm:justify-between sm:gap-2 pt-3 sm:pt-4 border-t border-gray-100">
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
                  <button
                    disabled={currentQuestionIndex === 0}
                    onClick={() => setCurrentQuestionIndex((p) => p - 1)}
                    className="justify-center flex items-center gap-1.5 px-3 sm:px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm bg-white/50 transition font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>පෙර</span>
                  </button>

                  {currentQuestionIndex < questions.length - 1 ? (
                    <button
                      onClick={() => setCurrentQuestionIndex((p) => p + 1)}
                      className="justify-center flex items-center gap-1.5 px-3 sm:px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition text-xs sm:text-sm font-bold shadow-sm"
                    >
                      <span>ඊළඟ</span>
                      <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  ) : (
                    <div />
                  )}
                </div>

                <button
                  disabled={isSubmitted || isSubmitting}
                  onClick={handleManualSubmit}
                  className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-linear-to-r from-emerald-700 to-teal-800 hover:from-emerald-800 hover:to-teal-900 text-white font-bold rounded-xl transition disabled:opacity-50 text-xs sm:text-sm shadow-md shadow-emerald-900/10"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Review & Submit</span>
                </button>
              </div>

              {/* Keyboard hints — hidden on mobile */}
              <div className="hidden sm:flex text-[11px] text-gray-400 items-center gap-3 flex-wrap pt-1">
                <span>⌨️ Shortcuts: <strong>1-5</strong> or <strong>A-E</strong> (Select)</span>
                <span>• <strong>← →</strong> (Navigate)</span>
                <span>• <strong>F</strong> (Flag for review)</span>
              </div>
            </div>

            {/* ── Desktop Question Palette Side Panel (unchanged) ── */}
            <div className="hidden md:block bg-white/80 backdrop-blur-md p-4 sm:p-5 rounded-xl shadow-sm border border-white/70 h-fit space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800 text-xs uppercase tracking-wider">
                  ප්‍රශ්න සිතියම
                </h3>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {answeredCount}/{questions.length}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100 rounded-lg text-[10px] font-bold text-gray-600">
                <button
                  type="button"
                  onClick={() => setPaletteFilter("all")}
                  className={`py-1 rounded text-center transition ${paletteFilter === "all" ? "bg-white text-emerald-800 shadow-2xs font-extrabold" : "hover:text-gray-900"}`}
                >
                  All ({questions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter("answered")}
                  className={`py-1 rounded text-center transition ${paletteFilter === "answered" ? "bg-white text-blue-700 shadow-2xs font-extrabold" : "hover:text-gray-900"}`}
                >
                  Ans ({answeredCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter("unanswered")}
                  className={`py-1 rounded text-center transition ${paletteFilter === "unanswered" ? "bg-white text-gray-900 shadow-2xs font-extrabold" : "hover:text-gray-900"}`}
                >
                  Skip ({unansweredCount})
                </button>
                <button
                  type="button"
                  onClick={() => setPaletteFilter("flagged")}
                  className={`py-1 rounded text-center transition ${paletteFilter === "flagged" ? "bg-white text-amber-800 shadow-2xs font-extrabold" : "hover:text-gray-900"}`}
                >
                  Flag ({flaggedCount})
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {questions.map((_, idx) => {
                  const isVisibleInFilter = filteredQuestionIndices.includes(idx);
                  const isAnswered = selectedAnswers[idx] !== undefined;
                  const isCurrent = currentQuestionIndex === idx;
                  const isFlagged = Boolean(flaggedQuestions[idx]);

                  let btnClass = "bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200";
                  if (isCurrent) {
                    btnClass = "ring-2 ring-emerald-600 ring-offset-2 bg-emerald-600 text-white font-extrabold shadow-sm";
                  } else if (isFlagged && isAnswered) {
                    btnClass = "bg-blue-100 text-blue-900 border-2 border-amber-400 font-bold hover:bg-blue-200";
                  } else if (isFlagged) {
                    btnClass = "bg-amber-100 text-amber-900 border border-amber-300 font-bold hover:bg-amber-200";
                  } else if (isAnswered) {
                    btnClass = "bg-blue-100 text-blue-800 border border-blue-300 font-bold hover:bg-blue-200";
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentQuestionIndex(idx)}
                      style={{ opacity: isVisibleInFilter ? 1 : 0.3 }}
                      className={`relative w-10 h-10 rounded-xl text-sm font-semibold flex items-center justify-center transition active:scale-95 ${btnClass}`}
                    >
                      {idx + 1}
                      {isFlagged && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border border-white" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-3 border-t text-xs space-y-1.5 text-gray-500 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-blue-100 border border-blue-300 rounded" />
                  <span>පිළිතුරු දුන් ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-amber-100 border border-amber-300 rounded" />
                  <span>සලකුණු කළ / Review ({flaggedCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-gray-100 border border-gray-200 rounded" />
                  <span>නොකළ ප්‍රශ්න ({unansweredCount})</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Pre-Submission Confirmation Modal — MOBILE-TIGHTENED ── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-emerald-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-gray-100 p-4 sm:p-6 space-y-4 sm:space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                  Quiz එක Submit කිරීමට පෙර
                </h3>
                <p className="text-[11px] sm:text-xs text-gray-500 mt-1">
                  Submit කිරීමෙන් පසු පිළිතුරු වෙනස් කළ නොහැක.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
              <div className="p-2 sm:p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-[9px] sm:text-[10px] font-bold text-emerald-700 uppercase leading-tight">
                  දුන්
                </p>
                <p className="text-lg sm:text-xl font-extrabold text-emerald-900 mt-0.5 leading-none">
                  {answeredCount}
                </p>
                <p className="text-[8px] sm:text-[9px] text-emerald-600 leading-none mt-0.5">
                  /{questions.length}
                </p>
              </div>
              <div className={`p-2 sm:p-3 rounded-xl border ${unansweredCount > 0 ? "bg-red-50 border-red-200 text-red-900" : "bg-gray-50 border-gray-200 text-gray-700"}`}>
                <p className={`text-[9px] sm:text-[10px] font-bold uppercase leading-tight ${unansweredCount > 0 ? "text-red-700" : "text-gray-500"}`}>
                  නොකළ
                </p>
                <p className={`text-lg sm:text-xl font-extrabold mt-0.5 leading-none ${unansweredCount > 0 ? "text-red-700" : "text-gray-700"}`}>
                  {unansweredCount}
                </p>
                <p className="text-[8px] sm:text-[9px] opacity-75 leading-none mt-0.5">
                  /{questions.length}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-[9px] sm:text-[10px] font-bold text-amber-700 uppercase leading-tight">
                  Flagged
                </p>
                <p className="text-lg sm:text-xl font-extrabold text-amber-900 mt-0.5 leading-none">
                  {flaggedCount}
                </p>
                <p className="text-[8px] sm:text-[9px] text-amber-600 leading-none mt-0.5">
                  Review
                </p>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="p-2.5 sm:p-3 bg-red-50 border border-red-200 rounded-xl text-[11px] sm:text-xs text-red-800 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>
                  ඔබ තවමත් <strong>ප්‍රශ්න {unansweredCount}</strong>කට පිළිතුරු සපයා නැත!
                </span>
              </div>
            )}

            <div className="space-y-2">
              {unansweredCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const firstUnanswered = questions.findIndex((_, idx) => selectedAnswers[idx] === undefined);
                    if (firstUnanswered !== -1) setCurrentQuestionIndex(firstUnanswered);
                    setShowSubmitModal(false);
                  }}
                  className="w-full py-2.5 px-3 sm:px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 text-[11px] sm:text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <HelpCircle className="w-4 h-4 text-gray-500 shrink-0" />
                  නොකළ ප්‍රශ්න වෙත යන්න
                </button>
              )}

              {flaggedCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const firstFlagged = questions.findIndex((_, idx) => Boolean(flaggedQuestions[idx]));
                    if (firstFlagged !== -1) setCurrentQuestionIndex(firstFlagged);
                    setShowSubmitModal(false);
                  }}
                  className="w-full py-2.5 px-3 sm:px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] sm:text-xs font-bold rounded-xl border border-amber-200 transition flex items-center justify-center gap-2"
                >
                  <Flag className="w-4 h-4 text-amber-600 shrink-0" />
                  සලකුණු කළ ප්‍රශ්න වෙත යන්න
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-[11px] sm:text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void finishQuiz()}
                className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] sm:text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                තහවුරු කර Submit
              </button>
            </div>
          </div>
        </div>
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
// QuizShell — MOBILE-TIGHTENED
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
        <div className="max-w-4xl mx-auto space-y-3 sm:space-y-6">
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-black text-white shadow-xl shadow-black/40 border border-slate-700/50">
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
            <div className="pointer-events-none absolute top-1/2 -right-24 w-72 h-72 rounded-full border-[1.5px] border-teal-400/10 hidden md:block" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-tr from-transparent via-white/3 to-white/5" />

            <div className="relative p-3.5 sm:p-6 md:p-7 flex items-start sm:items-center gap-3 sm:gap-5">
              <div className="shrink-0">
                <div className="relative">
                  <div className="absolute inset-0 bg-teal-400/25 blur-2xl rounded-full scale-110" />
                  <div className="relative w-12 h-12 sm:w-24 sm:h-24 flex items-center justify-center">
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
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1 sm:mb-2">
                  <span
                    className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border ${subjectBadgeStyle(
                      subject,
                    )}`}
                  >
                    {subject}
                  </span>
                  {stream && (
                    <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 bg-teal-500/15 backdrop-blur-sm rounded-full text-[9px] sm:text-xs font-bold uppercase tracking-wider border border-teal-400/30 text-teal-200">
                      {stream}
                    </span>
                  )}
                </div>
                <h1 className="text-sm sm:text-xl md:text-2xl font-extrabold leading-snug tracking-tight wrap-break-word">
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
// Review mode — MOBILE-TIGHTENED
// ---------------------------------------------------------------------------
function ReviewMode({
  questions,
  medium,
  myResult,
  myAnswers,
  isCorrectMap,
  reviewIndex,
  setReviewIndex,
  onBack,
}: {
  quiz: Quiz;
  questions: Question[];
  medium: Medium;
  myResult: StudentResult | null;
  myAnswers: MyAnswersMap;
  isCorrectMap: Record<string, boolean>;
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
    <div className="space-y-3 sm:space-y-4">
      {/* Review header */}
      <div className="bg-white/80 backdrop-blur-md p-3 sm:p-5 rounded-xl shadow-sm border border-emerald-200/70 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Eye className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-gray-900 text-sm sm:text-base">
              Review Mode
            </h2>
            <p className="text-[10px] sm:text-xs text-gray-500">
              නිවැරදි පිළිතුරු සහ විස්තර
            </p>
          </div>
        </div>

        {myResult ? (
          <div className="flex items-center gap-2 sm:gap-3 bg-emerald-50 border border-emerald-200 px-3 sm:px-4 py-1.5 sm:py-2.5 rounded-xl self-start sm:self-auto">
            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-700 leading-tight">
                ලකුණු
              </p>
              <p className="font-extrabold text-emerald-900 text-sm sm:text-lg leading-none">
                {myResult.score} / {myResult.total_marks}
              </p>
            </div>
          </div>
        ) : (
          <span className="text-[10px] sm:text-xs font-semibold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg self-start sm:self-auto">
            සහභාගී වී නැත
          </span>
        )}
      </div>

      {/* Mobile palette — tighter */}
      <div className="md:hidden bg-white/80 backdrop-blur-md p-2.5 sm:p-3 rounded-xl shadow-sm border border-white/70">
        <div className="grid grid-cols-8 xs:grid-cols-10 sm:grid-cols-12 gap-1 sm:gap-1.5">
          {questions.map((question, idx) => {
            const isCurrent = reviewIndex === idx;
            const sel = myAnswers[question.id];
            const answered = sel !== undefined && sel !== null;
            const correct = answered && isCorrectMap[question.id] === true;
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
                className={`w-full aspect-square rounded-md text-[10px] sm:text-xs font-semibold flex items-center justify-center transition ${
                  isCurrent ? "ring-2 ring-emerald-600 bg-emerald-600 text-white" : colorCls
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-6">
        <div className="md:col-span-3 bg-white/80 backdrop-blur-md p-3 sm:p-6 rounded-xl shadow-sm border border-white/70 space-y-3 sm:space-y-6">
          <h2 className="text-sm sm:text-lg font-medium text-gray-900 leading-snug sm:leading-relaxed">
            {reviewIndex + 1}. {localized.question_text}
          </h2>

          {localized.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={localized.image_url}
              alt="Question illustration"
              loading="lazy"
              decoding="async"
              className="max-h-56 sm:max-h-72 rounded-lg border border-gray-200 mx-auto"
              onError={(e) => {
                const el = e.target as HTMLImageElement;
                el.onerror = null;
                el.style.display = "none";
              }}
            />
          )}

          {!studentAnswered && myResult && (
            <div className="text-[10px] sm:text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-gray-400 shrink-0" />
              ඔබ මෙම ප්‍රශ්නයට පිළිතුරු දී නැත.
            </div>
          )}

          <div className="space-y-1.5 sm:space-y-2">
            {optionsList.map((opt, idx) => {
              const studentPicked = studentAnswered && studentSel === idx;
              const hasAnswerKey = typeof q.correct_option === "number";

              const isCorrectOption = hasAnswerKey
                ? q.correct_option === idx
                : studentPicked && isCorrectMap[q.id] === true;

              const isWrongPick = hasAnswerKey
                ? studentPicked && !isCorrectOption
                : studentPicked && isCorrectMap[q.id] === false;

              let cardCls = "bg-white/60 border-gray-200 text-gray-700";
              if (isCorrectOption)
                cardCls =
                  "bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold ring-1 ring-emerald-400/25";
              else if (isWrongPick)
                cardCls =
                  "bg-red-50 border-red-400 text-red-900 font-semibold ring-1 ring-red-400/25";

              let badgeCls = "bg-gray-200 text-gray-700";
              if (isCorrectOption) badgeCls = "bg-emerald-600 text-white";
              else if (isWrongPick) badgeCls = "bg-red-600 text-white";

              let label: React.ReactNode = null;
              if (isCorrectOption && studentPicked) {
                label = (
                  <span className="hidden sm:inline px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded shrink-0">
                    Your Answer ✓
                  </span>
                );
              } else if (isCorrectOption) {
                label = (
                  <span className="hidden sm:inline px-2 py-0.5 bg-emerald-200 text-emerald-900 text-[10px] font-bold rounded shrink-0">
                    Correct
                  </span>
                );
              } else if (isWrongPick) {
                label = (
                  <span className="hidden sm:inline px-2 py-0.5 bg-red-200 text-red-900 text-[10px] font-bold rounded shrink-0">
                    Your Answer ✗
                  </span>
                );
              }

              let badgeIcon: React.ReactNode;
              if (isCorrectOption) badgeIcon = <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />;
              else if (isWrongPick) badgeIcon = <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />;
              else badgeIcon = idx + 1;

              return (
                <div
                  key={idx}
                  className={`p-2.5 sm:p-3.5 rounded-lg border flex items-start gap-2 sm:gap-3 text-xs sm:text-sm transition ${cardCls}`}
                >
                  <span
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold shrink-0 mt-0.5 ${badgeCls}`}
                  >
                    {badgeIcon}
                  </span>
                  <span className="flex-1 wrap-break-word">{opt}</span>
                  {label}
                </div>
              );
            })}
          </div>

          {(localized.explanation || localized.explanation_image_url) && (
            <div className="p-2.5 sm:p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 sm:space-y-3">
              {localized.explanation && (
                <div>
                  <p className="font-bold text-amber-950 text-[11px] sm:text-sm mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 shrink-0" />
                    Explanation
                  </p>
                  <p className="text-[11px] sm:text-sm text-amber-900 leading-snug sm:leading-relaxed">
                    {localized.explanation}
                  </p>
                </div>
              )}

              {localized.explanation_image_url && (
                <div className={localized.explanation ? "pt-1 border-t border-amber-200/60" : ""}>
                  <p className="font-bold text-amber-950 text-[9px] sm:text-xs mb-2 flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 shrink-0" />
                    Diagram
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={localized.explanation_image_url}
                    alt="Explanation illustration"
                    loading="lazy"
                    decoding="async"
                    className="max-h-56 sm:max-h-96 rounded-lg border border-amber-200 bg-white mx-auto object-contain"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement;
                      el.onerror = null;
                      el.style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-3 sm:pt-4 border-t border-gray-100">
            <button
              disabled={reviewIndex === 0}
              onClick={() => setReviewIndex(reviewIndex - 1)}
              className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 sm:px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm bg-white/50 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> පෙර
            </button>

            {reviewIndex < questions.length - 1 ? (
              <button
                onClick={() => setReviewIndex(reviewIndex + 1)}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 sm:px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition text-xs sm:text-sm shadow-sm"
              >
                ඊළඟ <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            ) : (
              <button
                onClick={onBack}
                className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3 sm:px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition text-xs sm:text-sm shadow-sm"
              >
                Dashboard <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
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
              const correct = answered && isCorrectMap[question.id] === true;
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