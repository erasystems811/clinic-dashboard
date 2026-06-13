import { type ReactNode, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Home, Heart, CalendarDays, Building2, User, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUnreadNotifCount } from "@/lib/hospitals-api";

const NAV = [
  { href: "/",          label: "Home",      Icon: Home },
  { href: "/wellness",  label: "Personal",  Icon: Heart },
  { href: "/plan",      label: "Plan",      Icon: CalendarDays },
  { href: "/hospitals", label: "Hospitals", Icon: Building2 },
  { href: "/profile",   label: "Settings",  Icon: User },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const qc = useQueryClient();
  const lastDate = useRef(new Date().toISOString().split("T")[0]);
  const { data: notifData } = useUnreadNotifCount();
  const unread = notifData?.count ?? 0;

  useEffect(() => {
    function checkDay() {
      const today = new Date().toISOString().split("T")[0];
      if (today !== lastDate.current) {
        lastDate.current = today;
        void qc.refetchQueries({ queryKey: ["wellness"] });
        void qc.refetchQueries({ queryKey: ["plan"] });
      }
    }

    const interval = setInterval(checkDay, 60_000);

    function onVisible() { if (document.visibilityState === "visible") checkDay(); }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [qc]);

  const isNotifPage = location.startsWith("/notifications");

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, var(--bg-base) 0%, var(--bg-mid) 50%, var(--bg-base) 100%)" }}>
      <div className="flex flex-col min-h-screen max-w-md mx-auto relative shadow-2xl" style={{ background: "linear-gradient(135deg, var(--bg-base) 0%, var(--bg-mid) 50%, var(--bg-base) 100%)" }}>
        <main className="flex-1 overflow-y-auto pb-20">
          {children}
        </main>

        {/* ── Floating notification bell ── */}
        {!isNotifPage && (
          <button
            onClick={() => navigate("/notifications")}
            className="fixed z-50 active:scale-90 transition"
            style={{
              bottom: 76,
              right: "calc(50% - min(50vw, 224px) + 16px)",
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: unread > 0
                ? "linear-gradient(135deg,rgba(239,68,68,0.9),rgba(220,38,38,0.8))"
                : "color-mix(in srgb, var(--bg-base) 80%, transparent)",
              border: unread > 0 ? "1.5px solid rgba(239,68,68,0.5)" : "1.5px solid var(--glass-border)",
              boxShadow: unread > 0
                ? "0 4px 20px rgba(239,68,68,0.4)"
                : "0 4px 16px rgba(0,0,0,0.25)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" style={{ color: unread > 0 ? "#fff" : "var(--text-sub)" }} />
            {unread > 0 && (
              <span
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black"
                style={{ background: "#fff", color: "#dc2626" }}
              >
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        )}

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
  return (
    <button
      className="flex-1 select-none"
      onClick={() => onNavigate(href)}
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
