import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";
import { requireSuperAdmin } from "./super-admin.js";
import { sendEmail, wrapHtml } from "../lib/email.js";
import { runSupportAI, runTicketAnalysis, type SupportMessage, type AccountContext } from "../lib/support-ai.js";

const router: IRouter = Router();

const TicketBody = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
});

const MessageBody = z.object({
  message: z.string().min(1).max(2000),
});

const ReplyBody = z.object({
  message: z.string().min(1).max(2000),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getThreadMessages(ticketId: number): Promise<SupportMessage[]> {
  const { data } = await supabase
    .from("support_messages")
    .select("sender, message")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  return (data ?? []) as SupportMessage[];
}

async function appendMessage(ticketId: number, sender: "hospital" | "ai" | "admin", message: string) {
  await supabase.from("support_messages").insert({ ticket_id: ticketId, sender, message });
}

async function notifyAdminEscalation(ticket: { id: number; hospital_name: string; subject: string }, reason: string) {
  const notifyEmail = process.env.SUPPORT_EMAIL;
  if (!notifyEmail) return;
  const from = process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev";
  const body = `
    <p style="font-size:16px;font-weight:600;color:#e6edf3;margin:0 0 6px">Support Ticket Escalated</p>
    <p style="color:#8b949e;font-size:14px;margin:0 0 16px">From <strong style="color:#c9d1d9">${ticket.hospital_name}</strong></p>
    <p style="color:#8b949e;font-size:13px;margin:0 0 4px">Subject</p>
    <p style="color:#e6edf3;font-size:15px;margin:0 0 16px">${ticket.subject}</p>
    <p style="color:#8b949e;font-size:13px;margin:0 0 4px">Reason for escalation</p>
    <div style="padding:14px 16px;background:#0d1117;border-left:3px solid #f59e0b;border-radius:0 8px 8px 0">
      <p style="margin:0;font-size:14px;color:#c9d1d9">${reason}</p>
    </div>
    <p style="color:#8b949e;font-size:13px;margin-top:16px">Log in to your support inbox to reply.</p>
  `;
  sendEmail({
    to: notifyEmail,
    from,
    subject: `[Escalated] ${ticket.subject} — ${ticket.hospital_name}`,
    html: wrapHtml(body, "Era Systems"),
    text: `Escalated ticket from ${ticket.hospital_name}\n\nSubject: ${ticket.subject}\nReason: ${reason}`,
  }).catch(() => {});
}

async function notifyHospitalReply(hospitalId: number, ticketSubject: string, replyText: string, hospitalName: string) {
  const { data: hospitalData } = await supabase
    .from("hospitals")
    .select("contact_email")
    .eq("id", hospitalId)
    .single();
  const contactEmail = hospitalData?.contact_email as string | null;
  if (!contactEmail) return;
  const from = process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev";
  const body = `
    <p style="font-size:16px;font-weight:600;color:#e6edf3;margin:0 0 6px">Support Reply</p>
    <p style="color:#8b949e;font-size:14px;margin:0 0 16px">Your support ticket has been answered.</p>
    <p style="color:#8b949e;font-size:13px;margin:0 0 4px">Your question</p>
    <p style="color:#c9d1d9;font-size:14px;margin:0 0 16px">${ticketSubject}</p>
    <p style="color:#8b949e;font-size:13px;margin:0 0 4px">Reply from Era Systems</p>
    <div style="padding:14px 16px;background:#0d1117;border-left:3px solid #14b8a6;border-radius:0 8px 8px 0">
      <p style="margin:0;font-size:14px;color:#c9d1d9">${replyText.replace(/\n/g, "<br>")}</p>
    </div>
    <p style="color:#8b949e;font-size:13px;margin-top:16px">Log in to your Era Systems app to continue the conversation.</p>
  `;
  sendEmail({
    to: contactEmail,
    from,
    subject: `Re: ${ticketSubject} — Era Systems Support`,
    html: wrapHtml(body, hospitalName),
    text: `Support reply for: ${ticketSubject}\n\n${replyText}`,
  }).catch(() => {});
}

// ── Hospital routes ───────────────────────────────────────────────────────────

// POST /support/ticket — create a new ticket + trigger AI
router.post("/support/ticket", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const parsed = TicketBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }

  const { data: hospitalData } = await supabase
    .from("hospitals")
    .select("name")
    .eq("id", hospital.intId)
    .single();
  const hospitalName = (hospitalData?.name as string | null) ?? hospital.username;

  const { data: ticket, error } = await supabase
    .from("support_tickets")
    .insert({
      hospital_id: hospital.intId,
      hospital_name: hospitalName,
      subject: parsed.data.subject,
      message: parsed.data.message,
      status: "open",
    })
    .select()
    .single();

  if (error || !ticket) { res.status(500).json({ error: "Failed to create ticket" }); return; }

  await appendMessage(ticket.id as number, "hospital", parsed.data.message);

  res.json({ ok: true, ticketId: ticket.id });

  // AI processes in background — don't await so response is instant
  const ticketId = ticket.id as number;
  setImmediate(async () => {
    try {
      const history: SupportMessage[] = [{ sender: "hospital", message: parsed.data.message }];
      const decision = await runSupportAI(history, hospitalName);

      if (decision.canAnswer) {
        await appendMessage(ticketId, "ai", decision.reply);
        await supabase.from("support_tickets").update({ status: "active" }).eq("id", ticketId);
      } else {
        await supabase.from("support_tickets").update({ status: "escalated" }).eq("id", ticketId);
        await notifyAdminEscalation(
          { id: ticketId, hospital_name: hospitalName, subject: parsed.data.subject },
          decision.escalationReason ?? "Needs human review",
        );
      }
    } catch (err) {
      console.error("[support] AI processing error:", err);
      await supabase.from("support_tickets").update({ status: "escalated" }).eq("id", ticketId);
    }
  });
});

// GET /support/tickets — hospital lists their own tickets
router.get("/support/tickets", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data } = await supabase
    .from("support_tickets")
    .select("id, subject, status, created_at")
    .eq("hospital_id", hospital.intId)
    .order("created_at", { ascending: false });

  // For each ticket, get the latest message preview
  const tickets = await Promise.all((data ?? []).map(async t => {
    const { data: msgs } = await supabase
      .from("support_messages")
      .select("sender, message, created_at")
      .eq("ticket_id", t.id as number)
      .order("created_at", { ascending: false })
      .limit(1);
    const last = msgs?.[0];
    return {
      id: t.id,
      subject: t.subject,
      status: t.status,
      created_at: t.created_at,
      last_message: last ? { sender: last.sender, preview: (last.message as string).slice(0, 100), created_at: last.created_at } : null,
    };
  }));

  res.json(tickets);
});

// GET /support/tickets/:id/messages — hospital gets full thread
router.get("/support/tickets/:id/messages", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const ticketId = parseInt(req.params.id, 10);
  if (isNaN(ticketId)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, subject, status, hospital_id")
    .eq("id", ticketId)
    .eq("hospital_id", hospital.intId)
    .single();

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, sender, message, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  res.json({ ticket, messages: messages ?? [] });
});

// POST /support/tickets/:id/message — hospital sends a follow-up + trigger AI
router.post("/support/tickets/:id/message", async (req, res): Promise<void> => {
  const hospital = await getHospitalFromRequest(req);
  if (!hospital) { res.status(401).json({ error: "Unauthorized" }); return; }

  const ticketId = parseInt(req.params.id, 10);
  if (isNaN(ticketId)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }

  const parsed = MessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Message required" }); return; }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, subject, status, hospital_name")
    .eq("id", ticketId)
    .eq("hospital_id", hospital.intId)
    .single();

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  await appendMessage(ticketId, "hospital", parsed.data.message);

  // If already escalated to admin, don't re-run AI — admin is handling it
  if (ticket.status === "escalated" || ticket.status === "closed") {
    res.json({ ok: true });
    return;
  }

  await supabase.from("support_tickets").update({ status: "active" }).eq("id", ticketId);
  res.json({ ok: true });

  // AI re-processes with full history
  setImmediate(async () => {
    try {
      const history = await getThreadMessages(ticketId);
      const decision = await runSupportAI(history, ticket.hospital_name as string);

      if (decision.canAnswer) {
        await appendMessage(ticketId, "ai", decision.reply);
      } else {
        await supabase.from("support_tickets").update({ status: "escalated" }).eq("id", ticketId);
        await notifyAdminEscalation(
          { id: ticketId, hospital_name: ticket.hospital_name as string, subject: ticket.subject as string },
          decision.escalationReason ?? "Needs human review",
        );
      }
    } catch (err) {
      console.error("[support] AI follow-up error:", err);
      await supabase.from("support_tickets").update({ status: "escalated" }).eq("id", ticketId);
    }
  });
});

// ── Super admin routes ────────────────────────────────────────────────────────

// GET /super-admin/support/tickets — list all tickets
router.get("/super-admin/support/tickets", requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data: tickets } = await supabase
    .from("support_tickets")
    .select("id, hospital_id, hospital_name, subject, status, created_at")
    .order("created_at", { ascending: false });

  const result = await Promise.all((tickets ?? []).map(async t => {
    const { data: msgs } = await supabase
      .from("support_messages")
      .select("sender, message, created_at")
      .eq("ticket_id", t.id as number)
      .order("created_at", { ascending: false })
      .limit(1);
    const last = msgs?.[0];
    return {
      ...t,
      last_message: last ? { sender: last.sender, preview: (last.message as string).slice(0, 120), created_at: last.created_at } : null,
    };
  }));

  res.json(result);
});

// GET /super-admin/support/tickets/:id/messages — full thread
router.get("/super-admin/support/tickets/:id/messages", requireSuperAdmin, async (req, res): Promise<void> => {
  const ticketId = parseInt(req.params.id, 10);
  if (isNaN(ticketId)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, sender, message, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  res.json({ ticket, messages: messages ?? [] });
});

// PATCH /super-admin/support/tickets/:id/reply — admin sends a message
router.patch("/super-admin/support/tickets/:id/reply", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }

  const parsed = ReplyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Message required" }); return; }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("hospital_id, subject, hospital_name")
    .eq("id", id)
    .single();

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  await appendMessage(id, "admin", parsed.data.message);
  // Keep ticket open (active) — admin must explicitly press Resolved to close it
  await supabase
    .from("support_tickets")
    .update({ status: "active", reply: parsed.data.message, replied_at: new Date().toISOString() })
    .eq("id", id);

  await notifyHospitalReply(
    ticket.hospital_id as number,
    ticket.subject as string,
    parsed.data.message,
    ticket.hospital_name as string,
  );

  res.json({ ok: true });
});

// GET /super-admin/support/tickets/:id/analysis — AI diagnosis for super admin
router.get("/super-admin/support/tickets/:id/analysis", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("subject, hospital_name, status")
    .eq("id", id)
    .single();

  if (!ticket) { res.status(404).json({ error: "Not found" }); return; }

  const { data: messages } = await supabase
    .from("support_messages")
    .select("sender, message")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true });

  const hospitalIntId = ticket.hospital_id as number;
  const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Resolve hospital code first, then gather live data in parallel
  const { data: hospitalRow } = await supabase
    .from("hospitals").select("hospital_code").eq("id", hospitalIntId).single();
  const hospitalCode = (hospitalRow?.hospital_code as string) ?? "";

  const [modulesRes, logsRes, failuresRes, patientCountRes] = await Promise.all([
    supabase.from("hospital_modules").select("*").eq("hospital_id", hospitalIntId).maybeSingle(),
    supabase.from("automation_log").select("automation_type, status, error_message, created_at")
      .eq("hospital_id", hospitalIntId).order("created_at", { ascending: false }).limit(10),
    supabase.from("automation_log").select("automation_type, error_message, created_at")
      .eq("hospital_id", hospitalIntId).eq("status", "failed").gte("created_at", since48h)
      .order("created_at", { ascending: false }).limit(20),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("hospital_id", hospitalCode),
  ]);

  const context: AccountContext = {
    modules: modulesRes.data as Record<string, unknown> | null,
    recentAutomationLogs: (logsRes.data ?? []) as AccountContext["recentAutomationLogs"],
    recentFailures: (failuresRes.data ?? []) as AccountContext["recentFailures"],
    patientCount: patientCountRes.count,
  };

  const analysis = await runTicketAnalysis(
    ticket.subject as string,
    ticket.hospital_name as string,
    (messages ?? []) as SupportMessage[],
    context,
  );

  res.json(analysis);
});

// PATCH /super-admin/support/tickets/:id/resolve — admin marks ticket as resolved
router.patch("/super-admin/support/tickets/:id/resolve", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }

  await supabase
    .from("support_tickets")
    .update({ status: "closed" })
    .eq("id", id);

  res.json({ ok: true });
});

// PATCH /super-admin/support/tickets/:id/reopen — reopen a closed ticket
router.patch("/super-admin/support/tickets/:id/reopen", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }
  await supabase.from("support_tickets").update({ status: "open" }).eq("id", id);
  res.json({ ok: true });
});

export default router;
