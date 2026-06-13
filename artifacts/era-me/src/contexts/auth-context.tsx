import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";

export interface Account {
  id: number;
  username: string;
  email: string;
  accountType: "individual" | "family";
  displayName: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
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
  applyCompanionTheme: (themeColor: string, darkMode: boolean) => void;
  restoreAppTheme: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const SESSION_KEY = "era_me_session";

interface ThemePalette {
  primaryHSL: string;
  bgDark: string;
  bgDarkMid: string;
  bgLight: string;
  bgLightMid: string;
  accent: string;
  accentLight: string;
  glowRGB: string;
  btnGradient: string;
  backgroundDarkHSL: string;
  backgroundLightHSL: string;
  // Color-tinted text — dark mode uses light shades, light mode uses dark shades
  textDark: string;
  textDarkSub: string;
  textDarkDim: string;
  textLight: string;
  textLightSub: string;
  textLightDim: string;
}

const PALETTES: Record<string, ThemePalette> = {
  teal: {
    primaryHSL: "175 84% 32%",
    bgDark: "#060d1f", bgDarkMid: "#0a1628",
    bgLight: "#f0fdfb", bgLightMid: "#ccfbf1",
    accent: "#14b8a6", accentLight: "#5eead4",
    glowRGB: "20,184,166",
    btnGradient: "linear-gradient(135deg,#0d9488,#14b8a6)",
    backgroundDarkHSL: "226 60% 10%",
    backgroundLightHSL: "175 60% 97%",
    textDark: "#ccfbf1",    textDarkSub: "rgba(153,246,228,0.75)", textDarkDim: "rgba(94,234,212,0.45)",
    textLight: "#134e4a",   textLightSub: "rgba(19,78,74,0.65)",   textLightDim: "rgba(19,78,74,0.42)",
  },
  blue: {
    primaryHSL: "217 91% 60%",
    bgDark: "#060e21", bgDarkMid: "#09162e",
    bgLight: "#eff6ff", bgLightMid: "#dbeafe",
    accent: "#3b82f6", accentLight: "#93c5fd",
    glowRGB: "59,130,246",
    btnGradient: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
    backgroundDarkHSL: "222 70% 10%",
    backgroundLightHSL: "214 100% 97%",
    textDark: "#dbeafe",    textDarkSub: "rgba(147,197,253,0.75)", textDarkDim: "rgba(96,165,250,0.45)",
    textLight: "#1e3a5f",   textLightSub: "rgba(30,58,95,0.65)",   textLightDim: "rgba(30,58,95,0.42)",
  },
  purple: {
    primaryHSL: "271 91% 65%",
    bgDark: "#0d0618", bgDarkMid: "#130a24",
    bgLight: "#faf5ff", bgLightMid: "#ede9fe",
    accent: "#a78bfa", accentLight: "#c4b5fd",
    glowRGB: "139,92,246",
    btnGradient: "linear-gradient(135deg,#7c3aed,#a78bfa)",
    backgroundDarkHSL: "271 70% 8%",
    backgroundLightHSL: "270 100% 99%",
    textDark: "#ede9fe",    textDarkSub: "rgba(196,181,253,0.75)", textDarkDim: "rgba(167,139,250,0.45)",
    textLight: "#3b0764",   textLightSub: "rgba(59,7,100,0.65)",   textLightDim: "rgba(59,7,100,0.42)",
  },
  green: {
    primaryHSL: "142 71% 45%",
    bgDark: "#031209", bgDarkMid: "#051a0e",
    bgLight: "#f0fdf4", bgLightMid: "#dcfce7",
    accent: "#22c55e", accentLight: "#4ade80",
    glowRGB: "34,197,94",
    btnGradient: "linear-gradient(135deg,#15803d,#22c55e)",
    backgroundDarkHSL: "142 65% 5%",
    backgroundLightHSL: "142 76% 97%",
    textDark: "#dcfce7",    textDarkSub: "rgba(134,239,172,0.75)", textDarkDim: "rgba(74,222,128,0.45)",
    textLight: "#14532d",   textLightSub: "rgba(20,83,45,0.65)",   textLightDim: "rgba(20,83,45,0.42)",
  },
  orange: {
    primaryHSL: "25 95% 53%",
    bgDark: "#160c03", bgDarkMid: "#1e1105",
    bgLight: "#fff7ed", bgLightMid: "#fed7aa",
    accent: "#f97316", accentLight: "#fb923c",
    glowRGB: "249,115,22",
    btnGradient: "linear-gradient(135deg,#c2410c,#f97316)",
    backgroundDarkHSL: "25 80% 6%",
    backgroundLightHSL: "33 100% 98%",
    textDark: "#fff7ed",    textDarkSub: "rgba(253,186,116,0.75)", textDarkDim: "rgba(251,146,60,0.45)",
    textLight: "#431407",   textLightSub: "rgba(67,20,7,0.65)",    textLightDim: "rgba(67,20,7,0.42)",
  },
  rose: {
    primaryHSL: "328 81% 60%",
    bgDark: "#1a0515", bgDarkMid: "#250a1e",
    bgLight: "#fdf2f8", bgLightMid: "#fce7f3",
    accent: "#ec4899", accentLight: "#f472b6",
    glowRGB: "236,72,153",
    btnGradient: "linear-gradient(135deg,#be185d,#ec4899)",
    backgroundDarkHSL: "328 65% 8%",
    backgroundLightHSL: "322 100% 99%",
    textDark: "#fce7f3",    textDarkSub: "rgba(244,114,182,0.75)", textDarkDim: "rgba(236,72,153,0.45)",
    textLight: "#500724",   textLightSub: "rgba(80,7,36,0.65)",    textLightDim: "rgba(80,7,36,0.42)",
  },
  slate: {
    primaryHSL: "215 16% 47%",
    bgDark: "#0a0d12", bgDarkMid: "#0e1118",
    bgLight: "#f8fafc", bgLightMid: "#f1f5f9",
    accent: "#94a3b8", accentLight: "#cbd5e1",
    glowRGB: "148,163,184",
    btnGradient: "linear-gradient(135deg,#475569,#94a3b8)",
    backgroundDarkHSL: "215 20% 7%",
    backgroundLightHSL: "210 40% 98%",
    textDark: "#f1f5f9",    textDarkSub: "rgba(203,213,225,0.75)", textDarkDim: "rgba(148,163,184,0.45)",
    textLight: "#1e293b",   textLightSub: "rgba(30,41,59,0.65)",   textLightDim: "rgba(30,41,59,0.42)",
  },
};

function applyTheme(account: Account) {
  const root = document.documentElement;
  const dark = account.darkMode ?? true;
  const palette = PALETTES[account.themeColor ?? "slate"] ?? PALETTES.slate;

  root.setAttribute("data-theme", account.themeColor ?? "teal");

  // Tailwind theme vars
  root.style.setProperty("--primary", palette.primaryHSL);
  root.style.setProperty("--ring", palette.primaryHSL);
  root.style.setProperty("--background", dark ? palette.backgroundDarkHSL : palette.backgroundLightHSL);

  // Atmosphere vars used in inline styles
  root.style.setProperty("--bg-base", dark ? palette.bgDark : palette.bgLight);
  root.style.setProperty("--bg-mid",  dark ? palette.bgDarkMid : palette.bgLightMid);
  root.style.setProperty("--glow-rgb", palette.glowRGB);
  // Slate accent is too light on white backgrounds — darken it in light mode
  const effectiveAccent = (!dark && (account.themeColor ?? "teal") === "slate") ? "#475569" : palette.accent;
  root.style.setProperty("--accent", effectiveAccent);
  root.style.setProperty("--accent-light", palette.accentLight);
  root.style.setProperty("--btn-gradient", palette.btnGradient);

  // Glass card surfaces — accent-tinted for premium feel
  root.style.setProperty("--glass-bg",     dark ? `rgba(${palette.glowRGB},0.07)` : "rgba(255,255,255,0.60)");
  root.style.setProperty("--glass-border", dark ? `rgba(${palette.glowRGB},0.16)` : `rgba(${palette.glowRGB},0.18)`);
  root.style.setProperty("--glass-track",  dark ? `rgba(${palette.glowRGB},0.10)` : `rgba(${palette.glowRGB},0.12)`);
  root.style.setProperty("--input-bg",     dark ? `rgba(${palette.glowRGB},0.06)` : "rgba(255,255,255,0.65)");
  root.style.setProperty("--input-border", dark ? `rgba(${palette.glowRGB},0.14)` : `rgba(${palette.glowRGB},0.20)`);
  // Accent tints — highlighted panels (ERA score card border, today badge)
  root.style.setProperty("--accent-tint-bg",    dark ? `rgba(${palette.glowRGB},0.09)` : `rgba(${palette.glowRGB},0.10)`);
  root.style.setProperty("--accent-tint-border", dark ? `rgba(${palette.glowRGB},0.24)` : `rgba(${palette.glowRGB},0.28)`);
  // Color-tinted text — light shades in dark mode, dark shades in light mode
  root.style.setProperty("--text-main", dark ? palette.textDark    : palette.textLight);
  root.style.setProperty("--text-sub",  dark ? palette.textDarkSub : palette.textLightSub);
  root.style.setProperty("--text-dim",  dark ? palette.textDarkDim : palette.textLightDim);
  // Tailwind --foreground for body text
  root.style.setProperty("--foreground",   dark ? "214 32% 91%" : "222 47% 11%");
  // Light-mode gradient body background
  root.style.setProperty("--light-bg-from", palette.bgLight);
  root.style.setProperty("--light-bg-to",   palette.bgLightMid);

  if (dark) {
    root.classList.add("dark");
    root.style.setProperty("--card",                "226 50% 14%");
    root.style.setProperty("--card-foreground",     "214 32% 91%");
    root.style.setProperty("--muted",               "226 40% 20%");
    root.style.setProperty("--muted-foreground",    "215 20.2% 65.1%");
    root.style.setProperty("--secondary",           "226 40% 20%");
    root.style.setProperty("--secondary-foreground","214 32% 91%");
    root.style.setProperty("--border",              "226 40% 20%");
    root.style.setProperty("--input",               "226 40% 20%");
  } else {
    root.classList.remove("dark");
    root.style.setProperty("--card",                "0 0% 100%");
    root.style.setProperty("--card-foreground",     "222 47% 11%");
    root.style.setProperty("--muted",               "210 40% 94%");
    root.style.setProperty("--muted-foreground",    "215 16% 47%");
    root.style.setProperty("--secondary",           "210 40% 94%");
    root.style.setProperty("--secondary-foreground","222 47% 11%");
    root.style.setProperty("--border",              "214 32% 87%");
    root.style.setProperty("--input",               "214 32% 91%");
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

  const applyCompanionTheme = useCallback((themeColor: string, darkMode: boolean) => {
    if (account) applyTheme({ ...account, themeColor, darkMode });
  }, [account]);

  const restoreAppTheme = useCallback(() => {
    if (account) applyTheme(account);
  }, [account]);

  return (
    <AuthContext.Provider value={{ account, token, loading, login, logout, updateAccount, applyCompanionTheme, restoreAppTheme }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
