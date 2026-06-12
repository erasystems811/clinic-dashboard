import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/social";

function headers() {
  const token = localStorage.getItem("era_me_session");
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

export interface StreakItem { type: string; label: string; emoji: string; streak: number }

export interface PartnerProfile { id: number; username: string; displayName: string | null }

export interface Partners {
  partners: { id: number; other: PartnerProfile; since: string }[];
  incoming: { id: number; from: PartnerProfile; createdAt: string }[];
  outgoing: { id: number; to: PartnerProfile; createdAt: string }[];
}

export interface SearchResult {
  id: number;
  username: string;
  displayName: string | null;
  status: "none" | "pending_sent" | "pending_received" | "accepted";
}

export function useMyStreaks() {
  return useQuery<{ streaks: StreakItem[] }>({
    queryKey: ["social", "my-streaks"],
    queryFn: () => get(`${BASE}/my-streaks`),
  });
}

export function usePartners() {
  return useQuery<Partners>({
    queryKey: ["social", "partners"],
    queryFn: () => get(`${BASE}/partners`),
  });
}

export function useSearchUsers(q: string) {
  return useQuery<SearchResult[]>({
    queryKey: ["social", "search", q],
    queryFn: () => get(`${BASE}/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function usePartnerStreaks(id: number | null) {
  return useQuery<{ partner: PartnerProfile; streaks: StreakItem[] }>({
    queryKey: ["social", "partner-streaks", id],
    queryFn: () => get(`${BASE}/partners/${id}/streaks`),
    enabled: id !== null,
  });
}

export function useSendRequest() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (username) => post(`${BASE}/partners/request`, { username }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); },
  });
}

export function useAcceptRequest() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({
    mutationFn: (id) => patch(`${BASE}/partners/${id}/accept`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); },
  });
}

export function useDeclineRequest() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, number>({
    mutationFn: (id) => patch(`${BASE}/partners/${id}/decline`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); },
  });
}

export function useRemovePartner() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => del(`${BASE}/partners/${id}`),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["social"] }); },
  });
}
