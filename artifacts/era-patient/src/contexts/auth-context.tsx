import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Role = "receptionist" | "nurse" | "admin";

interface User {
  username: string;
  role: Role;
  displayName: string;
}

interface AuthContextValue {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const USERS: Record<string, { password: string; role: Role; displayName: string }> = {
  receptionist: { password: "recep1234", role: "receptionist", displayName: "Receptionist" },
  nurse: { password: "nurse1234", role: "nurse", displayName: "Nurse" },
  admin: { password: "admin1234", role: "admin", displayName: "Dr. Doe (Admin)" },
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "era_patient_auth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [user]);

  const login = (username: string, password: string): boolean => {
    const entry = USERS[username.toLowerCase()];
    if (!entry || entry.password !== password) return false;
    setUser({ username: username.toLowerCase(), role: entry.role, displayName: entry.displayName });
    return true;
  };

  const logout = () => setUser(null);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
