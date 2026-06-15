import { Component, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, Redirect, useRoute } from "wouter";
import SystemFeedbackPopup from "@/components/system-feedback-popup";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="max-w-md w-full rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-3">
            <p className="text-2xl">⚠️</p>
            <p className="font-semibold text-foreground">Something went wrong</p>
            <p className="text-sm text-muted-foreground">{(this.state.error as Error).message}</p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload(); }}
              className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
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
import EraMessages from "@/pages/era-messages";
import Settings from "@/pages/settings";
import PatientImport from "@/pages/patient-import";
import HelpPage from "@/pages/help";
import DoctorView from "@/pages/doctor-view";
import BookingPage from "@/pages/book";

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
  if (role === "doctor") return "/era-messages";
  return "/";
}

function ProtectedRouter() {
  const [matchesFeedback, feedbackParams] = useRoute("/feedback/:token");
  const [matchesFeedbackH, feedbackHParams] = useRoute("/feedback/h/:slug");
  const [matchesBook, bookParams] = useRoute("/book/:slug");
  const { hospital, user, hospitalConfig } = useAuth();

  if (matchesFeedbackH) {
    return <FeedbackForm hospitalSlug={feedbackHParams?.slug ?? ""} />;
  }

  if (matchesBook) {
    return <BookingPage hospitalSlug={bookParams?.slug ?? ""} />;
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
      {role === "admin" && <Route path="/call-tasks" component={CallTasks} />}
      {role === "admin" && <Route path="/import" component={PatientImport} />}
      {(role === "admin" || role === "doctor") && <Route path="/era-messages" component={EraMessages} />}
      {role === "admin" && <Route path="/help" component={HelpPage} />}

      {/* Receptionist routes */}
      {role === "receptionist" && <Route path="/queue" component={QueueManagement} />}
      {role === "receptionist" && <Route path="/call-tasks" component={CallTasks} />}
      {role === "receptionist" && apptEnabled && <Route path="/appointments" component={Appointments} />}
      {role === "receptionist" && <Route path="/patients/new" component={NewPatient} />}
      {role === "receptionist" && <Route path="/help" component={HelpPage} />}

      {/* Nurse routes */}
      {role === "nurse" && <Route path="/nurse-station" component={NurseStation} />}
      {role === "nurse" && <Route path="/call-tasks" component={CallTasks} />}
      {role === "nurse" && <Route path="/help" component={HelpPage} />}

      {/* Doctor routes */}
      {role === "doctor" && <Route path="/doctor-view" component={DoctorView} />}
      {role === "doctor" && <Route path="/help" component={HelpPage} />}

      {/* Default redirect */}
      <Route>
        <Redirect to={defaultPathForRole(role)} />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ErrorBoundary>
                <ProtectedRouter />
              </ErrorBoundary>
            </WouterRouter>
            <Toaster />
            <SystemFeedbackPopup />
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
