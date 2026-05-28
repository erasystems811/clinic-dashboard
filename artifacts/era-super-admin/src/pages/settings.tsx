import Layout from "@/components/layout";
import {
  Mail, MessageSquare, Clock, Zap, Calendar, Star, Newspaper,
  UserPlus, ClipboardList, BellRing, HeartPulse, Users, Gift
} from "lucide-react";

interface AutomationDef {
  id: string;
  name: string;
  purpose: string;
  trigger: string;
  channel: "email" | "sms/whatsapp" | "both";
  icon: React.ComponentType<{ className?: string }>;
  timing: string;
  notes?: string;
}

const AUTOMATIONS: AutomationDef[] = [
  {
    id: "queue_join",
    name: "Queue Check-In",
    purpose: "Reassures a patient they are registered and tells them their position in line so they feel informed from the moment they arrive.",
    trigger: "Receptionist checks a patient into the queue",
    channel: "sms/whatsapp",
    icon: ClipboardList,
    timing: "Instant — fires the moment the patient is checked in",
  },
  {
    id: "queue_next_in_line",
    name: "Next In Line Alert",
    purpose: "Gives the patient time to get ready before their turn, reducing calling delays and keeping the queue moving.",
    trigger: "Patient reaches 2nd position in the queue",
    channel: "sms/whatsapp",
    icon: BellRing,
    timing: "Instant — fires when previous patient is called",
  },
  {
    id: "queue_your_turn",
    name: "It's Your Turn",
    purpose: "Calls the patient in when the doctor is ready, eliminating the need for staff to physically search the waiting area.",
    trigger: "Receptionist calls the patient from the queue screen",
    channel: "sms/whatsapp",
    icon: BellRing,
    timing: "Instant — fires when staff taps 'Call Patient'",
  },
  {
    id: "queue_long_wait_apology",
    name: "Long Wait Apology",
    purpose: "Preserves patient goodwill during unusually long waits by proactively acknowledging the delay.",
    trigger: "Staff manually sends from the queue screen when wait time is unreasonably long",
    channel: "sms/whatsapp",
    icon: Clock,
    timing: "Manual trigger only — no automatic condition",
  },
  {
    id: "care_plan_notification",
    name: "Care Plan Ready (SMS/WhatsApp)",
    purpose: "Immediately notifies the patient the moment their care plan is saved, directing them to check their email for full details.",
    trigger: "Nurse saves a care plan in the nurse station",
    channel: "sms/whatsapp",
    icon: UserPlus,
    timing: "Instant — fires on save",
  },
  {
    id: "care_plan_email",
    name: "Care Plan Summary Email",
    purpose: "Delivers the full care plan in plain, patient-friendly language so they understand their treatment without needing to ask questions.",
    trigger: "Care plan created (20-minute delay gives nurse time for last-minute edits)",
    channel: "email",
    icon: Mail,
    timing: "20 minutes after care plan is saved — checked every 5 min by scheduler",
  },
  {
    id: "in_care_reminder",
    name: "Continuous In-Care Reminders",
    purpose: "Keeps the patient on track with medication and clinic visits throughout their treatment, reducing missed doses and no-shows.",
    trigger: "Patient is active in a care plan with time-slot preferences set (morning/afternoon/evening/night)",
    channel: "email",
    icon: HeartPulse,
    timing: "Every hour — scheduler checks which patients have that time slot active. Fires based on department settings, NOT a fixed daily time.",
    notes: "Each department can have different reminder frequencies and slots configured in hospital settings.",
  },
  {
    id: "care_plan_visit_reminder",
    name: "Scheduled Care Visit Reminder",
    purpose: "Ensures the patient remembers a specific clinic or procedure date from their care plan, preventing missed appointments.",
    trigger: "Patient has a scheduled date in their care plan within the next 24 hours",
    channel: "email",
    icon: Calendar,
    timing: "Daily at 8am — checks upcoming plan dates for all active patients",
  },
  {
    id: "post_treatment_checkin",
    name: "Post-Treatment Check-Ins",
    purpose: "Shows the patient the clinic still cares about their recovery after they leave, reducing anxiety and increasing loyalty.",
    trigger: "Patient moves to Post-Treatment stage",
    channel: "email",
    icon: HeartPulse,
    timing: "Day 1, Day 4, and Day 7 after treatment ends — checked daily at 7am",
  },
  {
    id: "post_care_email",
    name: "Dormant Re-Engagement",
    purpose: "Gently reminds long-inactive patients the clinic exists and invites them back before they are lost to competitors.",
    trigger: "Patient has been dormant (no visits) for 30+ days",
    channel: "email",
    icon: Users,
    timing: "Daily at 6pm",
  },
  {
    id: "appointment_reminder",
    name: "Appointment Reminder",
    purpose: "Reduces no-shows by keeping the patient aware of their upcoming visit at two critical moments — a day before and an hour before.",
    trigger: "Patient has an upcoming appointment",
    channel: "both",
    icon: Calendar,
    timing: "24 hours before + 1 hour before — checked every 15 minutes",
  },
  {
    id: "no_show_followup",
    name: "No-Show Follow-Up",
    purpose: "Recovers potentially lost patients by reaching out compassionately after a missed appointment and making rebooking easy.",
    trigger: "Patient misses an appointment (no check-in recorded)",
    channel: "email",
    icon: Calendar,
    timing: "1 hour after missed appointment time — checked every 15 minutes",
  },
  {
    id: "feedback_email",
    name: "Post-Visit Feedback Request",
    purpose: "Captures patient satisfaction data while the visit is fresh, giving the clinic actionable ratings and comments.",
    trigger: "Patient has a completed appointment from the previous day",
    channel: "email",
    icon: Star,
    timing: "Daily at 12pm — covers all previous day's completed visits",
  },
  {
    id: "birthday_email",
    name: "Birthday Greeting",
    purpose: "Deepens the patient relationship with a personal, human touch that most clinics never bother with.",
    trigger: "Patient's date of birth matches today's date",
    channel: "email",
    icon: Gift,
    timing: "Daily at 7am and 8am",
  },
  {
    id: "wellness_newsletter",
    name: "Wellness Newsletter",
    purpose: "Keeps the clinic top-of-mind for all active patients between visits with relevant health tips and seasonal content.",
    trigger: "Admin manually sends from the Wellness Newsletter screen",
    channel: "email",
    icon: Newspaper,
    timing: "Manual trigger — admin chooses when to send",
  },
];

const CHANNEL_STYLE: Record<string, string> = {
  "email": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "sms/whatsapp": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "both": "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

export default function Settings() {
  return (
    <Layout breadcrumb={[{ label: "Settings" }]}>
      <div className="mb-8">
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1.5">Platform Configuration</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1.5">Automation reference and platform configuration</p>
      </div>

      {/* Automation Reference */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-widest">Automation Reference</h2>
          <span className="text-[10px] text-muted-foreground font-medium ml-1">— {AUTOMATIONS.length} automations across all channels</span>
        </div>

        <div className="space-y-2">
          {AUTOMATIONS.map(a => (
            <div key={a.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                  <a.icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-foreground">{a.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${CHANNEL_STYLE[a.channel]}`}>
                      {a.channel}
                    </span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed mb-2">{a.purpose}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Trigger</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.trigger}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Timing</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{a.timing}</p>
                    </div>
                  </div>
                  {a.notes && (
                    <p className="text-[11px] text-amber-400/80 mt-2 border-t border-border pt-2">⚠ {a.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
