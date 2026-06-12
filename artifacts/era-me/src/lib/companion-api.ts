import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/companion";

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
  if (!r.ok) {
    const t = await r.text(); let m = t;
    try { m = (JSON.parse(t) as { error?: string }).error ?? t; } catch { /**/ }
    throw new Error(m);
  }
  return r.json() as Promise<T>;
}
async function patch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "PATCH", headers: headers(), body: JSON.stringify(body) });
  if (!r.ok) { const t = await r.text(); let m = t; try { m = (JSON.parse(t) as { error?: string }).error ?? t; } catch { /**/ } throw new Error(m); }
  return r.json() as Promise<T>;
}
async function del(path: string): Promise<void> {
  await fetch(path, { method: "DELETE", headers: headers() });
}

export interface CompanionSettings {
  hasPin: boolean;
  isSetUp: boolean;
  entryTab: string;
  personality: Record<string, unknown>;
  isBirthday: boolean;
  birthdayAge: number | null;
}

export interface DiaryEntry {
  id: number;
  type: "journal" | "conversation";
  title: string | null;
  preview: string | null;
  mood: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiaryEntryDetail {
  id: number;
  type: "journal" | "conversation";
  title: string | null;
  content: string | null;
  mood: number | null;
  createdAt: string;
  messages: { id: number; role: "user" | "assistant"; content: string; created_at: string }[];
}

export function useCompanionSettings() {
  return useQuery<CompanionSettings>({ queryKey: ["companion", "settings"], queryFn: () => get(`${BASE}/settings`) });
}

export function useDiaryEntries() {
  return useQuery<DiaryEntry[]>({ queryKey: ["companion", "entries"], queryFn: () => get(`${BASE}/entries`) });
}

export function useDiaryEntry(id: number | undefined) {
  return useQuery<DiaryEntryDetail>({
    queryKey: ["companion", "entry", id],
    queryFn: () => get(`${BASE}/entries/${id}`),
    enabled: !!id,
  });
}

export function usePersonality() {
  return useQuery<{ personality: Record<string, unknown>; conversationCount: number; hasInsights: boolean }>({
    queryKey: ["companion", "personality"],
    queryFn: () => get(`${BASE}/personality`),
  });
}

export function useSetupCompanion() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { pin: string; entryTab: string }>({
    mutationFn: (b) => post(`${BASE}/setup`, b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["companion"] }),
  });
}

export function useVerifyPin() {
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (pin) => post(`${BASE}/verify-pin`, { pin }),
  });
}

export function useChangePin() {
  return useMutation<{ ok: boolean }, Error, { currentPin: string; newPin: string }>({
    mutationFn: (b) => patch(`${BASE}/pin`, b),
  });
}

export function useChangeEntryTab() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, string>({
    mutationFn: (entryTab) => patch(`${BASE}/entry-tab`, { entryTab }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["companion", "settings"] }),
  });
}

export function useSaveJournal() {
  const qc = useQueryClient();
  return useMutation<DiaryEntryDetail, Error, { title?: string; content: string; mood?: number }>({
    mutationFn: (b) => post(`${BASE}/entries`, b),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["companion", "entries"] }),
  });
}

export function useUpdateJournal(id: number) {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { title?: string; content: string; mood?: number }>({
    mutationFn: (b) => patch(`${BASE}/entries/${id}`, b),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["companion", "entry", id] }); void qc.invalidateQueries({ queryKey: ["companion", "entries"] }); },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => del(`${BASE}/entries/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["companion", "entries"] }),
  });
}

export function useStartConversation() {
  const qc = useQueryClient();
  return useMutation<{ entryId: number; openingMessage: string }, Error, void>({
    mutationFn: () => post(`${BASE}/conversation`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["companion", "entries"] }),
  });
}

export function useSendMessage(entryId: number) {
  const qc = useQueryClient();
  return useMutation<{ reply: string }, Error, string>({
    mutationFn: (message) => post(`${BASE}/entries/${entryId}/chat`, { message }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["companion", "entry", entryId] }); void qc.invalidateQueries({ queryKey: ["companion", "personality"] }); },
  });
}

// ── PIN session (client-side unlock, expires 1h) ──────────────────────────────
const UNLOCK_KEY = "era_companion_unlock";

export function isCompanionUnlocked(accountId: number): boolean {
  try {
    const raw = sessionStorage.getItem(UNLOCK_KEY);
    if (!raw) return false;
    const { id, expiry } = JSON.parse(raw) as { id: number; expiry: number };
    return id === accountId && Date.now() < expiry;
  } catch { return false; }
}

export function setCompanionUnlocked(accountId: number) {
  sessionStorage.setItem(UNLOCK_KEY, JSON.stringify({ id: accountId, expiry: Date.now() + 60 * 60 * 1000 }));
}

export function clearCompanionUnlock() {
  sessionStorage.removeItem(UNLOCK_KEY);
}
