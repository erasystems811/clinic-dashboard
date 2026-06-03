/**
 * Returns the base URL for all API calls.
 * In production set VITE_API_BASE_URL to the API server Railway URL.
 * In development leave it unset — relative /api/... paths work via Vite proxy.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function authHeader(): Record<string, string> {
  try {
    const stored = localStorage.getItem("era_hospital_session");
    const session = stored ? JSON.parse(stored) : null;
    const token = session?.token as string | undefined;
    return token ? { "x-hospital-token": token } : {};
  } catch {
    return {};
  }
}
