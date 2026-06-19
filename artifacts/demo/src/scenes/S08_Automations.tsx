import { Mail, MessageSquare, Clock, Gift, AlertCircle, HeartPulse, Star, CalendarClock } from "lucide-react";
import NarrationBubble from "@/components/NarrationBubble";
import type { Prospect } from "@/types";

interface Props { prospect: Prospect; onNext: () => void; }

const AUTOMATIONS = [
  {
    icon: MessageSquare,
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    trigger: "Patient joins queue",
    title: "Queue Position SMS",
    desc: "Instant SMS with their position number. They wait anywhere — not at the front desk.",
    channel: "SMS",
    timing: "Instant",
  },
  {
    icon: Clock,
    color: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    trigger: "Waiting 45+ minutes",
    title: "Long Wait Apology",
    desc: "Automatic apology SMS sent to any patient who has been waiting too long — no staff involvement.",
    channel: "SMS",
    timing: "After 45 min",
  },
  {
    icon: CalendarClock,
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    trigger: "Appointment booked",
    title: "Appointment Reminders",
    desc: "Confirmation email when booked. A reminder 24 hours before. A final nudge 2 hours before the appointment time.",
    channel: "Email",
    timing: "24h + 2h before",
  },
  {
    icon: AlertCircle,
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    trigger: "Patient misses appointment",
    title: "No-Show Follow-up",
    desc: '"We noticed you couldn\'t make it today and wanted to check you\'re okay." Sent automatically 1 hour after a missed appointment.',
    channel: "Email",
    timing: "1 hour after miss",
  },
  {
    icon: HeartPulse,
    color: "text-violet-400 bg-violet-500/10 border-violet-500/20",
    trigger: "Care plan activated",
    title: "Care Plan Delivery",
    desc: "Instant SMS telling the patient to check their email, then a full personalised email with all medications and instructions sent automatically.",
    channel: "SMS → Email",
    timing: "Instant + 20 min",
  },
  {
    icon: HeartPulse,
    color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
    trigger: "Treatment ends",
    title: "Post-Treatment Check-ins",
    desc: "Warm check-in emails on Day 1, Day 4, and Day 7 after treatment — making sure the patient is recovering well.",
    channel: "Email",
    timing: "Day 1 · 4 · 7",
  },
  {
    icon: Star,
    color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
    trigger: "Day after visit",
    title: "Feedback Request",
    desc: "Automatic rating request sent the next morning — no staff needed to chase it. Feedback that isn't collected is feedback lost.",
    channel: "Email",
    timing: "Next morning",
  },
  {
    icon: Mail,
    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    trigger: "30 days since last visit",
    title: "Wellness Re-engagement",
    desc: '"It\'s been a while — just checking in." Sent to patients who haven\'t returned in 30 days. Brings dormant patients back without any staff effort.',
    channel: "Email",
    timing: "After 30 days",
  },
  {
    icon: Gift,
    color: "text-pink-400 bg-pink-500/10 border-pink-500/20",
    trigger: "Patient's birthday",
    title: "Birthday Email",
    desc: "A warm, personalised birthday message from the clinic — crafted uniquely for each hospital's tone and personality. Patients remember this.",
    channel: "Email",
    timing: "Every year",
  },
];

export default function S08_Automations({ prospect, onNext }: Props) {
  return (
    <div className="relative min-h-full flex flex-col items-center px-4 py-10 text-center space-y-8">
      {/* Headline */}
      <div className="space-y-3 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" /> Automation Engine
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold leading-snug">
          ERA runs <span className="text-primary">24/7 in the background.</span>{" "}
          Your team just shows up and works.
        </h2>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto leading-relaxed">
          Every patient touchpoint — from queue join to birthday — is handled automatically.
          No manual follow-ups. No missed messages. No extra staff.
        </p>
      </div>

      {/* Automation grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-4xl text-left">
        {AUTOMATIONS.map((a) => (
          <div key={a.title} className={`rounded-xl border bg-card p-4 space-y-2.5`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${a.color}`}>
                <a.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug">{a.title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{a.trigger}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{a.desc}</p>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-medium">{a.channel}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">{a.timing}</span>
            </div>
          </div>
        ))}
      </div>

      <NarrationBubble
        text={<>Every one of these runs automatically — <strong>no staff involvement, no manual triggers</strong>. {prospect.firstName}, ERA keeps your patients informed, supported, and coming back — while your team focuses on care.</>}
        onNext={onNext}
        nextLabel="See the doctor's view →"
      />
    </div>
  );
}
