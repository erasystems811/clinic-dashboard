import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const BASE = "/api/patient-app/hospitals";

function headers() {
  const token = localStorage.getItem("era_me_session");
  return { "Content-Type": "application/json", ...(token ? { "x-patient-token": token } : {}) };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: headers() });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = (JSON.parse(text) as { error?: string }).error ?? text; } catch { /* noop */ }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(path, { method: "DELETE", headers: headers() });
  if (!res.ok) throw new Error(await res.text());
}

export interface HospitalSearchResult {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
}

export interface HospitalConnection {
  connectionId: number;
  hospitalId: number;
  hospitalName: string;
  hospitalSlug: string;
  hospitalLogo: string | null;
  patientRecordId: number;
  patientName: string;
  stage: string | null;
  department: string | null;
  verifiedAt: string;
}

export function useMyHospitals() {
  return useQuery<HospitalConnection[]>({
    queryKey: ["hospitals"],
    queryFn: () => get(`${BASE}`),
  });
}

export function useHospitalSearch(q: string) {
  return useQuery<HospitalSearchResult[]>({
    queryKey: ["hospital-search", q],
    queryFn: () => get(`${BASE}/search?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length >= 2,
  });
}

export function useRequestConnection() {
  return useMutation<
    { ok: boolean; maskedEmail: string; patientName: string; hospitalName: string },
    Error,
    { hospitalId: number; patientRecordId: number }
  >({
    mutationFn: (body) => post(`${BASE}/connect/request`, body),
  });
}

export function useVerifyConnection() {
  const qc = useQueryClient();
  return useMutation<
    { ok: boolean },
    Error,
    { hospitalId: number; patientRecordId: number; otp: string }
  >({
    mutationFn: (body) => post(`${BASE}/connect/verify`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hospitals"] }),
  });
}

export function useRemoveConnection() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (connectionId) => del(`${BASE}/${connectionId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hospitals"] }),
  });
}
