/**
 * useUrlSync - Hook to sync URL with current page state
 * 
 * This hook provides a bridge between the old boolean-based navigation
 * and URL-based routing. It:
 * - Updates the URL when a page opens (using ?page=PageName format)
 * - Sets page states based on URL on initial load
 * - Handles browser back/forward buttons
 * - Checks authentication before opening protected pages
 * - Stores intended destination for post-login redirect
 * - Indicates user role in the URL path (/guest, /member, /admin, etc.)
 * 
 * URL Format: /{role}?page={PageName}
 * Examples:
 *   - /guest?page=Feedback
 *   - /member?page=MyProfile
 *   - /admin?page=ManageMembers
 */

import { useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Deep linking parameters for specific item selection
 */
export interface DeepLinkParams {
  id?: string;           // General item ID (feedback, announcement, issuance)
  eventId?: string;      // Event ID for attendance recording
  mode?: 'qr' | 'manual'; // Attendance recording mode
}

/**
 * Page state mapping between URL paths and boolean setters
 */
interface PageStateMap {
  showFeedbackPage: boolean;
  showOfficerDirectory: boolean;
  showAttendanceDashboard: boolean;
  showAttendanceRecording: boolean;
  showManageEvents: boolean;
  showMyQRID: boolean;
  showAttendanceTransparency: boolean;
  showMyProfile: boolean;
  showAnnouncements: boolean;
  showIssuanceCenter: boolean;
  showAccessLogs: boolean;
  showSystemTools: boolean;
  showManageMembers: boolean;
  showMembershipApplicationsPage: boolean;
  showSettings: boolean;
  showLoginPanel: boolean;
}

interface PageSetterMap {
  setShowFeedbackPage: (v: boolean) => void;
  setShowOfficerDirectory: (v: boolean) => void;
  setShowAttendanceDashboard: (v: boolean) => void;
  setShowAttendanceRecording: (v: boolean) => void;
  setShowManageEvents: (v: boolean) => void;
  setShowMyQRID: (v: boolean) => void;
  setShowAttendanceTransparency: (v: boolean) => void;
  setShowMyProfile: (v: boolean) => void;
  setShowAnnouncements: (v: boolean) => void;
  setShowIssuanceCenter: (v: boolean) => void;
  setShowAccessLogs: (v: boolean) => void;
  setShowSystemTools: (v: boolean) => void;
  setShowManageMembers: (v: boolean) => void;
  setShowMembershipApplicationsPage: (v: boolean) => void;
  setShowSettings: (v: boolean) => void;
  setShowLoginPanel: (v: boolean) => void;
}

// Map page query param values to state property names
const PAGE_TO_STATE: Record<string, keyof PageStateMap> = {
  'Feedback': 'showFeedbackPage',
  'OfficerDirectory': 'showOfficerDirectory',
  'AttendanceDashboard': 'showAttendanceDashboard',
  'AttendanceRecording': 'showAttendanceRecording',
  'ManageEvents': 'showManageEvents',
  'MyQRID': 'showMyQRID',
  'AttendanceTransparency': 'showAttendanceTransparency',
  'MyProfile': 'showMyProfile',
  'Announcements': 'showAnnouncements',
  'IssuanceCenter': 'showIssuanceCenter',
  'AccessLogs': 'showAccessLogs',
  'SystemTools': 'showSystemTools',
  'ManageMembers': 'showManageMembers',
  'MembershipApplications': 'showMembershipApplicationsPage',
  'Settings': 'showSettings',
  'Login': 'showLoginPanel',
};

// Reverse mapping: state property names to page query values
const STATE_TO_PAGE: Record<keyof PageStateMap, string> = Object.entries(PAGE_TO_STATE).reduce(
  (acc, [page, state]) => {
    acc[state] = page;
    return acc;
  },
  {} as Record<keyof PageStateMap, string>
);

// Public pages that don't require authentication
const PUBLIC_PAGES = new Set(['Feedback', 'Login']);

// Role requirements for protected pages
type UserRole = 'guest' | 'member' | 'head' | 'admin' | 'auditor';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest: 0,
  member: 2,
  head: 3,
  admin: 4,
  auditor: 5,
};

const PAGE_ROLE_REQUIREMENTS: Record<string, UserRole> = {
  'MyQRID': 'member',
  'AttendanceTransparency': 'member',
  'MyProfile': 'member',
  'Announcements': 'member',
  'IssuanceCenter': 'member',
  'MembershipApplications': 'member',
  'Settings': 'member',
  'OfficerDirectory': 'head',
  'AttendanceDashboard': 'head',
  'AttendanceRecording': 'head',
  'ManageEvents': 'admin',
  'ManageMembers': 'admin',
  'FeedbackDashboard': 'admin', // Admin/Auditor feedback management
  'AccessLogs': 'auditor',
  'SystemTools': 'auditor',
};

// LocalStorage key for storing intended destination
const INTENDED_DESTINATION_KEY = 'ysp_intended_destination';

interface UseUrlSyncOptions {
  pageStates: PageStateMap;
  pageSetters: PageSetterMap;
  isLoggedIn: boolean;
  userRole?: string;
  sessionChecked?: boolean;
}

/**
 * Get the display role for the URL path
 */
function getRolePathSegment(userRole: string, isLoggedIn: boolean): string {
  if (!isLoggedIn) return 'guest';
  
  switch (userRole) {
    case 'auditor': return 'auditor';
    case 'admin': return 'admin';
    case 'head': return 'officer';
    case 'member': return 'member';
    default: return 'guest';
  }
}

/**
 * Hook to synchronize URL with page navigation states
 */
export function useUrlSync({ 
  pageStates, 
  pageSetters, 
  isLoggedIn, 
  userRole = 'guest',
  sessionChecked = true,
}: UseUrlSyncOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isInitialLoad = useRef(true);
  const lastSyncedPage = useRef<string | null>(null);
  const skipStateSyncRef = useRef(false);
  const processingUrlRef = useRef(false);

  // Check if user has access to a page
  const hasPageAccess = useCallback((pageName: string): boolean => {
    if (PUBLIC_PAGES.has(pageName)) return true;
    
    const requiredRole = PAGE_ROLE_REQUIREMENTS[pageName];
    if (!requiredRole) return true; // Unknown page, allow
    
    if (!isLoggedIn) return false;
    
    const userLevel = ROLE_HIERARCHY[userRole as UserRole] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
    
    return userLevel >= requiredLevel;
  }, [isLoggedIn, userRole]);

  // Get the setter function name for a state property
  const getSetterName = (stateName: keyof PageStateMap): keyof PageSetterMap => {
    return `set${stateName.charAt(0).toUpperCase()}${stateName.slice(1)}` as keyof PageSetterMap;
  };

  // Close all pages (set all show states to false)
  const closeAllPages = useCallback(() => {
    Object.keys(pageSetters).forEach((setterName) => {
      const setter = pageSetters[setterName as keyof PageSetterMap];
      if (setter) {
        setter(false);
      }
    });
  }, [pageSetters]);

  // Open a specific page directly (without closing others first to avoid race)
  const openPageDirect = useCallback((pageName: string) => {
    const stateName = PAGE_TO_STATE[pageName];
    if (stateName) {
      // Set all to false except the target
      Object.entries(PAGE_TO_STATE).forEach(([page, state]) => {
        const setterName = getSetterName(state);
        const setter = pageSetters[setterName];
        if (setter) {
          setter(page === pageName);
        }
      });
    }
  }, [pageSetters]);

  // Build the URL with role, page, and optional deep link parameters
  const buildUrl = useCallback((pageName: string | null, params?: DeepLinkParams): string => {
    const roleSegment = getRolePathSegment(userRole, isLoggedIn);
    
    if (!pageName) {
      return `/${roleSegment}`;
    }
    
    const searchParams = new URLSearchParams();
    searchParams.set('page', pageName);
    
    // Add deep link parameters if provided
    if (params?.id) searchParams.set('id', params.id);
    if (params?.eventId) searchParams.set('eventId', params.eventId);
    if (params?.mode) searchParams.set('mode', params.mode);
    
    return `/${roleSegment}?${searchParams.toString()}`;
  }, [userRole, isLoggedIn]);

  // Build a shareable deep link URL (absolute URL)
  const buildShareableUrl = useCallback((pageName: string, params?: DeepLinkParams): string => {
    const baseUrl = window.location.origin;
    const relativeUrl = buildUrl(pageName, params);
    return `${baseUrl}${relativeUrl}`;
  }, [buildUrl]);

  // Store intended destination for post-login redirect
  const setIntendedDestination = useCallback((pageName: string) => {
    try {
      sessionStorage.setItem(INTENDED_DESTINATION_KEY, pageName);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Get and clear intended destination
  const getAndClearIntendedDestination = useCallback((): string | null => {
    try {
      const dest = sessionStorage.getItem(INTENDED_DESTINATION_KEY);
      if (dest) {
        sessionStorage.removeItem(INTENDED_DESTINATION_KEY);
      }
      return dest;
    } catch {
      return null;
    }
  }, []);

  // Navigate to a page by updating both URL and state, with optional deep link params
  const navigateToPage = useCallback((pageName: string, params?: DeepLinkParams) => {
    if (!hasPageAccess(pageName)) {
      // User doesn't have access - show login panel and remember destination
      setIntendedDestination(pageName);
      skipStateSyncRef.current = true;
      closeAllPages();
      pageSetters.setShowLoginPanel(true);
      navigate(buildUrl('Login'), { replace: true });
      lastSyncedPage.current = 'Login';
      setTimeout(() => { skipStateSyncRef.current = false; }, 50);
      return;
    }
    
    skipStateSyncRef.current = true;
    openPageDirect(pageName);
    navigate(buildUrl(pageName, params));
    lastSyncedPage.current = pageName;
    
    setTimeout(() => { skipStateSyncRef.current = false; }, 50);
  }, [hasPageAccess, setIntendedDestination, closeAllPages, pageSetters, navigate, openPageDirect, buildUrl]);

  // Close current page and navigate to home
  const closePage = useCallback(() => {
    skipStateSyncRef.current = true;
    closeAllPages();
    navigate(buildUrl(null));
    lastSyncedPage.current = null;
    setTimeout(() => { skipStateSyncRef.current = false; }, 50);
  }, [closeAllPages, navigate, buildUrl]);

  // Update URL when role changes (to keep role segment in sync)
  useEffect(() => {
    if (!sessionChecked || skipStateSyncRef.current) return;
    
    const currentPage = searchParams.get('page');
    const roleSegment = getRolePathSegment(userRole, isLoggedIn);
    const expectedPath = `/${roleSegment}`;
    
    // Only update if path doesn't match current role
    if (!location.pathname.startsWith(expectedPath) || location.pathname !== expectedPath) {
      const newUrl = currentPage ? `/${roleSegment}?page=${currentPage}` : `/${roleSegment}`;
      navigate(newUrl, { replace: true });
    }
  }, [userRole, isLoggedIn, sessionChecked, navigate, searchParams, location.pathname]);

  // Handle initial URL and URL changes (browser back/forward, direct URL access)
  useEffect(() => {
    if (!sessionChecked) return;
    if (processingUrlRef.current) return;
    
    const currentPage = searchParams.get('page');
    
    // Skip if we already processed this page
    if (!isInitialLoad.current && currentPage === lastSyncedPage.current) {
      return;
    }
    
    processingUrlRef.current = true;
    skipStateSyncRef.current = true;
    
    // Handle no page (home)
    if (!currentPage) {
      closeAllPages();
      lastSyncedPage.current = null;
      isInitialLoad.current = false;
      processingUrlRef.current = false;
      setTimeout(() => { skipStateSyncRef.current = false; }, 50);
      return;
    }
    
    // Check if the page exists
    if (!PAGE_TO_STATE[currentPage]) {
      // Unknown page - redirect to home
      navigate(buildUrl(null), { replace: true });
      lastSyncedPage.current = null;
      isInitialLoad.current = false;
      processingUrlRef.current = false;
      setTimeout(() => { skipStateSyncRef.current = false; }, 50);
      return;
    }
    
    // Check if page requires authentication
    if (!hasPageAccess(currentPage)) {
      setIntendedDestination(currentPage);
      closeAllPages();
      
      if (!isLoggedIn) {
        pageSetters.setShowLoginPanel(true);
      }
      
      navigate(buildUrl(null), { replace: true });
      lastSyncedPage.current = null;
      isInitialLoad.current = false;
      processingUrlRef.current = false;
      setTimeout(() => { skipStateSyncRef.current = false; }, 50);
      return;
    }
    
    // User has access - open the page
    openPageDirect(currentPage);
    lastSyncedPage.current = currentPage;
    isInitialLoad.current = false;
    processingUrlRef.current = false;
    
    setTimeout(() => { skipStateSyncRef.current = false; }, 50);
  }, [
    searchParams,
    sessionChecked, 
    hasPageAccess, 
    closeAllPages, 
    openPageDirect, 
    setIntendedDestination, 
    pageSetters, 
    navigate,
    isLoggedIn,
    buildUrl,
  ]);

  // Handle post-login redirect
  useEffect(() => {
    if (isLoggedIn && sessionChecked) {
      const intendedDest = getAndClearIntendedDestination();
      if (intendedDest && hasPageAccess(intendedDest)) {
        navigateToPage(intendedDest);
      }
    }
  }, [isLoggedIn, sessionChecked, getAndClearIntendedDestination, hasPageAccess, navigateToPage]);

  // Sync URL when page states change (for backwards compatibility with old navigation)
  useEffect(() => {
    if (skipStateSyncRef.current || !sessionChecked || isInitialLoad.current) return;
    
    // Find which page is currently open based on state
    const openPageEntry = Object.entries(pageStates).find(([_, isOpen]) => isOpen);
    
    if (openPageEntry) {
      const [stateName] = openPageEntry;
      const expectedPage = STATE_TO_PAGE[stateName as keyof PageStateMap];
      
      // Update URL if it doesn't match the open page
      if (expectedPage && lastSyncedPage.current !== expectedPage) {
        lastSyncedPage.current = expectedPage;
        navigate(buildUrl(expectedPage), { replace: true });
      }
    } else if (lastSyncedPage.current !== null) {
      // No page is open - sync to home
      lastSyncedPage.current = null;
      navigate(buildUrl(null), { replace: true });
    }
  }, [pageStates, navigate, sessionChecked, buildUrl]);

  // Get current deep link parameters from URL
  const getDeepLinkParams = useCallback((): DeepLinkParams => {
    return {
      id: searchParams.get('id') || undefined,
      eventId: searchParams.get('eventId') || undefined,
      mode: (searchParams.get('mode') as 'qr' | 'manual') || undefined,
    };
  }, [searchParams]);

  return {
    navigateToPage,
    closePage,
    currentPage: searchParams.get('page'),
    hasPageAccess,
    setIntendedDestination,
    getAndClearIntendedDestination,
    // Deep linking support
    deepLinkParams: getDeepLinkParams(),
    buildShareableUrl,
    buildUrl,
  };
}

export default useUrlSync;
