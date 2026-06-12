import { type ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { Home, Heart, Building2, User } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/",          label: "Home",     Icon: Home },
  { href: "/wellness",  label: "Wellness", Icon: Heart },
  { href: "/hospitals", label: "Hospitals",Icon: Building2 },
  { href: "/profile",   label: "Profile",  Icon: User },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto bg-background">
      {/* Page content — scrollable, leaves room for bottom nav */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-card border-t border-border safe-bottom z-50">
        <div className="flex items-center">
          {NAV.map(({ href, label, Icon }) => {
            const active = href === "/" ? location === "/" : location.startsWith(href);
            return (
              <Link key={href} href={href} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center gap-1 py-3 px-2 transition-colors",
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
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
