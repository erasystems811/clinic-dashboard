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

export function formatDate(date?: Date): string {
  return (date ?? new Date()).toLocaleDateString("en-NG", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
