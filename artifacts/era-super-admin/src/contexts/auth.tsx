// @refresh reset
import { createContext, useContext, useState, ReactNode } from "react";
import { getToken, setToken, clearToken, api } from "@/lib/api";

interface AuthContextValue {
  isAuthed: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(() => !!getToken());

  const login = async (username: string, password: string) => {
    const { token } = await api.login(username, password);
    setToken(token);
    setIsAuthed(true);
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    clearToken();
    setIsAuthed(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthed, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
