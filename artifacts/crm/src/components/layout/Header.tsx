import { useState } from "react";
import { useLocation } from "wouter";
import { ChevronRight, LogOut, KeyRound, User as UserIcon } from "lucide-react";
import { NotificationsPanel } from "./NotificationsPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useLogout } from "@workspace/api-client-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export function Header() {
  const [location, setLocation] = useLocation();
  const { user, setUser } = useAuth();
  const { toast } = useToast();
  const logout = useLogout();

  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  /* breadcrumbs */
  const parts = location.split("/").filter(Boolean);
  const breadcrumbs = parts.map((part, i) => {
    const isLast = i === parts.length - 1;
    const name = part.charAt(0).toUpperCase() + part.slice(1);
    return (
      <div key={i} className="flex items-center">
        {i > 0 && <ChevronRight className="w-4 h-4 mx-2 text-muted-foreground" />}
        <span className={isLast ? "font-medium text-foreground" : "text-muted-foreground"}>
          {name}
        </span>
      </div>
    );
  });

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        setUser(null);
        setLocation("/login");
      },
    });
  };

  const handleChangePassword = async () => {
    if (newPw.length < 6) {
      toast({ title: "Too short", description: "New password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    if (newPw !== confirmPw) {
      toast({ title: "Mismatch", description: "New passwords don't match.", variant: "destructive" });
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast({ title: "Password changed", description: "Your password has been updated." });
      setPwOpen(false);
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <>
      <header className="h-16 bg-card border-b border-border flex items-center px-8 justify-between shadow-sm z-10 sticky top-0">
        <div className="flex items-center text-sm">
          {breadcrumbs.length > 0
            ? breadcrumbs
            : <span className="font-medium text-foreground">Dashboard</span>}
        </div>

        <div className="flex items-center gap-4">
          <NotificationsPanel />

          {/* Profile dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold select-none">
                  {user?.name?.charAt(0).toUpperCase() ?? "?"}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-sm font-medium leading-none">{user?.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user?.role}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2 border-b border-border mb-1">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuItem onClick={() => setPwOpen(true)} className="cursor-pointer">
                <KeyRound className="w-4 h-4 mr-2" /> Change Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Change Password Dialog */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" /> Change Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input
                type="password"
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Your current password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <Input
                type="password"
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePassword} disabled={pwLoading}>
              {pwLoading ? "Updating…" : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
