import { ReactNode, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import {
  LogOut, ChevronRight, ShieldCheck, CheckCircle2,
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

const NAV = [
  { icon: BarChart2,  label: "Analytics",   href: "/",          sub: "Platform command" },
  { icon: Building2,  label: "Hospitals",   href: "/hospitals", sub: "Account registry" },
  { icon: Settings,   label: "Settings",    href: "/settings",  sub: "System config" },
];

const SIDEBAR_KEY = "era_sa_sidebar";

export default function Layout({ children, breadcrumb }: LayoutProps) {
  const { logout } = useAuth();
  const [loc, setLocation] = useLocation();
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) !== "0"; } catch { return true; }
  });
  const [showSecurity, setShowSecurity] = useState(false);
  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [deployMsg, setDeployMsg] = useState("");
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const deployRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => setOpen(v => {
    const next = !v;
    try { localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0"); } catch { /* */ }
    return next;
  });

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (deployRef.current && !deployRef.current.contains(e.target as Node)) setConfirmDeploy(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleDeploy = async () => {
    if (deployState === "pushing") return;
    setConfirmDeploy(false);
    setDeployState("pushing");
    try {
      const r = await post<{ ok: boolean; output: string }>("/super-admin/deploy", {});
      setDeployMsg(r.output);
      setDeployState("done");
    } catch (err: unknown) {
      setDeployMsg(err instanceof Error ? err.message : "Push failed");
      setDeployState("error");
    } finally {
      setTimeout(() => { setDeployState("idle"); setDeployMsg(""); }, 5000);
    }
  };

  const isActive = (href: string) => href === "/" ? loc === "/" : loc.startsWith(href);

  /* ── sidebar bg ────────────────────────────────────────────────────────── */
  const sbBg = "hsl(222 20% 4%)";
  const sbBorder = "hsl(220 18% 22%)";

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <aside className="shrink-0 flex flex-col transition-all duration-200"
        style={{ width: open ? 212 : 48, background: sbBg, borderRight: `1px solid ${sbBorder}` }}>

        {/* Brand */}
        <div className={`flex items-center shrink-0 h-12 border-b ${open ? "px-3 gap-3" : "justify-center"}`}
          style={{ borderBottomColor: sbBorder }}>
          {open ? (
            <>
              <button onClick={() => setLocation("/")} className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition group">
                {/* Mark */}
                <div className="relative w-6 h-6 shrink-0 flex items-center justify-center border border-[hsl(43_70%_62%/0.3)]"
                  style={{ background: "hsl(222 20% 4%)" }}>
                  <span className="font-black text-[10px]" style={{ color: "hsl(43 65% 58%)" }}>E</span>
                  <span className="absolute -top-px -left-px w-1.5 h-px" style={{ background: "hsl(43 65% 58% / 0.7)" }} />
                  <span className="absolute -top-px -left-px w-px h-1.5" style={{ background: "hsl(43 65% 58% / 0.7)" }} />
                  <span className="absolute -bottom-px -right-px w-1.5 h-px" style={{ background: "hsl(43 65% 58% / 0.7)" }} />
                  <span className="absolute -bottom-px -right-px w-px h-1.5" style={{ background: "hsl(43 65% 58% / 0.7)" }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-foreground tracking-[0.15em] uppercase leading-tight">Era Systems</p>
                  <p className="text-[8px] font-medium text-muted-foreground/40 uppercase tracking-[0.2em] leading-tight">Control Room</p>
                </div>
              </button>
              <button onClick={toggleOpen} title="Collapse"
                className="shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground transition">
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button onClick={toggleOpen} title="Expand"
              className="relative w-6 h-6 flex items-center justify-center border border-[hsl(43_70%_62%/0.3)] hover:opacity-80 transition"
              style={{ background: "hsl(222 20% 4%)" }}>
              <span className="font-black text-[10px]" style={{ color: "hsl(43 65% 58%)" }}>E</span>
            </button>
          )}
        </div>

        {/* Nav section label */}
        {open && (
          <div className="px-3 pt-4 pb-1">
            <p className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.3em]">Navigation</p>
          </div>
        )}

        {/* Nav items */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${open ? "px-2 pb-2 space-y-px" : "px-1.5 py-3 space-y-1"}`}>
          {NAV.map(item => {
            const active = isActive(item.href);
            return (
              <button key={item.href} onClick={() => setLocation(item.href)} title={!open ? item.label : undefined}
                className={`w-full flex items-center transition-all duration-150 group relative ${
                  open ? "gap-3 px-2.5 py-2.5" : "justify-center p-2.5"
                } ${active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-white/4 hover:text-foreground"
                }`}
                style={{ borderLeft: open && active ? "2px solid hsl(214 72% 56%)" : open ? "2px solid transparent" : "none" }}>
                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${active ? "text-primary" : ""}`} />
                {open && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-[11px] font-semibold leading-tight tracking-wide">{item.label}</p>
                    <p className="text-[9px] text-muted-foreground/50 leading-tight mt-0.5 tracking-wide">{item.sub}</p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Deploy */}
        <div className="px-2 py-2 border-t" style={{ borderTopColor: sbBorder }} ref={deployRef}>
          {open && (
            <p className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.3em] px-1 pb-2">Operations</p>
          )}
          {!confirmDeploy ? (
            <button onClick={() => open ? setConfirmDeploy(true) : handleDeploy()}
              disabled={deployState === "pushing"} title={!open ? "Deploy" : undefined}
              className={`w-full flex items-center transition-all duration-150 disabled:opacity-50 ${
                open ? "gap-3 px-2.5 py-2" : "justify-center p-2.5"
              } ${
                deployState === "done"  ? "text-emerald-400" :
                deployState === "error" ? "text-destructive" :
                "text-muted-foreground hover:bg-white/4 hover:text-foreground"
              }`}>
              {deployState === "pushing" ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                : deployState === "done"  ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                : deployState === "error" ? <AlertCircle  className="w-4 h-4 shrink-0 text-destructive" />
                : <Rocket className="w-4 h-4 shrink-0" />}
              {open && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[11px] font-semibold tracking-wide leading-tight">
                    {deployState === "pushing" ? "Deploying…" : deployState === "done" ? "Deployed" : deployState === "error" ? "Failed" : "Deploy"}
                  </p>
                  <p className="text-[9px] text-muted-foreground/40 leading-tight mt-0.5 truncate">{deployMsg || "Push to Railway"}</p>
                </div>
              )}
            </button>
          ) : (
            <div className="p-2.5 space-y-2 border border-[hsl(220_18%_25%)] bg-[hsl(220_20%_8%)]">
              <p className="text-[10px] text-muted-foreground leading-relaxed">Trigger Railway deploy?</p>
              <div className="flex gap-1.5">
                <button onClick={handleDeploy} className="flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[hsl(43_70%_62%)] border border-[hsl(43_70%_62%/0.3)] hover:bg-[hsl(43_70%_62%/0.08)] transition">
                  Deploy
                </button>
                <button onClick={() => setConfirmDeploy(false)} className="flex-1 py-1.5 border border-[hsl(220_18%_25%)] text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="px-2 pb-3 space-y-px border-t pt-1.5" style={{ borderTopColor: sbBorder }}>
          {open && (
            <p className="text-[8px] font-bold text-muted-foreground/30 uppercase tracking-[0.3em] px-1 pb-1.5">Account</p>
          )}

          {[
            { icon: ShieldCheck, label: "Security", action: () => setShowSecurity(true) },
            { icon: LogOut,      label: "Sign Out",  action: () => logout() },
          ].map(item => (
            <button key={item.label} onClick={item.action} title={!open ? item.label : undefined}
              className={`w-full flex items-center text-muted-foreground/60 hover:bg-white/4 hover:text-muted-foreground transition-all duration-150 ${
                open ? "gap-3 px-2.5 py-2" : "justify-center p-2.5"
              }`}>
              <item.icon className="w-3.5 h-3.5 shrink-0" />
              {open && <span className="text-[11px] font-medium tracking-wide">{item.label}</span>}
            </button>
          ))}

          {/* Collapse toggle */}
          <button onClick={toggleOpen} title={open ? "Collapse" : "Expand"}
            className={`w-full flex items-center text-muted-foreground/30 hover:text-muted-foreground/50 transition-all duration-150 ${
              open ? "gap-3 px-2.5 py-1.5" : "justify-center p-2.5"
            }`}>
            {open
              ? <><PanelLeftClose className="w-3.5 h-3.5 shrink-0" /><span className="text-[10px] tracking-wide">Collapse</span></>
              : <PanelLeftOpen className="w-3.5 h-3.5 shrink-0" />}
          </button>
        </div>
      </aside>

      {/* ── MAIN ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="shrink-0 h-11 border-b flex items-center px-6 gap-2"
          style={{ borderBottomColor: "hsl(220 18% 22%)", background: "hsl(224 22% 4%)" }}>
          {breadcrumb && breadcrumb.length > 0 ? (
            <>
              <span className="text-[10px] text-muted-foreground/30 font-medium tracking-wider uppercase">Era</span>
              {breadcrumb.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-border/60 shrink-0" />
                  {c.href
                    ? <button onClick={() => setLocation(c.href!)} className="text-[10px] text-muted-foreground/60 hover:text-foreground transition tracking-wider uppercase font-medium">{c.label}</button>
                    : <span className="text-[10px] text-foreground/80 font-semibold tracking-wider uppercase">{c.label}</span>}
                </span>
              ))}
            </>
          ) : (
            <span className="text-[9px] text-muted-foreground/25 font-medium tracking-[0.3em] uppercase">Evaluate · Rebuild · Automate</span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/70" />
            <span className="text-[9px] text-muted-foreground/30 uppercase tracking-widest">Operational</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {showSecurity && <ChangePasswordModal onClose={() => setShowSecurity(false)} />}
    </div>
  );
}
