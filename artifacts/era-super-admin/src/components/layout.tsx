import { ReactNode, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import {
  Building2, BarChart3, Settings2, LogOut, ShieldCheck,
  Upload, CheckCircle2, XCircle, Loader2, ChevronRight,
} from "lucide-react";
import ChangePasswordModal from "@/components/change-password-modal";
import { post } from "@/lib/api";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  exact?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Building2, label: "Hospitals", href: "/", exact: true },
  { icon: BarChart3, label: "Analytics", href: "/analytics" },
];

const BOTTOM_NAV: NavItem[] = [
  { icon: Settings2, label: "Settings", href: "/settings" },
];

type DeployState = "idle" | "pushing" | "done" | "error";

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

function NavLink({
  item,
  location,
  collapsed,
  onClick,
}: {
  item: NavItem;
  location: string;
  collapsed: boolean;
  onClick?: () => void;
}) {
  const [, setLocation] = useLocation();
  const isActive = item.exact
    ? location === item.href
    : location === item.href || location.startsWith(item.href + "/");

  return (
    <button
      onClick={() => { setLocation(item.href); onClick?.(); }}
      title={collapsed ? item.label : undefined}
      className={cn(
        "w-full flex items-center rounded transition-all text-sm font-medium",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
        isActive
          ? "bg-white/7 text-white border-l-2 border-primary"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/4 border-l-2 border-transparent"
      )}
    >
      <item.icon className={cn("shrink-0", collapsed ? "w-4 h-4" : "w-4 h-4", isActive && "text-primary")} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  );
}

export default function Layout({ children, title }: LayoutProps) {
  const { logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [showSecurity, setShowSecurity] = useState(false);
  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [deployMsg, setDeployMsg] = useState("");
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside
        className={cn(
          "flex flex-col shrink-0 border-r border-sidebar-border bg-sidebar transition-all duration-200",
          collapsed ? "w-[52px]" : "w-[220px]"
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            "flex items-center shrink-0 border-b border-sidebar-border",
            collapsed ? "h-16 justify-center px-3" : "h-16 px-4 gap-3"
          )}
        >
          {/* ERA logo — black bg blends with sidebar */}
          <div
            className="shrink-0 cursor-pointer"
            style={{ width: collapsed ? 28 : 32, height: collapsed ? 28 : 32 }}
            onClick={() => setLocation("/")}
          >
            <img
              src={`${BASE}/era-logo.png`}
              alt="ERA Systems"
              className="w-full h-full object-contain"
              style={{ imageRendering: "auto" }}
            />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setLocation("/")}>
              <p className="text-xs font-bold text-white tracking-wide leading-tight truncate">
                ERA SYSTEMS
              </p>
              <p className="text-[9px] text-muted-foreground tracking-widest mt-0.5 truncate uppercase">
                <span className="text-white/40">Evaluate</span>
                <span className="text-primary mx-1">·</span>
                <span className="text-white/40">Rebuild</span>
                <span className="text-primary mx-1">·</span>
                <span className="text-white/40">Automate</span>
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="flex-1 flex flex-col px-2 py-3 gap-0.5 overflow-y-auto">
          {!collapsed && (
            <p className="px-3 pb-1.5 text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest">
              Platform
            </p>
          )}
          {NAV_ITEMS.map(item => (
            <NavLink key={item.href} item={item} location={location} collapsed={collapsed} />
          ))}
        </div>

        {/* Bottom nav + user */}
        <div className="px-2 py-3 border-t border-sidebar-border space-y-0.5">
          {BOTTOM_NAV.map(item => (
            <NavLink key={item.href} item={item} location={location} collapsed={collapsed} />
          ))}

          {/* Security */}
          <button
            onClick={() => setShowSecurity(true)}
            title={collapsed ? "Security" : undefined}
            className={cn(
              "w-full flex items-center rounded transition-all text-sm font-medium text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/4",
              collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
            )}
          >
            <ShieldCheck className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Security</span>}
          </button>

          {/* Deploy */}
          <div className="relative" ref={deployRef}>
            <button
              onClick={() => setConfirmDeploy(s => !s)}
              title={collapsed ? "Deploy" : undefined}
              className={cn(
                "w-full flex items-center rounded transition-all text-sm font-medium",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                deployState === "done" ? "text-emerald-400" :
                deployState === "error" ? "text-red-400" :
                "text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-white/4"
              )}
            >
              {deployState === "pushing" ? <Loader2 className="w-4 h-4 shrink-0 animate-spin" /> :
               deployState === "done" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> :
               deployState === "error" ? <XCircle className="w-4 h-4 shrink-0" /> :
               <Upload className="w-4 h-4 shrink-0" />}
              {!collapsed && <span className="text-xs">
                {deployState === "pushing" ? "Deploying…" :
                 deployState === "done" ? "Deployed!" :
                 deployState === "error" ? "Failed" : "Deploy"}
              </span>}
            </button>

            {confirmDeploy && (
              <div
                className="absolute bottom-full left-0 mb-2 w-56 bg-card border border-border rounded shadow-2xl z-50 p-3 space-y-2.5"
                style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.7)" }}
              >
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Push to GitHub and trigger Railway deploy?
                </p>
                <div className="flex gap-2">
                  <button onClick={handleDeploy} className="flex-1 py-1.5 rounded bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition">
                    Deploy
                  </button>
                  <button onClick={() => setConfirmDeploy(false)} className="flex-1 py-1.5 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="pt-2 border-t border-sidebar-border mt-2">
            <button
              onClick={() => logout()}
              title={collapsed ? "Sign out" : undefined}
              className={cn(
                "w-full flex items-center rounded transition-all text-sm font-medium text-sidebar-foreground/40 hover:text-sidebar-foreground/70 hover:bg-white/4",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5"
              )}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-xs">Sign out</span>}
            </button>
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="border-t border-sidebar-border flex items-center justify-center py-2 text-muted-foreground/30 hover:text-muted-foreground/60 transition text-[10px] gap-1"
        >
          <ChevronRight className={cn("w-3 h-3 transition-transform", !collapsed && "rotate-180")} />
          {!collapsed && <span className="font-mono uppercase tracking-widest text-[9px]">Collapse</span>}
        </button>
      </aside>

      {/* ── Main content ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-7">
          {children}
        </main>
      </div>

      {showSecurity && <ChangePasswordModal onClose={() => setShowSecurity(false)} />}
    </div>
  );
}
