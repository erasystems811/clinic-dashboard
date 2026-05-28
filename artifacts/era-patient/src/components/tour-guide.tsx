import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAuth, type Role } from "@/contexts/auth-context";
import { X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2 } from "lucide-react";

interface Step {
  title: string;
  body: string;
  target?: string;
}

/* ── Admin tour ─────────────────────────────────────────────────────────────
   Purpose: show the admin what Era does *for* the clinic, not what buttons do.
*/
const ADMIN_STEPS: Step[] = [
  {
    title: "Welcome to Era Patient",
    body: "Era is built around one idea: no patient should fall through the cracks after leaving your clinic. Every section you're about to see exists to make sure they don't. This takes under 2 minutes.",
  },
  {
    title: "Starting a patient's journey",
    body: "Every patient in Era has a permanent profile — one place where their full history lives. Register them once and everything that follows — their care plan, treatment stages, and every message sent to them — is attached here forever.",
    target: '[data-tour="new-patient"]',
  },
  {
    title: "Your complete patient roster",
    body: "Every person your clinic has ever treated, in one place. Open any profile and you'll see the whole picture: where they are in their care journey, what was discussed during their visits, and every automated communication that went out on your behalf.",
    target: '[data-tour="nav-patients"]',
  },
  {
    title: "Your scheduling engine",
    body: "Appointments are booked here — and patients handle themselves from that point. They receive automatic confirmations and reminders before every visit, so your team spends less time chasing bookings and more time delivering care.",
    target: '[data-tour="nav-appointments"]',
  },
  {
    title: "The care that happens after the visit",
    body: "This is Era's patient retention engine. After treatment ends, every patient moves through a timed journey of check-ins, wellness nudges, and re-engagement messages — all sent automatically on your behalf. No one disappears. No one is forgotten.",
    target: '[data-tour="nav-pipeline"]',
  },
  {
    title: "Your audit trail",
    body: "Everything Era sends is recorded here with a timestamp and delivery status. If a message ever fails to reach a patient, you'll see it immediately — and you can act on it before it becomes a problem.",
    target: '[data-tour="nav-activity"]',
  },
  {
    title: "A direct line to patient satisfaction",
    body: "After every visit, patients receive a link to share how they felt. Their ratings and comments arrive here, giving you an honest, ongoing picture of your clinic's care quality — not once a year, but after every single visit.",
    target: '[data-tour="nav-feedback-admin"]',
  },
  {
    title: "Staying present between visits",
    body: "Your active patients hear from you even when they're not in the clinic. Write a health tip or seasonal message here and send it to your entire active roster in one action — it keeps your clinic relevant and your patients engaged long-term.",
    target: '[data-tour="nav-wellness"]',
  },
  {
    title: "Your clinic's control panel",
    body: "Manage staff credentials for your nurse and receptionist, configure notification preferences, and adjust the settings that shape how Era behaves for your clinic.",
    target: '[data-tour="nav-settings"]',
  },
  {
    title: "Era runs. Your team focuses on care.",
    body: "From this point forward, Era handles follow-ups, reminders, check-ins, and newsletters — quietly, automatically, on your behalf. Your receptionist and nurse each get their own tour when they log in. Restart this tour any time with the ? button.",
  },
];

/* ── Receptionist tour ──────────────────────────────────────────────────────
   Purpose: show how their role connects to the rest of the clinic.
*/
const RECEPTIONIST_STEPS: Step[] = [
  {
    title: "Welcome to Era Patient",
    body: "You're the first point of contact — and the first link in a chain that makes sure every patient is cared for long after they leave. Here's your workspace.",
  },
  {
    title: "The pulse of your day",
    body: "When a patient arrives, you check them in here and they appear instantly in the nurse's station. No delays, no calls across the office — the whole team moves in real time from the moment a patient walks through the door.",
    target: '[data-tour="nav-queue"]',
  },
  {
    title: "Registering a new patient",
    body: "For anyone visiting for the first time. One short form puts them in the system permanently — every future visit builds on it, and their full history is always one tap away for the whole team.",
    target: '[data-tour="new-patient"]',
  },
  {
    title: "Patients who need a personal call",
    body: "Some patients need more than an automated message. These are the ones your team has flagged for a follow-up call — worked through daily, this list makes sure no patient ever wonders if anyone is thinking about them.",
    target: '[data-tour="nav-call-tasks"]',
  },
  {
    title: "Your scheduling front desk",
    body: "Book, reschedule, and cancel appointments from here. Patients receive automatic confirmations and reminders for every booking — so your phone stops ringing with 'when is my appointment again?' questions.",
    target: '[data-tour="nav-appointments"]',
  },
  {
    title: "You keep the clinic moving.",
    body: "You're the thread that connects patients to care. Era handles the behind-the-scenes admin so you can stay fully focused on the people in front of you. Restart this tour any time with the ? button.",
  },
];

/* ── Nurse tour ─────────────────────────────────────────────────────────────
   Purpose: show that Era is designed around the nurse's consultation flow.
*/
const NURSE_STEPS: Step[] = [
  {
    title: "Welcome to Era Patient",
    body: "Era is built around your workflow. Patients arrive at your station prepared — their history is already open, their previous care plans are visible, and you can focus entirely on the consultation.",
  },
  {
    title: "Your consultation workspace",
    body: "The moment the receptionist checks a patient in, they appear here. Their full visit history and existing care notes are already loaded. After the consultation, you record what happened and update their care plan — and Era takes everything from there.",
    target: '[data-tour="nav-nurse-station"]',
  },
  {
    title: "Era takes the follow-through.",
    body: "The moment you update a care plan, Era gets to work — sending the patient a warm, plain-English explanation of their plan, scheduling follow-up reminders, and making sure they stay informed and supported. You focus on the consultation. Era handles everything after. Restart this tour any time with the ? button.",
  },
];

const STEPS_FOR_ROLE: Record<Role, Step[]> = {
  admin: ADMIN_STEPS,
  receptionist: RECEPTIONIST_STEPS,
  nurse: NURSE_STEPS,
};

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
  const CARD_H_EST = 200;
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

  if (transform === "none") {
    const leftNum = parseFloat(left);
    if (leftNum + CARD_W > window.innerWidth - 16) {
      left = `${Math.max(16, window.innerWidth - CARD_W - 16)}px`;
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top,
        left,
        transform,
        width: Math.min(CARD_W, window.innerWidth - 32),
        zIndex: 9999,
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 14,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        padding: "20px 20px 16px",
      }}
    >
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
          title="Close tour"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed mb-4">{step.body}</p>

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

  const steps = STEPS_FOR_ROLE[role] ?? ADMIN_STEPS;

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!user || !hospital) return;
    if (sessionStorage.getItem("era_tour_pending") === "1") {
      sessionStorage.removeItem("era_tour_pending");
      const t = setTimeout(() => {
        setStepIndex(0);
        setActive(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [user, hospital]);

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
      setActive(false);
      return;
    }
    let next = stepIndex + 1;
    while (next < steps.length - 1 && steps[next].target && !document.querySelector(steps[next].target!)) {
      next++;
    }
    setStepIndex(next);
  }, [stepIndex, steps]);

  const retreat = useCallback(() => {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }, [stepIndex]);

  const skip = useCallback(() => {
    setActive(false);
  }, []);

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
