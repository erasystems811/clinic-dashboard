export const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function patientAuthHeader(): Record<string, string> {
  try {
    const stored = localStorage.getItem("era_patient_session");
    const session = stored ? JSON.parse(stored) : null;
    const token = session?.token as string | undefined;
    return token ? { "x-patient-token": token } : {};
  } catch {
    return {};
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<T> {
  const { auth = false, ...init } = options ?? {};
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> ?? {}),
    ...(auth ? patientAuthHeader() : {}),
  };
  const res = await fetch(apiUrl(path), { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`);
  return data as T;
}
