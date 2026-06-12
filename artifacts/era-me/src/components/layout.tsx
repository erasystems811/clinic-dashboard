import { type ReactNode, useRef } from "react";
import { useLocation } from "wouter";
import { Home, Heart, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",          label: "Home",     Icon: Home },
  { href: "/wellness",  label: "Wellness", Icon: Heart },
  { href: "/hospitals", label: "Hospitals",Icon: Building2 },
  { href: "/profile",   label: "Profile",  Icon: User },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-background">
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border safe-bottom z-50">
        <div className="flex items-center">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <NavTab
                key={href}
                href={href}
                label={label}
                Icon={Icon}
                active={active}
                onNavigate={navigate}
              />
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function NavTab({ href, label, Icon, active, onNavigate }: {
  href: string; label: string; Icon: React.ElementType;
  active: boolean; onNavigate: (path: string) => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressedRef = useRef(false);

  function handlePointerDown() {
    longPressedRef.current = false;
    timerRef.current = setTimeout(() => {
      const companionTab = localStorage.getItem("era_companion_tab") ?? "/profile";
      if (href === companionTab) {
        longPressedRef.current = true;
        onNavigate("/companion");
      }
    }, 600);
  }

  function handlePointerUp() {
    clearTimeout(timerRef.current);
  }

  function handleClick(e: React.MouseEvent) {
    if (longPressedRef.current) { e.preventDefault(); return; }
    onNavigate(href);
  }

  return (
    <button
      className="flex-1 select-none"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onClick={handleClick}
      aria-label={label}
    >
      <div className={cn(
        "relative flex flex-col items-center gap-1 py-3 px-2 transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}>
        <Icon className={cn("w-5 h-5 transition-transform", active && "scale-110")} />
        <span className={cn("text-[10px] font-medium leading-none", active && "font-semibold")}>
          {label}
        </span>
        {active && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
        )}
      </div>
    </button>
  );
}
