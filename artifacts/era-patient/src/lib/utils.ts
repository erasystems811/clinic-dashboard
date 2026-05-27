import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns all stages a patient is currently in.
 *
 * Stage priority rules:
 *  - If the patient has active care plans (hasCarePlan), they are "In Care" — the stored
 *    patients.stage is ignored completely. In Care is mutually exclusive with Active,
 *    Post Treatment, etc.
 *  - "Queued" and "Booked" are transient overlays that can stack on top of any state.
 */
const STAGE_ALIASES: Record<string, string> = { "Post Care": "Active" };

export function getPatientStages(patient: { stage?: string | null } & Record<string, unknown>): string[] {
  const raw = (patient.stage as string | null) ?? "";
  const primary = STAGE_ALIASES[raw] ?? raw;
  const stages: string[] = [];

  // hasCarePlan = true means the patient is actively in care.
  // In that case the stored patients.stage (Active, Dormant, etc.) is stale/overridden —
  // do NOT include it. "In Care" will be added below.
  const inCare = patient.hasCarePlan === true;

  if (primary && !inCare) stages.push(primary);

  // Queued = currently in the queue (transient overlay — can stack with any state)
  if (patient.isInQueue === true && !stages.includes("Queued")) {
    stages.push("Queued");
  }

  // Booked = has at least one upcoming appointment (transient overlay)
  if (patient.isBooked === true && !stages.includes("Booked")) {
    stages.push("Booked");
  }

  // In Care = has active care plans — overrides the stored stage entirely
  if (inCare && !stages.includes("In Care")) {
    stages.push("In Care");
  }

  return Array.from(new Set(stages)).filter(Boolean);
}
