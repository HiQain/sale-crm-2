import { ReactNode } from "react";
import { TopNav } from "./TopNav";
import { ProtectedRoute } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AppLayout({ children, requireAdmin = false }: AppLayoutProps) {
  return (
    <ProtectedRoute requireAdmin={requireAdmin}>
      <div className="flex flex-col min-h-screen bg-background">
        <TopNav />
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
