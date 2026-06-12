import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function formatDate(date: Date = new Date()): string {
  return date.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" });
}

// Premium plan pricing
export const PRICING = {
  personal: { monthly: 3500, yearly: Math.round(3500 * 12 * 0.95) },
  student:  { monthly: 2500, yearly: Math.round(2500 * 12 * 0.95) },
  family:   { monthly: 5500, yearly: Math.round(5500 * 12 * 0.95) },
} as const;

export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG")}`;
}
