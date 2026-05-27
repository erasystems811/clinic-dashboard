import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns all stages a patient is currently in.
 * "In Care" is derived from hasCarePlan (set by the API from the care_plans table).
 */
export function getPatientStages(patient: { stage?: string | null } & Record<string, unknown>): string[] {
  const stages: string[] = [];
  if (patient.stage) stages.push(patient.stage as string);
  // Add "In Care" if the patient has active care plans and their primary stage isn't already In Care
  if (patient.hasCarePlan === true && patient.stage !== "In Care") {
    stages.push("In Care");
  }
  return Array.from(new Set(stages)).filter(Boolean);
}
