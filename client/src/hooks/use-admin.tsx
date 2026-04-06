import { useAuth } from "./use-auth";

/**
 * Hook to determine if the current user has admin privileges
 * Returns true if the user has the admin role, false otherwise
 */
export function useIsAdmin() {
  const { user } = useAuth();
  
  // If user is not authenticated, they are not an admin
  if (!user) {
    return false;
  }

  // Direct check: if user has isAdmin property set to true
  if (user.isAdmin === true) {
    return true;
  }

  // Check if user has roles and if any of them is "admin"
  if (user.roles && Array.isArray(user.roles)) {
    return user.roles.some(role => role.name.toLowerCase() === 'admin');
  }

  // Fallback check: if there are no roles defined in the system yet
  // we'll consider the username "admin" as having admin privileges
  if (user.username === 'admin') {
    return true;
  }

  return false;
}