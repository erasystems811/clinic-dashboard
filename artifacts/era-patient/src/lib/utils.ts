import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns all stages a patient is currently in.
 * Stages are reflective — a patient can be in multiple simultaneously:
 *   - primary stage from patients.stage (In Care, Post Treatment, Active, Dormant, etc.)
 *   - "Queued" overlay when is_in_queue === true and primary stage isn't already "Queued"
 *   - "In Care" safety-net from hasCarePlan (catches cases where stage hasn't updated yet)
 */
// Maps legacy stage names to current display names.
const STAGE_ALIASES: Record<string, string> = { "Post Care": "Active" };

export function getPatientStages(patient: { stage?: string | null } & Record<string, unknown>): string[] {
  const raw = (patient.stage as string | null) ?? "";
  const primary = STAGE_ALIASES[raw] ?? raw;
  const stages: string[] = [];

  if (primary) stages.push(primary);

  // Queued = currently in the queue (transient, derived from queue table)
  if (patient.isInQueue === true && !stages.includes("Queued")) {
    stages.push("Queued");
  }

  // Booked = has at least one upcoming appointment (derived from appointments table)
  if (patient.isBooked === true && !stages.includes("Booked")) {
    stages.push("Booked");
  }

  // In Care = has at least one active care plan (derived from care_plans table)
  if (patient.hasCarePlan === true && !stages.includes("In Care")) {
    stages.push("In Care");
  }

  return Array.from(new Set(stages)).filter(Boolean);
}
