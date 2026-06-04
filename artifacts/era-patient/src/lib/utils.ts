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
// "Post Care" is a legacy DB name for "Active".
// "In Care" was historically written to the stage column but is now a derived-only
// badge (from hasCarePlan). Map it to "Active" so legacy rows are handled gracefully:
// the "In Care" badge will still appear via the hasCarePlan derived check below.
const STAGE_ALIASES: Record<string, string> = { "Post Care": "Active", "In Care": "Active" };

const BASELINE_STAGES = new Set(["Active", "Post Care", "Dormant"]);

export function getPatientStages(patient: { stage?: string | null } & Record<string, unknown>, opts?: { apptEnabled?: boolean }): string[] {
  const raw = (patient.stage as string | null) ?? "";
  const primary = STAGE_ALIASES[raw] ?? raw;
  const inCare   = patient.hasCarePlan === true;
  const isQueued = patient.isInQueue   === true;
  const isBooked = patient.isBooked    === true && opts?.apptEnabled !== false;

  // Baseline stages (Active / Dormant) are suppressed whenever the patient has ANY
  // second stage. If they're Queued, Booked, In Care, or Post Treatment their clock
  // is paused — showing "Dormant" alongside those would be misleading.
  const hasSecondStage = inCare || primary === "Post Treatment" || isQueued || isBooked;

  const stages: string[] = [];

  if (primary && !(hasSecondStage && BASELINE_STAGES.has(primary))) {
    stages.push(primary);
  }

  if (isQueued && !stages.includes("Queued"))   stages.push("Queued");
  if (isBooked && !stages.includes("Booked"))   stages.push("Booked");
  if (inCare   && !stages.includes("In Care"))  stages.push("In Care");

  return Array.from(new Set(stages)).filter(Boolean);
}
