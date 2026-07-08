import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { ProtectedRoute } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export function AppLayout({ children, requireAdmin = false }: AppLayoutProps) {
  return (
    <ProtectedRoute requireAdmin={requireAdmin}>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
