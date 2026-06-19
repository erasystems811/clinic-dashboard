import {
  Home, Users, Calendar, Star, Newspaper, MessageSquare, Phone,
  FileUp, GitBranch, Activity, ClipboardList, Stethoscope,
  Settings, LogOut, HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}

function getNavItems(role: Role): NavItem[] {
  if (role === "receptionist") {
    return [
      { icon: ClipboardList, label: "Queue Management",   href: "/queue"        },
      { icon: Phone,          label: "Call Tasks",          href: "/call-tasks"   },
      { icon: Calendar,       label: "Appointments",        href: "/appointments" },
      { icon: HelpCircle,     label: "Help & Guide",        href: "/help"         },
    ];
  }
  if (role === "nurse") {
    return [
      { icon: Stethoscope,    label: "Medication View",     href: "/nurse-station"},
      { icon: HelpCircle,     label: "Help & Guide",        href: "/help"         },
    ];
  }
  if (role === "doctor") {
    return [
      { icon: ClipboardList,  label: "Patient Queue",       href: "/doctor-view"  },
      { icon: Stethoscope,    label: "Medication View",     href: "/nurse-station"},
    ];
  }
  return [
    { icon: Home,          label: "Dashboard",          href: "/"              },
    { icon: Users,         label: "Patients",           href: "/patients"      },
    { icon: Calendar,      label: "Appointments",       href: "/appointments"  },
    { icon: Star,          label: "Feedback",           href: "/feedback-admin"},
    { icon: Newspaper,     label: "Wellness Newsletter",href: "/wellness"      },
    { icon: MessageSquare, label: "ERA Messages",       href: "/era-messages"  },
    { icon: Phone,         label: "Message Log",        href: "/message-log"   },
    { icon: FileUp,        label: "Import Patients",    href: "/import"        },
    { icon: GitBranch,     label: "Pipeline",           href: "/pipeline"      },
    { icon: Activity,      label: "Activity",           href: "/activity"      },
    { icon: HelpCircle,    label: "Help & Guide",       href: "/help"          },
  ];
}

interface Props {
  role: Role;
  activePage: string;
}

export default function EraPatientSidebar({ role, activePage }: Props) {
  const items = getNavItems(role);

  return (
    <>
      {/* ── Desktop sidebar (sm+): full width with labels ── */}
      <div className="hidden sm:flex h-full flex-col bg-sidebar border-r border-sidebar-border w-56 shrink-0">
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <div className="w-3.5 h-3.5 rounded-sm bg-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">ERA Hospital</p>
              <p className="text-[10px] text-muted-foreground">era-hospital</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 scrollbar-hide">
          {items.map((item) => {
            const active = activePage === item.href || (item.href !== "/" && activePage.startsWith(item.href));
            return (
              <div
                key={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium mb-0.5 cursor-default transition-colors",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", active ? "text-primary" : "")} />
                <span className="truncate">{item.label}</span>
              </div>
            );
          })}
        </nav>
        <div className="px-2 py-2 border-t border-sidebar-border space-y-0.5">
          {role === "admin" && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground cursor-default">
              <Settings className="w-4 h-4 shrink-0" />
              <span>Settings</span>
            </div>
          )}
          <div className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground cursor-default">
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sign Out</span>
          </div>
        </div>
      </div>

      {/* ── Mobile sidebar (< sm): icon-only narrow strip ── */}
      <div className="flex sm:hidden h-full flex-col bg-sidebar border-r border-sidebar-border w-12 shrink-0">
        {/* Logo icon */}
        <div className="flex items-center justify-center py-3 border-b border-sidebar-border">
          <div className="w-6 h-6 rounded-md bg-primary/20 flex items-center justify-center">
            <div className="w-3 h-3 rounded-sm bg-primary" />
          </div>
        </div>
        {/* Nav icons */}
        <nav className="flex-1 overflow-y-auto py-1 flex flex-col items-center gap-0.5 scrollbar-hide">
          {items.map((item) => {
            const active = activePage === item.href || (item.href !== "/" && activePage.startsWith(item.href));
            return (
              <div
                key={item.href}
                title={item.label}
                className={cn(
                  "w-9 h-9 flex items-center justify-center rounded-md cursor-default transition-colors",
                  active
                    ? "bg-sidebar-accent text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="w-4 h-4 shrink-0" />
              </div>
            );
          })}
        </nav>
        {/* Bottom icons */}
        <div className="py-1 flex flex-col items-center gap-0.5 border-t border-sidebar-border">
          {role === "admin" && (
            <div className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground cursor-default">
              <Settings className="w-4 h-4" />
            </div>
          )}
          <div className="w-9 h-9 flex items-center justify-center rounded-md text-muted-foreground cursor-default">
            <LogOut className="w-4 h-4" />
          </div>
        </div>
      </div>
    </>
  );
}
