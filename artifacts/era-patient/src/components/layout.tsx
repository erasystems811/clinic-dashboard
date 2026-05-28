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
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
      { icon: Stethoscope, label: "Nurse Station", href: "/nurse-station" },
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
  const initials = user?.displayName
    ?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() ?? "??";

  return (
    <>
      {/* ── Hospital header ──────────────────────────────── */}
      <div className={cn(
        "shrink-0 border-b border-sidebar-border",
        collapsed ? "flex items-center justify-center py-4 px-2" : "px-4 py-4"
      )}>
        {collapsed ? (
          <div className="w-9 h-9 rounded-lg bg-primary/20 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
            <Activity className="w-4.5 h-4.5 text-primary" />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/20 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white leading-tight truncate tracking-wide">
                {hospital?.name?.toUpperCase() ?? "ERA PATIENT"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate flex items-center gap-1">
                <Building2 className="w-3 h-3 shrink-0" />
                <span className="font-mono">{hospital?.username ?? "clinical"}</span>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── New Patient CTA ──────────────────────────────── */}
      {(role === "admin" || role === "receptionist") && (
        <div className={cn("shrink-0", collapsed ? "px-2 py-3 flex justify-center" : "px-3 py-3")}>
          <Link href="/patients/new" onClick={onNavClick}>
            {collapsed ? (
              <button
                data-tour="new-patient"
                title="New Patient"
                className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground hover:bg-primary/90 transition"
                style={{ boxShadow: "0 2px 10px hsl(var(--primary) / 0.35)" }}
              >
                <Plus className="w-5 h-5" />
              </button>
            ) : (
              <button
                data-tour="new-patient"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition"
                style={{ boxShadow: "0 2px 12px hsl(var(--primary) / 0.35)" }}
              >
                <Plus className="w-5 h-5" />
                New Patient
              </button>
            )}
          </Link>
        </div>
      )}

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className={cn(
        "flex-1 px-2 space-y-0.5 overflow-y-auto py-2",
        role !== "admin" && role !== "receptionist" && "mt-2"
      )}>
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
                  "flex items-center rounded-lg text-sm font-medium w-full text-left transition-all duration-100 relative",
                  collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-white/10 text-white font-semibold"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-white/5"
                )}
              >
                <span className="relative shrink-0">
                  <item.icon className="w-5 h-5" />
                  {badge > 0 && collapsed && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center px-0.5 leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </span>
                {!collapsed && (
                  <>
                    <span>{item.label}</span>
                    {badge > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center px-1 leading-none">
                        {badge > 99 ? "99+" : badge}
                      </span>
                    )}
                  </>
                )}
              </button>
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom: Settings + User + Collapse ───────────── */}
      <div className="border-t border-sidebar-border shrink-0 px-2 py-3 space-y-0.5">

        {/* Settings */}
        {role === "admin" && (
          <Link href="/settings" onClick={onNavClick}>
            <button
              data-tour="nav-settings"
              title={collapsed ? "Settings" : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium w-full text-left transition-all",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                location === "/settings"
                  ? "bg-white/10 text-white font-semibold"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-white/5"
              )}
            >
              <Settings className="w-5 h-5 shrink-0" />
              {!collapsed && <span>Settings</span>}
            </button>
          </Link>
        )}

        {/* User card */}
        <div className={cn(
          "mt-1",
          collapsed
            ? "flex flex-col items-center gap-2 py-2"
            : "flex items-center gap-2.5 px-3 py-2.5"
        )}>
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-primary/20 ring-1 ring-primary/30 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{initials}</span>
          </div>

          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight truncate text-sidebar-foreground">
                {user?.displayName ?? "User"}
              </p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {ROLE_LABELS[role]}
              </p>
            </div>
          )}

          {/* Help + Logout */}
          {!collapsed ? (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => window.dispatchEvent(new Event("era:start-tour"))}
                className="p-1.5 rounded-md text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/5 transition"
                title="Restart guided tour"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-md text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 transition"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onLogout}
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center justify-center w-full rounded-lg py-2 text-muted-foreground/50 hover:bg-white/5 hover:text-muted-foreground transition-colors text-xs gap-2 font-medium"
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
  const [refreshing, setRefreshing] = useState(false);

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(SIDEBAR_KEY) === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_KEY, String(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

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

  const handleRefresh = () => {
    setRefreshing(true);
    window.dispatchEvent(new Event("era:refresh"));
    setTimeout(() => setRefreshing(false), 800);
  };

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

      {/* ── Desktop sidebar ──────────────────────────────── */}
      {!isMobile && (
        <aside
          className={cn(
            "border-r border-sidebar-border bg-sidebar flex flex-col shrink-0 transition-all duration-200",
            collapsed ? "w-14" : "w-60"
          )}
          style={{ boxShadow: "2px 0 24px rgba(0,0,0,0.4)" }}
        >
          <NavContent {...navProps} collapsed={collapsed} />
        </aside>
      )}

      {/* ── Mobile drawer ────────────────────────────────── */}
      {isMobile && mobileNavOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col shadow-2xl">
            <NavContent
              {...navProps}
              collapsed={false}
              onNavClick={() => setMobileNavOpen(false)}
            />
          </aside>
        </>
      )}

      {/* ── Main content ─────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className={cn(
          "h-12 flex items-center justify-between px-6 shrink-0 border-b border-border bg-background/80 backdrop-blur-sm",
        )}>
          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={() => setMobileNavOpen(o => !o)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition mr-3"
              aria-label="Open menu"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          )}

          {/* Breadcrumb / spacer */}
          <div className="flex-1" />

          {/* Right: feedback badge + refresh */}
          <div className="flex items-center gap-2">
            {feedbackUnread > 0 && (
              <span className="min-w-[20px] h-5 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center px-1.5">
                {feedbackUnread > 99 ? "99+" : feedbackUnread}
              </span>
            )}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
              {!isMobile && <span>Refresh</span>}
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto p-5 md:p-7 lg:p-8">
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
