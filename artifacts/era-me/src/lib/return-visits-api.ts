import { useQuery } from "@tanstack/react-query";

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

export interface ReturnVisit {
  id: number;
  visitDate: string;
  visitTime: string | null;
  reason: string;
  notes: string | null;
  scheduledBy: string;
  scheduledByName: string | null;
  hospitalName: string | null;
  status: string;
}

export function useReturnVisits() {
  return useQuery<{ visits: ReturnVisit[] }>({
    queryKey: ["patient-return-visits"],
    queryFn: async () => {
      const res = await fetch("/api/patient-app/return-visits", { headers: headers() });
      if (!res.ok) throw new Error(await res.text());
      return res.json() as Promise<{ visits: ReturnVisit[] }>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
