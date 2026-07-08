import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Target, 
  CheckSquare, 
  Activity, 
  LogOut,
  ChevronDown
} from "lucide-react";
import { useLogout } from "@workspace/api-client-react";

export function Sidebar() {
  const { user, setUser } = useAuth();
  const [location, setLocation] = useLocation();
  const logout = useLogout();

  const isAdmin = user?.role === "admin";
  const basePath = isAdmin ? "/admin" : "/user";

  const navItems = [
    { name: "Dashboard", path: basePath, icon: LayoutDashboard },
    ...(isAdmin ? [{ name: "Users", path: "/admin/users", icon: Users }] : []),
    { name: "Contacts", path: `${basePath}/contacts`, icon: Users },
    ...(isAdmin ? [{ name: "Companies", path: "/admin/companies", icon: Building2 }] : []),
    { name: "Deals", path: `${basePath}/deals`, icon: Target },
    { name: "Tasks", path: `${basePath}/tasks`, icon: CheckSquare },
    { name: "Activities", path: `${basePath}/activities`, icon: Activity },
  ];

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setUser(null);
        setLocation("/login");
      }
    });
  };

  return (
    <div className="w-64 bg-sidebar text-sidebar-foreground flex flex-col h-full border-r border-sidebar-border shadow-sm">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
          <div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
            <Target className="w-4 h-4 text-primary-foreground" />
          </div>
          NexusCRM
        </div>
      </div>

      <div className="flex-1 py-6 px-3 flex flex-col gap-1 overflow-y-auto">
        <div className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
          Menu
        </div>
        {navItems.map((item) => {
          const isActive = location === item.path || (location.startsWith(item.path) && item.path !== basePath);
          const Icon = item.icon;
          
          return (
            <Link key={item.path} href={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
              isActive 
                ? "bg-sidebar-accent text-white" 
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-white"
            }`}>
              <Icon className="w-4 h-4" />
              {item.name}
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border mt-auto">
        <div className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-sidebar-accent/50 cursor-pointer transition-colors" onClick={handleLogout}>
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-bold text-white uppercase">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium text-white truncate">{user?.name}</div>
            <div className="text-xs text-sidebar-foreground/60 truncate capitalize">{user?.role}</div>
          </div>
          <LogOut className="w-4 h-4 text-sidebar-foreground/60" />
        </div>
      </div>
    </div>
  );
}
