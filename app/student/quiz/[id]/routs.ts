import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client (service role — never exposed to browser)
const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

export const revalidate = 60;

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const quizId = params.id;

  if (!quizId) {
    return NextResponse.json({ error: "Missing quiz id" }, { status: 400 });
  }

  const [quizRes, questionsRes] = await Promise.all([
    adminClient
      .from("quizzes")
      .select("id, title, subject, stream, duration_minutes, scheduled_at")
      .eq("id", quizId)
      .maybeSingle(),
    adminClient
      .from("questions")
      .select(
        `id, quiz_id, question_text, image_url, correct_option, topic,
         option_1, option_2, option_3, option_4, option_5, explanation,
         question_text_en, option_1_en, option_2_en, option_3_en, option_4_en, option_5_en, explanation_en,
         question_text_ta, option_1_ta, option_2_ta, option_3_ta, option_4_ta, option_5_ta, explanation_ta,
         created_at`,
      )
      .eq("quiz_id", quizId)
      .order("created_at", { ascending: true }),
  ]);

  if (quizRes.error || !quizRes.data) {
    return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      quiz: quizRes.data,
      questions: questionsRes.data ?? [],
    },
    {
      headers: {
        // 60s CDN cache + 5min stale-while-revalidate
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}