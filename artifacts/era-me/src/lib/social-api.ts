import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/social";

function getToken(): string | null {
  try {
    const stored = localStorage.getItem("era_me_session");
    if (!stored) return null;
    return (JSON.parse(stored) as { token: string }).token ?? null;
  } catch { return null; }
}
function headers() {
  const token = getToken();
  return { "Content-Type": "application/json", ...(token ? { "x-patient-token": token } : {}) };
}
async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: headers() });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}
async function post<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: headers(), body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) { const t = await r.text(); let m = t; try { m = (JSON.parse(t) as { error?: string }).error ?? t; } catch { /**/ } throw new Error(m); }
  return r.json() as Promise<T>;
}
async function patch<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(path, { method: "PATCH", headers: headers(), body: body !== undefined ? JSON.stringify(body) : undefined });
  if (!r.ok) { const t = await r.text(); let m = t; try { m = (JSON.parse(t) as { error?: string }).error ?? t; } catch { /**/ } throw new Error(m); }
  return r.json() as Promise<T>;
}
async function del(path: string): Promise<void> {
  const r = await fetch(path, { method: "DELETE", headers: headers() });
  if (!r.ok) throw new Error(await r.text());
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StreakItem { type: string; label: string; emoji: string; streak: number }
export interface PartnerProfile { id: number; username: string; displayName: string | null }
export interface SharedGoal { module: string; target: number; label: string }

export interface Partners {
  partners: { id: number; other: PartnerProfile; since: string; sharedModules: string[]; sharedGoal: SharedGoal | null }[];
  incoming: { id: number; from: PartnerProfile; createdAt: string }[];
  outgoing: { id: number; to: PartnerProfile; createdAt: string }[];
}

export interface SearchResult {
  id: number; username: string; displayName: string | null;
  status: "none" | "pending_sent" | "pending_received" | "accepted";
}

export interface PartnerStreaks {
  partner: PartnerProfile;
  streaks: StreakItem[];
  sharedModules: string[];
  sharedGoal: SharedGoal | null;
}

export interface GoalProgress {
  goal: SharedGoal | null;
  myProgress?: { value: number; done: boolean };
  partnerProgress?: { value: number; done: boolean };
}

export interface WomensHealthSummary {
  hasData: boolean;
  mode?: "cycle" | "pregnancy";
  isSetUp?: boolean;
  // cycle
  phase?: string;
  cycleDay?: number;
  cycleLength?: number;
  daysUntilNextPeriod?: number;
  // pregnancy
  weeks?: number;
  trimester?: 1 | 2 | 3;
  dueDate?: string;
  isPostpartum?: boolean;
}

export interface Group {
  id: number; name: string; goalModule: string; goalTarget: number | null;
  goalLabel: string | null; createdBy: number; memberCount: number;
}

export interface GroupMember {
  accountId: number; displayName: string; username: string;
  value: number; done: boolean; isMe: boolean;
}

export interface GroupDetail { group: Group; members: GroupMember[]; myStatus: string }

// ── Goal module catalogue (matches backend SHAREABLE_GOAL_MODULES) ─────────────
export const GOAL_MODULES = [
  { type: "water",     label: "Water",     emoji: "💧", unit: "cups",         defaultTarget: 8  },
  { type: "workout",   label: "Workout",   emoji: "🏃", unit: "sessions",     defaultTarget: 1  },
  { type: "fruit",     label: "Fruit",     emoji: "🍎", unit: "portions",     defaultTarget: 5  },
  { type: "sleep",     label: "Sleep",     emoji: "😴", unit: "hrs sleep",    defaultTarget: 7  },
  { type: "outdoors",  label: "Outdoors",  emoji: "🌿", unit: "minutes",      defaultTarget: 30 },
  { type: "sunscreen", label: "Sunscreen", emoji: "☀️", unit: "applications", defaultTarget: 2  },
];

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useMyStreaks() {
  return useQuery<{ streaks: StreakItem[] }>({ queryKey: ["social", "my-streaks"], queryFn: () => get(`${BASE}/my-streaks`) });
}
export function usePartners() {
  return useQuery<Partners>({ queryKey: ["social", "partners"], queryFn: () => get(`${BASE}/partners`) });
}
export function useSearchUsers(q: string) {
  return useQuery<SearchResult[]>({ queryKey: ["social", "search", q], queryFn: () => get(`${BASE}/search?q=${encodeURIComponent(q)}`), enabled: q.trim().length >= 2, staleTime: 10_000 });
}
export function usePartnerStreaks(id: number | null) {
  return useQuery<PartnerStreaks>({ queryKey: ["social", "partner-streaks", id], queryFn: () => get(`${BASE}/partners/${id}/streaks`), enabled: id !== null });
}
export function usePartnerWomensHealth(id: number | null, enabled: boolean) {
  return useQuery<WomensHealthSummary>({ queryKey: ["social", "partner-wh", id], queryFn: () => get(`${BASE}/partners/${id}/womens-health`), enabled: id !== null && enabled });
}
export function usePartnerGoalProgress(id: number | null) {
  return useQuery<GoalProgress>({ queryKey: ["social", "goal-progress", id], queryFn: () => get(`${BASE}/partners/${id}/goal-progress`), enabled: id !== null, refetchInterval: 60_000 });
}
export function useMyGroups() {
  return useQuery<{ groups: Group[]; invites: Group[] }>({ queryKey: ["social", "groups"], queryFn: () => get(`${BASE}/groups`) });
}
export function useGroupDetail(id: number | null) {
  return useQuery<GroupDetail>({ queryKey: ["social", "group", id], queryFn: () => get(`${BASE}/groups/${id}`), enabled: id !== null, refetchInterval: 60_000 });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useSendRequest() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({ mutationFn: (u) => post(`${BASE}/partners/request`, { username: u }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); } });
}
export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({ mutationFn: (id) => patch(`${BASE}/partners/${id}/accept`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); } });
}
export function useDeclineRequest() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({ mutationFn: (id) => patch(`${BASE}/partners/${id}/decline`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); } });
}
export function useRemovePartner() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({ mutationFn: (id) => del(`${BASE}/partners/${id}`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); } });
}
export function useUpdatePartnerSettings() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { id: number; sharedModules?: string[]; sharedGoal?: SharedGoal | null }>({
    mutationFn: ({ id, ...body }) => patch(`${BASE}/partners/${id}/settings`, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); },
  });
}
export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean; groupId: number }, Error, { name: string; goalModule: string; goalTarget: number; goalLabel: string }>({
    mutationFn: (body) => post(`${BASE}/groups`, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social", "groups"] }); },
  });
}
export function useInviteToGroup() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { groupId: number; username: string }>({
    mutationFn: ({ groupId, username }) => post(`${BASE}/groups/${groupId}/invite`, { username }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social", "groups"] }); },
  });
}
export function useAcceptGroupInvite() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({ mutationFn: (id) => patch(`${BASE}/groups/${id}/accept`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); } });
}
export function useDeclineGroupInvite() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({ mutationFn: (id) => patch(`${BASE}/groups/${id}/decline`), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); } });
}
export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({ mutationFn: (id) => del(`${BASE}/groups/${id}/leave`) as unknown as Promise<{ ok: boolean }>, onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); } });
}
