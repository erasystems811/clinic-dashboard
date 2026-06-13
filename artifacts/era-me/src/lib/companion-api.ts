import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/companion";

function headers() {
  let token: string | null = null;
  try {
    const stored = localStorage.getItem("era_me_session");
    if (stored) token = (JSON.parse(stored) as { token: string }).token ?? null;
  } catch { /**/ }
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

export interface GestureConfig {
  element: "score" | "coins" | "greeting";
  count: number;
  hidden?: boolean;
  themeColor?: string;
  darkMode?: boolean;
}

export const GESTURE_ELEMENTS: { value: GestureConfig["element"]; label: string; emoji: string; hint: string }[] = [
  { value: "score",    label: "ERA Score",  emoji: "⭕", hint: "the ERA score ring" },
  { value: "coins",    label: "My Coins",   emoji: "🪙", hint: "your coins badge" },
  { value: "greeting", label: "My Name",    emoji: "👋", hint: "your greeting / name" },
];

export function decodeGesture(entryTab: string): GestureConfig {
  try {
    const parsed = JSON.parse(entryTab) as { element?: string; count?: number; hidden?: boolean; themeColor?: string; darkMode?: boolean };
    if (parsed.element && parsed.count) {
      return {
        element: parsed.element as GestureConfig["element"],
        count: Number(parsed.count),
        hidden: !!parsed.hidden,
        themeColor: parsed.themeColor,
        darkMode: parsed.darkMode,
      };
    }
  } catch { /* */ }
  return { element: "coins", count: 3, hidden: false };
}

export function isCompanionHidden(): boolean {
  try {
    const raw = localStorage.getItem("era_companion_tab");
    if (!raw) return false;
    return !!decodeGesture(raw).hidden;
  } catch { return false; }
}

export function gestureLabel(g: GestureConfig): string {
  const el = GESTURE_ELEMENTS.find((e) => e.value === g.element);
  return `Tap ${el?.hint ?? g.element} ${g.count} time${g.count !== 1 ? "s" : ""}`;
}

export interface CompanionSettings {
  hasPin: boolean;
  isSetUp: boolean;
  entryTab: string;
  gestureElement: GestureConfig["element"];
  gestureCount: number;
  isHidden: boolean;
  companionThemeColor?: string;
  companionDarkMode?: boolean;
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
  return useQuery<CompanionSettings>({
    queryKey: ["companion", "settings"],
    queryFn: async () => {
      const raw = await get<Omit<CompanionSettings, "gestureElement" | "gestureCount" | "isHidden" | "companionThemeColor" | "companionDarkMode">>(`${BASE}/settings`);
      const g = decodeGesture(raw.entryTab);
      return { ...raw, gestureElement: g.element, gestureCount: g.count, isHidden: !!g.hidden, companionThemeColor: g.themeColor, companionDarkMode: g.darkMode };
    },
  });
}

export function useChangeCompanionTheme() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, { themeColor: string; darkMode: boolean }>({
    mutationFn: ({ themeColor, darkMode }) => {
      let existing: Record<string, unknown> = {};
      try { existing = JSON.parse(localStorage.getItem("era_companion_tab") ?? "{}") as Record<string, unknown>; } catch { /**/ }
      const encoded = JSON.stringify({ ...existing, themeColor, darkMode });
      localStorage.setItem("era_companion_tab", encoded);
      return patch(`${BASE}/entry-tab`, { entryTab: encoded });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["companion", "settings"] }),
  });
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
  return useMutation<{ ok: boolean }, Error, { pin: string; gestureElement: GestureConfig["element"]; gestureCount: number; hidden?: boolean }>({
    mutationFn: ({ pin, gestureElement, gestureCount, hidden }) => {
      const encoded = JSON.stringify({ element: gestureElement, count: gestureCount, hidden: !!hidden });
      localStorage.setItem("era_companion_tab", encoded);
      return post(`${BASE}/setup`, { pin, entryTab: encoded });
    },
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

export function useChangeGesture() {
  const qc = useQueryClient();
  return useMutation<{ ok: boolean }, Error, GestureConfig>({
    mutationFn: ({ element, count, hidden }) => {
      let existing: Record<string, unknown> = {};
      try { existing = JSON.parse(localStorage.getItem("era_companion_tab") ?? "{}") as Record<string, unknown>; } catch { /**/ }
      const encoded = JSON.stringify({ ...existing, element, count, hidden: !!hidden });
      localStorage.setItem("era_companion_tab", encoded);
      return patch(`${BASE}/entry-tab`, { entryTab: encoded });
    },
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
