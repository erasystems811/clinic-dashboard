import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/auth";
import LoginPage from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import HospitalDetail from "@/pages/hospital-detail";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthed } = useAuth();

  if (!isAuthed) {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/hospitals/:id">
        {(params) => <HospitalDetail id={parseInt(params.id)} />}
      </Route>
      <Route>
        <div className="flex items-center justify-center min-h-screen text-muted-foreground text-sm">
          404 — Page not found
        </div>
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
