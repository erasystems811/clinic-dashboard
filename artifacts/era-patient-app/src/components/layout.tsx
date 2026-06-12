import { type ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { Home, Heart, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/",          icon: Home,      label: "Home"      },
  { to: "/wellness",  icon: Heart,     label: "Wellness"  },
  { to: "/hospitals", icon: Building2, label: "Hospitals" },
  { to: "/profile",   icon: User,      label: "Profile"   },
] as const;

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Page content — scrollable */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-bottom">
        <div className="flex items-center justify-around max-w-lg mx-auto">
          {NAV.map(({ to, icon: Icon, label }) => {
            const active = to === "/" ? location === "/" : location.startsWith(to);
            return (
              <Link key={to} to={to}>
                <button
                  className={cn(
                    "flex flex-col items-center gap-1 px-4 py-3 min-w-[60px] transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon
                    className={cn("w-6 h-6 transition-all", active && "scale-110")}
                    strokeWidth={active ? 2.5 : 1.8}
                  />
                  <span className={cn("text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                    {label}
                  </span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
