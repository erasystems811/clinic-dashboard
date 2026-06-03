import { Router, type IRouter } from "express";
import { supabase } from "../lib/supabase.js";
import { z } from "zod/v4";
import { getHospitalFromRequest } from "../lib/hospital-auth.js";
import { requireSuperAdmin } from "./super-admin.js";
import { sendEmail, wrapHtml } from "../lib/email.js";

const router: IRouter = Router();

const TicketBody = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
});

const ReplyBody = z.object({
  reply: z.string().min(1).max(2000),
});

// POST /support/ticket — hospital submits a ticket
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

  const { error } = await supabase.from("support_tickets").insert({
    hospital_id: hospital.intId,
    hospital_name: hospitalName,
    subject: parsed.data.subject,
    message: parsed.data.message,
    status: "open",
  });

  if (error) { res.status(500).json({ error: "Failed to submit ticket" }); return; }

  const notifyEmail = process.env.SUPPORT_EMAIL;
  if (notifyEmail) {
    const from = process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev";
    const body = `
      <p style="font-size:16px;font-weight:600;color:#e6edf3;margin:0 0 6px">New Support Ticket</p>
      <p style="color:#8b949e;font-size:14px;margin:0 0 16px">From <strong style="color:#c9d1d9">${hospitalName}</strong></p>
      <p style="color:#8b949e;font-size:13px;margin:0 0 4px">Subject</p>
      <p style="color:#e6edf3;font-size:15px;margin:0 0 16px">${parsed.data.subject}</p>
      <p style="color:#8b949e;font-size:13px;margin:0 0 4px">Message</p>
      <div style="padding:14px 16px;background:#0d1117;border-left:3px solid #14b8a6;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:14px;color:#c9d1d9">${parsed.data.message.replace(/\n/g, "<br>")}</p>
      </div>
    `;
    sendEmail({
      to: notifyEmail,
      from,
      subject: `[Support] ${parsed.data.subject} — ${hospitalName}`,
      html: wrapHtml(body, "Era Systems"),
      text: `New support ticket from ${hospitalName}\n\nSubject: ${parsed.data.subject}\n\n${parsed.data.message}`,
    }).catch(() => {});
  }

  res.json({ ok: true });
});

// GET /super-admin/support/tickets — list all tickets
router.get("/super-admin/support/tickets", requireSuperAdmin, async (_req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) { res.status(500).json({ error: "Failed to load tickets" }); return; }
  res.json(data ?? []);
});

// PATCH /super-admin/support/tickets/:id/reply — reply and close ticket
router.patch("/super-admin/support/tickets/:id/reply", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ticket ID" }); return; }

  const parsed = ReplyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Reply text required" }); return; }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("hospital_id, subject, hospital_name")
    .eq("id", id)
    .single();

  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }

  const { error } = await supabase
    .from("support_tickets")
    .update({ reply: parsed.data.reply, status: "closed", replied_at: new Date().toISOString() })
    .eq("id", id);

  if (error) { res.status(500).json({ error: "Failed to save reply" }); return; }

  const { data: hospitalData } = await supabase
    .from("hospitals")
    .select("contact_email, name")
    .eq("id", ticket.hospital_id as number)
    .single();

  const contactEmail = hospitalData?.contact_email as string | null;
  if (contactEmail) {
    const hospitalName = (hospitalData?.name as string | null) ?? (ticket.hospital_name as string);
    const from = process.env.PLATFORM_FROM_EMAIL ?? "onboarding@resend.dev";
    const body = `
      <p style="font-size:16px;font-weight:600;color:#e6edf3;margin:0 0 6px">Support Reply</p>
      <p style="color:#8b949e;font-size:14px;margin:0 0 16px">Your support ticket has been answered.</p>
      <p style="color:#8b949e;font-size:13px;margin:0 0 4px">Your question</p>
      <p style="color:#c9d1d9;font-size:14px;margin:0 0 16px">${ticket.subject as string}</p>
      <p style="color:#8b949e;font-size:13px;margin:0 0 4px">Reply from Era Systems</p>
      <div style="padding:14px 16px;background:#0d1117;border-left:3px solid #14b8a6;border-radius:0 8px 8px 0">
        <p style="margin:0;font-size:14px;color:#c9d1d9">${parsed.data.reply.replace(/\n/g, "<br>")}</p>
      </div>
    `;
    sendEmail({
      to: contactEmail,
      from,
      subject: `Re: ${ticket.subject as string} — Era Systems Support`,
      html: wrapHtml(body, hospitalName),
      text: `Support reply for: ${ticket.subject as string}\n\n${parsed.data.reply}`,
    }).catch(() => {});
  }

  res.json({ ok: true });
});

export default router;
