import { type ReactNode } from "react";
import { Bell, RefreshCw, Menu } from "lucide-react";
import EraPatientSidebar from "./EraPatientSidebar";
import { ROLE_COLORS } from "@/types";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  role: Role;
  activePage: string;
  children: ReactNode;
  userName?: string;
}

const ROLE_DISPLAY: Record<Role, string> = {
  admin:        "Admin",
  receptionist: "Receptionist",
  nurse:        "Nurse",
  doctor:       "Dr. Emmanuel Obi",
};

export default function DemoShell({ role, activePage, children }: Props) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Sidebar — hidden on mobile, visible sm+ */}
      <EraPatientSidebar role={role} activePage={activePage} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <div className="h-11 border-b border-border flex items-center justify-between px-3 sm:px-4 bg-card/50 shrink-0">
          <div className="flex items-center gap-2">
            {/* Logo shown only on mobile (replaces sidebar) */}
            <div className="flex sm:hidden items-center gap-1.5 mr-1">
              <div className="w-5 h-5 rounded-md bg-primary/20 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
              </div>
              <Menu className="w-3.5 h-3.5 text-muted-foreground/50" />
            </div>

            <span className="text-xs text-muted-foreground hidden sm:inline">ERA Hospital</span>
            <span className="text-muted-foreground text-xs hidden sm:inline">/</span>
            <span className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              ROLE_COLORS[role]
            )}>
              {ROLE_DISPLAY[role]}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground/50" />
            <Bell className="w-3.5 h-3.5 text-muted-foreground/50" />
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">
                {ROLE_DISPLAY[role].slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Page content — scrollable; touch-action ensures iOS respects inner scroll */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6" style={{ WebkitOverflowScrolling: "touch" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
