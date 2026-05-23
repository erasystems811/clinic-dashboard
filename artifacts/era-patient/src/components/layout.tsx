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
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth, type Role, type HospitalConfig } from "@/contexts/auth-context";

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

function getNavItems(role: Role, modules: HospitalConfig["modules"] | null): NavItem[] {
  const appt = modules?.appointmentsEnabled ?? true;

  if (role === "receptionist") {
    const items: NavItem[] = [
      { icon: ClipboardList, label: "Queue Management", href: "/queue" },
      { icon: Phone, label: "Call Tasks", href: "/call-tasks" },
    ];
    if (appt) items.push({ icon: Calendar, label: "Appointments", href: "/appointments" });
    return items;
  }
  if (role === "nurse") {
    return [{ icon: Stethoscope, label: "Nurse Station", href: "/nurse-station" }];
  }
  // admin
  const items: NavItem[] = [
    { icon: Home, label: "Dashboard", href: "/" },
    { icon: Users, label: "Patients", href: "/patients" },
  ];
  if (appt) items.push({ icon: Calendar, label: "Appointments", href: "/appointments" });
  items.push(
    { icon: GitBranch, label: "Pipeline", href: "/pipeline" },
    { icon: Activity, label: "Activity", href: "/activity" },
  );
  if (modules?.feedbackEnabled ?? true) {
    items.push({ icon: Star, label: "Feedback", href: "/feedback-admin" });
  }
  items.push({ icon: Newspaper, label: "Wellness Newsletter", href: "/wellness" });
  return items;
}

const ROLE_LABELS: Record<Role, string> = {
  receptionist: "Receptionist",
  nurse: "Nurse",
  admin: "Admin",
};

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, hospital, hospitalConfig, logout, logoutRole } = useAuth();
  const role = user?.role ?? "admin";
  const navItems = getNavItems(role, hospitalConfig?.modules ?? null);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-56 border-r border-border bg-sidebar flex flex-col shrink-0">
        {/* Header — hospital identity */}
        <div className="h-16 flex items-center px-4 border-b border-border shrink-0 gap-3">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center shrink-0">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-none truncate">{hospital?.name ?? "Era Patient"}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
              <Building2 className="w-3 h-3 shrink-0" />
              {hospital?.username ?? ""}
            </p>
          </div>
        </div>

        {(role === "admin" || role === "receptionist") && (
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

          {/* Switch Role */}
          <button
            onClick={logoutRole}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium w-full text-left text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mb-1"
            title="Switch to a different role"
          >
            <GitBranch className="w-4 h-4" />
            Switch Role
          </button>

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
              title="Sign out completely"
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
            <span className="font-bold text-lg tracking-tight">{hospital?.name ?? "Era Patient"}</span>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
