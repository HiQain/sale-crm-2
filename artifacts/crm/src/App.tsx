import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AgGridProvider } from "ag-grid-react";
import { AllCommunityModule } from "ag-grid-community";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "@/pages/login";
import Users from "@/pages/users";
import Leads from "@/pages/leads";
import ClientJourneys from "@/pages/client-journeys";
import Billings from "@/pages/billings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  return <Redirect to={user.role === "admin" ? "/admin/leads" : "/user/leads"} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />

      {/* Admin Routes */}
      <Route path="/admin">
        <Redirect to="/admin/leads" />
      </Route>
      <Route path="/admin/leads">
        <AppLayout requireAdmin><Leads /></AppLayout>
      </Route>
      <Route path="/admin/client-journeys">
        <AppLayout requireAdmin><ClientJourneys /></AppLayout>
      </Route>
      <Route path="/admin/billings">
        <AppLayout requireAdmin><Billings /></AppLayout>
      </Route>
      <Route path="/admin/users">
        <AppLayout requireAdmin><Users /></AppLayout>
      </Route>

      {/* User Routes */}
      <Route path="/user">
        <Redirect to="/user/leads" />
      </Route>
      <Route path="/user/leads">
        <AppLayout><Leads /></AppLayout>
      </Route>
      <Route path="/user/client-journeys">
        <AppLayout><ClientJourneys /></AppLayout>
      </Route>
      <Route path="/user/billings">
        <AppLayout><Billings /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AgGridProvider modules={[AllCommunityModule]}>
          <AuthProvider>
            <div className="font-sans text-foreground antialiased min-h-screen">
              <Router />
            </div>
            <Toaster />
          </AuthProvider>
        </AgGridProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
