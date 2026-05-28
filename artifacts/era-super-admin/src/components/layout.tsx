import { ReactNode, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { LayoutDashboard, LogOut, ChevronRight, ShieldCheck, Upload, CheckCircle2, XCircle, Loader2, Settings2 } from "lucide-react";
import ChangePasswordModal from "@/components/change-password-modal";
import { post, api } from "@/lib/api";

type DeployState = "idle" | "pushing" | "done" | "error";

interface LayoutProps {
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

export default function Layout({ children, breadcrumb }: LayoutProps) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [showSecurity, setShowSecurity] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [deployState, setDeployState] = useState<DeployState>("idle");
  const [deployMsg, setDeployMsg] = useState("");
  const [confirmDeploy, setConfirmDeploy] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
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
      setTimeout(() => { setDeployState("idle"); setShowSettings(false); }, 4000);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar — sharp 1px bottom rule, no glow */}
      <header className="border-b border-border flex items-center px-6 gap-4 shrink-0 h-14 bg-background">

        {/* Brand wordmark */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-3 hover:opacity-75 transition shrink-0"
        >
          {/* Mark: two stacked horizontal lines in gold — editorial logo */}
          <div className="flex flex-col gap-[3px] justify-center shrink-0">
            <span className="block h-[2px] w-5 bg-primary" />
            <span className="block h-[2px] w-3 bg-primary/60" />
          </div>
          <span
            className="font-display font-700 text-sm tracking-tight text-foreground hidden sm:block"
            style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700 }}
          >
            ERA SYSTEMS
          </span>
          <span className="hidden sm:inline-flex items-center text-[9px] font-mono font-bold text-primary/70 border border-primary/20 bg-primary/5 px-1.5 py-0.5 uppercase tracking-widest">
            ADMIN
          </span>
        </button>

        {/* Breadcrumb */}
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0 flex-1">
            <span className="text-border">›</span>
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {crumb.href ? (
                  <button onClick={() => setLocation(crumb.href!)} className="hover:text-foreground transition truncate">
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-foreground font-semibold truncate">{crumb.label}</span>
                )}
                {i < breadcrumb.length - 1 && <span className="text-border">›</span>}
              </span>
            ))}
          </div>
        )}

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-muted transition font-medium"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hospitals</span>
          </button>

          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => { setShowSettings(s => !s); setConfirmDeploy(false); }}
              className={`p-1.5 rounded transition ${showSettings ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-9 w-56 bg-card border border-border rounded shadow-2xl z-50 overflow-hidden"
                style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px hsl(225 35% 14%)" }}>
                <div className="p-1">
                  <button
                    onClick={() => { setShowSecurity(true); setShowSettings(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-foreground hover:bg-muted rounded font-semibold transition text-left"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                    Security
                  </button>
                </div>
                <div className="border-t border-border" />
                <div className="p-1">
                  {!confirmDeploy ? (
                    <button
                      onClick={() => setConfirmDeploy(true)}
                      disabled={deployState === "pushing"}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground rounded font-semibold transition text-left disabled:opacity-50"
                    >
                      {deployState === "pushing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                       deployState === "done" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> :
                       deployState === "error" ? <XCircle className="w-3.5 h-3.5 text-red-400" /> :
                       <Upload className="w-3.5 h-3.5" />}
                      <span className={deployState === "done" ? "text-emerald-400" : deployState === "error" ? "text-red-400" : ""}>
                        {deployState === "pushing" ? "Pushing…" : deployState === "done" ? "Pushed!" : deployState === "error" ? "Failed" : "Push to GitHub"}
                      </span>
                    </button>
                  ) : (
                    <div className="px-3 py-3 space-y-2.5">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">Overwrites GitHub with current code and triggers Railway deploy.</p>
                      <div className="flex gap-2">
                        <button onClick={handleDeploy} className="flex-1 py-1.5 rounded bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition">Deploy</button>
                        <button onClick={() => setConfirmDeploy(false)} className="flex-1 py-1.5 rounded border border-border text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-border mx-1" />

          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-muted transition font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {showSecurity && <ChangePasswordModal onClose={() => setShowSecurity(false)} />}
    </div>
  );
}
