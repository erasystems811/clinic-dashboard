// @refresh reset
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Role = "receptionist" | "nurse" | "admin";

export interface HospitalSession {
  id: number;
  name: string;
  username: string;
  token: string; // empty string for staff (nurse/receptionist)
}

export interface HospitalConfig {
  departments: string[];
  modules: {
    appointmentsEnabled: boolean;
    feedbackEnabled: boolean;
  };
}

interface User {
  username: string;
  role: Role;
  displayName: string;
}

interface AuthContextValue {
  hospital: HospitalSession | null;
  hospitalConfig: HospitalConfig | null;
  user: User | null;
  /** Look up a hospital by username without a password — returns name for display */
  lookupHospital: (username: string) => Promise<{ id: number; name: string; username: string; departments: string[]; modules: HospitalConfig["modules"] }>;
  /** Admin logs in with hospital credentials — establishes full hospital session */
  loginAdmin: (hospitalUsername: string, hospitalPassword: string) => Promise<void>;
  /** Nurse / Receptionist log in after hospital lookup — no hospital password needed */
  loginStaff: (role: "nurse" | "receptionist", password: string, hospitalInfo: { id: number; name: string; username: string; departments: string[]; modules: HospitalConfig["modules"] }) => boolean;
  logout: () => void;
}

const STAFF_CREDENTIALS: Record<"nurse" | "receptionist", { password: string; displayName: string }> = {
  receptionist: { password: "recep1234", displayName: "Receptionist" },
  nurse: { password: "nurse1234", displayName: "Nurse" },
};

const HOSPITAL_KEY = "era_hospital_session";
const CONFIG_KEY = "era_hospital_config";
const USER_KEY = "era_patient_auth";

const AuthContext = createContext<AuthContextValue | null>(null);

function readJson<T>(key: string): T | null {
  try { return JSON.parse(localStorage.getItem(key) ?? "null"); } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [hospital, setHospital] = useState<HospitalSession | null>(() => readJson(HOSPITAL_KEY));
  const [hospitalConfig, setHospitalConfig] = useState<HospitalConfig | null>(() => readJson(CONFIG_KEY));
  const [user, setUser] = useState<User | null>(() => readJson(USER_KEY));

  useEffect(() => {
    hospital ? localStorage.setItem(HOSPITAL_KEY, JSON.stringify(hospital)) : localStorage.removeItem(HOSPITAL_KEY);
  }, [hospital]);

  useEffect(() => {
    hospitalConfig ? localStorage.setItem(CONFIG_KEY, JSON.stringify(hospitalConfig)) : localStorage.removeItem(CONFIG_KEY);
  }, [hospitalConfig]);

  useEffect(() => {
    user ? localStorage.setItem(USER_KEY, JSON.stringify(user)) : localStorage.removeItem(USER_KEY);
  }, [user]);

  const lookupHospital = async (username: string) => {
    const res = await fetch(`/api/hospital/lookup/${encodeURIComponent(username.trim().toLowerCase())}`);
    if (!res.ok) throw new Error("Hospital not found");
    return res.json();
  };

  /** Admin: hospital credentials authenticate them and set full session */
  const loginAdmin = async (hospitalUsername: string, hospitalPassword: string): Promise<void> => {
    const res = await fetch("/api/auth/hospital-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: hospitalUsername.trim().toLowerCase(), password: hospitalPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error ?? "Invalid hospital credentials");
    }
    const data = await res.json();
    const session: HospitalSession = { id: data.id, name: data.name, username: data.username, token: data.token };
    setHospital(session);

    const cfgRes = await fetch("/api/hospital/config", {
      headers: { "x-hospital-token": data.token },
    });
    if (cfgRes.ok) {
      setHospitalConfig(await cfgRes.json());
    } else {
      setHospitalConfig({ departments: [], modules: { appointmentsEnabled: true, feedbackEnabled: true } });
    }

    setUser({ username: "admin", role: "admin", displayName: "Admin" });
  };

  /** Nurse / Receptionist: password check only; hospital info comes from the public lookup */
  const loginStaff = (
    role: "nurse" | "receptionist",
    password: string,
    hospitalInfo: { id: number; name: string; username: string; departments: string[]; modules: HospitalConfig["modules"] }
  ): boolean => {
    const entry = STAFF_CREDENTIALS[role];
    if (!entry || entry.password !== password) return false;
    setHospital({ id: hospitalInfo.id, name: hospitalInfo.name, username: hospitalInfo.username, token: "" });
    setHospitalConfig({ departments: hospitalInfo.departments, modules: hospitalInfo.modules });
    setUser({ username: role, role, displayName: entry.displayName });
    return true;
  };

  const logout = () => {
    setUser(null);
    setHospital(null);
    setHospitalConfig(null);
  };

  return (
    <AuthContext.Provider value={{ hospital, hospitalConfig, user, lookupHospital, loginAdmin, loginStaff, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
