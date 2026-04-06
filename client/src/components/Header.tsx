import { useLocation } from "wouter";
import { useAppContext } from "@/context/AppContext";
import { Bell, LogOut, Shield, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { Badge } from "@/components/ui/badge";
import ChangePasswordDialog from "@/components/ChangePasswordDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Header = () => {
  const { activePage, toggleNav } = useAppContext();
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const isAdmin = useIsAdmin();

  // Format the page title based on the active page
  const getPageTitle = () => {
    switch (activePage) {
      case "dashboard":
        return "Dashboard";
      case "receive":
        return "Receive Order";
      case "release":
        return "Release Material";
      case "amend":
        return "Amend Details";
      case "reports":
        return "Reports & Logs";
      case "users":
        return "User Management";
      default:
        return "Dashboard";
    }
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user || !user.fullName) return "U";
    
    const nameParts = user.fullName.split(" ");
    if (nameParts.length === 1) return nameParts[0][0];
    return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`;
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm">
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button 
            onClick={toggleNav}
            className="md:hidden mr-2 p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-slate-800">{getPageTitle()}</h2>
        </div>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="icon" className="rounded-full text-slate-400 hover:text-teal-700 hover:bg-slate-100">
            <Bell className="h-5 w-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="p-0 h-auto">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <span>{getUserInitials()}</span>
                  </div>
                  <div className="hidden md:flex items-center space-x-1">
                    <span className="text-sm font-medium">{user?.fullName}</span>
                    {isAdmin && (
                      <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 hover:bg-amber-100">
                        <Shield className="h-3 w-3 mr-0.5" /> Admin
                      </Badge>
                    )}
                  </div>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <span>{user?.fullName}</span>
                  <span className="text-xs text-muted-foreground">{user?.username}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {isAdmin && (
                <DropdownMenuItem className="cursor-default">
                  <Shield className="mr-2 h-4 w-4 text-amber-500" />
                  <div className="flex flex-col space-y-1">
                    <span>Administrator</span>
                    <span className="text-xs text-muted-foreground">Full system access</span>
                  </div>
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <div className="flex items-center w-full">
                  <UserCog className="mr-2 h-4 w-4" />
                  <span className="flex-1">Change Password</span>
                  <ChangePasswordDialog variant="ghost" size="sm" />
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-500 cursor-pointer">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default Header;
