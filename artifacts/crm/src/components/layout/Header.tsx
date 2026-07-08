import { useLocation } from "wouter";
import { ChevronRight, Search, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function Header() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Quick breadcrumb logic
  const parts = location.split('/').filter(Boolean);
  const breadcrumbs = parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    const name = part.charAt(0).toUpperCase() + part.slice(1);
    return (
      <div key={index} className="flex items-center">
        {index > 0 && <ChevronRight className="w-4 h-4 mx-2 text-muted-foreground" />}
        <span className={isLast ? "font-medium text-foreground" : "text-muted-foreground"}>
          {name}
        </span>
      </div>
    );
  });

  return (
    <header className="h-16 bg-card border-b border-border flex items-center px-8 justify-between shadow-sm z-10 sticky top-0">
      <div className="flex items-center text-sm">
        {breadcrumbs.length > 0 ? breadcrumbs : <span className="font-medium text-foreground">Dashboard</span>}
      </div>
      
      <div className="flex items-center gap-6">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Search CRM..." 
            className="pl-9 pr-4 py-1.5 bg-muted/50 border-none rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 w-64 transition-all"
          />
        </div>
        
        <button className="relative text-muted-foreground hover:text-foreground transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-card"></span>
        </button>
      </div>
    </header>
  );
}
