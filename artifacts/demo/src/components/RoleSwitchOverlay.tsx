import { useEffect, useState } from "react";
import { ShieldCheck, Phone, Stethoscope, UserSquare2 } from "lucide-react";
import { ROLE_LABELS, ROLE_COLORS } from "@/types";
import type { Role } from "@/types";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  admin:        ShieldCheck,
  receptionist: Phone,
  nurse:        Stethoscope,
  doctor:       UserSquare2,
};

interface Props {
  role: Role;
  visible: boolean;
  onDone: () => void;
}

export default function RoleSwitchOverlay({ role, visible, onDone }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setShow(true);
    const t = setTimeout(() => {
      setShow(false);
      setTimeout(onDone, 300);
    }, 1400);
    return () => clearTimeout(t);
  }, [visible, onDone]);

  if (!visible && !show) return null;

  const Icon = ROLE_ICONS[role];

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-300",
        show ? "opacity-100" : "opacity-0"
      )}
    >
      <div className="flex flex-col items-center gap-4 scale-in">
        <div className={cn(
          "w-16 h-16 rounded-2xl border flex items-center justify-center",
          ROLE_COLORS[role]
        )}>
          <Icon className="w-7 h-7" />
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium mb-1">Switching view to</p>
          <p className="text-xl font-bold text-foreground">{ROLE_LABELS[role]}</p>
        </div>
      </div>
    </div>
  );
}
