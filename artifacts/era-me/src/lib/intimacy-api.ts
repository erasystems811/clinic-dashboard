import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ── Session storage helpers ───────────────────────────────────────────────────
const UNLOCK_KEY = (id: number) => `era_intimacy_unlocked_${id}`;

export function isIntimacyUnlocked(accountId: number): boolean {
  try { return sessionStorage.getItem(UNLOCK_KEY(accountId)) === "1"; } catch { return false; }
}
export function setIntimacyUnlocked(accountId: number) {
  try { sessionStorage.setItem(UNLOCK_KEY(accountId), "1"); } catch {}
}
export function clearIntimacyUnlocked(accountId: number) {
  try { sessionStorage.removeItem(UNLOCK_KEY(accountId)); } catch {}
}

// ── Positions catalog (built-in) ──────────────────────────────────────────────
export const POSITIONS = [
  { id: "missionary",      name: "Classic",          category: "classic",     desc: "Face-to-face, intimate connection",           difficulty: 1 },
  { id: "cowgirl",         name: "Riding",           category: "classic",     desc: "You're in full control",                      difficulty: 1 },
  { id: "reverse_cowgirl", name: "Reverse Rider",    category: "classic",     desc: "Facing away, deeper sensation",               difficulty: 2 },
  { id: "doggy",           name: "From Behind",      category: "classic",     desc: "Deep connection, intense sensation",          difficulty: 1 },
  { id: "spooning",        name: "Spooning",         category: "intimate",    desc: "Side-by-side, close and warm",                difficulty: 1 },
  { id: "lotus",           name: "Lotus",            category: "intimate",    desc: "Seated face-to-face, deeply bonding",         difficulty: 2 },
  { id: "butterfly",       name: "Butterfly",        category: "elevated",    desc: "Edge of bed, hips elevated",                  difficulty: 2 },
  { id: "standing",        name: "Standing",         category: "adventurous", desc: "On your feet, spontaneous and exciting",     difficulty: 3 },
  { id: "chair",           name: "The Chair",        category: "adventurous", desc: "Seated and riding, full control",             difficulty: 2 },
  { id: "edge_of_bed",     name: "Edge of Bed",      category: "classic",     desc: "One standing, one lying at the edge",         difficulty: 1 },
  { id: "scissors",        name: "Scissors",         category: "intimate",    desc: "Side-by-side, legs intertwined",              difficulty: 3 },
  { id: "bridge",          name: "The Bridge",       category: "elevated",    desc: "Arched upward, opens everything up",          difficulty: 4 },
  { id: "wall",            name: "Against the Wall", category: "adventurous", desc: "Standing, pinned against a wall",             difficulty: 3 },
  { id: "pretzel",         name: "Pretzel Dip",      category: "elevated",    desc: "Intertwined bodies, uniquely deep",           difficulty: 3 },
  { id: "flat",            name: "Flat Lay",         category: "intimate",    desc: "Both lying flat, slow and connected",         difficulty: 1 },
  { id: "table_top",       name: "Table Top",        category: "adventurous", desc: "Any elevated surface, exciting angle",        difficulty: 2 },
  { id: "cradle",          name: "The Cradle",       category: "intimate",    desc: "Legs wrapped around, deeply close",           difficulty: 2 },
  { id: "waterfall",       name: "Waterfall",        category: "elevated",    desc: "Head over the edge, intense rush",            difficulty: 3 },
  { id: "cat",             name: "The CAT",          category: "intimate",    desc: "Coital alignment, maximum sensation",         difficulty: 2 },
  { id: "wheelbarrow",     name: "Wheelbarrow",      category: "elevated",    desc: "Legs raised, arms on floor, intense",         difficulty: 5 },
] as const;

export type PositionId = typeof POSITIONS[number]["id"];

export const POSITION_CATEGORIES = {
  classic:     { label: "Classic",     color: "#e11d48" },
  intimate:    { label: "Intimate",    color: "#a855f7" },
  elevated:    { label: "Elevated",    color: "#f59e0b" },
  adventurous: { label: "Adventurous", color: "#10b981" },
} as const;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface IntimacySettings {
  mode: "celibacy" | "active";
  freakyMode: boolean;
  weeklyGoal: number | null;
  contraception: string | null;
  lastStiTest: string | null;
  stiTestIntervalMonths: number;
  hasPartner: boolean;
  notes: string | null;
}

export interface CelibacyData {
  streak: { startDate: string; daysFree: number; reason: string } | null;
  todayCheckin: { maintained: boolean } | null;
  history: { startDate: string; endDate: string; days: number; reason: string }[];
}

export interface SessionData {
  week: {
    id: number; date: string; type: string;
    durationMinutes: number | null; satisfaction: number | null;
    emotionalConnection: number | null; libidoLevel: number | null; postinorTaken: boolean;
  }[];
  stats: { totalSessions: number; thisWeek: number; thisMonth: number };
}

export interface PositionStat {
  positionId: string; count: number; avgSatisfaction: number | null;
}

export interface PostinorData {
  logs: { takenAt: string; nextSafeDate: string; notes: string | null }[];
  latest: { takenAt: string; nextSafeDate: string } | null;
  safeNow: boolean;
  daysToSafe: number | null;
  recentCount: number;
}

export interface PartnerData {
  hasPartner: boolean;
  partner: { id: number; displayName: string } | null;
  pendingInvite: { code: string; expiresAt: string } | null;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
export function useSaveIntimacyDob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dob: string) =>
      apiFetch<{ ok: boolean; age: number; ageOk: boolean }>("/api/patient-app/intimacy/save-dob", {
        method: "POST", auth: true, body: JSON.stringify({ dob }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intimacy-settings"] }),
  });
}

export function useIntimacySettings() {
  return useQuery({
    queryKey: ["intimacy-settings"],
    queryFn: () => apiFetch<{ isSetUp: boolean; ageOk: boolean; age: number | null; settings: IntimacySettings | null }>(
      "/api/patient-app/intimacy/settings", { auth: true }
    ),
  });
}

export function useSetupIntimacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      pin: string; mode: "celibacy" | "active"; dob?: string;
      celibacyStartDate?: string; weeklyGoal?: number; contraception?: string; celibacyReason?: string;
    }) => apiFetch("/api/patient-app/intimacy/setup", { method: "POST", auth: true, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intimacy-settings"] }),
  });
}

export function useVerifyIntimacyPin() {
  return useMutation({
    mutationFn: (pin: string) =>
      apiFetch("/api/patient-app/intimacy/verify-pin", { method: "POST", auth: true, body: JSON.stringify({ pin }) }),
  });
}

export function useUpdateIntimacySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<IntimacySettings> & { celibacyStartDate?: string; celibacyReason?: string }) =>
      apiFetch("/api/patient-app/intimacy/settings", { method: "PUT", auth: true, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intimacy-settings"] }),
  });
}

export function useCelibacyData() {
  return useQuery<CelibacyData>({
    queryKey: ["intimacy-celibacy"],
    queryFn: () => apiFetch("/api/patient-app/intimacy/celibacy", { auth: true }),
  });
}

export function useCelibacyCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { maintained: boolean; notes?: string }) =>
      apiFetch("/api/patient-app/intimacy/celibacy/checkin", { method: "POST", auth: true, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intimacy-celibacy"] }),
  });
}

export function useIntimacySessions() {
  return useQuery<SessionData>({
    queryKey: ["intimacy-sessions"],
    queryFn: () => apiFetch("/api/patient-app/intimacy/sessions", { auth: true }),
  });
}

export function useLogSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      type?: "solo" | "partnered"; date?: string; durationMinutes?: number;
      protectionUsed?: boolean; postinorTaken?: boolean;
      satisfaction?: number; emotionalConnection?: number; libidoLevel?: number;
      physicalComfort?: number; positionIds?: string[]; notes?: string;
    }) => apiFetch("/api/patient-app/intimacy/sessions", { method: "POST", auth: true, body: JSON.stringify(body) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["intimacy-sessions"] });
      qc.invalidateQueries({ queryKey: ["intimacy-postinor"] });
    },
  });
}

export function usePositionStats() {
  return useQuery<{ stats: PositionStat[] }>({
    queryKey: ["intimacy-positions"],
    queryFn: () => apiFetch("/api/patient-app/intimacy/positions/stats", { auth: true }),
  });
}

export function usePostinorData() {
  return useQuery<PostinorData>({
    queryKey: ["intimacy-postinor"],
    queryFn: () => apiFetch("/api/patient-app/intimacy/postinor", { auth: true }),
  });
}

export function useLogPostinor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { takenAt?: string; notes?: string }) =>
      apiFetch("/api/patient-app/intimacy/postinor", { method: "POST", auth: true, body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intimacy-postinor"] }),
  });
}

export function usePartnerData() {
  return useQuery<PartnerData>({
    queryKey: ["intimacy-partner"],
    queryFn: () => apiFetch("/api/patient-app/intimacy/partner", { auth: true }),
  });
}

export function useGenerateInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ code: string; expiresAt: string }>("/api/patient-app/intimacy/partner/invite", { method: "POST", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intimacy-partner"] }),
  });
}

export function useJoinPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      apiFetch("/api/patient-app/intimacy/partner/join", { method: "POST", auth: true, body: JSON.stringify({ code }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intimacy-partner", "intimacy-settings"] }),
  });
}

export function useDisconnectPartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/patient-app/intimacy/partner", { method: "DELETE", auth: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["intimacy-partner", "intimacy-settings"] }),
  });
}

// Celibacy milestone definitions (mirrors smoking/alcohol pattern)
export const CELIBACY_MILESTONES = [
  { days: 3,   label: "3 Days",    emoji: "🌱", desc: "First steps" },
  { days: 7,   label: "1 Week",    emoji: "💪", desc: "One week strong" },
  { days: 14,  label: "2 Weeks",   emoji: "⭐", desc: "Two weeks clear" },
  { days: 30,  label: "1 Month",   emoji: "🔥", desc: "30-day milestone" },
  { days: 60,  label: "2 Months",  emoji: "💎", desc: "Discipline mastered" },
  { days: 90,  label: "3 Months",  emoji: "🏆", desc: "Quarter year" },
  { days: 180, label: "6 Months",  emoji: "👑", desc: "Half year" },
  { days: 365, label: "1 Year",    emoji: "🌟", desc: "A full year" },
] as const;
