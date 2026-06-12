import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";

export interface PatientAccount {
  id: number;
  username: string;
  email: string;
  phone?: string;
  accountType: "individual" | "family";
  displayName: string;
  gender?: string;
  dateOfBirth?: string;
  background?: string;
  themeColor: string;
  darkMode: boolean;
}

interface AuthContextValue {
  account: PatientAccount | null;
  token: string | null;
  loading: boolean;
  login: (token: string, account: PatientAccount) => void;
  logout: () => void;
  updateAccount: (patch: Partial<PatientAccount>) => void;
  refreshAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = "era_patient_session";

function applyTheme(account: PatientAccount | null) {
  const root = document.documentElement;
  const theme = account?.themeColor ?? "blue";
  const dark = account?.darkMode ?? false;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", dark);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<PatientAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored) as { token: string; account: PatientAccount };
        setToken(session.token);
        setAccount(session.account);
        applyTheme(session.account);
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback((newToken: string, newAccount: PatientAccount) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: newToken, account: newAccount }));
    setToken(newToken);
    setAccount(newAccount);
    applyTheme(newAccount);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setToken(null);
    setAccount(null);
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  }, []);

  const updateAccount = useCallback((patch: Partial<PatientAccount>) => {
    setAccount((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, account: updated }));
      }
      applyTheme(updated);
      return updated;
    });
  }, []);

  const refreshAccount = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<PatientAccount>("/api/patient-app/me", { auth: true });
      setAccount(data);
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        const session = JSON.parse(stored);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, account: data }));
      }
      applyTheme(data);
    } catch {
      // token may have expired
      logout();
    }
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ account, token, loading, login, logout, updateAccount, refreshAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
