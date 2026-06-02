import { ReactNode, useState, useEffect, useCallback } from "react";
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
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  FileUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { apiUrl } from "@/lib/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth, type Role, type HospitalConfig } from "@/contexts/auth-context";
import { TourGuide } from "@/components/tour-guide";
import { useIsMobile } from "@/hooks/use-mobile";

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
    return [
      { icon: Stethoscope, label: "Medication View", href: "/nurse-station" },
      { icon: Phone, label: "Call Tasks", href: "/call-tasks" },
    ];
  }
  const items: NavItem[] = [
    { icon: Home, label: "Dashboard", href: "/" },
    { icon: Users, label: "Patients", href: "/patients" },
  ];
  if (appt) items.push({ icon: Calendar, label: "Appointments", href: "/appointments" });
  items.push(
    { icon: GitBranch, label: "Pipeline", href: "/pipeline" },
    { icon: Activity, label: "Activity", href: "/activity" },
    { icon: Phone, label: "Call Tasks", href: "/call-tasks" },
    { icon: FileUp, label: "Import Patients", href: "/import" },
  );
  if (modules?.feedbackEnabled ?? true) {
    items.push({ icon: Star, label: "Feedback", href: "/feedback-admin" });
  }
  items.push({ icon: Newspaper, label: "Wellness Newsletter", href: "/wellness" });
  return items;
}

const ROLE_LABELS: Record<Role, string> = {
  receptionist: "Receptionist",
  nurse: "Medication View",
  admin: "Admin",
};

function RestartTourButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("era:start-tour"))}
      className="text-muted-foreground hover:text-foreground transition-colors"
      title="Restart guided tour"
    >
      <HelpCircle className="w-4 h-4" />
    </button>
  );
}

const SIDEBAR_KEY = "era_sidebar_collapsed";

function NavContent({
  navItems,
  location,
  role,
  hospital,
  user,
  collapsed,
  feedbackUnread,
  setCollapsed,
  onLogout,
  onNavClick,
}: {
  navItems: NavItem[];
  location: string;
  role: Role;
  hospital: { name: string; username: string } | null;
  user: { displayName?: string } | null;
  collapsed: boolean;
  feedbackUnread: number;
  setCollapsed: (v: boolean | ((p: boolean) => boolean)) => void;
  onLogout: () => void;
  onNavClick?: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className={cn(
        "h-16 flex items-center border-b border-border shrink-0 gap-3",
        collapsed ? "px-3 justify-center" : "px-4"
      )}>
        <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm leading-none truncate">{hospital?.name ?? "Era Patient"}</p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate flex items-center gap-1">
              <Building2 className="w-3 h-3 shrink-0" />
              {hospital?.username ?? ""}
            </p>
          </div>
        )}
      </div>

      {(role === "admin" || role === "receptionist") && (
        <div className={cn("shrink-0", collapsed ? "p-2 flex justify-center" : "p-4")}>
          <Link href="/patients/new" onClick={onNavClick}>
            {collapsed ? (
              <button
                data-tour="new-patient"
                title="New Patient"
                className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            ) : (
              <Button data-tour="new-patient" className="w-full justify-start gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                <Plus className="w-4 h-4" />
                New Patient
              </Button>
            )}
          </Link>
        </div>
      )}

      <nav className={cn("flex-1 px-2 py-2 space-y-1 overflow-y-auto", role !== "admin" && "mt-2")}>
        {navItems.map((item) => {
          const isActive =
            location === item.href ||
            (item.href !== "/" && location.startsWith(item.href));
          const tourId = item.href === "/"
            ? "nav-dashboard"
            : `nav-${item.href.replace(/^\//, "").replace(/[^a-z0-9]/g, "-")}`;
          const isFeedback = item.href === "/feedback-admin";
          const badge = isFeedback && feedbackUnread > 0 ? feedbackUnread : 0;
          return (
            <Link key={item.href} href={item.href} onClick={onNavClick}>
              <button
                data-tour={tourId}
                title={collapsed ? `${item.label}${badge ? ` (${badge} new)` : ""}` : undefined}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium w-full text-left transition-colors",
                  collapsed ? "justify-center p-2 relative" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <span className="relative shrink-0">
                  <item.icon className="w-4 h-4" />
                  {badge > 0 && collapsed && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-amber-400 text-[9px] font-bold text-black flex items-center justify-center px-0.5 leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                {!collapsed && item.label}
                {!collapsed && badge > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-amber-400 text-[10px] font-bold text-black flex items-center justify-center px-1 leading-none">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-border shrink-0", collapsed ? "p-2" : "p-4")}>
        {role === "admin" && !collapsed && (
          <Link href="/settings" onClick={onNavClick}>
            <button data-tour="nav-settings" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium w-full text-left text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mb-2">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </Link>
        )}
        {role === "admin" && collapsed && (
          <Link href="/settings" onClick={onNavClick}>
            <button title="Settings" className="flex items-center justify-center w-full p-2 rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors mb-1">
              <Settings className="w-4 h-4" />
            </button>
          </Link>
        )}

        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center border border-border"
              title={user?.displayName ?? "User"}
            >
              <span className="text-xs font-medium">
                {user?.displayName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "??"}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
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
            <RestartTourButton />
            <button
              onClick={onLogout}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out completely"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="mt-2 flex items-center justify-center w-full rounded-md py-1.5 text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors text-xs gap-1.5"
        >
          {collapsed
            ? <PanelLeftOpen className="w-4 h-4" />
            : <><PanelLeftClose className="w-4 h-4" /><span>Collapse</span></>
          }
        </button>
      </div>
    </>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user, hospital, hospitalConfig, logout } = useAuth();
  const isMobile = useIsMobile();
  const role = user?.role ?? "admin";
  const navItems = getNavItems(role, hospitalConfig?.modules ?? null);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [feedbackUnread, setFeedbackUnread] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  // Close mobile nav on route change
  useEffect(() => { setMobileNavOpen(false); }, [location]);

  const fetchUnread = useCallback(() => {
    if (role !== "admin" || !hospital?.token) return;
    if (!(hospitalConfig?.modules?.feedbackEnabled ?? true)) return;
    fetch(apiUrl("/api/feedback/unread-count"), {
      headers: { "x-hospital-token": hospital.token },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.count === "number") setFeedbackUnread(d.count); })
      .catch(() => {});
  }, [role, hospital, hospitalConfig]);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 60_000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  useEffect(() => {
    if (location === "/feedback-admin") setFeedbackUnread(0);
  }, [location]);

  const navProps = {
    navItems,
    location,
    role,
    hospital: hospital ? { name: hospital.name, username: hospital.username } : null,
    user: user ? { displayName: user.displayName } : null,
    feedbackUnread,
    setCollapsed,
    onLogout: () => setShowLogoutDialog(true),
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">

      {/* ── Desktop sidebar (hidden on mobile) ─────────────────────── */}
      {!isMobile && (
        <aside
          className={cn(
            "border-r border-border bg-sidebar flex flex-col shrink-0 transition-all duration-200",
            collapsed ? "w-14" : "w-56"
          )}
        >
          <NavContent {...navProps} collapsed={collapsed} />
        </aside>
      )}

      {/* ── Mobile drawer overlay ───────────────────────────────────── */}
      {isMobile && mobileNavOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/60"
            onClick={() => setMobileNavOpen(false)}
          />
          {/* Drawer */}
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-border flex flex-col shadow-2xl">
            <NavContent
              {...navProps}
              collapsed={false}
              onNavClick={() => setMobileNavOpen(false)}
            />
          </aside>
        </>
      )}

      {/* ── Main content ────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Mobile top bar */}
        {isMobile && (
          <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-background shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileNavOpen(o => !o)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition"
                aria-label="Open menu"
              >
                {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-sm truncate max-w-[160px]">{hospital?.name ?? "Era Patient"}</span>
            </div>
            {feedbackUnread > 0 && (
              <span className="min-w-[20px] h-5 rounded-full bg-amber-400 text-[10px] font-bold text-black flex items-center justify-center px-1">
                {feedbackUnread > 99 ? "99+" : feedbackUnread}
              </span>
            )}
          </header>
        )}

        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      <TourGuide />

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out? You'll need to log in again to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={logout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
