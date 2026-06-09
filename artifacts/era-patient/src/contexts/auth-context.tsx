import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiUrl } from "@/lib/api";
import { setHospitalTokenGetter, setPerformedByGetter } from "@workspace/api-client-react";

export type Role = "receptionist" | "nurse" | "admin" | "doctor";

export interface HospitalSession {
  id: number;
  name: string;
  username: string;
  token: string; // empty for staff (nurse/receptionist)
  feedbackSlug?: string | null;
  slug?: string | null;
  loginAt?: number; // Unix ms when this session was created — used to detect module changes
}

export interface HospitalConfig {
  departments: string[];
  modules: {
    wellnessNewsletterEnabled?: boolean;
    appointmentsEnabled: boolean;
    feedbackEnabled: boolean;
    messagesEnabled: boolean;
  };
}

interface User {
  username: string;
  role: Role;
  displayName: string;
  staffName?: string | null;
  doctorId?: number | null;
  specialty?: string | null;
}

interface AuthContextValue {
  hospital: HospitalSession | null;
  hospitalConfig: HospitalConfig | null;
  user: User | null;
  /** Admin: hospital username + password → full session */
  loginAdmin: (hospitalUsername: string, hospitalPassword: string) => Promise<void>;
  /** Staff: e.g. "GISD NURSE" + password → validated via API */
  loginStaff: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const HOSPITAL_KEY = "era_hospital_session";
const CONFIG_KEY = "era_hospital_config";
const USER_KEY = "era_patient_auth";

const AuthContext = createContext<AuthContextValue | null>(null);

function readJson<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hospital, setHospital] = useState<HospitalSession | null>(() => {
    const stored = readJson<HospitalSession>(HOSPITAL_KEY);
    // Register token synchronously so React Query has it before the first fetch
    const token = stored?.token || null;
    setHospitalTokenGetter(token ? () => token : null);
    return stored;
  });
  const [hospitalConfig, setHospitalConfig] = useState<HospitalConfig | null>(() => readJson(CONFIG_KEY));
  const [user, setUser] = useState<User | null>(() => readJson(USER_KEY));

  useEffect(() => {
    const token = hospital?.token || null;
    setHospitalTokenGetter(token ? () => token : null);
  }, [hospital]);

  useEffect(() => {
    const name = user?.staffName || null;
    setPerformedByGetter(name ? () => name : null);
  }, [user?.staffName]);

  useEffect(() => {
    hospital ? localStorage.setItem(HOSPITAL_KEY, JSON.stringify(hospital)) : localStorage.removeItem(HOSPITAL_KEY);
  }, [hospital]);

  // Poll hospital config every 30 seconds while logged in.
  // On each poll: refresh module config, and force logout if super admin
  // invalidated sessions after this session was created (module change).
  useEffect(() => {
    const token = hospital?.token;
    if (!token) return;

    const check = () => {
      const loginAt = hospital?.loginAt ?? 0;
      fetch(apiUrl("/api/hospital/config"), { headers: { "x-hospital-token": token } })
        .then(r => {
          // 401 = token invalid, 403 = account suspended — force logout immediately
          if (r.status === 401 || r.status === 403) { logout(); return null; }
          return r.ok ? r.json() : null;
        })
        .then(cfg => {
          if (!cfg) return;
          if (cfg.sessionInvalidatedAt && cfg.sessionInvalidatedAt > loginAt) {
            logout();
            return;
          }
          setHospitalConfig(cfg);
        })
        .catch(() => {});
    };

    check(); // run immediately on mount / login
    const interval = setInterval(check, 30_000); // then every 30s
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hospital?.token]); // re-run if the token changes (new login)

  useEffect(() => {
    hospitalConfig ? localStorage.setItem(CONFIG_KEY, JSON.stringify(hospitalConfig)) : localStorage.removeItem(CONFIG_KEY);
  }, [hospitalConfig]);

  useEffect(() => {
    user ? localStorage.setItem(USER_KEY, JSON.stringify(user)) : localStorage.removeItem(USER_KEY);
  }, [user]);

  const loginAdmin = async (hospitalUsername: string, hospitalPassword: string): Promise<void> => {
    const res = await fetch(apiUrl("/api/auth/hospital-login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: hospitalUsername.trim().toLowerCase(), password: hospitalPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error ?? "Invalid credentials");
    }
    const data = await res.json();
    setHospital({ id: data.id, name: data.name, username: data.username, token: data.token, feedbackSlug: data.feedbackSlug ?? null, slug: data.slug ?? null, loginAt: Date.now() });

    const cfgRes = await fetch(apiUrl("/api/hospital/config"), {
      headers: { "x-hospital-token": data.token },
    });
    setHospitalConfig(cfgRes.ok
      ? await cfgRes.json()
      : { departments: [], modules: { appointmentsEnabled: true, feedbackEnabled: true } }
    );
    setUser({ username: "admin", role: "admin", displayName: "Admin" });
    sessionStorage.setItem("era_tour_pending", "1");
  };

  const loginStaff = async (username: string, password: string): Promise<void> => {
    const res = await fetch(apiUrl("/api/staff/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Invalid credentials" }));
      throw new Error(err.error ?? "Invalid credentials");
    }
    const data = await res.json();
    setHospital({ id: data.hospital.id, name: data.hospital.name, username: data.hospital.username, token: data.token ?? "", loginAt: Date.now() });
    setHospitalConfig({ departments: data.departments, modules: data.modules });
    const displayName = data.staffName ?? (data.role === "nurse" ? "Medication View" : data.role === "doctor" ? "Doctor" : "Receptionist");
    setUser({ username: data.staffUsername ?? data.role, role: data.role, displayName, staffName: data.staffName ?? null, doctorId: data.doctorId ?? null, specialty: data.specialty ?? null });
    sessionStorage.setItem("era_tour_pending", "1");
  };

  const logout = () => {
    setUser(null);
    setHospital(null);
    setHospitalConfig(null);
  };

  return (
    <AuthContext.Provider value={{ hospital, hospitalConfig, user, loginAdmin, loginStaff, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
