import { type ReactNode } from "react";
import { Bell, RefreshCw } from "lucide-react";
import EraPatientSidebar from "./EraPatientSidebar";
import { ROLE_LABELS, ROLE_COLORS } from "@/types";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  role: Role;
  activePage: string;
  children: ReactNode;
  userName?: string;
}

const ROLE_DISPLAY: Record<Role, string> = {
  admin: "Admin",
  receptionist: "Receptionist",
  nurse: "Nurse",
  doctor: "Dr. Emmanuel Obi",
};

export default function DemoShell({ role, activePage, children, userName = "Admin" }: Props) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <EraPatientSidebar role={role} activePage={activePage} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="h-10 sm:h-12 border-b border-border flex items-center justify-between px-2 sm:px-4 bg-card/50 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">ERA Hospital</span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              ROLE_COLORS[role]
            )}>
              {ROLE_DISPLAY[role]}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground/50" />
            <Bell className="w-3.5 h-3.5 text-muted-foreground/50" />
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">
                {ROLE_DISPLAY[role].slice(0, 2).toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
