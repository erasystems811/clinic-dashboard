import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns all stages a patient is currently in.
 *
 * Three groups — groups 2 & 3 suppress group 1 entirely:
 *
 *  Group 1 — baseline states (patient between treatments):
 *    Active, Dormant
 *
 *  Group 2 — currently receiving treatment:
 *    In Care  (derived from hasCarePlan)
 *
 *  Group 3 — recently completed treatment:
 *    Post Treatment
 *
 * Rules:
 *  - Groups 2 + 3 CAN coexist (in care for one condition, post-treatment for another).
 *  - If the patient is in Group 2 OR Group 3, Group 1 is hidden — a patient in active
 *    treatment or recovery is never also "Active" or "Dormant".
 *  - Queued & Booked are transient overlays that stack on top of any state.
 */
const STAGE_ALIASES: Record<string, string> = { "Post Care": "Active" };

const BASELINE_STAGES = new Set(["Active", "Post Care", "Dormant"]);

export function getPatientStages(patient: { stage?: string | null } & Record<string, unknown>): string[] {
  const raw = (patient.stage as string | null) ?? "";
  const primary = STAGE_ALIASES[raw] ?? raw;
  const inCare = patient.hasCarePlan === true;

  // Patient is "in treatment" if they have active care plans OR are in post-treatment recovery.
  // In either case, baseline states (Active, Dormant) are suppressed — they don't apply.
  const inTreatment = inCare || primary === "Post Treatment";

  const stages: string[] = [];

  if (primary && !(inTreatment && BASELINE_STAGES.has(primary))) {
    stages.push(primary);
  }

  // Queued = currently in the queue (transient overlay)
  if (patient.isInQueue === true && !stages.includes("Queued")) {
    stages.push("Queued");
  }

  // Booked = upcoming appointment (transient overlay)
  if (patient.isBooked === true && !stages.includes("Booked")) {
    stages.push("Booked");
  }

  // In Care = has active care plan(s)
  if (inCare && !stages.includes("In Care")) {
    stages.push("In Care");
  }

  return Array.from(new Set(stages)).filter(Boolean);
}
