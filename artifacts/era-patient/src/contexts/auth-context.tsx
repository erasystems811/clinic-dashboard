import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Role = "receptionist" | "nurse" | "admin";

export interface HospitalSession {
  id: number;
  name: string;
  username: string;
  token: string; // empty for staff (nurse/receptionist)
}

export interface HospitalConfig {
  departments: string[];
  modules: {
    appointmentsEnabled: boolean;
    feedbackEnabled: boolean;
    messagesEnabled: boolean;
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

  const loginAdmin = async (hospitalUsername: string, hospitalPassword: string): Promise<void> => {
    const res = await fetch("/api/auth/hospital-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: hospitalUsername.trim().toLowerCase(), password: hospitalPassword }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Login failed" }));
      throw new Error(err.error ?? "Invalid credentials");
    }
    const data = await res.json();
    setHospital({ id: data.id, name: data.name, username: data.username, token: data.token });

    const cfgRes = await fetch("/api/hospital/config", {
      headers: { "x-hospital-token": data.token },
    });
    setHospitalConfig(cfgRes.ok
      ? await cfgRes.json()
      : { departments: [], modules: { appointmentsEnabled: true, feedbackEnabled: true } }
    );
    setUser({ username: "admin", role: "admin", displayName: "Admin" });
  };

  const loginStaff = async (username: string, password: string): Promise<void> => {
    const res = await fetch("/api/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Invalid credentials" }));
      throw new Error(err.error ?? "Invalid credentials");
    }
    const data = await res.json();
    setHospital({ id: data.hospital.id, name: data.hospital.name, username: data.hospital.username, token: "" });
    setHospitalConfig({ departments: data.departments, modules: data.modules });
    const displayName = data.role === "nurse" ? "Nurse" : "Receptionist";
    setUser({ username: data.role, role: data.role, displayName });
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
