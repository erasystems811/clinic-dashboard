import { type ReactNode, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { Home, Heart, CalendarDays, Building2, User, Bell } from "lucide-react";
import { useUnreadNotifCount } from "@/lib/hospitals-api";

const NAV = [
  { href: "/",          label: "Home",      Icon: Home },
  { href: "/wellness",  label: "Settings",  Icon: Heart },
  { href: "/plan",      label: "Plan",      Icon: CalendarDays },
  { href: "/hospitals", label: "Hospitals", Icon: Building2 },
  { href: "/profile",   label: "Profile",   Icon: User },
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

  const hideFloatingBell = location.startsWith("/notifications") || location.startsWith("/hospitals");
  const bellBottom = location.startsWith("/companion") ? 148 : 76;

  return (
    <div style={{ position: "fixed", inset: 0, background: "linear-gradient(135deg, var(--bg-base) 0%, var(--bg-mid) 50%, var(--bg-base) 100%)" }}>
      <div className="flex flex-col h-full max-w-md mx-auto relative shadow-2xl" style={{ background: "linear-gradient(135deg, var(--bg-base) 0%, var(--bg-mid) 50%, var(--bg-base) 100%)" }}>
        <main className="flex-1 min-h-0 overflow-y-auto pb-20" style={{ background: "var(--bg-base)" }}>
          {children}
        </main>

        {/* ── Floating notification bell ── */}
        {!hideFloatingBell && (
          <button
            onClick={() => navigate("/notifications")}
            className="fixed z-50"
            style={{
              bottom: bellBottom,
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
              transition: "transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease",
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

        {/* ── Bottom nav ── */}
        <nav
          className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md safe-bottom z-50"
          style={{
            background: "color-mix(in srgb, var(--bg-base) 82%, transparent)",
            backdropFilter: "blur(28px) saturate(180%)",
            WebkitBackdropFilter: "blur(28px) saturate(180%)",
            borderTop: "1px solid var(--glass-border)",
            boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
          }}
        >
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
      style={{ background: "transparent", border: "none", padding: 0 }}
    >
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4, paddingBottom: 10 }}>

        {/* Top accent bar — springs open when active */}
        <div style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          height: 3,
          width: active ? 28 : 0,
          borderRadius: "0 0 3px 3px",
          background: active ? "var(--accent)" : "transparent",
          boxShadow: active ? `0 2px 10px rgba(var(--glow-rgb), 0.7)` : "none",
          transition: "width 0.38s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease",
        }} />

        {/* Icon with spring scale */}
        <div style={{
          width: 44,
          height: 38,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: active ? "scale(1.14) translateY(-1px)" : "scale(1)",
          transition: "transform 0.38s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          <Icon
            style={{
              width: 22,
              height: 22,
              color: active ? "var(--accent)" : "var(--text-sub)",
              transition: "color 0.22s ease",
              filter: active ? `drop-shadow(0 0 6px rgba(var(--glow-rgb), 0.5))` : "none",
            }}
          />
        </div>

        {/* Label */}
        <span style={{
          fontSize: 10,
          fontWeight: active ? 700 : 500,
          color: active ? "var(--accent)" : "var(--text-dim)",
          letterSpacing: active ? 0.1 : 0,
          transition: "color 0.22s ease",
          lineHeight: 1,
          fontFamily: "inherit",
        }}>
          {label}
        </span>
      </div>
    </button>
  );
}
