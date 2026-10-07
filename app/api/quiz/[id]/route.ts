import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Do NOT use ISR revalidate — this route is now auth-gated (private).
export const dynamic = "force-dynamic";

// ─── Types ───
type QuizRow = {
  id: string;
  title: string;
  subject: string;
  stream: string | null;
  duration_minutes: number;
  scheduled_at: string | null;
};

type QuestionRow = {
  id: string;
  quiz_id: string | null;
  question_text: string;
  image_url: string | null;
  // ✱ shared explanation diagram (language-agnostic)
  explanation_image_url?: string | null;
  correct_option: number; // stripped before response unless reveal is allowed
  topic: string | null;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  option_5: string | null;
  explanation: string | null;
  created_at?: string;
  // optional multilingual
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

/**
 * What actually goes over the wire.
 *   • `correct_option` is optional — present only when the server
 *     has decided the answer key can be revealed to this caller
 *     (quiz window closed OR the student already submitted).
 *   • While the exam is still live and unsent, the field is absent
 *     and the client cannot reconstruct the answer key.
 */
type PublicQuestionRow = Omit<QuestionRow, "correct_option"> & {
  correct_option?: number;
};

type QuizQuestionLink = {
  order_index: number;
  questions: QuestionRow | QuestionRow[] | null;
};

/**
 * Removes `correct_option` from a question row, unless `reveal` is
 * true — in which case the answer key is passed through.
 *
 * Using a helper (rather than an inline destructure) keeps the
 * mapping code below readable and gives us one place to reason
 * about the reveal rule.
 */
function toPublicQuestion(
  row: QuestionRow,
  reveal: boolean,
): PublicQuestionRow {
  const { correct_option, ...rest } = row;
  return reveal ? { ...rest, correct_option } : rest;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: quizId } = await params;

  if (!quizId) {
    return NextResponse.json({ error: "Missing quiz id" }, { status: 400 });
  }

  // ─────────────────────────────────────────────────────────────
  // Auth gate: only authenticated users may fetch quiz data.
  // We read the session from cookies (SSR client) so the check
  // is server-side and cannot be bypassed from the browser.
  // ─────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Route Handlers cannot set cookies; this is intentional.
        },
      },
    },
  );

  const {
    data: { user },
  } = await anonClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ─── Service-role client for DB queries ───
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  // ── Quiz + questions + prior attempt (all in parallel) ──
  const [quizRes, quizQuestionsRes, directQuestionsRes, existingResultRes] =
    await Promise.all([
      adminClient
        .from("quizzes")
        .select("id, title, subject, stream, duration_minutes, scheduled_at")
        .eq("id", quizId)
        .maybeSingle(),

      // ක්‍රමය 1: quiz_questions link table
      adminClient
        .from("quiz_questions")
        .select("order_index, questions(*)")
        .eq("quiz_id", quizId)
        .order("order_index", { ascending: true }),

      // ක්‍රමය 2: direct questions.quiz_id
      adminClient
        .from("questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("created_at", { ascending: true }),

      // Has this student already submitted? — decides answer-key reveal.
      adminClient
        .from("quiz_results")
        .select("id")
        .eq("student_id", user.id)
        .eq("quiz_id", quizId)
        .maybeSingle(),
    ]);

  if (quizRes.error) {
    console.error("[api/quiz] Quiz query error:", quizRes.error);
    // Do NOT forward internal DB error details to the client.
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }

  if (!quizRes.data) {
    return NextResponse.json({ error: "Quiz not found", id: quizId }, { status: 404 });
  }

  const quiz = quizRes.data as QuizRow;

  // ── Questions merge කරන්න ──
  let rawQuestions: QuestionRow[] = [];
  let source: "quiz_questions" | "direct" | "none" = "none";

  if (
    !quizQuestionsRes.error &&
    Array.isArray(quizQuestionsRes.data) &&
    quizQuestionsRes.data.length > 0
  ) {
    const links = quizQuestionsRes.data as QuizQuestionLink[];
    rawQuestions = links
      .map((row) => {
        const q = row.questions;
        if (!q) return null;
        return Array.isArray(q) ? q[0] : q;
      })
      .filter((q): q is QuestionRow => q !== null && q !== undefined);
    source = "quiz_questions";
  } else if (
    !directQuestionsRes.error &&
    Array.isArray(directQuestionsRes.data) &&
    directQuestionsRes.data.length > 0
  ) {
    rawQuestions = directQuestionsRes.data as QuestionRow[];
    source = "direct";
  }

  // ─────────────────────────────────────────────────────────────
  // Decide whether to reveal `correct_option` to this caller.
  //
  // We reveal it if EITHER:
  //   • The quiz window has already closed, OR
  //   • This student has already submitted their attempt.
  //
  // This preserves exam integrity (no answer key while the window
  // is open and the student hasn't submitted) while enabling full
  // colour-coded review afterwards.
  // ─────────────────────────────────────────────────────────────
  const endsAtMs = quiz.scheduled_at
    ? new Date(quiz.scheduled_at).getTime() +
      (quiz.duration_minutes || 30) * 60 * 1000
    : null;

  const windowExpired = endsAtMs !== null && Date.now() > endsAtMs;
  const hasSubmitted =
    !existingResultRes.error && !!existingResultRes.data;
  const canRevealAnswerKey = windowExpired || hasSubmitted;

  console.log(
    "[api/quiz] ✅ Success:",
    quiz.title,
    "|",
    rawQuestions.length,
    "questions | source:",
    source,
    "| reveal answer key:",
    canRevealAnswerKey,
    `(windowExpired=${windowExpired}, hasSubmitted=${hasSubmitted})`,
  );

  // ─────────────────────────────────────────────────────────────
  // Build the public payload.
  // The answer key only ships when the server has decided it's
  // safe — see `canRevealAnswerKey` above.
  // ─────────────────────────────────────────────────────────────
  const publicQuestions: PublicQuestionRow[] = rawQuestions.map((row) =>
    toPublicQuestion(row, canRevealAnswerKey),
  );

  return NextResponse.json(
    {
      quiz,
      questions: publicQuestions,
      answerKeyRevealed: canRevealAnswerKey,
    },
    {
      headers: {
        // Must not be cached by CDNs — this response is auth-scoped.
        "Cache-Control": "private, no-store",
      },
    },
  );
}