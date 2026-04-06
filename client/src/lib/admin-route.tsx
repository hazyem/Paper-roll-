import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-admin";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

interface AdminRouteProps {
  path: string;
  component: React.ComponentType;
}

/**
 * AdminRoute component - Only allows access to users with admin privileges
 * Similar to ProtectedRoute but with additional admin check
 */
export function AdminRoute({ path, component: Component }: AdminRouteProps) {
  const { user, isLoading } = useAuth();
  const isAdmin = useIsAdmin();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Route>
    );
  }

  // If not logged in, redirect to login
  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  // If logged in but not admin, redirect to dashboard
  if (!isAdmin) {
    return (
      <Route path={path}>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-center mb-6">
            You don't have permission to access this page. 
            This area is restricted to administrators only.
          </p>
          <a 
            href="/" 
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
            onClick={(e) => {
              e.preventDefault();
              window.location.href = '/';
            }}
          >
            Return to Dashboard
          </a>
        </div>
      </Route>
    );
  }

  // If admin, render the component
  return (
    <Route path={path}>
      <Component />
    </Route>
  );
}