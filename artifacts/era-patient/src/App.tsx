import { Switch, Route, Router as WouterRouter, Redirect, useRoute } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth, type Role } from "@/contexts/auth-context";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Patients from "@/pages/patients";
import PatientDetail from "@/pages/patient-detail";
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
import Messages from "@/pages/messages";
import Settings from "@/pages/settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function defaultPathForRole(role: Role): string {
  if (role === "receptionist") return "/queue";
  if (role === "nurse") return "/nurse-station";
  return "/";
}

function ProtectedRouter() {
  const [matchesFeedback, feedbackParams] = useRoute("/feedback/:token");
  const { hospital, user, hospitalConfig } = useAuth();

  if (matchesFeedback) {
    return <FeedbackForm token={feedbackParams?.token ?? ""} />;
  }

  if (!user) return <Login />;
  if (user.role === "admin" && !hospital) return <Login />;

  const role = user.role;
  const modules = hospitalConfig?.modules;
  const apptEnabled = modules?.appointmentsEnabled ?? true;
  const feedbackEnabled = modules?.feedbackEnabled ?? true;
  const messagesEnabled = modules?.messagesEnabled ?? false;

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
      {role === "admin" && <Route path="/patients/:id" component={PatientDetail} />}
      {role === "admin" && apptEnabled && <Route path="/appointments" component={Appointments} />}
      {role === "admin" && <Route path="/pipeline" component={Pipeline} />}
      {role === "admin" && <Route path="/activity" component={ActivityLog} />}
      {role === "admin" && feedbackEnabled && <Route path="/feedback-admin" component={FeedbackAdmin} />}
      {role === "admin" && <Route path="/wellness" component={WellnessAdmin} />}
      {role === "admin" && messagesEnabled && <Route path="/messages" component={Messages} />}
      {role === "admin" && <Route path="/settings" component={Settings} />}

      {/* Receptionist routes */}
      {role === "receptionist" && <Route path="/queue" component={QueueManagement} />}
      {role === "receptionist" && <Route path="/call-tasks" component={CallTasks} />}
      {role === "receptionist" && apptEnabled && <Route path="/appointments" component={Appointments} />}
      {role === "receptionist" && <Route path="/patients/new" component={NewPatient} />}
      {role === "receptionist" && messagesEnabled && <Route path="/messages" component={Messages} />}

      {/* Nurse routes */}
      {role === "nurse" && <Route path="/nurse-station" component={NurseStation} />}
      {role === "nurse" && messagesEnabled && <Route path="/messages" component={Messages} />}

      {/* Default redirect */}
      <Route>
        <Redirect to={defaultPathForRole(role)} />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ProtectedRouter />
          </WouterRouter>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
