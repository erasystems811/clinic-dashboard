import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth, type Role } from "@/contexts/auth-context";
import { X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2 } from "lucide-react";

interface Step {
  title: string;
  body: string;
  target?: string;
}

const ADMIN_STEPS: Step[] = [
  {
    title: "Welcome to Era Patient 👋",
    body: "This quick tour walks you through the key features so your team can start using the system right away. It takes less than 2 minutes.",
  },
  {
    title: "Register Patients",
    body: "Use the New Patient button to register a new patient. Their records, treatment plan, and contact details are all stored here.",
    target: '[data-tour="new-patient"]',
  },
  {
    title: "Patient Records",
    body: "Browse all your patients, search by name or ID, and open any profile to see their full visit history and treatment notes.",
    target: '[data-tour="nav-patients"]',
  },
  {
    title: "Appointments",
    body: "Schedule appointments from here. Patients can receive automatic reminders before their visit so they don't miss it.",
    target: '[data-tour="nav-appointments"]',
  },
  {
    title: "The Pipeline",
    body: "This is Era's automation engine. After treatment, patients move through stages automatically and the system sends WhatsApp or email check-ins on your behalf — without you lifting a finger.",
    target: '[data-tour="nav-pipeline"]',
  },
  {
    title: "Activity Log",
    body: "Every message, reminder, and automated action is logged here. If a message failed to send, you can retry it from this screen.",
    target: '[data-tour="nav-activity"]',
  },
  {
    title: "Patient Feedback",
    body: "After a visit, patients can rate their experience via WhatsApp. All their responses show up here so you can spot trends and address issues quickly.",
    target: '[data-tour="nav-feedback-admin"]',
  },
  {
    title: "Wellness Newsletter",
    body: "Send health tips, seasonal advice, or general wellness content to all your patients at once. It keeps your clinic top of mind between visits.",
    target: '[data-tour="nav-wellness"]',
  },
  {
    title: "Messages",
    body: "View and manage WhatsApp conversations with patients here. Any message sent through Era — reminders, check-ins, replies — appears in this inbox.",
    target: '[data-tour="nav-messages"]',
  },
  {
    title: "Settings",
    body: "Change your staff login passwords here — nurse and receptionist credentials are managed from this page.",
    target: '[data-tour="nav-settings"]',
  },
  {
    title: "You're all set! 🎉",
    body: "Your receptionist and nurse each have their own tour when they first log in. You can restart this tour any time using the ? button at the bottom of the sidebar.",
  },
];

const RECEPTIONIST_STEPS: Step[] = [
  {
    title: "Welcome! 👋",
    body: "You're logged in as the Receptionist. This quick tour shows the tools you'll use every day.",
  },
  {
    title: "Queue Management",
    body: "When a patient arrives, find them here and check them in. The queue shows the waiting room in real time so the whole team stays in sync.",
    target: '[data-tour="nav-queue"]',
  },
  {
    title: "New Patient",
    body: "If a patient is visiting for the first time, register them here before checking them into the queue.",
    target: '[data-tour="new-patient"]',
  },
  {
    title: "Call Tasks",
    body: "Patients flagged for a follow-up call appear here. Work through this list daily so no patient falls through the cracks.",
    target: '[data-tour="nav-call-tasks"]',
  },
  {
    title: "You're ready! 🎉",
    body: "That's everything you need. Check in your first patient when you're ready. You can restart this tour any time using the ? button at the bottom of the sidebar.",
  },
];

const NURSE_STEPS: Step[] = [
  {
    title: "Welcome, Nurse! 👋",
    body: "This tour covers your workspace in Era Patient.",
  },
  {
    title: "Nurse Station",
    body: "Once a patient is checked in by the receptionist, their card appears here. Review their history, record vitals, and update their treatment plan.",
    target: '[data-tour="nav-nurse-station"]',
  },
  {
    title: "You're all set! 🎉",
    body: "When a patient is ready for you, they'll appear in your Nurse Station. The receptionist manages the queue before they reach you. You can restart this tour any time using the ? button at the bottom of the sidebar.",
  },
];

const STEPS_FOR_ROLE: Record<Role, Step[]> = {
  admin: ADMIN_STEPS,
  receptionist: RECEPTIONIST_STEPS,
  nurse: NURSE_STEPS,
};

function tourKey(hospitalSlug: string, role: Role) {
  return `era_tour_done_${hospitalSlug}_${role}`;
}

interface Rect { top: number; left: number; width: number; height: number; }

function getRect(selector: string): Rect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function Spotlight({ rect }: { rect: Rect }) {
  const PAD = 6;
  return (
    <div
      style={{
        position: "fixed",
        top: rect.top - PAD,
        left: rect.left - PAD,
        width: rect.width + PAD * 2,
        height: rect.height + PAD * 2,
        borderRadius: 10,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
        zIndex: 9998,
        pointerEvents: "none",
        outline: "2px solid hsl(var(--primary))",
        outlineOffset: 2,
        transition: "all 0.25s ease",
      }}
    />
  );
}

function TooltipCard({
  step,
  stepIndex,
  total,
  rect,
  onNext,
  onPrev,
  onSkip,
}: {
  step: Step;
  stepIndex: number;
  total: number;
  rect: Rect | null;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === total - 1;
  const CARD_W = 320;
  const CARD_H_EST = 180;
  const PAD = 14;

  let top = "50%";
  let left = "50%";
  let transform = "translate(-50%, -50%)";

  if (rect) {
    const rightSpace = window.innerWidth - (rect.left + rect.width);
    const bottomSpace = window.innerHeight - (rect.top + rect.height);

    if (rightSpace > CARD_W + PAD * 2) {
      top = `${Math.min(rect.top, window.innerHeight - CARD_H_EST - 16)}px`;
      left = `${rect.left + rect.width + PAD}px`;
      transform = "none";
    } else if (bottomSpace > CARD_H_EST + PAD * 2) {
      top = `${rect.top + rect.height + PAD}px`;
      left = `${Math.max(16, rect.left)}px`;
      transform = "none";
    } else {
      top = `${Math.max(16, rect.top - CARD_H_EST - PAD)}px`;
      left = `${Math.max(16, rect.left)}px`;
      transform = "none";
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top,
        left,
        transform,
        width: CARD_W,
        zIndex: 9999,
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 14,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        padding: "20px 20px 16px",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {isLast
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            : <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          }
          <p className="font-semibold text-sm text-foreground leading-snug">{step.title}</p>
        </div>
        <button
          onClick={onSkip}
          className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
          title="Skip tour"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-4">{step.body}</p>

      {/* Progress dots */}
      <div className="flex items-center gap-1.5 mb-4">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-200"
            style={{
              width: i === stepIndex ? 16 : 6,
              height: 6,
              background: i === stepIndex ? "hsl(var(--primary))" : "hsl(var(--border))",
            }}
          />
        ))}
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-2">
        {!isFirst && (
          <button
            onClick={onPrev}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-1 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          {isLast ? "Done" : "Next"}
          {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        {!isLast && (
          <button
            onClick={onSkip}
            className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

export function TourGuide() {
  const { user, hospital } = useAuth();
  const role = user?.role ?? "admin";
  const slug = hospital?.slug ?? "default";

  const steps = STEPS_FOR_ROLE[role] ?? ADMIN_STEPS;
  const key = tourKey(slug, role);

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    const handler = () => {
      setStepIndex(0);
      setActive(true);
    };
    window.addEventListener("era:start-tour", handler);
    return () => window.removeEventListener("era:start-tour", handler);
  }, []);

  const currentStep = steps[stepIndex];

  const updateRect = useCallback(() => {
    if (!currentStep?.target) { setRect(null); return; }
    const r = getRect(currentStep.target);
    setRect(r);
  }, [currentStep]);

  useEffect(() => {
    if (!active) return;
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [active, updateRect]);

  const advance = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      localStorage.setItem(key, "done");
      setActive(false);
      return;
    }
    // If next step target doesn't exist, skip past it
    let next = stepIndex + 1;
    while (next < steps.length - 1 && steps[next].target && !document.querySelector(steps[next].target!)) {
      next++;
    }
    setStepIndex(next);
  }, [stepIndex, steps, key]);

  const retreat = useCallback(() => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }, [stepIndex]);

  const skip = useCallback(() => {
    localStorage.setItem(key, "done");
    setActive(false);
  }, [key]);

  if (!active) return null;

  return createPortal(
    <>
      {rect && <Spotlight rect={rect} />}
      {!rect && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 9998 }}
          onClick={skip}
        />
      )}
      <TooltipCard
        step={currentStep}
        stepIndex={stepIndex}
        total={steps.length}
        rect={rect}
        onNext={advance}
        onPrev={retreat}
        onSkip={skip}
      />
    </>,
    document.body
  );
}

