import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns all stages a patient is currently in.
 *
 * Rules:
 *  - "In Care" (from hasCarePlan) stacks with "Post Treatment" and "Dormant" —
 *    a patient can be recovering from one treatment while actively in care for another.
 *  - "Active" + "In Care" is redundant: Active means "engaged but between treatments",
 *    which is obviously true if they have a care plan. Suppress "Active" in that case.
 *  - "Queued" and "Booked" are transient overlays that can stack with any state.
 */
const STAGE_ALIASES: Record<string, string> = { "Post Care": "Active" };

export function getPatientStages(patient: { stage?: string | null } & Record<string, unknown>): string[] {
  const raw = (patient.stage as string | null) ?? "";
  const primary = STAGE_ALIASES[raw] ?? raw;
  const inCare = patient.hasCarePlan === true;
  const stages: string[] = [];

  // Suppress "Active" when In Care — it's redundant (they're clearly active if they have a plan).
  // "Post Treatment" and "Dormant" are meaningful even alongside In Care, so keep them.
  if (primary && !(inCare && (primary === "Active" || primary === "Post Care"))) {
    stages.push(primary);
  }

  // Queued = in the queue right now (transient overlay)
  if (patient.isInQueue === true && !stages.includes("Queued")) {
    stages.push("Queued");
  }

  // Booked = upcoming appointment (transient overlay)
  if (patient.isBooked === true && !stages.includes("Booked")) {
    stages.push("Booked");
  }

  // In Care = active care plan exists
  if (inCare && !stages.includes("In Care")) {
    stages.push("In Care");
  }

  return Array.from(new Set(stages)).filter(Boolean);
}
