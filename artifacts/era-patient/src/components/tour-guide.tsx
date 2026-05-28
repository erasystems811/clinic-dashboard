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
    title: "Welcome to Era Patient",
    body: "Era exists so your clinic never loses a patient relationship to silence. Every feature here is designed to keep patients connected, informed, and coming back — without adding work for your team.",
  },
  {
    title: "Every patient starts here",
    body: "Registration is how Era begins building a relationship. The contact details captured here are what the system uses to send care plans, reminders, and follow-ups automatically on your behalf for the entire patient lifetime.",
    target: '[data-tour="new-patient"]',
  },
  {
    title: "Your patient relationships",
    body: "This is the living record of every patient at your clinic — their history, their stage in treatment, every message Era has sent them, and what's coming next. Nothing falls through the cracks because everything is in one place.",
    target: '[data-tour="nav-patients"]',
  },
  {
    title: "Your clinic's schedule",
    body: "Appointments are where the relationship becomes a visit. When an appointment is booked, Era takes over the reminder work — patients are notified 24 hours before and again 1 hour before, so your no-show rate drops without any manual effort.",
    target: '[data-tour="nav-appointments"]',
  },
  {
    title: "The engine that keeps patients close",
    body: "The pipeline is Era's most powerful feature. It tracks where every patient is in their care journey — In Care, Post Treatment, Active, Dormant — and sends the right message at the right moment. After treatment ends, Era checks in on them on Day 1, Day 4, and Day 7. Dormant patients get a gentle re-engagement. None of this requires action from your team.",
    target: '[data-tour="nav-pipeline"]',
  },
  {
    title: "Full visibility into every touchpoint",
    body: "The activity log is your audit trail. Every message Era has sent, every reminder that was delivered, every automation that fired — all here with its delivery status. This is how you prove to yourself (and to patients) that nothing was missed.",
    target: '[data-tour="nav-activity"]',
  },
  {
    title: "The voice of your patients",
    body: "After every visit, Era sends patients a feedback request while the experience is still fresh. What comes back here — the star ratings and comments — is the most honest signal your clinic gets about what's working and what isn't.",
    target: '[data-tour="nav-feedback-admin"]',
  },
  {
    title: "Stay relevant between visits",
    body: "The wellness newsletter exists so patients hear from your clinic even when they're not unwell. A seasonal health tip or a relevant wellness update keeps your brand present in their lives — and keeps them choosing you when they do need care.",
    target: '[data-tour="nav-wellness"]',
  },
  {
    title: "Your clinic's identity in Era",
    body: "Settings is where your clinic's tone, language, and staff access live. Getting these right matters — Era uses your hospital's name, phone number, and communication style in every patient message it sends on your behalf.",
    target: '[data-tour="nav-settings"]',
  },
  {
    title: "You're ready",
    body: "Era works quietly in the background so your team can focus on care. Your receptionist and nurse each have their own walkthrough when they log in. You can restart this tour at any time from the ? icon at the bottom of the sidebar.",
  },
];

const RECEPTIONIST_STEPS: Step[] = [
  {
    title: "Welcome to your workspace",
    body: "Your role in Era is the front door of the clinic. What you do here — checking patients in, managing the queue, booking appointments — is what triggers the rest of the system to work for them.",
  },
  {
    title: "The queue is how care begins",
    body: "When a patient arrives, checking them in here does more than update a list — it notifies the nurse they have a patient waiting and sends the patient a confirmation so they feel acknowledged the moment they walk in.",
    target: '[data-tour="nav-queue"]',
  },
  {
    title: "New patients need a record",
    body: "First-time visitors can't be checked in until they're registered. Capturing their details here is what gives Era everything it needs to send them care plans, reminders, and follow-ups for the entire length of their relationship with your clinic.",
    target: '[data-tour="new-patient"]',
  },
  {
    title: "Your follow-up responsibility",
    body: "Some patients need a personal call — not just an automated message. Call tasks are created when Era judges that a phone conversation is the right next step. Working through this list daily is what separates a clinic that cares from one that doesn't.",
    target: '[data-tour="nav-call-tasks"]',
  },
  {
    title: "The appointment book",
    body: "Booking an appointment here is what arms Era with the information to send automatic reminders. Without a booked appointment, the patient is invisible to the reminder system — so booking accurately is what protects your clinic's schedule.",
    target: '[data-tour="nav-appointments"]',
  },
  {
    title: "You're ready",
    body: "The queue is live, the system is watching, and everything you do here has a knock-on effect for the patient's experience. You can restart this tour any time from the ? icon at the bottom of the sidebar.",
  },
];

const NURSE_STEPS: Step[] = [
  {
    title: "Welcome to your station",
    body: "Your workspace in Era is built around one purpose: giving every patient a care plan that follows them home. The note you write here becomes the foundation for every automated message Era sends on your behalf after the consultation ends.",
  },
  {
    title: "Where care continues after the visit",
    body: "As soon as reception checks a patient in, they appear here. After the consultation, saving their care plan does two things: it sends them an immediate WhatsApp notification, and triggers a detailed email 20 minutes later — giving the patient a clear picture of what to do next, in their own language.",
    target: '[data-tour="nav-nurse-station"]',
  },
  {
    title: "You're ready",
    body: "Your notes don't stay in the file — they become the messages that keep patients on track with their treatment. You can restart this tour any time from the ? icon at the bottom of the sidebar.",
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
  const CARD_W = 340;
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
