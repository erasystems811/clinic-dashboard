import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route, Redirect } from "wouter";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import AuthPage from "@/pages/auth";
import HomePage from "@/pages/home";
import WellnessPage from "@/pages/wellness";
import WaterPage from "@/pages/wellness/water";
import MedicationsPage from "@/pages/wellness/medications";
import WorkoutPage from "@/pages/wellness/workout";
import SleepPage from "@/pages/wellness/sleep";
import MoodPage from "@/pages/wellness/mood";
import FruitPage from "@/pages/wellness/fruit";
import VitalsPage from "@/pages/wellness/vitals";
import SmokingPage from "@/pages/wellness/smoking";
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
import CompanionGate from "@/pages/companion/index";
import { NewJournalPage, JournalViewPage } from "@/pages/companion/journal";
import ChatPage from "@/pages/companion/chat";
import PersonalityPage from "@/pages/companion/personality";
import CompanionSettingsPage from "@/pages/companion/settings";
import OnboardingPage from "@/pages/onboarding";
import PlanPage from "@/pages/plan";
import ReportPage from "@/pages/report";
import Layout from "@/components/layout";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function AppRoutes() {
  const { account, loading } = useAuth();

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
    <Switch>
      {/* Companion routes — full-screen, no bottom nav */}
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
            <Route path="/wellness" component={WellnessPage} />
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
            <Route path="/wellness/eyebreak" component={EyeBreakPage} />
            <Route path="/wellness/sunscreen" component={SunscreenPage} />
            <Route path="/wellness/outdoors" component={OutdoorsPage} />
            <Route path="/wellness/vaccines" component={VaccinesPage} />
            <Route path="/wellness/checkups" component={CheckupsPage} />
            <Route path="/wellness/hygiene" component={HygienePage} />
            <Route path="/womens-health" component={WomensHealthPage} />
        <Route path="/womens-health/calendar" component={CycleCalendarPage} />
        <Route path="/womens-health/history" component={CycleHistoryPage} />
        <Route path="/social" component={SocialPage} />
        <Route path="/social/partner/:id" component={PartnerPage} />
        <Route path="/hospitals" component={HospitalsPage} />
            <Route path="/profile" component={ProfilePage} />
            <Route path="/pricing" component={PricingPage} />
            <Route path="/auth"><Redirect to="/" /></Route>
            <Route><Redirect to="/" /></Route>
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </QueryClientProvider>
  );
}
