// @refresh reset
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Role = "receptionist" | "nurse" | "admin";

export interface HospitalSession {
  id: number;
  name: string;
  username: string;
  token: string;
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
  loginHospital: (username: string, password: string) => Promise<void>;
  loginRole: (role: Role, password: string) => boolean;
  logout: () => void;
  logoutRole: () => void;
}

const ROLE_CREDENTIALS: Record<Role, { password: string; displayName: string }> = {
  receptionist: { password: "recep1234", displayName: "Receptionist" },
  nurse: { password: "nurse1234", displayName: "Nurse" },
  admin: { password: "admin1234", displayName: "Admin" },
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

  const loginHospital = async (username: string, password: string): Promise<void> => {
    const res = await fetch("/api/auth/hospital-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error ?? "Login failed");
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
  };

  const loginRole = (role: Role, password: string): boolean => {
    const entry = ROLE_CREDENTIALS[role];
    if (!entry || entry.password !== password) return false;
    setUser({ username: role, role, displayName: entry.displayName });
    return true;
  };

  const logout = () => {
    setUser(null);
    setHospital(null);
    setHospitalConfig(null);
  };

  const logoutRole = () => setUser(null);

  return (
    <AuthContext.Provider value={{ hospital, hospitalConfig, user, loginHospital, loginRole, logout, logoutRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
