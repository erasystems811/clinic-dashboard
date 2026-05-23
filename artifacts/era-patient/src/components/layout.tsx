import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity,
  Calendar,
  Home,
  Users,
  GitBranch,
  Settings,
  Plus,
  LogOut,
  ClipboardList,
  Stethoscope,
  Phone,
  Star,
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth, type Role } from "@/contexts/auth-context";

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

function getNavItems(role: Role): NavItem[] {
  if (role === "receptionist") {
    return [
      { icon: ClipboardList, label: "Queue Management", href: "/queue" },
      { icon: Phone, label: "Call Tasks", href: "/call-tasks" },
      { icon: Calendar, label: "Appointments", href: "/appointments" },
    ];
  }
  if (role === "nurse") {
    return [
      { icon: Stethoscope, label: "Nurse Station", href: "/nurse-station" },
    ];
  }
  // admin
  return [
    { icon: Home, label: "Dashboard", href: "/" },
    { icon: Users, label: "Patients", href: "/patients" },
    { icon: Calendar, label: "Appointments", href: "/appointments" },
    { icon: GitBranch, label: "Pipeline", href: "/pipeline" },
    { icon: Activity, label: "Activity", href: "/activity" },
    { icon: Star, label: "Feedback", href: "/feedback-admin" },
    { icon: Newspaper, label: "Wellness Newsletter", href: "/wellness" },
  ];
}

const ROLE_LABELS: Record<Role, string> = {
  receptionist: "Receptionist",
  nurse: "Nurse",
  admin: "Admin",
};

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const role = user?.role ?? "admin";
  const navItems = getNavItems(role);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar flex flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mr-3">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg tracking-tight">Era Patient</span>
        </div>

        {role === "admin" && (
          <div className="p-4 shrink-0">
            <Link href="/patients/new">
              <Button className="w-full justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4" />
                New Patient
              </Button>
            </Link>
          </div>
        )}

        <nav className={cn("flex-1 px-3 py-2 space-y-1 overflow-y-auto", role !== "admin" && "mt-2")}>
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium w-full text-left transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border shrink-0">
          {role === "admin" && (
            <button className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium w-full text-left text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mb-2">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          )}

          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border shrink-0">
              <span className="text-xs font-medium">
                {user?.displayName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "??"}
              </span>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <span className="text-sm font-medium leading-none truncate">{user?.displayName ?? "User"}</span>
              <span className="text-xs text-muted-foreground capitalize">{ROLE_LABELS[role]}</span>
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-background shrink-0 md:hidden">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center mr-3">
              <Activity className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">Era Patient</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
