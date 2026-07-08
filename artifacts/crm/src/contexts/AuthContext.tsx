import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import type { AuthUser } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  isLoading: boolean;
  /** True only when the server explicitly returned 401/403 — not on network/5xx errors. */
  isUnauthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isLoading: true,
  isUnauthenticated: false,
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isUnauthenticated, setIsUnauthenticated] = useState(false);
  const [_, setLocation] = useLocation();

  const { data: me, isLoading, error } = useGetMe({
    query: {
      retry: 1,
      queryKey: getGetMeQueryKey(),
    }
  });

  useEffect(() => {
    if (me && !error) {
      setUser(me);
      setIsUnauthenticated(false);
    } else if (error) {
      const status = (error as any)?.response?.status ?? (error as any)?.status;
      if (status === 401 || status === 403) {
        // Confirmed: server says not authenticated
        setUser(null);
        setIsUnauthenticated(true);
      }
      // Transient (network/5xx): leave user state as-is; don't kick them out
    }
  }, [me, error]);

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading, isUnauthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function ProtectedRoute({ children, requireAdmin = false }: { children: ReactNode, requireAdmin?: boolean }) {
  const { user, isLoading, isUnauthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (isUnauthenticated) {
        setLocation("/login");
      } else if (user && requireAdmin && user.role !== "admin") {
        setLocation("/user");
      }
    }
  }, [user, isLoading, isUnauthenticated, setLocation, requireAdmin]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Loading…</div>;
  }

  if (isUnauthenticated || (user && requireAdmin && user.role !== "admin")) {
    return null; // Redirect handled in useEffect above
  }

  // Query finished but user is null due to a transient error — don't blank the screen
  if (!user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Connecting…</div>;
  }

  return <>{children}</>;
}
