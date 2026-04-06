import { Link, useLocation } from "wouter";
import { useAppContext } from "@/context/AppContext";
import { useIsAdmin } from "@/hooks/use-admin";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  PlusCircle, 
  MinusCircle, 
  Edit, 
  BarChart4,
  Users
} from "lucide-react";

const navItems = [
  { 
    name: "Dashboard", 
    path: "/", 
    id: "dashboard", 
    icon: <LayoutDashboard className="h-5 w-5" />
  },
  { 
    name: "Receive Order", 
    path: "/receive", 
    id: "receive", 
    icon: <PlusCircle className="h-5 w-5" /> 
  },
  { 
    name: "Release Material", 
    path: "/release", 
    id: "release", 
    icon: <MinusCircle className="h-5 w-5" /> 
  },
  { 
    name: "Amend Details", 
    path: "/amend", 
    id: "amend", 
    icon: <Edit className="h-5 w-5" /> 
  },
  { 
    name: "Reports", 
    path: "/reports", 
    id: "reports", 
    icon: <BarChart4 className="h-5 w-5" /> 
  },
  { 
    name: "User Management", 
    path: "/users", 
    id: "users", 
    icon: <Users className="h-5 w-5" /> 
  }
];

const Sidebar = () => {
  const { activePage, navOpen, closeNav } = useAppContext();
  const [location, setLocation] = useLocation();
  const isAdmin = useIsAdmin();

  const navigateTo = (path: string) => {
    setLocation(path);
    closeNav();
  };

  const formatDateRelative = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    
    return `Today at ${displayHours}:${displayMinutes} ${ampm}`;
  };

  return (
    <aside 
      className={cn(
        "bg-slate-800 text-white w-full md:w-64 md:h-screen flex-shrink-0 flex flex-col",
        "fixed md:relative z-50 inset-0",
        !navOpen && "hidden md:flex"
      )}
    >
      <div className="p-4 flex items-center justify-between md:justify-center border-b border-slate-600">
        <h1 className="text-xl font-semibold">Paper Roll Tracker</h1>
        <button 
          className="md:hidden p-2 rounded-md hover:bg-slate-600"
          onClick={closeNav}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="flex-grow">
        <ul className="py-4">
          {navItems
            .filter(item => item.id !== 'users' || isAdmin) // Only show User Management for admins
            .map((item) => (
              <li key={item.id}>
                <button
                  className={cn(
                    "flex items-center w-full text-left px-4 py-3 hover:bg-slate-600 transition-colors",
                    activePage === item.id && "bg-slate-600"
                  )}
                  onClick={() => navigateTo(item.path)}
                >
                  <span className="mr-3">{item.icon}</span>
                  {item.name}
                </button>
              </li>
            ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-slate-600 hidden md:block">
        <div className="text-xs text-slate-400">
          <p>Last synced: <span>{formatDateRelative()}</span></p>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
