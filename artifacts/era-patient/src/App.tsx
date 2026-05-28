import { Switch, Route, Router as WouterRouter, Redirect, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, type Role } from "@/contexts/auth-context";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import PatientHistory from "@/pages/patient-history";
import NewPatient from "@/pages/patient-new";
import Appointments from "@/pages/appointments";
import Pipeline from "@/pages/pipeline";
import ActivityLog from "@/pages/activity";
import QueueManagement from "@/pages/queue";
import NurseStation from "@/pages/nurse-station";
import CallTasks from "@/pages/call-tasks";
import FeedbackAdmin from "@/pages/feedback-admin";
import FeedbackForm from "@/pages/feedback-form";
import WellnessAdmin from "@/pages/wellness-admin";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function PatientRedirect() {
  const [, params] = useRoute("/patients/:id");
  return <Redirect to={`/patients/${params?.id ?? ""}/history`} />;
}

function defaultPathForRole(role: Role): string {
  if (role === "receptionist") return "/queue";
  if (role === "nurse") return "/nurse-station";
  return "/";
}

function ProtectedRouter() {
  const [matchesFeedback, feedbackParams] = useRoute("/feedback/:token");
  const [matchesFeedbackH, feedbackHParams] = useRoute("/feedback/h/:slug");
  const { hospital, user, hospitalConfig } = useAuth();

  if (matchesFeedbackH) {
    return <FeedbackForm hospitalSlug={feedbackHParams?.slug ?? ""} />;
  }

  if (matchesFeedback) {
    return <FeedbackForm token={feedbackParams?.token ?? ""} />;
  }

  if (!user) {
    return (
      <Switch>
        <Route path="/login"><Login /></Route>
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }
  if (user.role === "admin" && !hospital) {
    return (
      <Switch>
        <Route path="/login"><Login /></Route>
        <Route><Redirect to="/login" /></Route>
      </Switch>
    );
  }

  const role = user.role;
  const modules = hospitalConfig?.modules;
  const apptEnabled = modules?.appointmentsEnabled ?? true;
  const feedbackEnabled = modules?.feedbackEnabled ?? true;

  return (
    <Switch>
      <Route path="/login">
        <Redirect to={defaultPathForRole(role)} />
      </Route>

      {/* Admin routes */}
      {role === "admin" && <Route path="/" component={Dashboard} />}
      {role === "admin" && <Route path="/patients" component={Patients} />}
      {role === "admin" && <Route path="/patients/new" component={NewPatient} />}
      {role === "admin" && <Route path="/patients/:id/history" component={PatientHistory} />}
      {role === "admin" && <Route path="/patients/:id" component={PatientRedirect} />}
      {role === "admin" && apptEnabled && <Route path="/appointments" component={Appointments} />}
      {role === "admin" && <Route path="/pipeline" component={Pipeline} />}
      {role === "admin" && <Route path="/activity" component={ActivityLog} />}
      {role === "admin" && feedbackEnabled && <Route path="/feedback-admin" component={FeedbackAdmin} />}
      {role === "admin" && <Route path="/wellness" component={WellnessAdmin} />}
      {role === "admin" && <Route path="/settings" component={Settings} />}

      {/* Receptionist routes */}
      {role === "receptionist" && <Route path="/queue" component={QueueManagement} />}
      {role === "receptionist" && <Route path="/call-tasks" component={CallTasks} />}
      {role === "receptionist" && apptEnabled && <Route path="/appointments" component={Appointments} />}
      {role === "receptionist" && <Route path="/patients/new" component={NewPatient} />}

      {/* Nurse routes */}
      {role === "nurse" && <Route path="/nurse-station" component={NurseStation} />}

      {/* Default redirect */}
      <Route>
        <Redirect to={defaultPathForRole(role)} />
      </Route>
    </Switch>
  );
}

/* ── Role-based theme ───────────────────────────────────────────────────────
   Applies CSS variable overrides to :root based on the logged-in role so the
   accent colour the user chose at login flows through the entire app.
   nurse / receptionist → navy  hsl(221 78% 57%)
   admin                → gold  hsl(43 60% 52%)
*/
function RoleThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  useEffect(() => {
    const root = document.documentElement;
    if (!user) {
      root.style.removeProperty("--primary");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--sidebar-primary");
      root.style.removeProperty("--sidebar-primary-foreground");
      root.style.removeProperty("--sidebar-ring");
      return;
    }

    if (user.role === "admin") {
      // Admin: teal #3d9e8c
      root.style.setProperty("--primary", "169 44% 43%");
      root.style.setProperty("--primary-foreground", "0 0% 100%");
      root.style.setProperty("--ring", "169 44% 43%");
      root.style.setProperty("--sidebar-primary", "169 44% 43%");
      root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
      root.style.setProperty("--sidebar-ring", "169 44% 43%");
    } else {
      // nurse + receptionist: navy blue
      root.style.setProperty("--primary", "221 78% 57%");
      root.style.setProperty("--primary-foreground", "0 0% 100%");
      root.style.setProperty("--ring", "221 78% 57%");
      root.style.setProperty("--sidebar-primary", "221 78% 57%");
      root.style.setProperty("--sidebar-primary-foreground", "0 0% 100%");
      root.style.setProperty("--sidebar-ring", "221 78% 57%");
    }
  }, [user?.role]);

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <RoleThemeProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ProtectedRouter />
            </WouterRouter>
            <Toaster />
          </RoleThemeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
