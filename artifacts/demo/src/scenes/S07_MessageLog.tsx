import { useEffect, useState } from "react";
import { MessageSquare, Mail, Smartphone, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; }

interface LogEntry {
  id: number;
  channel: "sms" | "email" | "in-app";
  event: string;
  message: string;
  status: "delivered" | "pending" | "failed";
  time: string;
}

export default function S07_MessageLog({ prospect, onNext }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);

  const entries: LogEntry[] = [
    {
      id: 1, channel: "sms",    status: "delivered", time: "9:02 AM",
      event: "Queue Added",
      message: `Hello ${prospect.firstName}, you've been added to the queue at ERA Hospital. Your current position is #1.`,
    },
    {
      id: 2, channel: "sms",    status: "delivered", time: "9:18 AM",
      event: "Called In",
      message: `It's your turn, ${prospect.firstName}! Please proceed to the consultation room.`,
    },
    {
      id: 3, channel: "sms",    status: "delivered", time: "9:35 AM",
      event: "Care Plan Activated",
      message: `Hi ${prospect.firstName}, your care plan has been activated. View details in the ERA-me app.`,
    },
    {
      id: 4, channel: "in-app", status: "delivered", time: "9:36 AM",
      event: "ERA Message",
      message: `Hi ${prospect.firstName}, this is your nurse. Your medications are ready at the front desk. Any questions, feel free to message me here!`,
    },
    {
      id: 5, channel: "email",  status: "delivered", time: "10:00 AM",
      event: "Post-Visit Summary",
      message: `Dear ${prospect.firstName}, thank you for visiting ERA Hospital. Attached is your visit summary and care plan.`,
    },
    {
      id: 6, channel: "sms",    status: "pending",   time: "2:00 PM",
      event: "Medication Reminder",
      message: `Reminder from ERA Hospital: Take your Paracetamol 500mg. Your health matters!`,
    },
  ];

  useEffect(() => {
    if (visibleCount < entries.length) {
      const t = setTimeout(() => setVisibleCount(c => c + 1), 700);
      return () => clearTimeout(t);
    }
  }, [visibleCount, entries.length]);

  const CHANNEL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
    sms:    Smartphone,
    email:  Mail,
    "in-app": MessageSquare,
  };

  const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
    delivered: CheckCircle2,
    pending:   Clock,
    failed:    AlertCircle,
  };

  const STATUS_COLOR: Record<string, string> = {
    delivered: "text-green-400",
    pending:   "text-amber-400",
    failed:    "text-red-400",
  };

  const CHANNEL_COLOR: Record<string, string> = {
    sms:    "bg-primary/10 text-primary",
    email:  "bg-blue-500/10 text-blue-400",
    "in-app": "bg-violet-500/10 text-violet-400",
  };

  return (
    <div className="relative space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Message Log</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Automated communications sent for {prospect.firstName} {prospect.lastName}</p>
      </div>

      <Card>
        <div className="divide-y divide-border">
          {entries.slice(0, visibleCount).map((entry) => {
            const ChannelIcon = CHANNEL_ICON[entry.channel];
            const StatusIcon  = STATUS_ICON[entry.status];
            return (
              <div key={entry.id} className="flex items-start gap-4 px-4 py-3.5 fade-in-up">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${CHANNEL_COLOR[entry.channel]}`}>
                  <ChannelIcon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{entry.channel.toUpperCase()}</span>
                    <span className="text-xs font-medium">{entry.event}</span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-snug">{entry.message}</p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs text-muted-foreground">{entry.time}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${STATUS_COLOR[entry.status]}`}>
                    <StatusIcon className="w-3 h-3" />
                    {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <NarrationBubble
        text={<>Every message sent, every trigger, every channel — <strong>all logged here automatically</strong>. You always know what your patients received and when.</>}
        onNext={onNext}
        nextLabel="Continue →"
      />
    </div>
  );
}
