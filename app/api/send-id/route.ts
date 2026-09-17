// app/api/send-id/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export const runtime = "nodejs"; // required for Resend's Node SDK

const resend = new Resend(process.env.RESEND_API_KEY);

const NON_AISSA_REGEX =
  /^N(\d{2})([A-Z]{2,6})(\d{3})-([A-Z0-9]{2,6})-([A-Z]{2,4})$/;

interface SendIdPayload {
  email: string;
  fullName: string;
  aisId: string;
}

function buildHtml(fullName: string, aisId: string): string {
  return `
  <!DOCTYPE html>
  <html>
    <head><meta charset="utf-8" /></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:Inter,Arial,sans-serif;">
      <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#1e293b;padding:24px 32px;color:#ffffff;">
          <p style="margin:0;font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:.7;">All Island School Science Association</p>
          <h1 style="margin:6px 0 0;font-size:22px;font-weight:800;">AISSA Quiz Platform</h1>
        </div>
        <div style="padding:28px 32px;color:#111827;">
          <p style="font-size:15px;margin:0 0 12px;">Hi <strong>${fullName}</strong>,</p>
          <p style="font-size:14px;line-height:1.6;margin:0 0 20px;color:#374151;">
            Welcome to the AISSA Quiz platform! Since you registered without an existing
            AISSA Member ID, we have generated an official Quiz ID for you.
          </p>
          <div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:18px;text-align:center;">
            <p style="margin:0;font-size:11px;letter-spacing:1.5px;color:#4f46e5;font-weight:700;text-transform:uppercase;">Your Official Quiz ID</p>
            <p style="margin:8px 0 0;font-size:22px;font-weight:800;font-family:'Courier New',monospace;color:#1e1b4b;word-break:break-all;">${aisId}</p>
          </div>
          <p style="font-size:13px;line-height:1.6;margin:20px 0 0;color:#4b5563;">
            Use this ID for all future AISSA competitions and quiz rankings.
            Keep it safe — it is unique to you.
          </p>
          <p style="font-size:12px;margin:24px 0 0;color:#9ca3af;">
            If you did not register for the AISSA Quiz platform, please ignore this email.
          </p>
        </div>
        <div style="background:#f9fafb;padding:16px 32px;text-align:center;color:#9ca3af;font-size:11px;">
          © ${new Date().getFullYear()} AISSA — All Island School Science Association
        </div>
      </div>
    </body>
  </html>`;
}

function buildText(fullName: string, aisId: string): string {
  return [
    `Hi ${fullName},`,
    ``,
    `Welcome to the AISSA Quiz platform!`,
    ``,
    `Your official Quiz ID: ${aisId}`,
    ``,
    `Use this ID for all future AISSA competitions and quiz rankings.`,
    ``,
    `— AISSA Team`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  // ---- 1. Parse body ------------------------------------------------------
  let body: SendIdPayload;
  try {
    body = (await req.json()) as SendIdPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { email, fullName, aisId } = body ?? ({} as SendIdPayload);

  // ---- 2. Validate --------------------------------------------------------
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!fullName || typeof fullName !== "string") {
    return NextResponse.json({ error: "Invalid full name" }, { status: 400 });
  }
  if (!aisId || !NON_AISSA_REGEX.test(aisId)) {
    // Only accept Non-AISSA (N-prefixed) IDs — AISSA members don't get an email.
    return NextResponse.json(
      { error: "Invalid Non-AISSA Quiz ID" },
      { status: 400 },
    );
  }
  if (!process.env.RESEND_API_KEY) {
    console.error("RESEND_API_KEY is not configured");
    return NextResponse.json(
      { error: "Email service not configured" },
      { status: 500 },
    );
  }

  // ---- 3. Send via Resend -------------------------------------------------
  try {
    const { error: sendError } = await resend.emails.send({
      from:
        process.env.AISSA_FROM_EMAIL ??
        "AISSA Quiz <onboarding@resend.dev>",
      to: email,
      subject: `Your AISSA Quiz ID: ${aisId}`,
      html: buildHtml(fullName, aisId),
      text: buildText(fullName, aisId),
    });

    if (sendError) {
      console.error("Resend send error:", sendError);
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Unexpected /api/send-id error:", err);
    return NextResponse.json(
      { error: "Unexpected error sending email" },
      { status: 500 },
    );
  }
}