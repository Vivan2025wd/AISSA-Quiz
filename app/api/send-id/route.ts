import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // ─────────────────────────────────────────────────────────────
    // Auth gate: only an authenticated user who JUST registered
    // should be calling this.  This prevents unauthenticated
    // actors from spamming the endpoint to send arbitrary emails.
    // ─────────────────────────────────────────────────────────────
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { email, fullName, aisId } = body as {
      email?: string;
      fullName?: string;
      aisId?: string;
    };

    // ── Validate: the email in the request MUST match the
    //    authenticated user's email — no sending to third parties.
    if (!email || !aisId) {
      return NextResponse.json(
        { error: "Missing email or aisId" },
        { status: 400 },
      );
    }

    if (email.toLowerCase().trim() !== user.email?.toLowerCase().trim()) {
      return NextResponse.json(
        { error: "Forbidden: email mismatch" },
        { status: 403 },
      );
    }

    const apiKey = process.env.BREVO_API_KEY;
    const fromEmail =
      process.env.AISSA_FROM_EMAIL ?? "AISSA Quiz <vivanrakmitha5@gmail.com>";

    if (!apiKey) {
      console.error("[send-id] BREVO_API_KEY missing");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 },
      );
    }

    // Parse "Name <email>" format
    const match = fromEmail.match(/^(.+?)\s*<(.+?)>$/);
    const senderName = match?.[1]?.trim() ?? "AISSA Quiz";
    const senderEmail = match?.[2]?.trim() ?? fromEmail;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? "https://aissa-quiz.vercel.app";

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: senderName, email: senderEmail },
        to: [{ email, name: fullName || "Student" }],
        subject: "Your AISSA Quiz ID",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #059669; font-size: 24px;">Hello, ${fullName || "Student"}! 👋</h1>
            <p style="color: #333; font-size: 16px; line-height: 1.6;">
              You have successfully registered on the AISSA Quiz Platform.
            </p>
            <div style="background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
              <p style="color: #047857; font-size: 14px; font-weight: bold; margin: 0 0 8px 0; text-transform: uppercase;">
                Your AISSA Quiz ID
              </p>
              <p style="color: #064e3b; font-size: 24px; font-weight: bold; margin: 0; font-family: monospace; letter-spacing: 2px;">
                ${aisId}
              </p>
            </div>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              You do not need this ID to log in, but please keep it safe for future reference.
            </p>
            <p style="color: #666; font-size: 14px; line-height: 1.6;">
              <a href="${appUrl}/auth/login" 
                 style="display: inline-block; background: #059669; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 12px;">
                Log in →
              </a>
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
            <p style="color: #999; font-size: 12px; text-align: center;">
              AISSA Quiz Platform — All Island School Science Association
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[send-id] Brevo error:", res.status, errBody);
      // Do not forward third-party error body to clients.
      return NextResponse.json(
        { error: "Email send failed" },
        { status: 500 },
      );
    }

    const data = await res.json();
    console.log("[send-id] ✅ Email sent to:", email, "| id:", data?.messageId);
    return NextResponse.json({ success: true, id: data?.messageId });
  } catch (err) {
    console.error("[send-id] Unexpected error:", err);
    return NextResponse.json(
      { error: "Unexpected error" },
      { status: 500 },
    );
  }
}