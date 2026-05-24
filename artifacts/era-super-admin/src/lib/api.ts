const TOKEN_KEY = "era_super_admin_token";
const BASE = "/api";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "x-super-admin-token": token } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export function get<T>(path: string) {
  return request<T>(path);
}
export function post<T>(path: string, body: unknown) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}
export function patch<T>(path: string, body: unknown) {
  return request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
}
export function put<T>(path: string, body: unknown) {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

// ── Domain types ──────────────────────────────────────────────────────────────
export interface StaffCredentials {
  nurseUsername: string;
  nursePlainPassword: string;
  receptionistUsername: string;
  receptionistPlainPassword: string;
}

export interface Hospital {
  id: number;
  name: string;
  slug: string;
  username: string;
  active: boolean;
  subscriptionStatus: string;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string | null;
  currentPassword: string | null;
  settings: HospitalSettings | null;
  modules: HospitalModules | null;
  staffCredentials: StaffCredentials | null;
}

export interface HospitalSettings {
  id: number;
  hospitalId: number;
  departments: string[];
  pipelinePostTreatmentDays: number | null;
  pipelineDormantDays: number | null;
  language: string | null;
  tone: string[] | null;
  clinicDescription: string | null;
  sendingEmail: string | null;
  postTreatmentCheckinDays: number | null;
  postCareCheckinDays: number | null;
  whatsappFromNumber: string | null;
}

export interface HospitalModules {
  id: number;
  hospitalId: number;
  appointmentsEnabled: boolean;
  feedbackEnabled: boolean;
  wellnessNewsletterEnabled: boolean;
  whatsappEnabled: boolean;
  messagesEnabled: boolean;
}

export interface AutomationLog {
  id: number;
  hospitalId: number | null;
  hospitalName: string | null;
  patientId: number | null;
  patientName: string | null;
  automationType: string;
  channel: string;
  status: string;
  messagePreview: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  lastAttemptedAt: string | null;
  sentAt: string | null;
}

// ── API calls ─────────────────────────────────────────────────────────────────
export const api = {
  login: (username: string, password: string) =>
    post<{ token: string }>("/super-admin/auth/login", { username, password }),

  logout: () =>
    post<{ ok: boolean }>("/super-admin/auth/logout", {}),

  listHospitals: () =>
    get<Hospital[]>("/super-admin/hospitals"),

  getHospital: (id: number) =>
    get<Hospital>(`/super-admin/hospitals/${id}`),

  createHospital: (data: { name: string; username: string; subscriptionStatus?: string }) =>
    post<Hospital>("/super-admin/hospitals", data),

  updateHospital: (id: number, data: Partial<{ name: string; active: boolean; subscriptionStatus: string; password: string }>) =>
    patch<Hospital>(`/super-admin/hospitals/${id}`, data),

  regeneratePassword: (id: number) =>
    post<{ newPassword: string; hospital: Hospital }>(`/super-admin/hospitals/${id}/regenerate-password`, {}),

  getSettings: (id: number) =>
    get<HospitalSettings>(`/super-admin/hospitals/${id}/settings`),

  updateSettings: (id: number, data: Partial<HospitalSettings>) =>
    put<HospitalSettings>(`/super-admin/hospitals/${id}/settings`, data),

  getModules: (id: number) =>
    get<HospitalModules>(`/super-admin/hospitals/${id}/modules`),

  updateModules: (id: number, data: Partial<HospitalModules>) =>
    put<HospitalModules>(`/super-admin/hospitals/${id}/modules`, data),

  getAutomationLog: (params?: { status?: string; hospitalId?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.hospitalId) qs.set("hospitalId", String(params.hospitalId));
    return get<AutomationLog[]>(`/super-admin/automation-log${qs.toString() ? "?" + qs.toString() : ""}`);
  },

  retryAutomation: (id: number) =>
    post<{ ok: boolean; message: string }>(`/super-admin/automation-log/${id}/retry`, {}),

  resetTestData: () =>
    post<{ ok: boolean; message: string }>("/super-admin/reset-test-data", {}),

  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ ok: boolean }>("/super-admin/change-password", { currentPassword, newPassword }),
};
