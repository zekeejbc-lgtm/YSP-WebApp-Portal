/**
 * Route Configuration for YSP Tagum WebApp
 * 
 * Defines all application routes with:
 * - Path
 * - Component (lazy loaded)
 * - Required roles for access
 * - Metadata (title, etc.)
 * 
 * Note: HomePage will be created during refactor, LoginPanel is a modal overlay
 */

import { lazy, ComponentType } from 'react';

// Lazy load all page components
// Note: These use default exports. Components need to have default exports.
const FeedbackPage = lazy(() => import('../components/FeedbackPage'));
const OfficerDirectoryPage = lazy(() => import('../components/OfficerDirectoryPage'));
const AttendanceDashboardPage = lazy(() => import('../components/AttendanceDashboardPage'));
const AttendanceRecordingPage = lazy(() => import('../components/AttendanceRecordingPage'));
const ManageEventsPage = lazy(() => import('../components/ManageEventsPage'));
const MyQRIDPage = lazy(() => import('../components/MyQRIDPage'));
const AttendanceTransparencyPage = lazy(() => import('../components/AttendanceTransparencyPage'));
const MyProfilePage = lazy(() => import('../components/MyProfilePage'));
const AnnouncementsPage = lazy(() => import('../components/AnnouncementsPage_Enhanced'));
const IssuanceCenterPage = lazy(() => import('../components/IssuanceCenterPage'));
const EmailSystemPage = lazy(() => import('../components/EmailSystemPage'));
const AccessLogsPage = lazy(() => import('../components/AccessLogsPage'));
const SystemToolsPage = lazy(() => import('../components/SystemToolsPage'));
const ManageMembersPage = lazy(() => import('../components/ManageMembersPage'));
const MembershipApplicationsPage = lazy(() => import('../components/MembershipApplicationsPage'));
const SettingsPage = lazy(() => import('../components/SettingsPage'));

/**
 * Route definition with role requirements
 */
export interface AppRoute {
  path: string;
  element: React.LazyExoticComponent<ComponentType<unknown>>;
  /** Roles required to access this route. Empty = public */
  requiredRoles?: string[];
  /** Page title for document.title */
  title?: string;
  /** If true, authenticated users will be redirected away (e.g., login page) */
  publicOnly?: boolean;
}

/**
 * All application routes
 * 
 * Note: The "/" (homepage) route is handled by the AppLayout component,
 * not as a separate route. Login is handled as a modal overlay.
 */
export const routes: AppRoute[] = [
  // Public routes
  {
    path: '/feedback',
    element: FeedbackPage,
    title: 'Feedback - YSP Tagum',
  },

  // Member+ routes
  {
    path: '/my-qrid',
    element: MyQRIDPage,
    requiredRoles: ['member'],
    title: 'My QR ID - YSP Tagum',
  },
  {
    path: '/attendance/transparency',
    element: AttendanceTransparencyPage,
    requiredRoles: ['member'],
    title: 'Attendance - YSP Tagum',
  },
  {
    path: '/profile',
    element: MyProfilePage,
    requiredRoles: ['member'],
    title: 'My Profile - YSP Tagum',
  },
  {
    path: '/announcements',
    element: AnnouncementsPage,
    requiredRoles: ['member'],
    title: 'Announcements - YSP Tagum',
  },
  {
    path: '/issuance',
    element: IssuanceCenterPage,
    requiredRoles: ['member'],
    title: 'Issuance Center - YSP Tagum',
  },
  {
    path: '/email-system',
    element: EmailSystemPage,
    requiredRoles: ['admin'],
    title: 'Email System - YSP Tagum',
  },
  {
    path: '/applications',
    element: MembershipApplicationsPage,
    requiredRoles: ['member'],
    title: 'Membership Applications - YSP Tagum',
  },
  {
    path: '/settings',
    element: SettingsPage,
    requiredRoles: ['member'],
    title: 'Settings - YSP Tagum',
  },

  // Head+ routes (leadership)
  {
    path: '/directory',
    element: OfficerDirectoryPage,
    requiredRoles: ['head'],
    title: 'Officer Directory - YSP Tagum',
  },
  {
    path: '/attendance/dashboard',
    element: AttendanceDashboardPage,
    requiredRoles: ['head'],
    title: 'Attendance Dashboard - YSP Tagum',
  },
  {
    path: '/attendance/recording',
    element: AttendanceRecordingPage,
    requiredRoles: ['head'],
    title: 'Record Attendance - YSP Tagum',
  },

  // Admin+ routes (management)
  {
    path: '/events',
    element: ManageEventsPage,
    requiredRoles: ['admin'],
    title: 'Manage Events - YSP Tagum',
  },
  {
    path: '/admin/members',
    element: ManageMembersPage,
    requiredRoles: ['admin'],
    title: 'Manage Members - YSP Tagum',
  },

  // Auditor+ routes (highest access)
  {
    path: '/admin/logs',
    element: AccessLogsPage,
    requiredRoles: ['auditor'],
    title: 'Access Logs - YSP Tagum',
  },
  {
    path: '/admin/tools',
    element: SystemToolsPage,
    requiredRoles: ['auditor'],
    title: 'System Tools - YSP Tagum',
  },
];

/**
 * Get route by path
 */
export function getRouteByPath(path: string): AppRoute | undefined {
  return routes.find(route => route.path === path);
}

/**
 * Get all routes accessible by a given role
 */
export function getAccessibleRoutes(userRole: string, hasRoleAccess: (roles: string[] | undefined) => boolean): AppRoute[] {
  return routes.filter(route => hasRoleAccess(route.requiredRoles));
}
