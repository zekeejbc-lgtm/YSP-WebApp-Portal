/**
 * ProtectedRoute - Route guard for authentication and role-based access
 * 
 * Usage:
 * <Route path="/admin" element={<ProtectedRoute requiredRoles={["admin"]}><AdminPage /></ProtectedRoute>} />
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Suspense, type ReactNode } from 'react';
import { LazyFallback } from '../SocialMediaIcon';
import { useTheme } from '../../contexts/ThemeContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: string[];
  /** If true, redirect to login. If false, show access denied. Default: true */
  redirectToLogin?: boolean;
}

export function ProtectedRoute({ 
  children, 
  requiredRoles,
  redirectToLogin = true 
}: ProtectedRouteProps) {
  const { isAuthenticated, sessionChecked, hasRoleAccess } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();

  // Wait for session to be checked
  if (!sessionChecked) {
    return <LazyFallback isDark={isDark} label="Checking session..." />;
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    if (redirectToLogin) {
      // Save the attempted URL for redirecting after login
      return <Navigate to="/login" state={{ from: location.pathname }} replace />;
    }
    return <Navigate to="/" replace />;
  }

  // Check role access
  if (requiredRoles && !hasRoleAccess(requiredRoles)) {
    // User is logged in but doesn't have required role
    // Redirect to home with access denied message
    return <Navigate to="/" state={{ accessDenied: true }} replace />;
  }

  // Render children wrapped in Suspense for lazy-loaded components
  return (
    <Suspense fallback={<LazyFallback isDark={isDark} label="Loading..." />}>
      {children}
    </Suspense>
  );
}

/**
 * PublicRoute - For pages that should redirect authenticated users away
 * (e.g., login page - logged in users shouldn't see it)
 */
interface PublicRouteProps {
  children: ReactNode;
  /** Where to redirect if already authenticated. Default: "/" */
  redirectTo?: string;
}

export function PublicOnlyRoute({ children, redirectTo = '/' }: PublicRouteProps) {
  const { isAuthenticated, sessionChecked } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();

  if (!sessionChecked) {
    return <LazyFallback isDark={isDark} label="Checking session..." />;
  }

  if (isAuthenticated) {
    // Check if there's a "from" location to redirect back to
    const from = (location.state as { from?: string })?.from || redirectTo;
    return <Navigate to={from} replace />;
  }

  return <>{children}</>;
}
