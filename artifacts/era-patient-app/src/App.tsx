import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/auth-context";
import AuthPage from "@/pages/auth";
import Layout from "@/components/layout";
import HomePage from "@/pages/home";
import WellnessPage from "@/pages/wellness";
import HospitalsPage from "@/pages/hospitals";
import ProfilePage from "@/pages/profile";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

function AppRouter() {
  const { account, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
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

  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/wellness" component={WellnessPage} />
        <Route path="/hospitals" component={HospitalsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/auth"><Redirect to="/" /></Route>
        <Route><Redirect to="/" /></Route>
      </Switch>
    </Layout>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </QueryClientProvider>
  );
}
