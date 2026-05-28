import { ReactNode, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import {
  LogOut, ChevronRight, ShieldCheck, Upload, CheckCircle2, XCircle,
  Loader2, BarChart2, Building2, Settings, Rocket, AlertCircle
} from "lucide-react";
import ChangePasswordModal from "@/components/change-password-modal";
import { post } from "@/lib/api";

type DeployState = "idle" | "pushing" | "done" | "error";

interface LayoutProps {
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

const NAV_ITEMS = [
  {
    icon: BarChart2,
    label: "Analytics",
    href: "/",
    description: "Health & platform data",
  },
  {
    icon: Building2,
    label: "Hospitals",
    href: "/hospitals",
    description: "All hospital accounts",
  },
  {
    icon: Settings,
    label: "Settings",
    href: "/settings",
    description: "Automations & config",
  },
];

export default function Layout({ children, breadcrumb }: LayoutProps) {
  const { logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [showSecurity, setShowSecurity] = useState(false);
  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [deployMsg, setDeployMsg] = useState("");
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const deployRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (deployRef.current && !deployRef.current.contains(e.target as Node)) {
        setConfirmDeploy(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDeploy = async () => {
    if (deployState === "pushing") return;
    setConfirmDeploy(false);
    setDeployState("pushing");
    setDeployMsg("");
    try {
      const result = await post<{ ok: boolean; output: string }>("/super-admin/deploy", {});
      setDeployMsg(result.output);
      setDeployState("done");
    } catch (err: unknown) {
      setDeployMsg(err instanceof Error ? err.message : "Push failed");
      setDeployState("error");
    } finally {
      setTimeout(() => { setDeployState("idle"); }, 5000);
    }
  };

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Sidebar ── */}
      <aside
        className="w-56 shrink-0 flex flex-col border-r border-border"
        style={{ background: "hsl(226 60% 7%)" }}
      >
        {/* Brand */}
        <div className="px-4 py-5 border-b border-border">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-3 w-full hover:opacity-80 transition"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: "hsl(43 96% 54%)",
                boxShadow: "0 0 14px hsl(43 96% 54% / 0.4)",
              }}
            >
              <span className="font-black text-sm text-black tracking-tighter">E</span>
            </div>
            <div className="text-left min-w-0">
              <p className="font-extrabold text-sm text-foreground tracking-tight leading-tight">Era Systems</p>
              <p className="text-[10px] font-bold text-primary/70 uppercase tracking-widest leading-tight">Super Admin</p>
            </div>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => setLocation(item.href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group ${
                  active
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                }`}
              >
                <item.icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold leading-tight ${active ? "text-foreground" : ""}`}>
                    {item.label}
                  </p>
                  <p className={`text-[10px] leading-tight mt-0.5 truncate ${active ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                    {item.description}
                  </p>
                </div>
                {active && (
                  <div className="w-1 h-4 rounded-full bg-primary shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Deploy */}
        <div className="px-2 pb-2 border-t border-border pt-2" ref={deployRef}>
          {!confirmDeploy ? (
            <button
              onClick={() => setConfirmDeploy(true)}
              disabled={deployState === "pushing"}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left group disabled:opacity-50 ${
                deployState === "done"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : deployState === "error"
                  ? "bg-red-500/10 text-red-400"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {deployState === "pushing" ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
              ) : deployState === "done" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : deployState === "error" ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              ) : (
                <Rocket className="w-4 h-4 shrink-0 transition-colors group-hover:text-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">
                  {deployState === "pushing" ? "Deploying…" : deployState === "done" ? "Deployed!" : deployState === "error" ? "Deploy failed" : "Deploy"}
                </p>
                {deployMsg ? (
                  <p className="text-[10px] leading-tight mt-0.5 truncate text-muted-foreground">{deployMsg}</p>
                ) : (
                  <p className="text-[10px] leading-tight mt-0.5 text-muted-foreground/60">Push to production</p>
                )}
              </div>
            </button>
          ) : (
            <div className="px-3 py-3 space-y-2 rounded-lg bg-muted/30 border border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">Push current code to GitHub and trigger a Railway deploy?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeploy}
                  className="flex-1 py-1.5 rounded-md text-xs font-bold transition"
                  style={{ background: "hsl(43 96% 54%)", color: "#000" }}
                >
                  Deploy
                </button>
                <button
                  onClick={() => setConfirmDeploy(false)}
                  className="flex-1 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security + Sign out */}
        <div className="px-2 pb-3 space-y-0.5 border-t border-border pt-2">
          <button
            onClick={() => setShowSecurity(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-muted-foreground hover:bg-muted/40 hover:text-foreground transition group"
          >
            <ShieldCheck className="w-4 h-4 shrink-0 group-hover:text-foreground" />
            <span className="text-sm font-medium">Security</span>
          </button>
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-muted-foreground hover:bg-muted/40 hover:text-foreground transition group"
          >
            <LogOut className="w-4 h-4 shrink-0 group-hover:text-foreground" />
            <span className="text-sm font-medium">Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (breadcrumb only) */}
        {breadcrumb && breadcrumb.length > 0 && (
          <header className="shrink-0 flex items-center px-6 gap-1.5 h-12 border-b border-border bg-background/60 backdrop-blur-sm">
            <span className="text-xs text-muted-foreground/50 font-medium">Era Systems</span>
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3 text-border shrink-0" />
                {crumb.href ? (
                  <button
                    onClick={() => setLocation(crumb.href!)}
                    className="text-xs text-muted-foreground hover:text-foreground transition font-medium"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-xs text-foreground font-semibold">{crumb.label}</span>
                )}
              </span>
            ))}
          </header>
        )}

        <main className="flex-1 p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {showSecurity && <ChangePasswordModal onClose={() => setShowSecurity(false)} />}
    </div>
  );
}
