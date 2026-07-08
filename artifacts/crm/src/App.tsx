import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Companies from "@/pages/companies";
import Deals from "@/pages/deals";
import Tasks from "@/pages/tasks";
import Users from "@/pages/users";
import Activities from "@/pages/activities";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,        // 30s — don't re-fetch if data is fresh
      gcTime: 5 * 60_000,       // 5 min cache
    },
  },
});

// A component to automatically redirect logged in users from root
function RootRedirect() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  
  return <Redirect to={user.role === "admin" ? "/admin" : "/user"} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />

      {/* Admin Routes */}
      <Route path="/admin">
        <AppLayout requireAdmin><Dashboard /></AppLayout>
      </Route>
      <Route path="/admin/users">
        <AppLayout requireAdmin><Users /></AppLayout>
      </Route>
      <Route path="/admin/contacts">
        <AppLayout requireAdmin><Contacts /></AppLayout>
      </Route>
      <Route path="/admin/companies">
        <AppLayout requireAdmin><Companies /></AppLayout>
      </Route>
      <Route path="/admin/deals">
        <AppLayout requireAdmin><Deals /></AppLayout>
      </Route>
      <Route path="/admin/tasks">
        <AppLayout requireAdmin><Tasks /></AppLayout>
      </Route>
      <Route path="/admin/activities">
        <AppLayout requireAdmin><Activities /></AppLayout>
      </Route>

      {/* User Routes */}
      <Route path="/user">
        {/* Users get the same dashboard view for this implementation, backend filters data */}
        <AppLayout><Dashboard /></AppLayout>
      </Route>
      <Route path="/user/contacts">
        <AppLayout><Contacts /></AppLayout>
      </Route>
      <Route path="/user/deals">
        <AppLayout><Deals /></AppLayout>
      </Route>
      <Route path="/user/tasks">
        <AppLayout><Tasks /></AppLayout>
      </Route>
      <Route path="/user/activities">
        <AppLayout><Activities /></AppLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <div className="font-sans text-foreground antialiased min-h-screen">
            <Router />
          </div>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
