import { Component, useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { applyEmeraldVars, applyCrimsonVars } from "@/lib/section-theme";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8" style={{ background: "var(--bg-base, #0f172a)" }}>
          <div className="max-w-sm w-full rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center space-y-3">
            <p className="text-2xl">⚠️</p>
            <p className="font-semibold text-white">Something went wrong</p>
            <p className="text-sm text-white/60">{(this.state.error as Error).message}</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="mt-2 px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Switch, Route, Redirect } from "wouter";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { HealthProvider } from "@/contexts/health-context";
import AuthPage from "@/pages/auth";
import HomePage from "@/pages/home";
import WellnessPage from "@/pages/wellness";
import ProgramsPage from "@/pages/programs";
import WaterPage from "@/pages/wellness/water";
import MedicationsPage from "@/pages/wellness/medications";
import WorkoutPage from "@/pages/wellness/workout";
import SleepPage from "@/pages/wellness/sleep";
import MoodPage from "@/pages/wellness/mood";
import FruitPage from "@/pages/wellness/fruit";
import VitalsPage from "@/pages/wellness/vitals";
import SmokingPage from "@/pages/wellness/smoking";
import AlcoholPage from "@/pages/wellness/alcohol";
import IntimacyPage from "@/pages/intimacy/index";
import EyeBreakPage from "@/pages/wellness/eyebreak";
import SunscreenPage from "@/pages/wellness/sunscreen";
import OutdoorsPage from "@/pages/wellness/outdoors";
import VaccinesPage from "@/pages/wellness/vaccines";
import CheckupsPage from "@/pages/wellness/checkups";
import HygienePage from "@/pages/wellness/hygiene";
import HospitalsPage from "@/pages/hospitals";
import ProfilePage from "@/pages/profile";
import PricingPage from "@/pages/pricing";
import WomensHealthPage from "@/pages/womens-health/index";
import CycleCalendarPage from "@/pages/womens-health/calendar";
import CycleHistoryPage from "@/pages/womens-health/history";
import SocialPage from "@/pages/social/index";
import PartnerPage from "@/pages/social/partner";
import GroupPage from "@/pages/social/group";
import CompanionGate from "@/pages/companion/index";
import { NewJournalPage, JournalViewPage } from "@/pages/companion/journal";
import ChatPage from "@/pages/companion/chat";
import PersonalityPage from "@/pages/companion/personality";
import CompanionSettingsPage from "@/pages/companion/settings";
import OnboardingPage from "@/pages/onboarding";
import PlanPage from "@/pages/plan";
import WeightLossPage from "@/pages/weightloss/index";
import WLTodayPage from "@/pages/weightloss/today";
import WLPlanPage from "@/pages/weightloss/plan";
import WLCalculatorPage from "@/pages/weightloss/calculator";
import WLCoachPage from "@/pages/weightloss/coach";
import WLProgressPage from "@/pages/weightloss/progress";
import ReportPage from "@/pages/report";
import NotificationsPage from "@/pages/notifications";
import NotificationSettingsPage from "@/pages/notification-settings";
import Layout from "@/components/layout";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: true } },
});

// Lightweight page-view tracker: fires once per route change.
// Fire-and-forget — never blocks navigation or re-renders.
function usePageTracker() {
  const [location] = useLocation();
  const sessionId = useRef(
    localStorage.getItem("era_session_id") ?? (() => {
      const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("era_session_id", id);
      return id;
    })()
  );
  const lastRoute = useRef("");

  useEffect(() => {
    if (location === lastRoute.current) return;
    lastRoute.current = location;
    const token = (() => {
      try { return (JSON.parse(localStorage.getItem("era_me_session") ?? "{}") as { token?: string }).token ?? null; } catch { return null; }
    })();
    void fetch("/api/patient-app/track", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { "x-patient-token": token } : {}) },
      body: JSON.stringify({
        route: location,
        sessionId: sessionId.current,
        deviceType: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
      }),
    }).catch(() => {/* ignore */});
  }, [location]);
}

// Watches the current path and applies the correct section palette automatically.
// Any new page added under /weightloss/* gets emerald theming with zero extra code.
// Companion routes are excluded — companion manages its own theme internally.
function SectionThemeManager() {
  const [location] = useLocation();
  const { account, restoreAppTheme } = useAuth();
  const dark = account?.darkMode ?? true;

  useEffect(() => {
    if (location.startsWith("/weightloss")) {
      applyEmeraldVars(dark);
    } else if (location.startsWith("/intimacy")) {
      applyCrimsonVars();
    } else if (!location.startsWith("/companion")) {
      restoreAppTheme();
    }
  }, [location, dark, restoreAppTheme]);

  return null;
}

// Scroll container for section pages (body has overflow:hidden globally).
// Outer div is fixed (viewport-locked), inner div is the actual scroll target —
// matching Layout's pattern so iOS PWA scroll works reliably.
function SP({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg-base)" }}>
      <div style={{ maxWidth: "448px", margin: "0 auto", height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
        {children}
      </div>
    </div>
  );
}

function AppRoutes() {
  const { account, loading } = useAuth();
  usePageTracker();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">E</span>
          </div>
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/reset-password" component={AuthPage} />
        <Route><Redirect to="/auth" /></Route>
      </Switch>
    );
  }

  // First-time user — hasn't completed onboarding yet
  if (!account.displayName) {
    return (
      <Switch>
        <Route path="/onboarding" component={OnboardingPage} />
        <Route><Redirect to="/onboarding" /></Route>
      </Switch>
    );
  }

  return (
    <>
    <SectionThemeManager />
    <Switch>
      {/* Full-screen section routes — no bottom nav, own scroll container */}
      {/* WLCoachPage manages its own scroll via height:100dvh */}
      <Route path="/weightloss/coach" component={WLCoachPage} />
      <Route path="/weightloss"><SP><WeightLossPage /></SP></Route>
      <Route path="/weightloss/today"><SP><WLTodayPage /></SP></Route>
      <Route path="/weightloss/plan"><SP><WLPlanPage /></SP></Route>
      <Route path="/weightloss/calculator"><SP><WLCalculatorPage /></SP></Route>
      <Route path="/weightloss/progress"><SP><WLProgressPage /></SP></Route>
      <Route path="/womens-health"><SP><WomensHealthPage /></SP></Route>
      <Route path="/womens-health/calendar"><SP><CycleCalendarPage /></SP></Route>
      <Route path="/womens-health/history"><SP><CycleHistoryPage /></SP></Route>
      <Route path="/social"><SP><SocialPage /></SP></Route>
      <Route path="/social/partner/:id"><SP><PartnerPage /></SP></Route>
      <Route path="/social/group/:id"><SP><GroupPage /></SP></Route>
      <Route path="/intimacy"><SP><IntimacyPage /></SP></Route>
      <Route path="/wellness/intimacy"><Redirect to="/intimacy" /></Route>
      <Route path="/companion" component={CompanionGate} />
      <Route path="/companion/journal/new" component={NewJournalPage} />
      <Route path="/companion/journal/:id" component={JournalViewPage} />
      <Route path="/companion/chat/:id" component={ChatPage} />
      <Route path="/companion/personality" component={PersonalityPage} />
      <Route path="/companion/settings" component={CompanionSettingsPage} />

      {/* Main routes — wrapped in Layout with bottom nav */}
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/plan" component={PlanPage} />
            <Route path="/report" component={ReportPage} />
            <Route path="/notifications" component={NotificationsPage} />
            <Route path="/notification-settings" component={NotificationSettingsPage} />
            <Route path="/programs" component={ProgramsPage} />
            <Route path="/wellness" component={ProgramsPage} />
            <Route path="/wellness/water" component={WaterPage} />
            <Route path="/wellness/medications" component={MedicationsPage} />
            <Route path="/wellness/workout" component={WorkoutPage} />
            <Route path="/wellness/sleep" component={SleepPage} />
            <Route path="/wellness/mood" component={MoodPage} />
            <Route path="/wellness/energy" component={MoodPage} />
            <Route path="/wellness/stress" component={MoodPage} />
            <Route path="/wellness/fruit" component={FruitPage} />
            <Route path="/wellness/vitals" component={VitalsPage} />
            <Route path="/wellness/smoking" component={SmokingPage} />
            <Route path="/wellness/alcohol" component={AlcoholPage} />
            <Route path="/wellness/intimacy" component={IntimacyPage} />
            <Route path="/wellness/eyebreak" component={EyeBreakPage} />
            <Route path="/wellness/sunscreen" component={SunscreenPage} />
            <Route path="/wellness/outdoors" component={OutdoorsPage} />
            <Route path="/wellness/vaccines" component={VaccinesPage} />
            <Route path="/wellness/checkups" component={CheckupsPage} />
            <Route path="/wellness/hygiene" component={HygienePage} />
            <Route path="/hospitals" component={HospitalsPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/auth"><Redirect to="/" /></Route>
            <Route><Redirect to="/" /></Route>
          </Switch>
        </Layout>
      </Route>
    </Switch>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <HealthProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </HealthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
