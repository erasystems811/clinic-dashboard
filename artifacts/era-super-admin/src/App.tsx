import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/auth";
import LoginPage from "@/pages/login";
import Analytics from "@/pages/analytics";
import Hospitals from "@/pages/dashboard";
import HospitalDetail from "@/pages/hospital-detail";
import Settings from "@/pages/settings";
import AutomationTests from "@/pages/automation-tests";
import Usage from "@/pages/usage";
import SupportInbox from "@/pages/support";
import DocsPage from "@/pages/docs";
import Announcements from "@/pages/announcements";
import KnowledgeBase from "@/pages/knowledge-base";

const queryClient = new QueryClient();

function AppRoutes() {
  const { isAuthed } = useAuth();

  if (!isAuthed) {
    return <LoginPage />;
  }

  return (
    <Switch>
      <Route path="/" component={Analytics} />
      <Route path="/hospitals" component={Hospitals} />
      <Route path="/hospitals/:id">
        {(params) => <HospitalDetail id={parseInt(params.id)} />}
      </Route>
      <Route path="/settings" component={Settings} />
      <Route path="/announcements" component={Announcements} />
      <Route path="/knowledge-base" component={KnowledgeBase} />
      <Route path="/automation-tests" component={AutomationTests} />
      <Route path="/usage" component={Usage} />
      <Route path="/support" component={SupportInbox} />
      <Route path="/docs" component={DocsPage} />
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
