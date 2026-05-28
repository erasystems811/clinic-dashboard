import { ReactNode, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import {
  LogOut, ChevronRight, ShieldCheck, CheckCircle2, XCircle,
  Loader2, BarChart2, Building2, Settings, Rocket, AlertCircle,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import ChangePasswordModal from "@/components/change-password-modal";
import { post } from "@/lib/api";

type DeployState = "idle" | "pushing" | "done" | "error";

interface LayoutProps {
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

const NAV_ITEMS = [
  { icon: BarChart2,  label: "Analytics",  href: "/",          description: "Health & platform data" },
  { icon: Building2,  label: "Hospitals",   href: "/hospitals", description: "All hospital accounts" },
  { icon: Settings,   label: "Settings",    href: "/settings",  description: "Automations & config" },
];

const SIDEBAR_OPEN_KEY = "era_sa_sidebar_open";

export default function Layout({ children, breadcrumb }: LayoutProps) {
  const { logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_OPEN_KEY) !== "0"; } catch { return true; }
  });
  const [showSecurity, setShowSecurity] = useState(false);
  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [deployMsg, setDeployMsg] = useState("");
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const deployRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => setOpen(v => {
    const next = !v;
    try { localStorage.setItem(SIDEBAR_OPEN_KEY, next ? "1" : "0"); } catch { /* */ }
    return next;
  });

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
      setTimeout(() => setDeployState("idle"), 5000);
    }
  };

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  // ── Shared button variants ──────────────────────────────────────────────────
  const deployIcon = deployState === "pushing" ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
    : deployState === "done"  ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
    : deployState === "error" ? <AlertCircle  className="w-4 h-4 shrink-0 text-red-400" />
    : <Rocket className="w-4 h-4 shrink-0" />;

  const deployLabel = deployState === "pushing" ? "Deploying…"
    : deployState === "done"  ? "Deployed!"
    : deployState === "error" ? "Failed"
    : "Deploy";

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside
        className="shrink-0 flex flex-col border-r border-border transition-all duration-200"
        style={{ width: open ? 220 : 52, background: "hsl(226 60% 7%)" }}
      >

        {/* Brand + collapse toggle */}
        <div className={`flex items-center border-b border-border shrink-0 h-14 ${open ? "px-3 gap-3" : "px-0 justify-center"}`}>
          {open && (
            <button onClick={() => setLocation("/")} className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "hsl(43 96% 54%)", boxShadow: "0 0 12px hsl(43 96% 54% / 0.4)" }}>
                <span className="font-black text-xs text-black">E</span>
              </div>
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-foreground tracking-tight leading-tight truncate">Era Systems</p>
                <p className="text-[9px] font-bold text-primary/70 uppercase tracking-widest leading-tight">Super Admin</p>
              </div>
            </button>
          )}
          {!open && (
            <button onClick={() => setLocation("/")} className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-80 transition"
              style={{ background: "hsl(43 96% 54%)", boxShadow: "0 0 10px hsl(43 96% 54% / 0.35)" }}>
              <span className="font-black text-xs text-black">E</span>
            </button>
          )}
          <button
            onClick={toggleOpen}
            className={`shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/40 transition ${open ? "" : "absolute left-0 bottom-0 opacity-0 pointer-events-none"}`}
            title={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-1.5 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href);
            return (
              <button
                key={item.href}
                onClick={() => setLocation(item.href)}
                title={!open ? item.label : undefined}
                className={`w-full flex items-center rounded-lg transition-all group ${
                  open ? "gap-3 px-2.5 py-2.5" : "justify-center p-2.5"
                } ${
                  active
                    ? "bg-primary/12 text-foreground"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                }`}
              >
                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${active ? "text-primary" : "group-hover:text-foreground"}`} />
                {open && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold leading-tight">{item.label}</p>
                    <p className="text-[10px] text-muted-foreground/60 leading-tight mt-0.5 truncate">{item.description}</p>
                  </div>
                )}
                {open && active && <div className="w-1 h-4 rounded-full bg-primary shrink-0" />}
              </button>
            );
          })}
        </nav>

        {/* Deploy */}
        <div className="px-1.5 pb-1 border-t border-border pt-1.5" ref={deployRef}>
          {!confirmDeploy ? (
            <button
              onClick={() => !open ? handleDeploy() : setConfirmDeploy(true)}
              disabled={deployState === "pushing"}
              title={!open ? deployLabel : undefined}
              className={`w-full flex items-center rounded-lg transition-all group disabled:opacity-50 ${
                open ? "gap-3 px-2.5 py-2.5" : "justify-center p-2.5"
              } ${
                deployState === "done"  ? "text-emerald-400" :
                deployState === "error" ? "text-red-400" :
                "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
              }`}
            >
              {deployIcon}
              {open && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-semibold leading-tight">{deployLabel}</p>
                  {deployMsg
                    ? <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate">{deployMsg}</p>
                    : <p className="text-[10px] text-muted-foreground/50 leading-tight mt-0.5">Push to production</p>
                  }
                </div>
              )}
            </button>
          ) : (
            <div className="mx-0.5 px-2.5 py-2.5 space-y-2 rounded-lg bg-muted/30 border border-border">
              <p className="text-[11px] text-muted-foreground leading-relaxed">Push to GitHub and trigger Railway deploy?</p>
              <div className="flex gap-2">
                <button onClick={handleDeploy}
                  className="flex-1 py-1.5 rounded-md text-xs font-bold transition"
                  style={{ background: "hsl(43 96% 54%)", color: "#000" }}>
                  Deploy
                </button>
                <button onClick={() => setConfirmDeploy(false)}
                  className="flex-1 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Security · Sign out · Collapse */}
        <div className="px-1.5 pb-2 space-y-0.5 border-t border-border pt-1">
          <button
            onClick={() => setShowSecurity(true)}
            title={!open ? "Security" : undefined}
            className={`w-full flex items-center rounded-lg text-muted-foreground hover:bg-muted/30 hover:text-foreground transition group ${open ? "gap-3 px-2.5 py-2" : "justify-center p-2.5"}`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            {open && <span className="text-xs font-medium">Security</span>}
          </button>

          <button
            onClick={() => logout()}
            title={!open ? "Sign out" : undefined}
            className={`w-full flex items-center rounded-lg text-muted-foreground hover:bg-muted/30 hover:text-foreground transition group ${open ? "gap-3 px-2.5 py-2" : "justify-center p-2.5"}`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {open && <span className="text-xs font-medium">Sign out</span>}
          </button>

          {/* Collapse toggle — always visible at the very bottom */}
          <button
            onClick={toggleOpen}
            title={open ? "Collapse sidebar" : "Expand sidebar"}
            className={`w-full flex items-center rounded-lg text-muted-foreground/50 hover:bg-muted/30 hover:text-muted-foreground transition ${open ? "gap-3 px-2.5 py-2" : "justify-center p-2.5"}`}
          >
            {open
              ? <PanelLeftClose className="w-4 h-4 shrink-0" />
              : <PanelLeftOpen  className="w-4 h-4 shrink-0" />}
            {open && <span className="text-xs font-medium text-muted-foreground/50">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb bar */}
        {breadcrumb && breadcrumb.length > 0 && (
          <header className="shrink-0 flex items-center px-6 gap-1.5 h-12 border-b border-border">
            <span className="text-xs text-muted-foreground/40 font-medium">Era Systems</span>
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <ChevronRight className="w-3 h-3 text-border shrink-0" />
                {crumb.href ? (
                  <button onClick={() => setLocation(crumb.href!)}
                    className="text-xs text-muted-foreground hover:text-foreground transition font-medium">
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
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {showSecurity && <ChangePasswordModal onClose={() => setShowSecurity(false)} />}
    </div>
  );
}
