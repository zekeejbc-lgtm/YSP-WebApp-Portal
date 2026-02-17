/**
 * AppRouter - Main routing component for the application
 * 
 * This component:
 * - Sets up all routes using react-router-dom
 * - Wraps protected routes with ProtectedRoute component
 * - Provides Suspense fallback for lazy-loaded components
 * - Handles 404 (not found) routes
 */

import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { routes } from '../../routes';
import { ProtectedRoute } from './ProtectedRoute';

interface AppRouterProps {
  /** The homepage/layout component that wraps the app */
  children?: React.ReactNode;
}

/**
 * Simple loading fallback for route transitions
 */
function RouteLoadingFallback() {
  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          border: '4px solid rgba(255, 255, 255, 0.1)',
          borderTopColor: '#f97316',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Main router component
 * 
 * Routes are configured as follows:
 * - "/" renders the children (homepage/layout)
 * - Other routes render their respective components
 * - Protected routes are wrapped with ProtectedRoute
 * - Unknown routes redirect to "/"
 */
export function AppRouter({ children }: AppRouterProps) {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
        {/* Homepage route - renders the layout/homepage */}
        <Route path="/" element={children} />
        <Route path="/Home" element={children} />
        
        {/* Dynamic routes from configuration */}
        {routes.map((route) => {
          const RouteElement = route.element;
          
          // Wrap in ProtectedRoute if roles are required
          if (route.requiredRoles && route.requiredRoles.length > 0) {
            return (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <ProtectedRoute requiredRoles={route.requiredRoles}>
                    <RouteElement />
                  </ProtectedRoute>
                }
              />
            );
          }
          
          // Public route
          return (
            <Route
              key={route.path}
              path={route.path}
              element={<RouteElement />}
            />
          );
        })}
        
        {/* Catch-all: redirect unknown routes to homepage */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default AppRouter;
