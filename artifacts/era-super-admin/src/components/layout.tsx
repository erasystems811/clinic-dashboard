import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/auth";
import { Building2, LayoutDashboard, LogOut, ChevronRight, ShieldCheck } from "lucide-react";
import ChangePasswordModal from "@/components/change-password-modal";

interface LayoutProps {
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

export default function Layout({ children, breadcrumb }: LayoutProps) {
  const { logout } = useAuth();
  const [, setLocation] = useLocation();
  const [showSecurity, setShowSecurity] = useState(false);

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
          <button
            onClick={() => setShowSecurity(true)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg hover:bg-muted transition"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Security
          </button>
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
