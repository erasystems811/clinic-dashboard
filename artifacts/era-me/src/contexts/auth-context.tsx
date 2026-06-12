import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";

export interface Account {
  id: number;
  username: string;
  email: string;
  accountType: "individual" | "family";
  displayName: string | null;
  themeColor: string;
  darkMode: boolean;
  isPremium?: boolean;
}

interface AuthContextValue {
  account: Account | null;
  token: string | null;
  loading: boolean;
  login: (token: string, account: Account) => void;
  logout: () => void;
  updateAccount: (patch: Partial<Account>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = "era_me_session";

function applyTheme(account: Account) {
  const root = document.documentElement;
  root.setAttribute("data-theme", account.themeColor ?? "blue");
  if (account.darkMode) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) { setLoading(false); return; }
      const session = JSON.parse(stored) as { token: string; account: Account };
      setToken(session.token);
      setAccount(session.account);
      applyTheme(session.account);
      // Re-fetch to pick up any server-side changes
      apiFetch<Account>("/api/patient-app/me", {
        headers: { "x-patient-token": session.token },
      }).then((fresh) => {
        const merged = { ...session.account, ...fresh };
        setAccount(merged);
        applyTheme(merged);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ token: session.token, account: merged }));
      }).catch(() => {});
    } catch {
      localStorage.removeItem(SESSION_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback((newToken: string, newAccount: Account) => {
    setToken(newToken);
    setAccount(newAccount);
    applyTheme(newAccount);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ token: newToken, account: newAccount }));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setAccount(null);
    localStorage.removeItem(SESSION_KEY);
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("dark");
  }, []);

  const updateAccount = useCallback((patch: Partial<Account>) => {
    setAccount((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      applyTheme(updated);
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        try {
          const session = JSON.parse(stored);
          localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, account: updated }));
        } catch {}
      }
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ account, token, loading, login, logout, updateAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
