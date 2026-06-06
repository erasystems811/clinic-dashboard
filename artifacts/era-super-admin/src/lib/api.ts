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
    throw new Error(err.message ?? err.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function get<T>(path: string) {
  return request<T>(path, { cache: "no-store" });
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
export function del<T>(path: string) {
  return request<T>(path, { method: "DELETE" });
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
  subscriptionExpiresAt: string | null;
  logoUrl: string | null;
  hospitalCode: string | null;
  createdAt: string;
  updatedAt: string | null;
  currentPassword: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  feedbackSlug: string | null;
  settings: HospitalSettings | null;
  modules: HospitalModules | null;
  staffCredentials: StaffCredentials | null;
  patientCount: number;
  walletBalanceKobo: number | null;
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
  senderName: string | null;
  postTreatmentCheckinDays: number | null;
  postCareCheckinDays: number | null;
  whatsappFromNumber: string | null;
  notificationChannel: "whatsapp" | "sms" | null;
  phoneNumber: string | null;
  termiiSenderId: string | null;
  callTaskAiDailyLimit: number | null;
  callTaskAiUsedToday: number;
}

export interface HospitalModules {
  id: number;
  hospitalId: number;
  appointmentsEnabled: boolean;
  feedbackEnabled: boolean;
  wellnessNewsletterEnabled: boolean;
  whatsappEnabled: boolean;
  messagesEnabled: boolean;
  callTaskSmsEnabled: boolean;
  followupSmsEnabled: boolean;
  appointmentReminderSmsEnabled: boolean;
}

export interface WalletInfo {
  balanceKobo: number;
  balanceNaira: number;
  transactions: { id: number; type: string; amount_kobo: number; description: string; flutterwave_ref: string | null; created_at: string }[];
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

  updateHospital: (id: number, data: Partial<{ name: string; active: boolean; subscriptionStatus: string; subscriptionExpiresAt: string | null; password: string; contactEmail: string | null; contactPhone: string | null }>) =>
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

  resetTestData: (hospitalId: number) =>
    post<{ ok: boolean; message: string }>("/super-admin/reset-test-data", { hospitalId }),

  getHealth: () =>
    get<{ ok: boolean; anyWarning?: boolean; checks: { name: string; ok: boolean; warning?: boolean; detail: string; balance?: string; flagged?: boolean; flaggedAt?: string }[] }>("/super-admin/health"),

  setServiceAlert: (service: string) =>
    post<{ ok: boolean }>("/super-admin/service-alert", { service }),

  clearServiceAlert: (service: string) =>
    del<{ ok: boolean }>(`/super-admin/service-alert/${encodeURIComponent(service)}`),

  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ ok: boolean }>("/super-admin/change-password", { currentPassword, newPassword }),

  getConfig: () =>
    get<{ eraPatientUrl: string }>("/super-admin/config"),

  listSupportTickets: () =>
    get<{ id: number; hospital_id: number; hospital_name: string; subject: string; status: string; created_at: string; last_message: { sender: string; preview: string; created_at: string } | null }[]>("/super-admin/support/tickets"),

  getSupportThread: (id: number) =>
    get<{ ticket: object; messages: { id: number; sender: string; message: string; created_at: string }[] }>(`/super-admin/support/tickets/${id}/messages`),

  replyToTicket: (id: number, message: string) =>
    patch<{ ok: boolean }>(`/super-admin/support/tickets/${id}/reply`, { message }),

  reopenTicket: (id: number) =>
    patch<{ ok: boolean }>(`/super-admin/support/tickets/${id}/reopen`, {}),

  testSms: (to: string, senderId?: string) =>
    post<{ ok: boolean; detail: string }>("/super-admin/test-sms", { to, senderId }),

  testEmail: (to: string) =>
    post<{ ok: boolean; to?: string; from?: string; error?: string }>("/super-admin/test-email", { to }),

  getHospitalWallet: (id: number) =>
    get<WalletInfo>(`/super-admin/hospitals/${id}/wallet`),
};
