import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type AnswerInput = {
  question_id: string;
  selected_option: number | null;
};

export async function POST(req: Request) {
  try {
    // ── Auth gate ──
    const cookieStore = await cookies();
    const anonClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() { /* Route Handlers cannot set cookies */ },
        },
      },
    );

    const { data: { user } } = await anonClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { quiz_id, answers, time_spent_seconds } = body as {
      quiz_id?: string;
      answers?: AnswerInput[];
      time_spent_seconds?: number;
    };

    if (!quiz_id || !Array.isArray(answers)) {
      return NextResponse.json({ error: "Missing quiz_id or answers" }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!url || !serviceKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });

    // ── Prevent double-submission ──
    const { data: existing } = await adminClient
      .from("quiz_results")
      .select("id, score, total_marks")
      .eq("student_id", user.id)
      .eq("quiz_id", quiz_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { already_submitted: true, score: existing.score, total_marks: existing.total_marks },
        { status: 200 },
      );
    }

    // ── Fetch answer key server-side ──
    const questionIds = answers.map((a) => a.question_id);

    const { data: questionRows, error: qErr } = await adminClient
      .from("questions")
      .select("id, correct_option")
      .in("id", questionIds);

    if (qErr || !questionRows) {
      console.error("[api/grade] Question fetch error:", qErr);
      return NextResponse.json({ error: "Grading failed" }, { status: 500 });
    }

    // Build a map: question_id → correct_option
    const answerKey = new Map<string, number>(
      (questionRows as { id: string; correct_option: number }[]).map((q) => [
        q.id,
        q.correct_option,
      ]),
    );

    // ── Grade on the server ──
    let score = 0;
    const answerRows = answers.map((a) => {
      const correctOption = answerKey.get(a.question_id);
      const isCorrect =
        a.selected_option !== null &&
        a.selected_option !== undefined &&
        correctOption !== undefined &&
        a.selected_option === correctOption;
      if (isCorrect) score++;
      return {
        student_id: user.id,
        quiz_id,
        question_id: a.question_id,
        selected_option: a.selected_option,
        is_correct: isCorrect,
      };
    });

    const totalMarks = answers.length;
    const timeSpent = Math.max(0, Math.floor(Number(time_spent_seconds) || 0));

    // ── Persist result ──
    const { data: resultRow, error: resultErr } = await adminClient
      .from("quiz_results")
      .insert([
        {
          student_id: user.id,
          quiz_id,
          score,
          total_marks: totalMarks,
          time_spent_seconds: timeSpent,
        },
      ])
      .select("id")
      .single();

    if (resultErr || !resultRow) {
      console.error("[api/grade] Result insert error:", resultErr);
      return NextResponse.json({ error: "Could not save result" }, { status: 500 });
    }

    // ── Persist individual answers ──
    const answersWithResultId = answerRows.map((a) => ({
      ...a,
      result_id: resultRow.id,
    }));

    if (answersWithResultId.length > 0) {
      const { error: answersErr } = await adminClient
        .from("quiz_answers")
        .insert(answersWithResultId);

      if (answersErr) {
        console.error("[api/grade] Answers insert error:", answersErr);
        // Non-fatal: result was saved, answers failed.
      }
    }

    return NextResponse.json({ score, total_marks: totalMarks });
  } catch (err) {
    console.error("[api/grade] Unexpected error:", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
