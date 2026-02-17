/**
 * ProtectedRoute - Route guard for authentication and role-based access
 * 
 * Usage:
 * <Route path="/admin" element={<ProtectedRoute requiredRoles={["admin"]}><AdminPage /></ProtectedRoute>} />
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Suspense, type ReactNode, useEffect, useState } from 'react';
import { LazyFallback } from '../SocialMediaIcon';
import { useTheme } from '../../contexts/ThemeContext';
import { authorizePageAccess } from '../../services/gasLoginService';

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
  const { isAuthenticated, sessionChecked } = useAuth();
  const { isDark } = useTheme();
  const location = useLocation();
  const [pageCheckPending, setPageCheckPending] = useState(true);
  const [pageAllowed, setPageAllowed] = useState(false);

  // Server-authoritative page access check for protected routes.
  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    // Only check when this is actually a protected/authenticated route context.
    if (!sessionChecked || !isAuthenticated || !requiredRoles || requiredRoles.length === 0) {
      return () => {
        active = false;
        controller.abort();
      };
    }

    const runCheck = async () => {
      setPageCheckPending(true);
      const result = await authorizePageAccess(location.pathname, controller.signal);
      if (!active) return;
      setPageAllowed(result.success === true && result.allowed === true);
      setPageCheckPending(false);
    };

    runCheck();

    return () => {
      active = false;
      controller.abort();
    };
  }, [sessionChecked, isAuthenticated, requiredRoles, location.pathname]);

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

  // Public pass-through safeguard (ProtectedRoute is normally used with requiredRoles).
  if (!requiredRoles || requiredRoles.length === 0) {
    return (
      <Suspense fallback={<LazyFallback isDark={isDark} label="Loading..." />}>
        {children}
      </Suspense>
    );
  }

  if (pageCheckPending) {
    return <LazyFallback isDark={isDark} label="Authorizing access..." />;
  }

  if (!pageAllowed) {
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
