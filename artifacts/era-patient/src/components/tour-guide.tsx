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
    body: "This quick tour walks you through every section of the system so your team can hit the ground running. It takes under 2 minutes.",
  },
  {
    title: "Add a New Patient",
    body: "Tap this button to register a new patient. You'll enter their name, contact info, treatment notes, and care plan — everything in one place.",
    target: '[data-tour="new-patient"]',
  },
  {
    title: "Patient Records",
    body: "Your full patient list lives here. Search by name or ID, open any profile to view their visit history, treatment notes, pipeline stage, and all messages sent to them.",
    target: '[data-tour="nav-patients"]',
  },
  {
    title: "Appointments",
    body: "Book and manage appointments from this calendar view. Patients automatically receive a reminder before their visit — no manual follow-up needed.",
    target: '[data-tour="nav-appointments"]',
  },
  {
    title: "Automation Pipeline",
    body: "This is Era's automation engine. After treatment, each patient moves through stages (In Care → Post Care → Dormant) and the system sends WhatsApp messages or emails on your behalf at each stage — completely hands-free.",
    target: '[data-tour="nav-pipeline"]',
  },
  {
    title: "Activity Log",
    body: "Every message, reminder, and automated action is recorded here with its delivery status. If anything failed to send, you can retry it directly from this screen.",
    target: '[data-tour="nav-activity"]',
  },
  {
    title: "Patient Feedback",
    body: "After each visit, patients receive a link to rate their experience. All their star ratings and comments appear here so you can monitor satisfaction and act on any issues.",
    target: '[data-tour="nav-feedback-admin"]',
  },
  {
    title: "Wellness Newsletter",
    body: "Compose and send health tips or seasonal wellness content to all your active patients at once. It keeps your clinic top-of-mind between visits.",
    target: '[data-tour="nav-wellness"]',
  },
  {
    title: "Settings",
    body: "Manage your clinic configuration here — update staff login passwords for your nurse and receptionist, and adjust system preferences.",
    target: '[data-tour="nav-settings"]',
  },
  {
    title: "You're all set! 🎉",
    body: "Your receptionist and nurse each have their own tour when they log in. You can restart this tour any time by tapping the ? icon at the bottom of the sidebar.",
  },
];

const RECEPTIONIST_STEPS: Step[] = [
  {
    title: "Welcome! 👋",
    body: "You're logged in as the Receptionist. This quick tour covers the tools you'll use every day.",
  },
  {
    title: "Queue Management",
    body: "When a patient arrives at reception, find them here and check them in. The queue updates in real time so the doctor and nurse always know who's waiting.",
    target: '[data-tour="nav-queue"]',
  },
  {
    title: "Register a New Patient",
    body: "First-time visitor? Use this button to register them before checking them into the queue. Takes about 60 seconds.",
    target: '[data-tour="new-patient"]',
  },
  {
    title: "Call Tasks",
    body: "Patients flagged for a follow-up phone call show up here. Work through this list daily — each card tells you who to call and why.",
    target: '[data-tour="nav-call-tasks"]',
  },
  {
    title: "Appointments",
    body: "Book and view upcoming appointments from here. You can also reschedule or cancel directly from the calendar.",
    target: '[data-tour="nav-appointments"]',
  },
  {
    title: "You're ready! 🎉",
    body: "That covers your workspace. Check in your first patient when you're ready. You can restart this tour any time using the ? icon at the bottom of the sidebar.",
  },
];

const NURSE_STEPS: Step[] = [
  {
    title: "Welcome, Nurse! 👋",
    body: "This short tour covers your workspace in Era Patient.",
  },
  {
    title: "Nurse Station",
    body: "Once the receptionist checks a patient in from the queue, their card appears here. Review their visit history and existing notes, then record vitals and update their treatment plan after the consultation.",
    target: '[data-tour="nav-nurse-station"]',
  },
  {
    title: "You're all set! 🎉",
    body: "Patients appear in your station as soon as reception checks them in. You can restart this tour any time using the ? icon at the bottom of the sidebar.",
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

  // Keep card within viewport horizontally
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
          title="Close tour"
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

  const steps = STEPS_FOR_ROLE[role] ?? ADMIN_STEPS;

  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  // Auto-start on login (sessionStorage flag set by auth context after each login)
  useEffect(() => {
    if (!user || !hospital) return;
    if (sessionStorage.getItem("era_tour_pending") === "1") {
      sessionStorage.removeItem("era_tour_pending");
      // Small delay so sidebar nav items are fully rendered
      const t = setTimeout(() => {
        setStepIndex(0);
        setActive(true);
      }, 600);
      return () => clearTimeout(t);
    }
  }, [user, hospital]);

  // Manual restart via ? button
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
    // Skip steps whose target element is absent (e.g. disabled module)
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
