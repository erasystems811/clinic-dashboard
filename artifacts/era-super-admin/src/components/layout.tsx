import { ReactNode, useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Building2, LayoutDashboard, LogOut, ChevronRight, ShieldCheck, Upload, CheckCircle2, XCircle, Loader2, Settings2, Trash2 } from "lucide-react";
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
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
        setConfirmDeploy(false);
        setConfirmReset(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleReset = async () => {
    setResetting(true);
    try {
      await api.resetTestData();
    } finally {
      setResetting(false);
      setConfirmReset(false);
      setTimeout(() => setShowSettings(false), 800);
    }
  };

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
      <header className="h-14 border-b border-border flex items-center px-6 gap-4 shrink-0">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 hover:opacity-80 transition"
        >
          <div className="w-7 h-7 rounded-lg bg-primary/10 ring-1 ring-primary/30 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-sm text-foreground">Era Systems</span>
          <span className="text-xs text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-muted ml-1">
            Super Admin
          </span>
        </button>

        {breadcrumb && breadcrumb.length > 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <ChevronRight className="w-3.5 h-3.5" />
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1">
                {crumb.href ? (
                  <button
                    onClick={() => setLocation(crumb.href!)}
                    className="hover:text-foreground transition"
                  >
                    {crumb.label}
                  </button>
                ) : (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                )}
                {i < breadcrumb.length - 1 && (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </span>
            ))}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setLocation("/")}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Hospitals
          </button>

          {/* Settings gear — Security + Deploy hidden inside */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => { setShowSettings(s => !s); setConfirmDeploy(false); }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition"
              title="Settings"
            >
              <Settings2 className="w-4 h-4" />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-9 w-52 bg-card border border-border rounded-xl shadow-2xl z-50 overflow-hidden">
                <button
                  onClick={() => { setShowSecurity(true); setShowSettings(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition text-left"
                >
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  Security
                </button>

                <div className="border-t border-border" />

                {/* Reset Test Data */}
                {!confirmReset ? (
                  <button
                    onClick={() => { setConfirmReset(true); setConfirmDeploy(false); }}
                    disabled={resetting}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition text-left disabled:opacity-50"
                  >
                    {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {resetting ? "Resetting…" : "Reset Test Data"}
                  </button>
                ) : (
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Permanently deletes all patients, appointments, queue entries and logs across <strong>all hospitals</strong>. Accounts are preserved. Cannot be undone.</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleReset}
                        disabled={resetting}
                        className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition"
                      >
                        {resetting ? "Resetting…" : "Yes, reset"}
                      </button>
                      <button
                        onClick={() => setConfirmReset(false)}
                        className="flex-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="border-t border-border" />

                {!confirmDeploy ? (
                  <button
                    onClick={() => setConfirmDeploy(true)}
                    disabled={deployState === "pushing"}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition text-left disabled:opacity-50"
                  >
                    {deployState === "pushing" ? <Loader2 className="w-4 h-4 animate-spin" /> :
                     deployState === "done" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                     deployState === "error" ? <XCircle className="w-4 h-4 text-red-400" /> :
                     <Upload className="w-4 h-4" />}
                    <span className={deployState === "done" ? "text-emerald-400" : deployState === "error" ? "text-red-400" : ""}>
                      {deployState === "pushing" ? "Pushing to GitHub…" :
                       deployState === "done" ? "Pushed!" :
                       deployState === "error" ? "Push failed" :
                       "Push to GitHub"}
                    </span>
                  </button>
                ) : (
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">This will overwrite GitHub with the current Replit code and trigger a Railway deploy. Continue?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeploy}
                        className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition"
                      >
                        Yes, push
                      </button>
                      <button
                        onClick={() => setConfirmDeploy(false)}
                        className="flex-1 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main className="flex-1 p-6">
        {children}
      </main>

      {showSecurity && <ChangePasswordModal onClose={() => setShowSecurity(false)} />}
    </div>
  );
}
