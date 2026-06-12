import { type ReactNode, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Home, Heart, CalendarDays, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",          label: "Home",      Icon: Home },
  { href: "/wellness",  label: "Wellness",  Icon: Heart },
  { href: "/plan",      label: "Plan",      Icon: CalendarDays },
  { href: "/hospitals", label: "Hospitals", Icon: Building2 },
  { href: "/profile",   label: "Profile",   Icon: User },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const qc = useQueryClient();
  const lastDate = useRef(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    function checkDay() {
      const today = new Date().toISOString().split("T")[0];
      if (today !== lastDate.current) {
        lastDate.current = today;
        // Day rolled over — refresh daily data and current plan
        void qc.invalidateQueries({ queryKey: ["wellness", "today"] });
        void qc.invalidateQueries({ queryKey: ["plan"] }); // invalidates all plan queries (current + past weeks)
        void qc.invalidateQueries({ queryKey: ["wellness", "summary"] });
      }
    }

    // Poll every minute so midnight is caught even if app stays open
    const interval = setInterval(checkDay, 60_000);

    // Also fire whenever the user returns to the tab/app (mobile: foreground)
    function onVisible() { if (document.visibilityState === "visible") checkDay(); }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [qc]);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, var(--bg-base) 0%, var(--bg-mid) 50%, var(--bg-base) 100%)" }}>
      <div className="flex flex-col min-h-screen max-w-md mx-auto relative shadow-2xl" style={{ background: "linear-gradient(135deg, var(--bg-base) 0%, var(--bg-mid) 50%, var(--bg-base) 100%)" }}>
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md safe-bottom z-50"
        style={{ background: "color-mix(in srgb, var(--bg-base) 88%, transparent)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", borderTop: "1px solid var(--glass-border)" }}>
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
      <div className="relative flex flex-col items-center gap-1 py-3 px-2 transition-all">
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center transition-all", active && "scale-105")}
          style={active ? { background: `rgba(var(--glow-rgb),0.15)`, boxShadow: `0 0 12px rgba(var(--glow-rgb),0.3)` } : {}}>
          <Icon className="w-5 h-5" style={{ color: active ? "var(--accent)" : "var(--text-sub)" }} />
        </div>
        <span className="text-[10px] font-semibold leading-none"
          style={{ color: active ? "var(--accent)" : "var(--text-dim)" }}>
          {label}
        </span>
      </div>
    </button>
  );
}
