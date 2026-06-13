import { ReactNode, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import {
  LogOut, ChevronRight, ShieldCheck, CheckCircle2,
  Loader2, BarChart2, Building2, Settings, Rocket, AlertCircle,
  PanelLeftClose, PanelLeftOpen, Menu, X, FlaskConical, TrendingUp, Headphones, BookOpen, Bell, Star, Kanban, Activity, Database,
} from "lucide-react";
import ChangePasswordModal from "@/components/change-password-modal";
import { post } from "@/lib/api";

type DeployState = "idle" | "pushing" | "done" | "error";

interface LayoutProps {
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

const NAV = [
  { icon: BarChart2,     label: "Analytics",          href: "/",                 sub: "Platform command" },
  { icon: Building2,     label: "Hospitals",          href: "/hospitals",        sub: "Account registry" },
  { icon: TrendingUp,    label: "Usage",              href: "/usage",            sub: "Hospital consumption" },
  { icon: Bell,          label: "Announcements",      href: "/announcements",    sub: "Push notices to hospitals" },
  { icon: FlaskConical,  label: "Automation Tests",   href: "/automation-tests", sub: "Verify email delivery" },
  { icon: Headphones,    label: "Support",            href: "/support",          sub: "Hospital tickets" },
  { icon: Star,          label: "System Feedback",    href: "/feedback",         sub: "Hospital staff ratings" },
  { icon: Kanban,        label: "CRM",                href: "/crm",              sub: "Sales pipeline & leads" },
  { icon: Activity,      label: "Patient Analytics",  href: "/patient-analytics",  sub: "ERA patient app metrics" },
  { icon: Database,      label: "Knowledge Base",     href: "/knowledge-base",     sub: "RAG docs for companion & coach" },
  { icon: BookOpen,      label: "Docs & Settings",    href: "/docs",               sub: "Manual, config & reference" },
];

const SIDEBAR_KEY = "era_sa_sidebar";

export default function Layout({ children, breadcrumb }: LayoutProps) {
  const { logout } = useAuth();
  const [loc, setLocation] = useLocation();
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) !== "0"; } catch { return true; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
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

  // Close mobile drawer on route change
  const navigate = (href: string) => {
    setLocation(href);
    setMobileOpen(false);
  };

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

  const sbBg = "hsl(222 55% 5%)";
  const sbBorder = "hsl(222 40% 14%)";

  /* ── Shared sidebar content ─────────────────────────────────────── */
  function SidebarContent({ expanded, onNavigate }: { expanded: boolean; onNavigate: (href: string) => void }) {
    return (
      <>
        {/* Brand */}
        <div className={`flex items-center shrink-0 h-12 border-b ${expanded ? "px-3 gap-3" : "justify-center"}`}
          style={{ borderBottomColor: sbBorder }}>
          {expanded ? (
            <>
              <button onClick={() => onNavigate("/")} className="flex items-center gap-2.5 flex-1 min-w-0 hover:opacity-80 transition group">
                <img src={`${import.meta.env.BASE_URL}era-logo.png`} alt="Era Systems" className="w-8 h-8 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold text-foreground tracking-[0.15em] uppercase leading-tight">Era Systems</p>
                  <p className="text-[8px] font-medium text-muted-foreground/40 uppercase tracking-[0.2em] leading-tight">Admin Console</p>
                </div>
              </button>
              <button onClick={toggleOpen} title="Collapse"
                className="shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground transition hidden md:block">
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <button onClick={toggleOpen} title="Expand" className="hover:opacity-80 transition">
              <img src={`${import.meta.env.BASE_URL}era-logo.png`} alt="Era Systems" className="w-8 h-8 object-contain" />
            </button>
          )}
        </div>

        {/* Nav items */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${expanded ? "px-3 pt-3 pb-2 space-y-0.5" : "px-2 py-3 space-y-1"}`}>
          {NAV.map(item => {
            const active = isActive(item.href);
            return (
              <button key={item.href} onClick={() => onNavigate(item.href)} title={!expanded ? item.label : undefined}
                className={`w-full flex items-center transition-all duration-150 group rounded-lg ${
                  expanded ? "gap-3 px-3 py-2.5" : "justify-center p-2.5"
                } ${active
                  ? "bg-primary/15 text-foreground"
                  : "text-muted-foreground/70 hover:bg-white/5 hover:text-foreground"
                }`}>
                <item.icon className={`w-4 h-4 shrink-0 transition-colors ${active ? "text-primary" : ""}`} />
                {expanded && (
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium leading-tight">{item.label}</p>
                    <p className="text-xs text-muted-foreground/50 leading-tight mt-0.5">{item.sub}</p>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Deploy */}
        <div className="px-3 py-2 border-t" style={{ borderTopColor: sbBorder }} ref={deployRef}>
          {!confirmDeploy ? (
            <button onClick={() => expanded ? setConfirmDeploy(true) : handleDeploy()}
              disabled={deployState === "pushing"} title={!expanded ? "Deploy" : undefined}
              className={`w-full flex items-center transition-all duration-150 rounded-lg disabled:opacity-50 ${
                expanded ? "gap-3 px-3 py-2.5" : "justify-center p-2.5"
              } ${
                deployState === "done"  ? "text-emerald-400" :
                deployState === "error" ? "text-destructive" :
                "text-muted-foreground/70 hover:bg-white/5 hover:text-foreground"
              }`}>
              {deployState === "pushing" ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                : deployState === "done"  ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                : deployState === "error" ? <AlertCircle  className="w-4 h-4 shrink-0 text-destructive" />
                : <Rocket className="w-4 h-4 shrink-0" />}
              {expanded && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium leading-tight">
                    {deployState === "pushing" ? "Deploying…" : deployState === "done" ? "Deployed" : deployState === "error" ? "Failed" : "Deploy"}
                  </p>
                  <p className="text-xs text-muted-foreground/50 leading-tight mt-0.5 truncate">{deployMsg || "Push to Railway"}</p>
                </div>
              )}
            </button>
          ) : (
            <div className="p-3 space-y-2 rounded-lg border border-border bg-card/60">
              <p className="text-sm text-muted-foreground">Trigger Railway deploy?</p>
              <div className="flex gap-2">
                <button onClick={handleDeploy} className="flex-1 py-1.5 rounded-lg text-sm font-semibold text-primary border border-primary/30 hover:bg-primary/10 transition">
                  Deploy
                </button>
                <button onClick={() => setConfirmDeploy(false)} className="flex-1 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="px-3 pb-3 space-y-0.5 border-t pt-2" style={{ borderTopColor: sbBorder }}>
          {[
            { icon: ShieldCheck, label: "Security", action: () => setShowSecurity(true) },
            { icon: LogOut,      label: "Sign Out",  action: () => logout() },
          ].map(item => (
            <button key={item.label} onClick={item.action} title={!expanded ? item.label : undefined}
              className={`w-full flex items-center text-muted-foreground/60 hover:bg-white/5 hover:text-muted-foreground transition-all duration-150 rounded-lg ${
                expanded ? "gap-3 px-3 py-2" : "justify-center p-2.5"
              }`}>
              <item.icon className="w-4 h-4 shrink-0" />
              {expanded && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          ))}

          {/* Collapse toggle — desktop only */}
          <button onClick={toggleOpen} title={open ? "Collapse" : "Expand"}
            className={`hidden md:flex w-full items-center text-muted-foreground/30 hover:text-muted-foreground/50 transition-all duration-150 rounded-lg ${
              expanded ? "gap-3 px-3 py-1.5" : "justify-center p-2.5"
            }`}>
            {expanded
              ? <><PanelLeftClose className="w-4 h-4 shrink-0" /><span className="text-sm">Collapse</span></>
              : <PanelLeftOpen className="w-4 h-4 shrink-0" />}
          </button>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">

      {/* ── DESKTOP SIDEBAR (hidden on mobile) ──────────────────────────── */}
      <aside className="hidden md:flex shrink-0 flex-col transition-all duration-200"
        style={{ width: open ? 212 : 48, background: sbBg, borderRight: `1px solid ${sbBorder}` }}>
        <SidebarContent expanded={open} onNavigate={setLocation} />
      </aside>

      {/* ── MOBILE DRAWER OVERLAY ────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside
            className="absolute left-0 top-0 h-full w-64 flex flex-col"
            style={{ background: sbBg, borderRight: `1px solid ${sbBorder}` }}
          >
            {/* Close button in drawer header */}
            <div className="absolute top-2 right-2 z-10">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/5 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <SidebarContent expanded={true} onNavigate={navigate} />
          </aside>
        </div>
      )}

      {/* ── MAIN ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top bar */}
        <header className="shrink-0 h-12 border-b flex items-center px-4 md:px-6 gap-2"
          style={{ borderBottomColor: "hsl(222 40% 14%)", background: "hsl(222 47% 7%)" }}>

          {/* Hamburger — mobile only */}
          <button
            className="md:hidden shrink-0 p-1 -ml-1 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-white/5 transition"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {breadcrumb && breadcrumb.length > 0 ? (
            <>
              <span className="text-[10px] text-muted-foreground/30 font-medium tracking-wider uppercase hidden sm:inline">Era</span>
              {breadcrumb.map((c, i) => (
                <span key={i} className="flex items-center gap-2">
                  <ChevronRight className="w-3 h-3 text-border/60 shrink-0 hidden sm:block" />
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
            <span className="text-[9px] text-muted-foreground/30 uppercase tracking-widest hidden sm:inline">Platform</span>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>

      {showSecurity && <ChangePasswordModal onClose={() => setShowSecurity(false)} />}
    </div>
  );
}
