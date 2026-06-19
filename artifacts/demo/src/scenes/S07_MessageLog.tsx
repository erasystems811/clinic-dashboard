import { useEffect, useState } from "react";
import { Mail, Phone, CheckCircle2, XCircle, Clock, Filter } from "lucide-react";
import { Card } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; }

interface LogEntry {
  id: number;
  channel: "sms" | "email";
  type: string;
  preview: string;
  status: "sent" | "failed" | "queued";
  time: string;
}

function ChannelIcon({ channel }: { channel: string }) {
  if (channel === "email") return <Mail className="w-3.5 h-3.5 text-blue-400" />;
  return <Phone className="w-3.5 h-3.5 text-amber-400" />;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sent") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
      <CheckCircle2 className="w-3 h-3" /> Sent
    </span>
  );
  if (status === "failed") return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
      <XCircle className="w-3 h-3" /> Failed
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
      <Clock className="w-3 h-3" /> Queued
    </span>
  );
}

export default function S07_MessageLog({ prospect, onNext }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);

  const entries: LogEntry[] = [
    {
      id: 1, channel: "sms", status: "sent", time: "9:02 AM",
      type: "Queue Position SMS",
      preview: `Hello ${prospect.firstName}, you've been added to the queue at ERA Hospital. Your current position is #1.`,
    },
    {
      id: 2, channel: "sms", status: "sent", time: "9:18 AM",
      type: "Queue Position SMS",
      preview: `It's your turn, ${prospect.firstName}! Please proceed to the consultation room.`,
    },
    {
      id: 3, channel: "sms", status: "sent", time: "9:35 AM",
      type: "Treatment Notification",
      preview: `Hi ${prospect.firstName}, your care plan has been activated at ERA Hospital. You can view your full plan in the ERA-me app.`,
    },
    {
      id: 4, channel: "email", status: "sent", time: "9:55 AM",
      type: "Treatment Plan Email",
      preview: `Hi ${prospect.firstName}, attached is your full care plan from ERA Hospital — medications, dosage, and timing for the next 7 days.`,
    },
    {
      id: 5, channel: "email", status: "sent", time: "Tomorrow, 8:00 AM",
      type: "Medication Reminder",
      preview: `Reminder: Time to take your Paracetamol 500mg, Amoxicillin 250mg. Please take your medication as prescribed.`,
    },
    {
      id: 6, channel: "email", status: "queued", time: "Tomorrow, 8:01 AM",
      type: "Feedback Request",
      preview: `Hi ${prospect.firstName}, we hope you're feeling better! We'd love to hear about your experience at ERA Hospital. It only takes 30 seconds.`,
    },
  ];

  useEffect(() => {
    if (visibleCount < entries.length) {
      const t = setTimeout(() => setVisibleCount(c => c + 1), 500);
      return () => clearTimeout(t);
    }
  }, [visibleCount, entries.length]);

  return (
    <div className="relative max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Message Log</h1>
        <p className="text-muted-foreground text-sm mt-0.5">All automated messages sent to patients — SMS, WhatsApp, and email.</p>
      </div>

      {/* Filter bar (visual only) */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Filter className="w-4 h-4" />
          Filter
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm opacity-60" disabled>
            <option>All statuses</option>
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm opacity-60" disabled>
            <option>All channels</option>
          </select>
          <input type="date" className="h-9 rounded-md border border-input bg-background px-3 text-sm opacity-60" disabled />
          <input type="date" className="h-9 rounded-md border border-input bg-background px-3 text-sm opacity-60" disabled />
        </div>
      </div>

      {/* Log list */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="divide-y divide-border">
          {entries.slice(0, visibleCount).map(entry => (
            <div key={entry.id} className="px-4 py-3 hover:bg-muted/30 transition-colors fade-in-up">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <ChannelIcon channel={entry.channel} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{prospect.firstName} {prospect.lastName}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{entry.type}</span>
                    <StatusBadge status={entry.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xl">{entry.preview}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 mt-0.5">{entry.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <NarrationBubble
        text={<>Every SMS and email ERA sent — <strong>logged automatically with delivery status</strong>. You always have a full record of what each patient received and when. Filter by channel, status, or date range.</>}
        onNext={onNext}
        nextLabel="Continue →"
      />
    </div>
  );
}
