import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Returns all stages a patient is currently in (primary stage + any active_stages). */
export function getPatientStages(patient: { stage?: string | null } & Record<string, unknown>): string[] {
  const active = (patient.activeStages as string[] | null | undefined) ?? [];
  return Array.from(new Set([...(patient.stage ? [patient.stage] : []), ...active])).filter(Boolean) as string[];
}
