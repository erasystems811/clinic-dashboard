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
      {/* Top bar */}
      <header className="border-b border-border flex items-center px-6 gap-4 shrink-0 h-16"
        style={{ boxShadow: "0 1px 0 0 hsl(43 96% 54% / 0.08)" }}>

        {/* Brand */}
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-3 hover:opacity-80 transition shrink-0 group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-lg"
            style={{ boxShadow: "0 0 12px hsl(43 96% 54% / 0.35)" }}>
            <span className="text-primary-foreground font-black text-sm tracking-tighter">E</span>
          </div>
          <div className="hidden sm:block">
            <span className="font-extrabold text-sm text-foreground tracking-tight">Era Systems</span>
            <span className="ml-2 text-[10px] font-semibold text-primary/80 uppercase tracking-widest border border-primary/25 bg-primary/8 px-1.5 py-0.5 rounded">
              Super Admin
            </span>
          </div>
        </button>

        {/* Breadcrumb */}
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0 flex-1">
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-border" />
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5 min-w-0">
                {crumb.href ? (
                  <button
                    onClick={() => setLocation(crumb.href!)}
                    className="hover:text-foreground transition truncate max-w-[140px] sm:max-w-none text-xs"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-foreground font-semibold text-xs truncate max-w-[140px] sm:max-w-none">{crumb.label}</span>
                )}
                {i < breadcrumb.length - 1 && (
                  <ChevronRight className="w-3 h-3 shrink-0 text-border" />
                )}
              </span>
            ))}
          </div>
        )}

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-md hover:bg-muted transition font-medium"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Hospitals</span>
          </button>

          {/* Settings */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => { setShowSettings(s => !s); setConfirmDeploy(false); }}
              className={`p-2 rounded-md transition ${showSettings ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              title="Settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-10 w-56 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
                style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px hsl(220 14% 11%)" }}>
                <div className="p-1">
                  <button
                    onClick={() => { setShowSecurity(true); setShowSettings(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-foreground hover:bg-muted rounded-lg transition text-left font-medium"
                  >
                    <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                    Security
                  </button>
                </div>

                <div className="border-t border-border mx-1" />

                <div className="p-1">
                  {!confirmDeploy ? (
                    <button
                      onClick={() => setConfirmDeploy(true)}
                      disabled={deployState === "pushing"}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition text-left disabled:opacity-50 font-medium"
                    >
                      {deployState === "pushing" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                       deployState === "done" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                       deployState === "error" ? <XCircle className="w-4 h-4 text-red-400" /> :
                       <Upload className="w-4 h-4" />}
                      <span className={deployState === "done" ? "text-emerald-400" : deployState === "error" ? "text-red-400" : ""}>
                        {deployState === "pushing" ? "Pushing…" :
                         deployState === "done" ? "Pushed!" :
                         deployState === "error" ? "Push failed" :
                         "Push to GitHub"}
                      </span>
                    </button>
                  ) : (
                    <div className="px-3 py-3 space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed">This will overwrite GitHub with current Replit code and trigger a Railway deploy.</p>
                      <div className="flex gap-2">
                        <button
                          onClick={handleDeploy}
                          className="flex-1 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition"
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
              </div>
            )}
          </div>

          <div className="w-px h-4 bg-border mx-1" />

          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-md hover:bg-muted transition font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>

      {showSecurity && <ChangePasswordModal onClose={() => setShowSecurity(false)} />}
    </div>
  );
}
