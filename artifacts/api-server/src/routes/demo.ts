import { Router } from "express";
import { z } from "zod/v4";
import { supabase } from "../lib/supabase.js";
import { requireSuperAdmin } from "./super-admin.js";
import { sendEmail, wrapHtml } from "../lib/email.js";

const router = Router();

const RegisterBody = z.object({
  sessionId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().min(1),
  phone: z.string().min(1),
});

const ProgressBody = z.object({
  sessionId: z.string().min(1),
  stageReached: z.string().min(1),
  completed: z.boolean().optional(),
});

// POST /api/demo/register — called at the start of a demo session
router.post("/demo/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid request" });

  const { sessionId, firstName, lastName, email, phone } = parsed.data;

  console.log(`[demo] register: ${firstName} ${lastName} <${email}> ${phone} session=${sessionId}`);

  const { error } = await supabase.from("demo_sessions").upsert({
    session_id: sessionId,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
  }, { onConflict: "session_id" });

  if (error) {
    console.error("[demo] register DB error:", error.code, error.message, error.hint ?? "");
    return void res.status(500).json({ error: "Failed to save session", detail: error.message });
  }

  console.log(`[demo] register OK: session=${sessionId}`);
  res.json({ ok: true, sessionId });
});

// POST /api/demo/progress — update which scene the prospect reached
router.post("/demo/progress", async (req, res) => {
  const parsed = ProgressBody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid request" });

  const { sessionId, stageReached, completed } = parsed.data;

  const update: Record<string, unknown> = { stage_reached: stageReached };
  if (completed) {
    update.completed = true;
    update.completed_at = new Date().toISOString();
  }

  await supabase.from("demo_sessions").update(update).eq("session_id", sessionId);
  res.json({ ok: true });
});

const CTABody = z.object({
  sessionId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  action: z.enum(["conversation", "proposal"]),
});

// POST /api/demo/cta — prospect clicked "Start a conversation" or "Get a proposal"
router.post("/demo/cta", async (req, res) => {
  const parsed = CTABody.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: "Invalid request" });

  const { sessionId, firstName, lastName, email, phone, action } = parsed.data;
  const fromEmail = `ERA Systems <${process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev"}>`;
  const adminEmail = process.env.DEMO_ADMIN_EMAIL ?? "chideraumeh25@gmail.com";
  const actionLabel = action === "conversation" ? "Start a conversation" : "Get a proposal";

  // Update Supabase
  void supabase.from("demo_sessions")
    .update({ cta_action: action, cta_at: new Date().toISOString() })
    .eq("session_id", sessionId);

  // Email the prospect
  const prospectBody = `
    <p style="font-size:16px;font-weight:600;color:#e6edf3;margin:0 0 12px">
      ${action === "conversation" ? `We'll be in touch, ${firstName}!` : `Proposal request received, ${firstName}!`}
    </p>
    <p style="font-size:14px;color:#c9d1d9;line-height:1.7;margin:0 0 16px">
      ${action === "conversation"
        ? `Thank you for completing the ERA Patient demo. Our team will reach out to <strong style="color:#e6edf3">${email}</strong> shortly to start the conversation.`
        : `Thank you for completing the ERA Patient demo. We'll put together a personalised proposal for your clinic and send it to <strong style="color:#e6edf3">${email}</strong>.`}
    </p>
    <p style="font-size:13px;color:#8b949e;margin:0">In the meantime, reply to this email if you have any questions.</p>
  `;

  // Email the admin (you)
  const adminBody = `
    <p style="font-size:16px;font-weight:600;color:#e6edf3;margin:0 0 12px">New demo lead — ${actionLabel}</p>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tr><td style="padding:5px 0;color:#8b949e;width:120px">Name</td><td style="padding:5px 0;color:#e6edf3;font-weight:600">${firstName} ${lastName}</td></tr>
      <tr><td style="padding:5px 0;color:#8b949e">Email</td><td style="padding:5px 0;color:#e6edf3">${email}</td></tr>
      <tr><td style="padding:5px 0;color:#8b949e">Phone</td><td style="padding:5px 0;color:#e6edf3">${phone}</td></tr>
      <tr><td style="padding:5px 0;color:#8b949e">Action</td><td style="padding:5px 0;color:#14b8a6;font-weight:600">${actionLabel}</td></tr>
    </table>
  `;

  try {
    await Promise.all([
      sendEmail({
        to: email,
        from: fromEmail,
        subject: action === "conversation" ? "We'll be in touch — ERA Patient" : "Your ERA Patient proposal is coming",
        html: wrapHtml(prospectBody, "ERA Systems"),
        text: `${action === "conversation" ? `Hi ${firstName}, we'll reach out to ${email} shortly.` : `Hi ${firstName}, your proposal is on its way to ${email}.`}`,
      }),
      sendEmail({
        to: adminEmail,
        from: fromEmail,
        subject: `Demo lead: ${firstName} ${lastName} — ${actionLabel}`,
        html: wrapHtml(adminBody, "ERA Systems"),
        text: `New lead: ${firstName} ${lastName} | ${email} | ${phone} | ${actionLabel}`,
      }),
    ]);
  } catch (err) {
    console.error("[demo/cta] email error:", (err as Error).message);
  }

  res.json({ ok: true });
});

// GET /api/demo/sessions — super-admin only, list all demo prospects
router.get("/demo/sessions", requireSuperAdmin, async (_req, res) => {
  const { data, error } = await supabase
    .from("demo_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(500);

  if (error) return void res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

export default router;
