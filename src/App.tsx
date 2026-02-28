  import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
  import { useLocation, useNavigate } from "react-router-dom";
  import { useUrlSync } from "./hooks/useUrlSync";
  import {
    Moon,
    Sun,
    Mail,
    Phone,
    MapPin,
    Globe,
    Upload,
    Trash2,
    X,
    ZoomIn,
    ExternalLink,
    Home,
    LayoutDashboard,
    MessageSquare,
    FileText,
    QrCode,
    Users,
    ClipboardList,
    MessageCircle,
    Network,
    Plus,
    Edit2,
    Edit3,
    Save,
    Loader2,
    RefreshCw,
    AlertCircle,
  } from "lucide-react";
  import { openEmailApp, openPhoneApp } from "./utils/externalLinks";
  import { suggestLinkTextFromUrl, normalizeThemeSongUrl } from "./utils/appHelpers";
  import { detectSocialPlatform, SocialIcon } from "./components/SocialMediaIcon";
  import type { PendingApplication, NavGroup } from "./types/app";
  import {
    fetchHomepageContent,
    updateHomepageContent,
    getDefaultHomepageContent,
    uploadOrgChart,
    fetchHomepageOtherContentSafe,
    updateHomepageOtherContent,
    invalidateOtherContentCache,
    type HomepageMainContent,
    type SocialLinkData,
  } from "./services/gasHomepageService";
  import {
    saveHomepageContentToCache,
    loadHomepageContentFromCache,
    saveHomepageOtherToCache,
    loadHomepageOtherFromCache,
    hasHomepageContentChanged,
    hasHomepageOtherChanged,
    saveProjectsToCache,
    loadProjectsFromCache,
    getProjectChanges,
    clearUserProfileCache,
    type CachedHomepageContent,
    type CachedHomepageOther,
    type CachedProject,
  } from "./services/localStorageCache";
  import {
    fetchAllProjects,
    addProject,
    updateProject,
    deleteProject,
    type Project,
  } from "./services/projectsService";
  import {
    authenticateUser,
    verifyLogin2FA,
    clearSession,
    getStoredUser,
    hasActiveSession,
    verifySession,
    getSessionVerificationState,
    refreshSessionToken,
    checkUserRole,
    authorizePageAccess,
    LoginErrorCodes,
  } from "./services/gasLoginService";
  // ADDED getMaintenanceModeFromBackend HERE:
  import {
  logLogin,
  logLogout,
  getMaintenanceModeFromBackend,
  getCacheVersionFromBackend,
  getLocalCacheVersion,
  setLocalCacheVersion,
  forceClearAllCaches, // 👈 ADD THIS HERE
  startCacheVersionPolling,
  stopCacheVersionPolling,
} from "./services/gasSystemToolsService";
  // 👈 ADD THIS IMPORT
import { CacheRefreshModal, RoleChangeModal, SessionRecoveryModal, determineRoleChangeType, type RoleChangeType } from "./components/CacheRefreshModals";
  import { ImageWithFallback } from "./components/figma/ImageWithFallback";
  import { toast, Toaster } from "sonner";
  import { Helmet } from 'react-helmet-async';
import MusicPlayer from "./components/MusicPlayer";
import YSPChatBot from "./components/YSPChatBot"; // 👈 Add this import
import type { AttendanceDashboardContext } from "./components/AttendanceDashboardPage";
import LoadingScreen, { type LoadingStep } from "./components/LoadingScreen";
import MyQRIDPage from "./components/MyQRIDPage";
  const LoginPanel = lazy(() => import("./components/LoginPanel"));
  const FeedbackPage = lazy(() => import("./components/FeedbackPage"));
  const OfficerDirectoryPage = lazy(() => import("./components/OfficerDirectoryPage"));
  const AttendanceDashboardPage = lazy(() => import("./components/AttendanceDashboardPage"));
  const AttendanceRecordingPage = lazy(() => import("./components/AttendanceRecordingPage"));
  const ManageEventsPage = lazy(() => import("./components/ManageEventsPage"));
  const AttendanceTransparencyPage = lazy(() => import("./components/AttendanceTransparencyPage"));
  const MyProfilePage = lazy(() => import("./components/MyProfilePage"));
  const AnnouncementsPage = lazy(() => import("./components/AnnouncementsPage_Enhanced"));
  const IssuanceCenterPage = lazy(() => import("./components/IssuanceCenterPage"));
  const SystemToolsPage = lazy(() => import("./components/SystemToolsPage"));
  const ManageMembersPage = lazy(() => import("./components/ManageMembersPage"));
  const MembershipApplicationsPage = lazy(() => import("./components/MembershipApplicationsPage"));
  const SettingsPage = lazy(() => import("./components/SettingsPage"));
  const KaagapAIMeetPage = lazy(() => import("./components/KaagapAIMeetPage"));
  const FounderModal = lazy(() => import("./components/FounderModal"));
  const DeveloperModal = lazy(() => import("./components/DeveloperModal"));
  import { UploadToastContainer, type UploadToastMessage } from "./components/UploadToast";
  import { FormattedText } from "./components/FormattedText";
  import { 
    SkeletonCardGrid, 
    SkeletonSection, 
    SkeletonOrgChart, 
    SkeletonContact, 
    SkeletonProfileCard,
  } from "./components/SkeletonCard";
  import { SideBar } from "./components/design-system";
  import TopBar from "./components/design-system/TopBar";
  import AnimatedHamburger from "./components/design-system/AnimatedHamburger";
  import GlowingCard from "./components/GlowingCard";
  import LazyProjectCard from "./components/LazyProjectCard";
  import AccessLogsPage from "./components/AccessLogsPage";
  import MaintenanceScreen from "./components/MaintenanceScreen";
  import PwaInstallPrompt from "./components/PwaInstallPrompt";
  import {
    isFullPWAInMaintenance,
    isPageInMaintenance,
    getFullPWAMaintenanceConfig,
    getPageMaintenanceConfig,
  } from "./utils/maintenanceMode";

  /**
   * Helper functions, types, and social media icons are now imported from:
   * - ./utils/appHelpers (suggestLinkTextFromUrl, formatTime, getYouTubeVideoId, normalizeThemeSongUrl)
   * - ./components/SocialMediaIcon (detectSocialPlatform, SocialIcon, LazyFallback)
   * - ./types/app (PendingApplication, NavPage, NavGroup, etc.)
   */

  const PAGE_BACKEND_PATHS: Record<string, string> = {
    feedback: "feedback",
    "membership-editor": "admin/members",
    "officer-directory": "directory",
    "attendance-dashboard": "attendance/dashboard",
    "attendance-recording": "attendance/recording",
    "manage-events": "events",
    "my-qr-id": "my-qrid",
    "attendance-transparency": "attendance/transparency",
    "my-profile": "profile",
    announcements: "announcements",
    "issuance-center": "issuance",
    "access-logs": "admin/logs",
    "system-tools": "admin/tools",
    "manage-members": "admin/members",
    "kaagapai-meet": "kaagapai-meet",
    settings: "settings",
  };

  const PUBLIC_PAGE_IDS = new Set([
    "home",
    "about",
    "projects",
    "contact",
    "org-chart",
    "feedback",
    "membership-applications",
    "login",
    "founder",
    "developer",
  ]);

  const PAGE_ACCESS_DEBUG = false;
  const SIDEBAR_DEBUG_TOAST_ID = "sidebar-pages-debug";
  const PROJECT_ID_QUERY_PARAM = "projectId";
  const SITE_ORIGIN = "https://www.youthservicephilippinestagum.me";
  const SITE_NAME = "Youth Service Philippines - Tagum Chapter";
  const DEFAULT_OG_IMAGE = "https://i.imgur.com/J4wddTW.png";

  type SeoMeta = {
    title: string;
    description: string;
    keywords: string;
    canonicalPath: string;
    noindex?: boolean;
  };

  const PUBLIC_SEO_BY_VIEW: Record<string, SeoMeta> = {
    home: {
      title: "YSP Tagum Portal | Youth Service Philippines - Tagum Chapter",
      description:
        "Official YSP Tagum Portal for Youth Service Philippines - Tagum Chapter. Join youth leadership, volunteer, and community service programs in Tagum City.",
      keywords:
        "YSP Tagum, Youth Service Philippines, Youth Service Philippines Tagum, Tagum youth volunteers, youth leadership Tagum",
      canonicalPath: "/",
    },
    Feedback: {
      title: "Feedback | YSP Tagum Portal",
      description:
        "Send feedback to Youth Service Philippines - Tagum Chapter to help improve our youth programs and services.",
      keywords: "YSP Tagum feedback, Youth Service Philippines feedback",
      canonicalPath: "/visitor?page=Feedback",
    },
    MembershipApplications: {
      title: "Opportunities | YSP Tagum",
      description:
        "Explore and apply for opportunities from Youth Service Philippines - Tagum Chapter.",
      keywords:
        "YSP Tagum opportunities, Youth Service Philippines opportunities, join YSP Tagum",
      canonicalPath: "/visitor?page=Opportunities",
    },
    Opportunities: {
      title: "Opportunities | YSP Tagum",
      description:
        "Explore and apply for opportunities from Youth Service Philippines - Tagum Chapter.",
      keywords:
        "YSP Tagum opportunities, Youth Service Philippines opportunities, join YSP Tagum",
      canonicalPath: "/visitor?page=Opportunities",
    },
    Founder: {
      title: "Founder | YSP Tagum",
      description:
        "Learn about the founder and leadership story behind Youth Service Philippines - Tagum Chapter.",
      keywords: "YSP Tagum founder, Youth Service Philippines Tagum founder",
      canonicalPath: "/visitor?page=Founder",
    },
    Developer: {
      title: "Developer | YSP Tagum Portal",
      description:
        "Meet the developer and technical team behind the YSP Tagum Portal.",
      keywords: "YSP Tagum developer, Youth Service Philippines portal developer",
      canonicalPath: "/visitor?page=Developer",
    },
    Login: {
      title: "Member Login | YSP Tagum Portal",
      description:
        "Secure login for Youth Service Philippines - Tagum Chapter members and officers.",
      keywords: "YSP Tagum login, Youth Service Philippines member login",
      canonicalPath: "/visitor?page=Login",
      noindex: true,
    },
  };

  const PRIVATE_SEO: SeoMeta = {
    title: "YSP Tagum Portal",
    description: "Youth Service Philippines - Tagum Chapter member portal.",
    keywords: "YSP Tagum portal",
    canonicalPath: "/",
    noindex: true,
  };

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
    const LAST_VIEW_KEY = "ysp_last_view";
    const LAST_SCROLL_KEY = "ysp_last_scroll";
    const hasRestoredViewRef = useRef(false);
    const pendingScrollRestoreRef = useRef<number | null>(null);
    const hasRestoredScrollRef = useRef(false);
    const [isDark, setIsDark] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [modalProject, setModalProject] =
      useState<Project | null>(null);

    // --- START NEW CODE ---
    // Sync maintenance mode immediately upon loading the website
    useEffect(() => {
      const initMaintenanceMode = async () => {
        try {
          // This fetches from your Google Sheet and updates LocalStorage
          await getMaintenanceModeFromBackend(true); 
        } catch (error) {
          console.error("Failed to sync maintenance status:", error);
        }
      };
      initMaintenanceMode();
    }, []);

    // Support short deep-link format: /o/{opportunityId}
    useEffect(() => {
      const match = location.pathname.match(/^\/o\/([^/?#]+)/i);
      if (!match) return;
      const shortId = decodeURIComponent(match[1] || "").trim();
      if (!shortId) return;
      navigate(`/visitor?page=opp&id=${encodeURIComponent(shortId)}`, { replace: true });
    }, [location.pathname, navigate]);
    // --- END NEW CODE ---
    // ... rest of your code
    const [isAdmin, setIsAdmin] = useState(false);
    const [sessionChecked, setSessionChecked] = useState(false);
    const [showLoginPrepLoader, setShowLoginPrepLoader] = useState(false);
    const [userRole, setUserRole] = useState<string>("guest"); // guest, member, admin
    const [userName, setUserName] = useState<string>(""); // Display name (e.g., "John Doe")
    const [userUsername, setUserUsername] = useState<string>(""); // Actual username for API calls (e.g., "JohnDoe123")
    const [userEmail, setUserEmail] = useState<string>("");
    const [userIdCode, setUserIdCode] = useState<string>("");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_userPosition, setUserPosition] = useState<string>("");
    const [userProfilePicture, setUserProfilePicture] = useState<string>("");
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [logoError, _setLogoError] = useState(false);
    const [showLoginPanel, setShowLoginPanel] = useState(false);
    const [showFeedbackPage, setShowFeedbackPage] = useState(false);
    const [showMembershipApplicationsPage, setShowMembershipApplicationsPage] = useState(false);
    const [showOfficerDirectory, setShowOfficerDirectory] = useState(false);
    const [directorySearchRequest, setDirectorySearchRequest] = useState<{
      query: string;
      idCode?: string;
      trigger: number;
    } | null>(null);
    const [showAttendanceDashboard, setShowAttendanceDashboard] = useState(false);
    const [attendanceDashboardContext, setAttendanceDashboardContext] = useState<AttendanceDashboardContext | null>(null);
    const [showAttendanceRecording, setShowAttendanceRecording] = useState(false);
    const [showManageEvents, setShowManageEvents] = useState(false);
    const [showMyQRID, setShowMyQRID] = useState(false);
    const [showAttendanceTransparency, setShowAttendanceTransparency] = useState(false);
    const [showMyProfile, setShowMyProfile] = useState(false);
    const [showAnnouncements, setShowAnnouncements] = useState(false);
    const [showIssuanceCenter, setShowIssuanceCenter] = useState(false);
    const [showAccessLogs, setShowAccessLogs] = useState(false);
    const [showSystemTools, setShowSystemTools] = useState(false);
    const [showManageMembers, setShowManageMembers] = useState(false);
    const [showKaagapAIMeet, setShowKaagapAIMeet] = useState(false);
    const [showMembershipApplications, setShowMembershipApplications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showFounderModal, setShowFounderModal] = useState(false);
  const [showDeveloperModal, setShowDeveloperModal] = useState(false);

  const [cacheVersion, setCacheVersion] = useState(() => {
    try {
      return getLocalCacheVersion();
    } catch {
      return 0;
    }
  });

  const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";
  const [showCacheRefreshModal, setShowCacheRefreshModal] = useState(false);
  const [showSessionRecoveryModal, setShowSessionRecoveryModal] = useState(false);
  const [hardRefreshMode, setHardRefreshMode] = useState<"standard" | "full">("standard");

  // Role Change Modal State
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [roleChangeInfo, setRoleChangeInfo] = useState<{
    changeType: RoleChangeType;
    oldRole: string;
    newRole: string;
  } | null>(null);
  const roleCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionExpiryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // URL Sync - Bridges boolean navigation states with URL routing
  // Provides deepLinkParams for item-specific navigation (feedback ID, event ID, etc.)
  const { deepLinkParams, buildShareableUrl, currentPage } = useUrlSync({
    pageStates: {
      showFeedbackPage,
      showMembershipApplications,
      showOfficerDirectory,
      showAttendanceDashboard,
      showAttendanceRecording,
      showManageEvents,
      showMyQRID,
      showAttendanceTransparency,
      showMyProfile,
      showAnnouncements,
      showIssuanceCenter,
      showAccessLogs,
      showSystemTools,
      showManageMembers,
      showKaagapAIMeet,
      showMembershipApplicationsPage,
      showSettings,
      showLoginPanel,
      showFounderModal,
      showDeveloperModal,
    },
    pageSetters: {
      setShowFeedbackPage,
      setShowMembershipApplications,
      setShowOfficerDirectory,
      setShowAttendanceDashboard,
      setShowAttendanceRecording,
      setShowManageEvents,
      setShowMyQRID,
      setShowAttendanceTransparency,
      setShowMyProfile,
      setShowAnnouncements,
      setShowIssuanceCenter,
      setShowAccessLogs,
      setShowSystemTools,
      setShowManageMembers,
      setShowKaagapAIMeet,
      setShowMembershipApplicationsPage,
      setShowSettings,
      setShowLoginPanel,
      setShowFounderModal,
      setShowDeveloperModal,
    },
    isLoggedIn: isAdmin || userRole !== 'guest',
    userRole,
    sessionChecked,
  });

  const seoMeta = useMemo(() => {
    if (currentPage && PUBLIC_SEO_BY_VIEW[currentPage]) {
      return PUBLIC_SEO_BY_VIEW[currentPage];
    }
    if (currentPage) return PRIVATE_SEO;
    return PUBLIC_SEO_BY_VIEW.home || PRIVATE_SEO;
  }, [currentPage]);

  const canonicalUrl = `${SITE_ORIGIN}${seoMeta.canonicalPath}`;
  const robotsContent = seoMeta.noindex
    ? "noindex, nofollow, noarchive"
    : "index, follow, max-image-preview:large";
  const websiteJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    inLanguage: "en-PH",
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_ORIGIN}/visitor?page=Feedback`,
      "query-input": "required name=search_term_string",
    },
  });

  const handleRequestCacheClear = () => {
    setHardRefreshMode("full");
    setShowCacheRefreshModal(true);
  };

  const handleSessionExpired = useCallback((username?: string) => {
    if (username) {
      clearUserProfileCache(username);
    }
    setShowLoginPrepLoader(false);
    clearSession();
    setIsAdmin(false);
    setUserRole("guest");
    setUserName("");
    setUserUsername("");
    setUserEmail("");
    setUserIdCode("");
    setUserPosition("");
    setUserProfilePicture("");
    setActivePage("home");
    setShowLoginPanel(false);
    setShowSessionRecoveryModal(true);
  }, []);

  const handleDismissHardRefresh = () => {
    setShowCacheRefreshModal(false);
    setHardRefreshMode("standard");
  };

  const handleConfirmHardRefresh = async () => {
    setShowCacheRefreshModal(false);
    const preserveSession = hardRefreshMode !== "full";
    setHardRefreshMode("standard");
    await forceClearAllCaches({ preserveSession });
  };

  const handleReloginFromSessionRecovery = () => {
    setShowSessionRecoveryModal(false);
    setShowLoginPanel(true);
  };

  const handleHardRefreshFromSessionRecovery = async () => {
    setShowSessionRecoveryModal(false);
    await forceClearAllCaches({ preserveSession: false });
  };

  // Role Change Handlers
  const handleDismissRoleChange = () => {
    setShowRoleChangeModal(false);
    // Don't clear roleChangeInfo so user sees current state
  };

  const handleConfirmRoleChange = async () => {
    setShowRoleChangeModal(false);
    // For banned users, force logout
    if (roleChangeInfo?.newRole === 'banned') {
      // Clear profile cache before logout
      const storedUser = getStoredUser();
      if (storedUser?.username) {
        clearUserProfileCache(storedUser.username);
      }
      
      clearSession();
      setIsAdmin(false);
      setUserRole("guest");
      setUserName("");
      setUserUsername("");
      setUserEmail("");
      setUserIdCode("");
      setUserPosition("");
      setUserProfilePicture("");
      setActivePage("home");
      toast.error('Account access has been revoked');
      return;
    }
    // For all other role changes, clear cache and force re-login
    await forceClearAllCaches({ preserveSession: false });
  };

  // Role Checking Polling Effect (15-30 seconds interval)
  useEffect(() => {
    // Only run when user is logged in
    if (!isAdmin || userRole === 'guest' || !userName) {
      if (roleCheckIntervalRef.current) {
        clearInterval(roleCheckIntervalRef.current);
        roleCheckIntervalRef.current = null;
      }
      return;
    }

    const storedUser = getStoredUser();
    if (!storedUser?.username) return;

    let isMounted = true;

    const checkRole = async () => {
      if (!isMounted) return;
      
      try {
        const result = await checkUserRole(storedUser.username);
        
        if (!isMounted) return;
        
        if (result.success && result.role) {
          const currentStoredUser = getStoredUser();
          const currentRole = currentStoredUser?.role || userRole;
          
          // Check if role has changed
          if (result.role !== currentRole) {
            const changeType = determineRoleChangeType(currentRole, result.role);
            setRoleChangeInfo({
              changeType,
              oldRole: currentRole,
              newRole: result.role,
            });
            setShowRoleChangeModal(true);
            
            // Stop polling once we detect a change
            if (roleCheckIntervalRef.current) {
              clearInterval(roleCheckIntervalRef.current);
              roleCheckIntervalRef.current = null;
            }
          }
        }
      } catch (error) {
        // Silently fail - don't disrupt user experience for polling failures
        // eslint-disable-next-line no-console
        console.debug('[RoleCheck] Polling error (ignored):', error);
      }
    };

    // Initial check after a short delay (5 seconds after login)
    const initialTimeout = setTimeout(() => {
      if (isMounted) checkRole();
    }, 5000);

    // Then poll every 20 seconds (between 15-30 as requested)
    roleCheckIntervalRef.current = setInterval(checkRole, 20000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      if (roleCheckIntervalRef.current) {
        clearInterval(roleCheckIntervalRef.current);
        roleCheckIntervalRef.current = null;
      }
    };
  }, [isAdmin, userRole, userName]);

  // Session Expiry Polling Effect
  // Detects server-confirmed session expiry during active use.
  useEffect(() => {
    if (!sessionChecked || !isAdmin || userRole === "guest") {
      if (sessionExpiryIntervalRef.current) {
        clearInterval(sessionExpiryIntervalRef.current);
        sessionExpiryIntervalRef.current = null;
      }
      return;
    }

    let isMounted = true;
    let isChecking = false;

    const checkSessionExpiry = async () => {
      if (!isMounted || isChecking || !hasActiveSession()) return;

      isChecking = true;
      try {
        const state = await getSessionVerificationState();
        if (!isMounted) return;

        if (state === "expired") {
          const storedUser = getStoredUser();
          handleSessionExpired(storedUser?.username || userUsername);
          toast.error("Session expired", {
            description: "Your session ended while using the app. Please log in again.",
          });

          if (sessionExpiryIntervalRef.current) {
            clearInterval(sessionExpiryIntervalRef.current);
            sessionExpiryIntervalRef.current = null;
          }
        }
      } finally {
        isChecking = false;
      }
    };

    const initialTimeout = setTimeout(() => {
      if (isMounted) {
        void checkSessionExpiry();
      }
    }, 10000);

    sessionExpiryIntervalRef.current = setInterval(() => {
      void checkSessionExpiry();
    }, 30000);

    return () => {
      isMounted = false;
      clearTimeout(initialTimeout);
      if (sessionExpiryIntervalRef.current) {
        clearInterval(sessionExpiryIntervalRef.current);
        sessionExpiryIntervalRef.current = null;
      }
    };
  }, [handleSessionExpired, isAdmin, sessionChecked, userRole, userUsername]);

  // Proactively refresh session before token expiry to avoid disruptive 401s mid-action.
  useEffect(() => {
    if (!sessionChecked || !hasActiveSession()) return;

    let mounted = true;
    let refreshing = false;

    const tickRefresh = async () => {
      if (!mounted || refreshing || !hasActiveSession()) return;
      refreshing = true;
      try {
        const nextToken = await refreshSessionToken(false);
        if (!mounted) return;
        if (!nextToken) {
          const state = await getSessionVerificationState();
          if (state === "expired") {
            const storedUser = getStoredUser();
            handleSessionExpired(storedUser?.username || userUsername);
          }
        }
      } finally {
        refreshing = false;
      }
    };

    const initialTimer = setTimeout(() => {
      void tickRefresh();
    }, 3000);

    const interval = setInterval(() => {
      void tickRefresh();
    }, 120000);

    return () => {
      mounted = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [handleSessionExpired, sessionChecked, userUsername]);

  useEffect(() => {
    let isMounted = true;

    const syncCacheVersion = async () => {
      try {
        const backendVersion = await getCacheVersionFromBackend();
        if (!isMounted) return;
        
        // Get the current local version BEFORE updating
        const localVersion = getLocalCacheVersion();
        
        // Check if user has an outdated cache version
        // Only show modal if:
        // 1. User has used the app before (localVersion > 0)
        // 2. Backend version is newer than local version
        if (localVersion > 0 && backendVersion > localVersion) {
          // User has outdated cache - show the hard refresh modal
          setLocalCacheVersion(backendVersion);
          setCacheVersion(backendVersion);
          setHardRefreshMode("full");
          setShowCacheRefreshModal(true);
        } else {
          // First-time user (localVersion=0) or already up-to-date - just sync silently
          setLocalCacheVersion(backendVersion);
          setCacheVersion(backendVersion);
        }
      } catch {
        if (!isMounted) return;
        setCacheVersion(getLocalCacheVersion());
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "ysp_cache_version") {
        setCacheVersion(getLocalCacheVersion());
      }
    };

    const handleCacheVersionChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ newVersion?: number; oldVersion?: number }>;
      const newVersion = customEvent.detail?.newVersion;
      
      // Update local cache version to prevent repeated modal triggers
      if (newVersion !== undefined) {
        setLocalCacheVersion(newVersion);
        setCacheVersion(newVersion);
      } else {
        setCacheVersion(getLocalCacheVersion());
      }
      
      // When cache is bumped by admin, force FULL refresh (clear all storage, log out users)
      setHardRefreshMode("full");
      setShowCacheRefreshModal(true);
    };

    syncCacheVersion();
    startCacheVersionPolling();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("cache-version-changed", handleCacheVersionChange);

    return () => {
      isMounted = false;
      stopCacheVersionPolling();
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("cache-version-changed", handleCacheVersionChange);
    };
  }, []);
    
    // Upload Toast State for progress bar at bottom-right
    const [uploadToastMessages, setUploadToastMessages] = useState<UploadToastMessage[]>([]);
    
    // Upload Toast Helper Functions
    const addUploadToast = useCallback((message: UploadToastMessage) => {
      setUploadToastMessages(prev => [...prev.filter(m => m.id !== message.id), message]);
    }, []);
    
    const updateUploadToast = useCallback((id: string, updates: Partial<UploadToastMessage>) => {
      setUploadToastMessages(prev => 
        prev.map(m => m.id === id ? { ...m, ...updates } : m)
      );
    }, []);
    
    const removeUploadToast = useCallback((id: string) => {
      setUploadToastMessages(prev => prev.filter(m => m.id !== id));
    }, []);

    const updateSidebarDebugToast = useCallback(
      (payload: {
        status: UploadToastMessage["status"];
        progress: number;
        message: string;
        title?: string;
      }) => {
        addUploadToast({
          id: SIDEBAR_DEBUG_TOAST_ID,
          title: payload.title || "Loading Pages...",
          message: payload.message,
          status: payload.status,
          progress: payload.progress,
          progressLabel: "Loading pages...",
        });
      },
      [addUploadToast]
    );

    const [activePage, setActivePage] = useState<string>("home");
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleOfficerDirectorySearch = useCallback(
      (request: { query: string; idCode?: string }) => {
        setDirectorySearchRequest({ ...request, trigger: Date.now() });
        setShowOfficerDirectory(true);
        setActivePage("officer-directory");
      },
      []
    );

    // Homepage Content Loading States
    const [isLoadingHomepage, setIsLoadingHomepage] = useState(true);
    const [homepageError, setHomepageError] = useState<string | null>(null);
    const [isSavingHomepage, setIsSavingHomepage] = useState(false);

    // Delete Confirmation Modal State
    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

    // Org Chart State
    const [orgChartUrl, setOrgChartUrl] = useState<string>('');
    const [showDeleteOrgChartModal, setShowDeleteOrgChartModal] = useState(false);
    const [isUploadingOrgChart, setIsUploadingOrgChart] = useState(false);

    // Pending Applications State (shared across pages)
    const [pendingApplications, setPendingApplications] = useState<PendingApplication[]>([]);

    // Homepage Edit Mode
    const [isEditingHomepage, setIsEditingHomepage] = useState(false);
    
    // Profile Edit Mode
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [triggerProfileEditMode, setTriggerProfileEditMode] = useState(false);

    // Access Logs Modal State (to hide chatbot when modals are open)
    const [accessLogsModalOpen, setAccessLogsModalOpen] = useState(false);
    
    // Issuance Center Modal State (to hide chatbot when modals are open)
    const [issuanceModalOpen, setIssuanceModalOpen] = useState(false);
    
    // Attendance Dashboard Modal State (to hide chatbot when modals are open)
    const [attendanceDashboardModalOpen, setAttendanceDashboardModalOpen] = useState(false);
    
    // Manage Events Modal State (to hide chatbot when modals are open)
    const [manageEventsModalOpen, setManageEventsModalOpen] = useState(false);
    
    // Attendance Transparency Modal State (to hide chatbot when modals are open)
    const [attendanceTransparencyModalOpen, setAttendanceTransparencyModalOpen] = useState(false);

    // Membership Applications Modal State (to hide chatbot)
    const [membershipAppsModalOpen, setMembershipAppsModalOpen] = useState(false);
    
    // Manage Members Modal State (to hide chatbot)
    const [manageMembersModalOpen, setManageMembersModalOpen] = useState(false);
    
    // System Tools Modal State (to hide chatbot)
    const [systemToolsModalOpen, setSystemToolsModalOpen] = useState(false);
    const [isAccessMatrixLoading, setIsAccessMatrixLoading] = useState(false);
    const [hasResolvedSidebarAccess, setHasResolvedSidebarAccess] = useState(false);
    const [pageAccessByPath, setPageAccessByPath] = useState<Record<string, boolean>>({});
    const isAccessMatrixLoadingRef = useRef(false);
    const hasResolvedSidebarAccessRef = useRef(false);

    useEffect(() => {
      isAccessMatrixLoadingRef.current = isAccessMatrixLoading;
    }, [isAccessMatrixLoading]);

    useEffect(() => {
      hasResolvedSidebarAccessRef.current = hasResolvedSidebarAccess;
    }, [hasResolvedSidebarAccess]);

    const prepareSidebarBootstrap = useCallback(() => {
      setHasResolvedSidebarAccess(false);
      updateSidebarDebugToast({
        status: "loading",
        progress: 10,
        message: "initializing",
      });
    }, [updateSidebarDebugToast]);

    const waitForPostLoginRender = useCallback(async () => {
      const nextPaint = () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });

      await nextPaint();

      const start = Date.now();
      const maxWaitMs = 8000;
      while (!hasResolvedSidebarAccessRef.current && Date.now() - start < maxWaitMs) {
        await new Promise<void>((resolve) => setTimeout(resolve, 60));
      }

      await nextPaint();
    }, []);

    const isPageAllowed = useCallback((pageId: string): boolean => {
      if (PUBLIC_PAGE_IDS.has(pageId)) return true;
      const path = PAGE_BACKEND_PATHS[pageId];
      if (!path) return true;
      if (!isAdmin || userRole === "guest") return false;
      return pageAccessByPath[path] === true;
    }, [isAdmin, pageAccessByPath, userRole]);

    useEffect(() => {
      const handleAttendanceTransparencyModal = (event: Event) => {
        const detail = (event as CustomEvent).detail as { open?: boolean } | undefined;
        setAttendanceTransparencyModalOpen(!!detail?.open);
      };
      window.addEventListener("attendance-transparency-modal", handleAttendanceTransparencyModal as EventListener);
      return () => {
        window.removeEventListener("attendance-transparency-modal", handleAttendanceTransparencyModal as EventListener);
      };
    }, []);

    useEffect(() => {
      if (!showSystemTools) {
        setSystemToolsModalOpen(false);
      }
    }, [showSystemTools]);

    useEffect(() => {
      if (!sessionChecked) {
        setHasResolvedSidebarAccess(false);
        removeUploadToast(SIDEBAR_DEBUG_TOAST_ID);
        return;
      }

      if (!isAdmin || userRole === "guest") {
        if (PAGE_ACCESS_DEBUG) {
          console.warn("[AccessDebug] Skipping protected access matrix (user not authenticated for protected pages)", {
            sessionChecked,
            isAdmin,
            userRole,
            userUsername,
          });
        }
        setIsAccessMatrixLoading(false);
        setHasResolvedSidebarAccess(true);
        setPageAccessByPath({});
        removeUploadToast(SIDEBAR_DEBUG_TOAST_ID);
        return;
      }

      let cancelled = false;
      const controller = new AbortController();
      const syncAccess = async () => {
        setHasResolvedSidebarAccess(false);
        updateSidebarDebugToast({
          status: "loading",
          progress: 35,
          message: "authorizing sidebar pages",
        });
        setIsAccessMatrixLoading(true);
        const nextAccess: Record<string, boolean> = {};
        const paths = Array.from(new Set(Object.values(PAGE_BACKEND_PATHS)));
        const detailedResults: Array<{
          path: string;
          allowed: boolean;
          success?: boolean;
          role?: string;
          checkedAt?: string;
          error?: string;
        }> = [];

        if (PAGE_ACCESS_DEBUG) {
          console.warn("[AccessDebug] Starting backend page-access matrix sync");
          console.warn("[AccessDebug] User context", {
            isAdmin,
            userRole,
            userUsername,
            paths,
          });
        }

        await Promise.all(
          paths.map(async (path) => {
            try {
              const result = await authorizePageAccess("/" + path, controller.signal);
              nextAccess[path] = result.success === true && result.allowed === true;
              detailedResults.push({
                path,
                allowed: nextAccess[path],
                success: result.success,
                role: result.role,
                checkedAt: result.checkedAt,
                error: result.error,
              });
              if (PAGE_ACCESS_DEBUG) {
                console.warn("[AccessDebug] authorizePageAccess result", {
                  requestPath: "/" + path,
                  path,
                  allowed: nextAccess[path],
                  response: result,
                });
              }
            } catch {
              nextAccess[path] = false;
              detailedResults.push({
                path,
                allowed: false,
                success: false,
                error: "request_failed_or_aborted",
              });
              if (PAGE_ACCESS_DEBUG) {
                console.warn("[AccessDebug] authorizePageAccess request failed", {
                  requestPath: "/" + path,
                  path,
                  allowed: false,
                });
              }
            }
          })
        );

        if (!cancelled) {
          if (PAGE_ACCESS_DEBUG) {
            const allowedPaths = Object.entries(nextAccess)
              .filter(([, allowed]) => allowed)
              .map(([path]) => path);
            const deniedPaths = Object.entries(nextAccess)
              .filter(([, allowed]) => !allowed)
              .map(([path]) => path);
            console.warn("[AccessDebug] Final page access matrix", nextAccess);
            console.warn("[AccessDebug] Detailed results", detailedResults);
            console.warn("[AccessDebug] Allowed paths", allowedPaths);
            console.warn("[AccessDebug] Denied paths", deniedPaths);
            console.warn("[AccessDebug] End backend page-access matrix sync");
          }
          setPageAccessByPath(nextAccess);
          setIsAccessMatrixLoading(false);
          setHasResolvedSidebarAccess(true);
          updateSidebarDebugToast({
            status: "success",
            progress: 100,
            message: "sidebar pages loaded",
          });
          setTimeout(() => removeUploadToast(SIDEBAR_DEBUG_TOAST_ID), 4000);
        }
      };

      syncAccess();
      return () => {
        cancelled = true;
        controller.abort();
      };
    }, [isAdmin, removeUploadToast, sessionChecked, updateSidebarDebugToast, userRole, userUsername]);

    useEffect(() => {
      if (!sessionChecked) return;

      let blocked = false;
      const closeIfBlocked = (
        isOpen: boolean,
        pageId: string,
        closePage: () => void
      ) => {
        if (isOpen && !isPageAllowed(pageId)) {
          if (PAGE_ACCESS_DEBUG) {
            const backendPath = PAGE_BACKEND_PATHS[pageId];
            console.warn("[AccessDebug] Force-closing unauthorized page", {
              pageId,
              backendPath,
              userRole,
              isAdmin,
              pageAccessValue: backendPath ? pageAccessByPath[backendPath] : undefined,
              currentAccessMatrix: pageAccessByPath,
            });
          }
          closePage();
          blocked = true;
        }
      };

      closeIfBlocked(showMembershipApplicationsPage, "membership-editor", () => setShowMembershipApplicationsPage(false));
      closeIfBlocked(showOfficerDirectory, "officer-directory", () => setShowOfficerDirectory(false));
      closeIfBlocked(showAttendanceDashboard, "attendance-dashboard", () => setShowAttendanceDashboard(false));
      closeIfBlocked(showAttendanceRecording, "attendance-recording", () => setShowAttendanceRecording(false));
      closeIfBlocked(showManageEvents, "manage-events", () => setShowManageEvents(false));
      closeIfBlocked(showMyQRID, "my-qr-id", () => setShowMyQRID(false));
      closeIfBlocked(showAttendanceTransparency, "attendance-transparency", () => setShowAttendanceTransparency(false));
      closeIfBlocked(showMyProfile, "my-profile", () => setShowMyProfile(false));
      closeIfBlocked(showAnnouncements, "announcements", () => setShowAnnouncements(false));
      closeIfBlocked(showIssuanceCenter, "issuance-center", () => setShowIssuanceCenter(false));
      closeIfBlocked(showAccessLogs, "access-logs", () => setShowAccessLogs(false));
      closeIfBlocked(showSystemTools, "system-tools", () => setShowSystemTools(false));
      closeIfBlocked(showManageMembers, "manage-members", () => setShowManageMembers(false));
      closeIfBlocked(showKaagapAIMeet, "kaagapai-meet", () => setShowKaagapAIMeet(false));
      closeIfBlocked(showSettings, "settings", () => setShowSettings(false));

      if (blocked) {
        if (PAGE_ACCESS_DEBUG) {
          console.warn("[AccessDebug] Redirecting to home after unauthorized page attempt");
        }
        setActivePage("home");
        setAccessLogsModalOpen(false);
        setIssuanceModalOpen(false);
        setAttendanceDashboardModalOpen(false);
        setManageEventsModalOpen(false);
        setAttendanceTransparencyModalOpen(false);
        setMembershipAppsModalOpen(false);
        setManageMembersModalOpen(false);
        setSystemToolsModalOpen(false);
      }
    }, [
      isPageAllowed,
      sessionChecked,
      showMembershipApplicationsPage,
      showOfficerDirectory,
      showAttendanceDashboard,
      showAttendanceRecording,
      showManageEvents,
      showMyQRID,
      showAttendanceTransparency,
      showMyProfile,
      showAnnouncements,
      showIssuanceCenter,
      showAccessLogs,
      showSystemTools,
      showManageMembers,
      showKaagapAIMeet,
      showSettings,
      pageAccessByPath,
      isAdmin,
      userRole,
    ]);
    
    // Homepage Content - Fetched from GAS Backend
    const [homepageContent, setHomepageContent] = useState<HomepageMainContent & {
      projects: { title: string };
      contact: {
        title: string;
        email: string;
        phone: string;
        location: string;
        locationLink: string;
        socialLinks: { id: number; url: string; label: string }[];
        partnerTitle: string;
        partnerDescription: string;
        partnerButtonText: string;
        partnerButtonLink: string;
      };
    }>(() => {
      // Initialize with default content (will be replaced by API data)
      const defaults = getDefaultHomepageContent();
      const defaultState = {
        ...defaults,
        themeSong: {
          title: '',
          url: '',
        },
        projects: {
          title: "Projects Implemented",
        },
        contact: {
          title: "Get in Touch",
          email: "YSPTagumChapter@gmail.com",
          phone: "+63 917 123 4567",
          location: "Tagum City, Davao del Norte, Philippines",
          locationLink: "https://maps.google.com/?q=Tagum+City,Davao+del+Norte,Philippines",
          socialLinks: [
            { id: 1, url: "https://www.facebook.com/YSPTagumChapter", label: "YSP Tagum Chapter" },
          ],
          partnerTitle: "🤝 Become Our Partner",
          partnerDescription: "Join us in making a difference in our community. Partner with YSP and help us create lasting impact through collaborative projects.",
          partnerButtonText: "Partner with Us",
          partnerButtonLink: "https://forms.gle/YourGoogleFormLink",
        },
      };

      try {
        const stored = localStorage.getItem('YSP_HOMEPAGE_CONTENT');
        if (stored) {
          return { ...defaultState, ...JSON.parse(stored) };
        }
      } catch (e) {
        console.warn('Failed to load homepage content from storage', e);
      }
      return defaultState;
    });

    // Restore session on mount
    useEffect(() => {
      let isMounted = true;

    const restoreSession = async () => {
      const storedUser = getStoredUser();
      if (storedUser && hasActiveSession()) {
        // Show startup loader for active sessions during restore.
        setShowLoginPrepLoader(true);
        try {
          const valid = await verifySession();
          if (!isMounted) return;

            if (valid) {
              // Restore user data only when session is still valid
              prepareSidebarBootstrap();
              setIsAdmin(true);
              setUserRole(storedUser.role);
              setUserName(storedUser.name);
              setUserUsername(storedUser.username); // Store actual username for API calls
              setUserEmail(storedUser.email || '');
              setUserIdCode(storedUser.id || '');
              setUserPosition(storedUser.position || '');
              setUserProfilePicture(storedUser.profilePic || '');
            } else {
              handleSessionExpired(storedUser.username);
            }
          } catch (error) {
            console.warn("[App] Session verification skipped during restore:", error);
            if (!isMounted) return;

            // Fallback to local session when verification endpoint is unreachable
            prepareSidebarBootstrap();
            setIsAdmin(true);
            setUserRole(storedUser.role);
            setUserName(storedUser.name);
            setUserUsername(storedUser.username);
            setUserEmail(storedUser.email || '');
            setUserIdCode(storedUser.id || '');
            setUserPosition(storedUser.position || '');
            setUserProfilePicture(storedUser.profilePic || '');
          }
        }
        if (isMounted) {
          setSessionChecked(true);
        }
      };

      restoreSession();

      return () => {
        isMounted = false;
      };
    }, [handleSessionExpired, prepareSidebarBootstrap]);

    // Fetch homepage content from GAS backend on mount - with cache-first for instant loading
    useEffect(() => {
      const loadHomepageContent = async () => {
        const toastId = `homepage-sync-${Date.now()}`;
        const MAX_RETRIES = 3;
        const BASE_RETRY_DELAY = 1000; // 1 second
        let retryCount = 0;
        let loadedFromCache = false;
        
        // ===== STEP 1: Try to load from cache for instant display =====
        const cachedData = loadHomepageContentFromCache();
        if (cachedData) {
          const { data: cached, isStale } = cachedData;
          
          // Apply cached data immediately
          setHomepageContent(prev => ({
            ...prev,
            hero: cached.hero,
            about: cached.about,
            mission: cached.mission,
            vision: cached.vision,
            advocacyPillars: cached.advocacyPillars,
            themeSong: cached.themeSong,
          }));
          
          loadedFromCache = true;
          
          if (!isStale) {
            // Cache is fresh, perform silent background sync
            setIsLoadingHomepage(false);
          }
        }
        
        // If we have cache, skip showing loading toast for faster perceived performance
        const shouldShowToast = !loadedFromCache;
        
        const attemptLoad = async (): Promise<boolean> => {
          try {
            if (shouldShowToast) {
              addUploadToast({
                id: toastId,
                title: 'Syncing Homepage',
                message: retryCount > 0 ? `Retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})` : 'Connecting to backend...',
                status: 'loading',
                progress: 30,
                progressLabel: 'Starting...',
              });
            }
            if (!loadedFromCache) {
              setIsLoadingHomepage(true);
            }
            setHomepageError(null);
            
            if (shouldShowToast) {
              updateUploadToast(toastId, { progress: 30, message: 'Fetching homepage content...' });
            }
            const content = await fetchHomepageContent();
            if (shouldShowToast) {
              updateUploadToast(toastId, { progress: 80, message: 'Applying homepage updates...' });
            }
            
            // Check if content has actually changed
            const newCacheData: CachedHomepageContent = {
              hero: content.hero,
              about: content.about,
              mission: content.mission,
              vision: content.vision,
              advocacyPillars: content.advocacyPillars,
              themeSong: content.themeSong,
            };
            
            const hasChanged = hasHomepageContentChanged(newCacheData);
            
            if (hasChanged || !loadedFromCache) {
              setHomepageContent(prev => {
                const updated = {
                  ...prev,
                  hero: content.hero,
                  about: content.about,
                  mission: content.mission,
                  vision: content.vision,
                  advocacyPillars: content.advocacyPillars,
                  themeSong: content.themeSong,
                };
                try {
                  localStorage.setItem('YSP_HOMEPAGE_CONTENT', JSON.stringify(updated));
                } catch (e) {
                  console.error('Failed to save homepage content to storage', e);
                }
                return updated;
              });
              
              // Save to enhanced cache
              saveHomepageContentToCache(newCacheData);
            }
            
            setIsLoadingHomepage(false);
            
            if (shouldShowToast) {
              updateUploadToast(toastId, {
                status: 'success',
                progress: 100,
                title: 'Homepage Synced',
                message: 'Content loaded from backend.',
              });
              setTimeout(() => removeUploadToast(toastId), 3000);
            } else if (loadedFromCache && hasChanged) {
              // Silent update completed with changes
            }
            return true;
          } catch (error) {
            console.error(`[App] Error loading homepage content (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
            
            // Attempt retry if under max retries
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount - 1); // Exponential backoff
              
              if (shouldShowToast) {
                updateUploadToast(toastId, {
                  status: 'loading',
                  progress: 30 + (retryCount * 10),
                  message: `Retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
                });
              }
              
              // Wait before retrying
              await new Promise(resolve => setTimeout(resolve, delay));
              return attemptLoad();
            }
            
            // All retries failed
            return false;
          }
        };
        
        try {
          if (!loadedFromCache) {
            setIsLoadingHomepage(true);
          }
          const success = await attemptLoad();
          
          if (!success) {
            setIsLoadingHomepage(false);
            if (!loadedFromCache) {
              setHomepageError('Failed to load homepage content. Using cached data.');
              updateUploadToast(toastId, {
                status: 'error',
                progress: 100,
                title: 'Sync Failed',
                message: 'Homepage content failed to load after retries. Tap reload to try again.',
                actionLabel: 'Reload',
                onAction: () => {
                  removeUploadToast(toastId);
                  retryLoadHomepage();
                },
              });
            } else {
              console.warn('[App] Backend sync failed, using cached homepage data');
            }
          }
        } catch (error) {
          console.error('[App] Unexpected error in homepage load:', error);
          setIsLoadingHomepage(false);
          if (!loadedFromCache) {
            setHomepageError('Failed to load homepage content. Using cached data.');
            updateUploadToast(toastId, {
              status: 'error',
              progress: 100,
              title: 'Sync Failed',
              message: 'Homepage content failed to load. Tap reload to try again.',
              actionLabel: 'Reload',
              onAction: () => {
                removeUploadToast(toastId);
                retryLoadHomepage();
              },
            });
          }
        }
      };

      loadHomepageContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch projects from backend on mount - with cache-first and deletion detection
    useEffect(() => {
      const loadProjects = async () => {
        // ===== STEP 1: Try to load from cache for instant display =====
        const cachedData = loadProjectsFromCache();
        let loadedFromCache = false;
        
        if (cachedData) {
          const { data: cachedProjects, isStale } = cachedData;
          
          // Apply cached data immediately - map CachedProject to Project
          const mappedProjects: Project[] = cachedProjects.map(cp => ({
            projectId: cp.id,
            id: cp.id,
            title: cp.title,
            description: cp.description,
            imageUrl: cp.imageUrl,
            link: cp.link,
            linkText: cp.linkText,
            status: cp.status as 'Active' | 'Inactive',
            category: cp.category,
            date: cp.date,
            location: cp.location,
            participants: cp.participants,
            featured: cp.featured,
          }));
          setProjects(mappedProjects);
          loadedFromCache = true;
          
          if (!isStale) {
            setIsLoadingProjects(false);
          }
        }
        
        if (!loadedFromCache) {
          setIsLoadingProjects(true);
        }
        
        // ===== STEP 2: Fetch from backend =====
        try {
          const result = await fetchAllProjects();
          
          if (result.error) {
            console.error('[App] Error loading projects:', result.error);
            if (!loadedFromCache) {
              toast.error('Failed to load projects');
            }
          } else {
            // ===== STEP 3: Detect changes and deletions =====
            const newProjects = result.projects.map(p => ({
              id: p.id || p.projectId,
              title: p.title,
              description: p.description,
              imageUrl: p.imageUrl,
              link: p.link || '',
              linkText: p.linkText || '',
              category: p.category || '',
              status: p.status,
              date: p.date || '',
              location: p.location,
              participants: p.participants,
              featured: p.featured,
            })) as CachedProject[];
            
            const changes = getProjectChanges(newProjects);
            
            if (changes.hasChanges) {
              
              // Update state with fresh data
              setProjects(result.projects);
              
              // Save to cache
              saveProjectsToCache(newProjects);
            }
          }
        } catch (error) {
          console.error('[App] Error loading projects:', error);
          if (!loadedFromCache) {
            toast.error('Failed to load projects');
          }
        } finally {
          setIsLoadingProjects(false);
        }
      };

      loadProjects();
    }, []);

    // Fetch org chart URL AND Contact Info from backend on mount - with cache-first
    useEffect(() => {
      const loadOtherContent = async () => {
        // ===== STEP 1: Try to load from cache for instant display =====
        const cachedData = loadHomepageOtherFromCache();
        let loadedFromCache = false;
        
        if (cachedData) {
          const { data: cached } = cachedData;
          
          // Apply cached data immediately
          if (cached.orgChartUrl && cached.orgChartUrl.trim() !== '') {
            setOrgChartUrl(cached.orgChartUrl);
          }
          
          setHomepageContent(prev => ({
            ...prev,
            contact: cached.contact,
          }));
          
          loadedFromCache = true;
          
          // No UI loading state change needed here when loading cached other content.
        }
        
        // ===== STEP 2: Fetch from backend =====
        try {
          // Only invalidate if we don't have cache or cache is stale
          if (!loadedFromCache) {
            invalidateOtherContentCache();
          }
          
          const { content: otherContent, error: otherContentError } = await fetchHomepageOtherContentSafe();
          if (otherContentError && loadedFromCache) {
            console.warn(`[App] Other content sync fallback (${otherContentError.code}) - using cached content`);
          }
          
          // Build new cache data
          const newCacheData: CachedHomepageOther = {
            orgChartUrl: otherContent.orgChartUrl || '',
            contact: {
              title: otherContent.sectionTitle || '',
              email: otherContent.orgEmail || '',
              phone: otherContent.orgPhone || '',
              location: otherContent.orgLocation || '',
              locationLink: otherContent.orgGoogleMapUrl || '',
              socialLinks: otherContent.socialLinks?.map((link: SocialLinkData) => ({
                id: link.id,
                url: link.url,
                label: link.displayName
              })) || [],
              partnerTitle: otherContent.partnerTitle || '',
              partnerDescription: otherContent.partnerDescription || '',
              partnerButtonText: otherContent.partnerButtonText || '',
              partnerButtonLink: otherContent.partnerGformUrl || '',
            }
          };
          
          // Check if content has actually changed
          const hasChanged = hasHomepageOtherChanged(newCacheData);
          
          if (hasChanged || !loadedFromCache) {
            
            // 1. Update Org Chart State
            if (otherContent.orgChartUrl && otherContent.orgChartUrl.trim() !== '') {
              setOrgChartUrl(otherContent.orgChartUrl);
            }

            // 2. Update Homepage Content State (Contact, Partners, Socials)
            setHomepageContent(prev => ({
              ...prev,
              contact: {
                title: otherContent.sectionTitle || prev.contact.title,
                email: otherContent.orgEmail || prev.contact.email,
                phone: otherContent.orgPhone || prev.contact.phone,
                location: otherContent.orgLocation || prev.contact.location,
                locationLink: otherContent.orgGoogleMapUrl || prev.contact.locationLink,
                
                // Map backend 'displayName' to frontend 'label'
                socialLinks: otherContent.socialLinks?.map((link: SocialLinkData) => ({
                  id: link.id,
                  url: link.url,
                  label: link.displayName
                })) || [],
                
                partnerTitle: otherContent.partnerTitle || prev.contact.partnerTitle,
                partnerDescription: otherContent.partnerDescription || prev.contact.partnerDescription,
                partnerButtonText: otherContent.partnerButtonText || prev.contact.partnerButtonText,
                partnerButtonLink: otherContent.partnerGformUrl || prev.contact.partnerButtonLink,
              }
            }));
            
            // Save to cache
            saveHomepageOtherToCache(newCacheData);
          }
        } catch (error) {
          console.error('[App] Error loading other content:', error);
          if (loadedFromCache) {
            console.warn('[App] Backend sync failed, using cached other content');
          }
        }
      };

      loadOtherContent();
    }, []);

    // Retry loading homepage content
    const retryLoadHomepage = async () => {
      const toastId = `homepage-retry-${Date.now()}`;
      const MAX_RETRIES = 3;
      const BASE_RETRY_DELAY = 1000;
      let retryCount = 0;
      
      const attemptLoad = async (): Promise<boolean> => {
        try {
          addUploadToast({
            id: toastId,
            title: 'Reloading Homepage',
            message: retryCount > 0 ? `Retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})` : 'Connecting to backend...',
            status: 'loading',
            progress: 30,
            progressLabel: 'Starting...',
          });
          setIsLoadingHomepage(true);
          setHomepageError(null);
          
          updateUploadToast(toastId, { progress: 30, message: 'Fetching homepage content...' });
          const content = await fetchHomepageContent();
          updateUploadToast(toastId, { progress: 80, message: 'Applying homepage updates...' });
          setHomepageContent(prev => ({
            ...prev,
            hero: content.hero,
            about: content.about,
            mission: content.mission,
            vision: content.vision,
            advocacyPillars: content.advocacyPillars,
            themeSong: content.themeSong,
          }));
          setIsLoadingHomepage(false); // Clear loading state on success
          updateUploadToast(toastId, {
            status: 'success',
            progress: 100,
            title: 'Homepage Refreshed',
            message: 'Homepage content updated.',
          });
          setTimeout(() => removeUploadToast(toastId), 3000);
          return true;
        } catch (error) {
          console.error(`[App] Error retrying homepage content (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error);
          
          // Attempt retry if under max retries
          if (retryCount < MAX_RETRIES) {
            retryCount++;
            const delay = BASE_RETRY_DELAY * Math.pow(2, retryCount - 1);
            
            updateUploadToast(toastId, {
              status: 'loading',
              progress: 30 + (retryCount * 10),
              message: `Retrying... (attempt ${retryCount + 1}/${MAX_RETRIES})`,
            });
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return attemptLoad();
          }
          
          return false;
        }
      };
      
      try {
        setIsLoadingHomepage(true);
        const success = await attemptLoad();
        
        if (!success) {
          setIsLoadingHomepage(false);
          setHomepageError('Failed to load homepage content.');
          updateUploadToast(toastId, {
            status: 'error',
            progress: 100,
            title: 'Sync Failed',
            message: 'Homepage content failed to load after retries. Tap reload to try again.',
            actionLabel: 'Reload',
            onAction: () => {
              removeUploadToast(toastId);
              retryLoadHomepage();
            },
          });
        }
      } catch (error) {
        console.error('[App] Unexpected error in retry homepage load:', error);
        setIsLoadingHomepage(false);
        setHomepageError('Failed to load homepage content.');
        updateUploadToast(toastId, {
          status: 'error',
          progress: 100,
          title: 'Sync Failed',
          message: 'Homepage content failed to load. Tap reload to try again.',
          actionLabel: 'Reload',
          onAction: () => {
            removeUploadToast(toastId);
            retryLoadHomepage();
          },
        });
      }
    };

    // Temporary state for editing
    const [editedContent, setEditedContent] = useState(homepageContent);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (!target.closest('.dropdown-container')) {
          setOpenDropdown(null);
        }
      };

      if (openDropdown) {
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
      }
    }, [openDropdown]);

    // Projects State
    const [projects, setProjects] = useState<Project[]>([]);
    const [isLoadingProjects, setIsLoadingProjects] = useState(true);
    const [showUploadProjectModal, setShowUploadProjectModal] = useState(false);
    const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [newProject, setNewProject] = useState({
      title: "",
      description: "",
      imageUrl: "",
      link: "",
      linkText: "",
    });
    const [projectImageFile, setProjectImageFile] = useState<File | null>(null);
    const [isUploadingProjectImage, setIsUploadingProjectImage] = useState(false);

    const isPortalStartupReady = Boolean(
      isAdmin &&
      userRole !== "guest" &&
      hasResolvedSidebarAccess &&
      !isLoadingHomepage &&
      !isLoadingProjects
    );

    useEffect(() => {
      if (!showLoginPrepLoader) return;
      if (isPortalStartupReady) setShowLoginPrepLoader(false);
    }, [isPortalStartupReady, showLoginPrepLoader]);

    const loginPrepSteps = useMemo<LoadingStep[]>(
      () => [
        {
          id: "init",
          label: "Initializing",
          status: isAdmin && userRole !== "guest" ? "success" : "loading",
        },
        {
          id: "homepage",
          label: "Preparing system",
          status: !isAdmin || userRole === "guest"
            ? "pending"
            : !isLoadingHomepage
            ? "success"
            : "loading",
        },
        {
          id: "assets",
          label: "Loading sidebars",
          status: !isAdmin || userRole === "guest"
            ? "pending"
            : hasResolvedSidebarAccess
            ? "success"
            : "loading",
        },
        {
          id: "complete",
          label: "Finalizing",
          status: isPortalStartupReady ? "success" : "loading",
        },
      ],
      [hasResolvedSidebarAccess, isAdmin, isLoadingHomepage, isPortalStartupReady, userRole]
    );

    // YSP Logo URLs
    const primaryLogoUrl = "https://i.imgur.com/J4wddTW.png";
    const fallbackLogoUrl =
      "https://ui-avatars.com/api/?name=YSP&size=80&background=f6421f&color=fff";

    // Navigation Groups Configuration
    const navigationGroups: NavGroup[] = useMemo(() => ([
      {
        id: "home-group",
        label: "Home",
        icon: <Home className="w-5 h-5" />,
        pages: [
          {
            id: "about",
            label: "About",
            action: () => {
              setActivePage("about");
              document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
          },
          {
            id: "projects",
            label: "Projects",
            action: () => {
              setActivePage("projects");
              document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
          },
          {
            id: "contact",
            label: "Contact",
            action: () => {
              setActivePage("contact");
              document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
          },
          {
            id: "feedback",
            label: "Feedback",
            action: () => {
              setActivePage("feedback");
              setShowFeedbackPage(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
          },
        ],
      },
      {
        id: "dashboard-directory",
        label: "Dashboard & Directory",
        icon: <LayoutDashboard className="w-5 h-5" />,
        pages: [
          {
            id: "officer-directory",
            label: "Officer Directory Search",
            action: () => {
              setActivePage("officer-directory");
              setShowOfficerDirectory(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["head"], // CHANGED: Only Head and above (Members cannot see)
          },
          {
            id: "manage-members",
            label: "Manage Members",
            action: () => {
              setActivePage("manage-members");
              setShowManageMembers(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["admin"], // admin and above (auditor)
            icon: <Users className="w-4 h-4" />,
          },
          {
            id: "attendance-dashboard",
            label: "Attendance Dashboard",
            action: () => {
              setActivePage("attendance-dashboard");
              setShowAttendanceDashboard(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["head"], // head and above (admin, auditor)
          },
        ],
        roles: ["member"], // member and above can see this group
      },
      {
        id: "attendance-management",
        label: "Attendance Management",
        icon: <QrCode className="w-5 h-5" />,
        pages: [
          {
            id: "attendance-recording",
            label: "Attendance Recording",
            action: () => {
              setActivePage("attendance-recording");
              setShowAttendanceRecording(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["head"], // head and above (admin, auditor)
          },
          {
            id: "manage-events",
            label: "Manage Events",
            action: () => {
              setActivePage("manage-events");
              setShowManageEvents(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["admin"], // admin and above (auditor)
          },
          {
            id: "my-qr-id",
            label: "My QR ID",
            action: () => {
              setActivePage("my-qr-id");
              setShowMyQRID(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["member"], // member and above
          },
          {
            id: "attendance-transparency",
            label: "Attendance Transparency",
            action: () => {
              setActivePage("attendance-transparency");
              setShowAttendanceTransparency(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["member"], // member and above
          },
        ],
        roles: ["member"], // member and above can see this group
      },
      {
        id: "communication",
        label: "Communication Center",
        icon: <MessageSquare className="w-5 h-5" />,
        pages: [
          {
            id: "announcements",
            label: "Announcements",
            action: () => {
              setActivePage("announcements");
              setShowAnnouncements(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["member"], // member and above
          },
          {
            id: "feedback",
            label: "Feedback",
            action: () => {
              setActivePage("feedback");
              setShowFeedbackPage(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            icon: <MessageCircle className="w-4 h-4" />,
            // Public - no roles required
          },
          {
            id: "issuance-center",
            label: "Issuance Center",
            action: () => {
              setActivePage("issuance-center");
              setShowIssuanceCenter(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            icon: <FileText className="w-4 h-4" />,
            roles: ["admin", "auditor", "head", "member"], // All logged-in users can view their issuances
          },
          {
            id: "membership-editor",
            label: "Opportunities Editor",
            action: () => {
              setActivePage("membership-editor");
              setShowMembershipApplicationsPage(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            icon: <Users className="w-4 h-4" />,
            roles: ["admin", "auditor"], // CHANGED: Removed "head"
          },
        ],
        // Public group - no roles required
      },
      {
        id: "logs-reports",
        label: "Logs & Reports",
        icon: <FileText className="w-5 h-5" />,
        pages: [
          {
            id: "access-logs",
            label: "Access Logs",
            action: () => {
              setActivePage("access-logs");
              setShowAccessLogs(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["auditor"], // auditor only (highest access)
          },
          {
            id: "system-tools",
            label: "System Tools",
            action: () => {
              setActivePage("system-tools");
              setShowSystemTools(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["auditor"], // CHANGED: Only Auditor (Admin cannot see)
          },
        ],
        roles: ["admin"], // admin and above can see this group
      },
      {
        id: "kaagapai-meet-group",
        label: "KaagapAI Meet",
        icon: <Network className="w-5 h-5" />,
        pages: [
          {
            id: "kaagapai-meet",
            label: "KaagapAI Meet (Google Meet)",
            action: () => {
              setActivePage("kaagapai-meet");
              setShowKaagapAIMeet(true);
              setOpenDropdown(null);
              setIsMenuOpen(false);
            },
            roles: ["member"],
          },
        ],
        roles: ["member"],
      },
    ]), []);

    // Role Hierarchy Helper - Check if user has access based on role hierarchy
    // auditor (highest) > admin > head > member/guest > suspended > banned (no access)
    const hasRoleAccess = useCallback((requiredRoles: string[] | undefined): boolean => {
      if (!requiredRoles || requiredRoles.length === 0) return true; // Public access
      
      // Define role hierarchy levels (higher number = more access)
      const roleHierarchy: Record<string, number> = {
        banned: 0,      // No access
        suspended: 1,   // Minimal access
        guest: 2,       // Guest access (same as member)
        member: 2,      // Standard access
        head: 3,        // Leadership access
        admin: 4,       // Management access
        auditor: 5,     // Highest access
      };

      const normalizedUserRole = (userRole || "").toLowerCase().trim();
      const inferCustomRoleLevel = (role: string): number => {
        if (!role) return 0;
        if (roleHierarchy[role] !== undefined) return roleHierarchy[role];
        if (role.includes("auditor")) return 5;
        if (role.includes("admin")) return 4;
        if (role.includes("president") || role.includes("head")) return 3;
        if (role.includes("member") || role.includes("volunteer")) return 2;
        if (role.includes("guest")) return 1;
        // Any authenticated non-restricted custom role gets at least member-level visibility.
        if (isAdmin && role !== "banned" && role !== "suspended") return 2;
        return 0;
      };

      const userLevel = inferCustomRoleLevel(normalizedUserRole);
      
      // Check if user's role level meets ANY of the required roles
      return requiredRoles.some(role => {
        const normalizedRequiredRole = (role || "").toLowerCase().trim();
        const requiredLevel = roleHierarchy[normalizedRequiredRole] || 0;
        return userLevel >= requiredLevel;
      });
    }, [isAdmin, userRole]);

    // Filter groups and pages based on user role
    const visibleGroups = useMemo(() => {
      // If not logged in, return public pages only (flat list for sidebar)
      // NOTE: Home and Login are handled by dedicated UI elements in the sidebar,
      // so they should NOT be included in this pages array to avoid duplicates
      if (!isAdmin) {
        return [{
          id: "public-pages",
          label: "Navigation",
          icon: <Home className="w-5 h-5" />,
          pages: [
            {
              id: "about",
              label: "About",
              icon: <Users className="w-5 h-5" />,
              action: () => {
                setActivePage("about");
                document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
                setIsSidebarOpen(false);
              },
            },
            {
              id: "projects",
              label: "Projects",
              icon: <ClipboardList className="w-5 h-5" />,
              action: () => {
                setActivePage("projects");
                document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
                setIsSidebarOpen(false);
              },
            },
            {
              id: "contact",
              label: "Contact",
              icon: <Mail className="w-5 h-5" />,
              action: () => {
                setActivePage("contact");
                document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
                setIsSidebarOpen(false);
              },
            },
            {
              id: "feedback",
              label: "Feedback",
              icon: <MessageCircle className="w-5 h-5" />,
              action: () => {
                setActivePage("feedback");
                setShowFeedbackPage(true);
                setIsSidebarOpen(false);
              },
            },
          ],
        }];
      }

      // Suspended users only see their profile (minimal access)
      if (userRole === 'suspended') {
        return [{
          id: "restricted-access",
          label: "Limited Access",
          icon: <Users className="w-5 h-5" />,
          pages: [
            {
              id: "my-profile",
              label: "My Profile",
              action: () => {
                setActivePage("my-profile");
                setShowMyProfile(true);
                setIsSidebarOpen(false);
              },
            },
            {
              id: "my-qr-id",
              label: "My QR ID",
              action: () => {
                setActivePage("my-qr-id");
                setShowMyQRID(true);
                setIsSidebarOpen(false);
              },
            },
            {
              id: "attendance-transparency",
              label: "Attendance Transparency",
              action: () => {
                setActivePage("attendance-transparency");
                setShowAttendanceTransparency(true);
                setIsSidebarOpen(false);
              },
            },
          ],
        }];
      }

      if (isAccessMatrixLoading) {
        return [];
      }
      
      return navigationGroups
        .filter((group) => {
          // Filter out home-group when logged in (it's redundant)
          if (group.id === "home-group") return false;
          // Use role hierarchy to check access
          return hasRoleAccess(group.roles);
        })
        .map((group) => ({
          ...group,
          pages: group.pages.filter((page) => {
            // Use role hierarchy to check access
            return hasRoleAccess(page.roles) && isPageAllowed(page.id);
          }),
        }))
        .filter((group) => group.pages.length > 0);
    }, [hasRoleAccess, isAdmin, isAccessMatrixLoading, isPageAllowed, navigationGroups, userRole]);

    useEffect(() => {
      if (!PAGE_ACCESS_DEBUG || isAccessMatrixLoading) return;
      const allProtectedPageIds = Object.keys(PAGE_BACKEND_PATHS);
      const visiblePageIds = visibleGroups.flatMap((group) => group.pages.map((page) => page.id));
      const hiddenProtectedPageIds = allProtectedPageIds.filter(
        (pageId) => !visiblePageIds.includes(pageId) && !PUBLIC_PAGE_IDS.has(pageId)
      );

      console.warn("[AccessDebug] Sidebar visibility resolution");
      console.warn("[AccessDebug] User context", {
        isAdmin,
        userRole,
        userUsername,
      });
      console.warn("[AccessDebug] Visible page IDs", visiblePageIds);
      console.warn("[AccessDebug] Hidden protected page IDs", hiddenProtectedPageIds);
      console.warn("[AccessDebug] Current matrix", pageAccessByPath);
      console.warn("[AccessDebug] End sidebar visibility resolution");
    }, [
      isAccessMatrixLoading,
      isAdmin,
      userRole,
      userUsername,
      visibleGroups,
      pageAccessByPath,
    ]);

    const toggleDark = useCallback(() => {
      setIsDark(!isDark);
      document.documentElement.classList.toggle("dark");
    }, [isDark]);

    const syncProjectIdInUrl = useCallback(
      (projectId?: string | null, replace = false) => {
        const params = new URLSearchParams(location.search);
        const normalizedId = String(projectId || "").trim();

        if (normalizedId) params.set(PROJECT_ID_QUERY_PARAM, normalizedId);
        else params.delete(PROJECT_ID_QUERY_PARAM);

        const nextSearch = params.toString();
        const currentSearch = location.search.startsWith("?")
          ? location.search.slice(1)
          : location.search;
        if (nextSearch === currentSearch) return;

        navigate(
          {
            pathname: location.pathname,
            search: nextSearch ? `?${nextSearch}` : "",
          },
          { replace }
        );
      },
      [location.pathname, location.search, navigate]
    );

    const openProjectModal = useCallback((project: Project) => {
      setModalProject(project);
      const projectId = String(project?.projectId || "").trim();
      if (projectId && projectId !== "org-chart") {
        syncProjectIdInUrl(projectId, false);
      }
    }, [syncProjectIdInUrl]);

    const closeModal = useCallback(() => {
      setModalProject(null);
      syncProjectIdInUrl(null, true);
    }, [syncProjectIdInUrl]);

    useEffect(() => {
      const projectId = new URLSearchParams(location.search).get(PROJECT_ID_QUERY_PARAM);
      if (!projectId) {
        if (modalProject && String(modalProject.projectId || "").trim() !== "org-chart") {
          setModalProject(null);
        }
        return;
      }

      if (modalProject && String(modalProject.projectId || "").trim() === projectId) return;

      const matchedProject = projects.find(
        (project) => String(project.projectId || "").trim() === projectId
      );
      if (!matchedProject) return;

      setModalProject(matchedProject);
      if (activePage !== "projects") setActivePage("projects");
    }, [activePage, location.search, modalProject, projects]);

    // Project Management Functions
    const handleUploadProject = async () => {
      if (!newProject.title.trim()) {
        toast.error("Please enter a project title");
        return;
      }
      if (!newProject.description.trim()) {
        toast.error("Please enter a project description");
        return;
      }
      if (!projectImageFile && !newProject.imageUrl.trim()) {
        toast.error("Please upload an image");
        return;
      }

      setIsUploadingProjectImage(true);
      const toastId = `project-upload-${Date.now()}`;
      const isEditing = !!editingProject;
      const controller = new AbortController();
      const { signal } = controller;

      try {
        // Show progress toast
        addUploadToast({
          id: toastId,
          title: isEditing ? 'Updating Project' : 'Uploading Project',
          message: isEditing ? 'Saving project changes...' : 'Preparing upload...',
          status: 'loading',
          progress: 10,
          onCancel: () => {
            controller.abort();
            updateUploadToast(toastId, {
              status: 'info',
              progress: 100,
              title: 'Cancelled',
              message: isEditing ? 'Project update cancelled' : 'Project upload cancelled',
            });
          },
        });

        const projectData = {
          title: newProject.title.trim(),
          description: newProject.description.trim(),
          imageUrl: newProject.imageUrl,
          link: newProject.link.trim() || undefined,
          linkText: newProject.linkText.trim() || undefined,
          status: 'Active' as const,
        };

        updateUploadToast(toastId, { progress: 30, message: 'Processing image...', status: 'loading' });

        let result;
        if (isEditing) {
          result = await updateProject(editingProject.projectId, projectData, projectImageFile || undefined, signal);
        } else {
          result = await addProject(projectData, projectImageFile || undefined, signal);
        }

        if (signal.aborted) {
          return;
        }

        if (result.success) {
          updateUploadToast(toastId, { progress: 80, message: isEditing ? 'Updating backend...' : 'Syncing to backend...', status: 'loading' });

          // Reload projects from backend
          const projectsResult = await fetchAllProjects(signal);
          if (signal.aborted) {
            return;
          }
          if (!projectsResult.error) {
            setProjects(projectsResult.projects);
            
            // Update projects cache
            const projectsToCache = projectsResult.projects.map(p => ({
              id: p.id || p.projectId,
              title: p.title,
              description: p.description,
              imageUrl: p.imageUrl,
              link: p.link || '',
              linkText: p.linkText || '',
              category: p.category || '',
              status: p.status,
              date: p.date || '',
              location: p.location,
              participants: p.participants,
              featured: p.featured,
            })) as CachedProject[];
            saveProjectsToCache(projectsToCache);
          }

          updateUploadToast(toastId, {
            status: 'success',
            progress: 100,
            title: isEditing ? 'Update Complete' : 'Upload Complete',
            message: isEditing ? 'Project updated successfully!' : 'Project uploaded successfully!',
          });

          setNewProject({ title: "", description: "", imageUrl: "", link: "", linkText: "" });
          setProjectImageFile(null);
          setEditingProject(null);
          setShowUploadProjectModal(false);

          setTimeout(() => removeUploadToast(toastId), 3000);
        } else {
          updateUploadToast(toastId, {
            status: 'error',
            progress: 100,
            title: isEditing ? 'Update Failed' : 'Upload Failed',
            message: result.error?.message || 'Failed to upload project',
          });
          setTimeout(() => removeUploadToast(toastId), 5000);
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        console.error('Upload error:', error);
        updateUploadToast(toastId, {
          status: 'error',
          progress: 100,
          title: isEditing ? 'Update Error' : 'Upload Error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
        setTimeout(() => removeUploadToast(toastId), 5000);
      } finally {
        setIsUploadingProjectImage(false);
      }
    };

    const startEditProject = useCallback((project: Project) => {
      setEditingProject(project);
      setNewProject({
        title: project.title,
        description: project.description,
        imageUrl: project.imageUrl,
        link: project.link || "",
        linkText: project.linkText || "",
      });
      setProjectImageFile(null);
      setShowUploadProjectModal(true);
    }, []);

    const closeProjectModal = useCallback(() => {
      setEditingProject(null);
      setNewProject({ title: "", description: "", imageUrl: "", link: "", linkText: "" });
      setProjectImageFile(null);
      setShowUploadProjectModal(false);
    }, []);

    const handleDeleteSelectedProjects = () => {
      if (selectedProjectIds.length === 0) {
        toast.error("No projects selected");
        return;
      }
      // Show confirmation modal instead of directly deleting
      setShowDeleteConfirmModal(true);
    };

    const confirmDeleteProjects = async () => {
      const count = selectedProjectIds.length;
      const toastId = `project-delete-${Date.now()}`;
      const controller = new AbortController();
      const { signal } = controller;
      
      addUploadToast({
        id: toastId,
        title: 'Deleting Project' + (count > 1 ? 's' : ''),
        message: `Removing ${count} project${count > 1 ? 's' : ''} from database...`,
        status: 'loading',
        progress: 10,
        onCancel: () => {
          controller.abort();
          updateUploadToast(toastId, {
            status: 'info',
            progress: 100,
            title: 'Cancelled',
            message: 'Delete cancelled',
          });
        },
      });

      try {
        // Delete each selected project from backend
        let successCount = 0;
        let failCount = 0;
        
        for (let i = 0; i < selectedProjectIds.length; i++) {
          if (signal.aborted) {
            return;
          }
          const projectId = selectedProjectIds[i];
          const progress = Math.round(10 + ((i + 1) / selectedProjectIds.length) * 80);
          
          updateUploadToast(toastId, {
            message: `Deleting project ${i + 1} of ${count}...`,
            progress,
          });
          
          const result = await deleteProject(projectId, signal);
          if (signal.aborted) {
            return;
          }
          if (result.success) {
            successCount++;
          } else {
            failCount++;
            console.error(`Failed to delete project ${projectId}:`, result.error);
          }
        }
        
        // Reload projects from backend to sync state
        const projectsResult = await fetchAllProjects(signal);
        if (signal.aborted) {
          return;
        }
        if (!projectsResult.error) {
          setProjects(projectsResult.projects);
          
          // Update projects cache after deletion
          const projectsToCache = projectsResult.projects.map(p => ({
            id: p.id || p.projectId,
            title: p.title,
            description: p.description,
            imageUrl: p.imageUrl,
            link: p.link || '',
            linkText: p.linkText || '',
            category: p.category || '',
            status: p.status,
            date: p.date || '',
            location: p.location,
            participants: p.participants,
            featured: p.featured,
          })) as CachedProject[];
          saveProjectsToCache(projectsToCache);
        } else {
          // Fallback: remove from local state
          setProjects(projects.filter((p) => !selectedProjectIds.includes(p.projectId)));
        }
        
        setSelectedProjectIds([]);
        setShowDeleteConfirmModal(false);
        
        if (failCount === 0) {
          updateUploadToast(toastId, {
            status: 'success',
            progress: 100,
            title: 'Deleted',
            message: `${successCount} project${successCount > 1 ? 's' : ''} deleted successfully!`,
          });
          toast.success(`${successCount} project${successCount > 1 ? 's' : ''} deleted successfully!`);
        } else {
          updateUploadToast(toastId, {
            status: 'error',
            progress: 100,
            title: 'Partial Delete',
            message: `${successCount} deleted, ${failCount} failed`,
          });
          toast.error(`${failCount} project${failCount > 1 ? 's' : ''} failed to delete`);
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        console.error('Delete error:', error);
        updateUploadToast(toastId, {
          status: 'error',
          progress: 100,
          title: 'Delete Error',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
        toast.error('Failed to delete projects');
      }
    };

    // Org Chart Upload Handler
    const handleOrgChartUpload = async (file: File) => {
      if (!file) return;
      
      setIsUploadingOrgChart(true);
      const toastId = `org-chart-upload-${Date.now()}`;
      const controller = new AbortController();
      const { signal } = controller;
      
      addUploadToast({
        id: toastId,
        title: 'Uploading Org Chart',
        message: 'Preparing image...',
        status: 'loading',
        progress: 0,
        onCancel: () => {
          controller.abort();
          updateUploadToast(toastId, {
            status: 'info',
            progress: 100,
            title: 'Cancelled',
            message: 'Upload cancelled',
          });
        },
      });

      try {
        updateUploadToast(toastId, { progress: 30, message: 'Uploading to Google Drive...' });
        
        const result = await uploadOrgChart(file, signal);

        if (signal.aborted) {
          return;
        }
        
        if (result.success && result.imageUrl) {
          // The backend already saves the URL to the sheet, just update local state
          setOrgChartUrl(result.imageUrl);
          
          // Update the homepage other cache with new org chart URL
          const cachedOther = loadHomepageOtherFromCache();
          if (cachedOther) {
            const updatedOther: CachedHomepageOther = {
              ...cachedOther.data,
              orgChartUrl: result.imageUrl,
            };
            saveHomepageOtherToCache(updatedOther);
          }
          
          updateUploadToast(toastId, {
            status: 'success',
            progress: 100,
            title: 'Upload Complete',
            message: 'Org chart uploaded successfully!',
          });
          toast.success('Org chart uploaded successfully!');
        } else {
          console.error('[App] Upload failed:', result.error);
          updateUploadToast(toastId, {
            status: 'error',
            progress: 100,
            title: 'Upload Failed',
            message: result.error || 'Failed to upload org chart',
          });
          toast.error(result.error || 'Failed to upload org chart');
        }
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        console.error('[App] Org chart upload error:', error);
        updateUploadToast(toastId, {
          status: 'error',
          progress: 100,
          title: 'Upload Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        toast.error('Failed to upload org chart');
      } finally {
        setIsUploadingOrgChart(false);
      }
    };

    // Org Chart Delete Handler
    const confirmDeleteOrgChart = async () => {
      const toastId = `org-chart-delete-${Date.now()}`;
      const controller = new AbortController();
      const { signal } = controller;
      
      addUploadToast({
        id: toastId,
        title: 'Deleting Org Chart',
        message: 'Removing from database...',
        status: 'loading',
        progress: 50,
        onCancel: () => {
          controller.abort();
          updateUploadToast(toastId, {
            status: 'info',
            progress: 100,
            title: 'Cancelled',
            message: 'Delete cancelled',
          });
        },
      });

      try {
        // Clear from backend - this updates the sheet to have empty org chart URL
        await updateHomepageOtherContent({ orgChartUrl: '' }, signal);

        if (signal.aborted) {
          return;
        }
        
        setOrgChartUrl(''); // Clear the org chart URL locally
        setShowDeleteOrgChartModal(false);
        
        updateUploadToast(toastId, {
          status: 'success',
          progress: 100,
          title: 'Deleted',
          message: 'Org chart deleted successfully!',
        });
        toast.success('Org chart deleted successfully!');
      } catch (error) {
        if (signal.aborted) {
          return;
        }
        console.error('[App] Org chart delete error:', error);
        setOrgChartUrl(''); // Still clear locally
        setShowDeleteOrgChartModal(false);
        updateUploadToast(toastId, {
          status: 'error',
          progress: 100,
          title: 'Delete Error',
          message: 'Removed locally, sync may be delayed',
        });
        toast.success('Org chart removed');
      }
    };

    const toggleProjectSelection = useCallback((projectId: string) => {
      setSelectedProjectIds((prev) =>
        prev.includes(projectId)
          ? prev.filter((id) => id !== projectId)
          : [...prev, projectId]
      );
    }, []);

    const recordRecentUsername = (identifier: string) => {
      const cleaned = identifier.trim();
      if (!cleaned) return;
      try {
        const listKey = "ysp_recent_usernames";
        const lastKey = "ysp_last_username";
        const stored = localStorage.getItem(listKey);
        const parsed = stored ? JSON.parse(stored) : [];
        const existing = Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
        const next = [cleaned, ...existing.filter((item) => item !== cleaned)].slice(0, 5);
        localStorage.setItem(listKey, JSON.stringify(next));
        localStorage.setItem(lastKey, cleaned);
      } catch {
        // Ignore storage failures.
      }
    };

    const recordRememberedUsername = (identifier: string, remember: boolean) => {
      try {
        if (remember) {
          localStorage.setItem("ysp_remember_username", "true");
          localStorage.setItem("ysp_remembered_username", identifier.trim());
        } else {
          localStorage.removeItem("ysp_remember_username");
          localStorage.removeItem("ysp_remembered_username");
        }
      } catch {
        // Ignore storage failures.
      }
    };

    const handleLogin = async (
      username: string,
      password: string,
      rememberMe: boolean,
      totpCode?: string,
      challengeUsername?: string
    ): Promise<{ requires2FA?: boolean; challengeUsername?: string; maskedEmail?: string; completed?: boolean; error?: string }> => {
      // Real authentication via GAS backend
      try {
        let response;
        if (totpCode) {
          response = await verifyLogin2FA((challengeUsername || username).trim(), totpCode);
        } else {
          response = await authenticateUser(username, password);
          if (response.success && response.requires2FA) {
            return {
              requires2FA: true,
              challengeUsername: response.username || username,
              maskedEmail: response.maskedEmail || '',
            };
          }
        }
        
        if (response.success && response.user) {
          const user = response.user;
          
          // Handle BANNED accounts - no access
          if (user.role === 'banned') {
            toast.error('Account Banned', {
              description: 'This account has been permanently banned. Contact admin for assistance.',
            });
            return { error: 'Account banned' };
          }

          recordRecentUsername(username);
          recordRememberedUsername(username, rememberMe);

          // Handle SUSPENDED accounts - minimal access warning
          if (user.role === 'suspended') {
            setShowLoginPrepLoader(true);
            prepareSidebarBootstrap();
            setIsAdmin(true); // Allow login but limited
            setUserRole('suspended');
            setUserName(user.name);
            setUserUsername(user.username); // Store actual username for API calls
            setUserEmail(user.email || '');
            setUserIdCode(user.id || '');
            setUserPosition(user.position || '');
            setUserProfilePicture(user.profilePic || '');
            setShowLoginPanel(false);
            await waitForPostLoginRender();
            toast.warning('Account Suspended', {
              description: 'Your account has limited access. Contact admin for full restoration.',
            });
            return { completed: true };
          }

          // Normal login for all other roles
          setShowLoginPrepLoader(true);
          prepareSidebarBootstrap();
          setIsAdmin(true);
          setUserRole(user.role);
          setUserName(user.name);
          setUserUsername(user.username); // Store actual username for API calls
          setUserEmail(user.email || '');
          setUserIdCode(user.id || '');
          setUserPosition(user.position || '');
          setUserProfilePicture(user.profilePic || '');
          setShowLoginPanel(false);
          await waitForPostLoginRender();

          // Log successful login to Access Logs
          logLogin(user.name || username, true);

          // Role-specific welcome messages
          const roleMessages: Record<string, string> = {
            auditor: 'Welcome, Auditor! You have full system access including audit logs.',
            admin: 'Welcome, Admin! You have full management access.',
            head: 'Welcome, Committee Head! You have leadership access.',
            member: 'Welcome, Member! You have standard access.',
            guest: 'Welcome, Guest! You have limited viewing access.',
          };

          toast.success('Successfully logged in!', {
            description: roleMessages[user.role] || `Welcome, ${user.name}!`,
          });
          return { completed: true };
        }
        return { error: 'Login failed' };
      } catch (error: unknown) {
        // Log failed login attempt
        logLogin(username, false);
        
        // Handle specific error types
        if (error && typeof error === 'object' && 'code' in error) {
          const loginError = error as { code: string; message: string };
          
          switch (loginError.code) {
            case LoginErrorCodes.INVALID_CREDENTIALS:
              toast.error('Invalid credentials', {
                description: 'Please check your username and password',
              });
              return { error: 'Invalid credentials' };
            case LoginErrorCodes.ACCOUNT_BANNED:
              toast.error('Account Banned', {
                description: loginError.message || 'This account has been permanently banned.',
              });
              return { error: loginError.message || 'Account access denied' };
            case LoginErrorCodes.TIMEOUT_ERROR:
              toast.error('Connection Timeout', {
                description: 'The server is taking too long to respond. Please try again.',
              });
              return { error: 'Connection timeout' };
            case LoginErrorCodes.NETWORK_ERROR:
              toast.error('Network Error', {
                description: 'Unable to connect to the server. Please check your internet connection.',
              });
              return { error: 'Network error' };
            case LoginErrorCodes.NO_API_URL:
              toast.error('Service Unavailable', {
                description: 'Login service is not configured. Please contact administrator.',
              });
              return { error: 'Service unavailable' };
            default:
              toast.error('Login Failed', {
                description: loginError.message || 'An unexpected error occurred. Please try again.',
              });
              return { error: loginError.message || 'Login failed' };
          }
        } else {
          toast.error('Login Failed', {
            description: 'An unexpected error occurred. Please try again.',
          });
          return { error: 'Unexpected error' };
        }
      }
    };

    const handleContinueSession = async () => {
      const storedUser = getStoredUser();
      if (!storedUser || !hasActiveSession()) {
        toast.error('Session not available', {
          description: 'Please log in with your username and password.',
        });
        return;
      }

      try {
        const valid = await verifySession();
        if (!valid) {
          handleSessionExpired(storedUser.username);
          return;
        }

        prepareSidebarBootstrap();
        setShowLoginPrepLoader(true);
        setIsAdmin(true);
        setUserRole(storedUser.role);
        setUserName(storedUser.name);
        setUserUsername(storedUser.username); // Store actual username for API calls
        setUserEmail(storedUser.email || '');
        setUserIdCode(storedUser.id || '');
        setUserPosition(storedUser.position || '');
        setUserProfilePicture(storedUser.profilePic || '');
        setShowLoginPanel(false);
        await waitForPostLoginRender();
        toast.success('Welcome back!', {
          description: storedUser.name ? `Signed in as ${storedUser.name}` : 'Signed in.',
        });
      } catch (error) {
        console.error('[App] Session verification failed:', error);
        handleSessionExpired(storedUser.username);
      }
    };

    const handleLogout = () => {
      const executeLogout = async () => {
        // Log logout before clearing session (need username)
        if (userName) {
          await logLogout(userName);

          // Clear the user's profile cache on logout
          const storedUser = getStoredUser();
          if (storedUser?.username) {
            clearUserProfileCache(storedUser.username);
          }
        }

        // Clear session from storage
        clearSession();
        setShowLoginPrepLoader(false);

        setIsAdmin(false);
        setUserRole("guest");
        setUserName("");
        setUserUsername("");
        setUserEmail("");
        setUserIdCode("");
        setUserPosition("");
        setUserProfilePicture("");
        setActivePage("home");
        toast.success('Successfully logged out');
      };

      void executeLogout();
    };

    // Homepage Edit Handlers
    const handleStartEditing = () => {
      if (userRole === 'admin' || userRole === 'auditor') {
        setEditedContent(homepageContent);
        setIsEditingHomepage(true);
        toast.info('Edit mode enabled', {
          description: 'Make your changes and click Save to apply them.',
        });
      }
    };

    const handleCancelEditing = () => {
      setEditedContent(homepageContent);
      setIsEditingHomepage(false);
      toast.info('Changes discarded');
    };

    const handleSaveEditing = async () => {
      setIsSavingHomepage(true);
      
      try {
        // 1. Prepare Main Content (Hero, About, Mission, Vision)
        const contentToSave: HomepageMainContent = {
          hero: editedContent.hero,
          about: editedContent.about,
          mission: editedContent.mission,
          vision: editedContent.vision,
          advocacyPillars: editedContent.advocacyPillars,
          themeSong: editedContent.themeSong,
        };

        // 2. Prepare Other Content (Contact, Socials, Partners)
        // We map frontend field names to what the backend expects
        const otherContentToSave = {
          sectionTitle: editedContent.contact.title,
          orgEmail: editedContent.contact.email,
          orgPhone: editedContent.contact.phone,
          orgLocation: editedContent.contact.location,
          orgGoogleMapUrl: editedContent.contact.locationLink,
          
          // Partner Section
          partnerTitle: editedContent.contact.partnerTitle,
          partnerDescription: editedContent.contact.partnerDescription,
          partnerButtonText: editedContent.contact.partnerButtonText,
          partnerGformUrl: editedContent.contact.partnerButtonLink,
          
          // Social Links (Backend expects 'displayName', frontend uses 'label')
          socialLinks: editedContent.contact.socialLinks.map(link => ({
            id: link.id,
            url: link.url,
            displayName: link.label
          }))
        };

        // 3. Save BOTH to backend in parallel
        const [mainSuccess, otherSuccess] = await Promise.all([
          updateHomepageContent(contentToSave),
          updateHomepageOtherContent(otherContentToSave)
        ]);
        
        if (mainSuccess && otherSuccess) {
          // Update local state
          setHomepageContent(editedContent);
          setIsEditingHomepage(false);
          
          // Update caches with the edited content
          const homepageCacheData: CachedHomepageContent = {
            hero: editedContent.hero,
            about: editedContent.about,
            mission: editedContent.mission,
            vision: editedContent.vision,
            advocacyPillars: editedContent.advocacyPillars,
            themeSong: editedContent.themeSong,
          };
          saveHomepageContentToCache(homepageCacheData);
          
          const otherCacheData: CachedHomepageOther = {
            orgChartUrl: orgChartUrl,
            contact: editedContent.contact,
          };
          saveHomepageOtherToCache(otherCacheData);
          
          toast.success('Homepage updated successfully!', {
            description: 'All sections have been saved to the database.',
          });
        } else if (mainSuccess || otherSuccess) {
          // Partial success
          setHomepageContent(editedContent);
          setIsEditingHomepage(false);
          toast.warning('Partial Save', {
            description: 'Some sections saved, but others failed. Please check connection.',
          });
        } else {
          // Total failure
          setHomepageContent(editedContent);
          setIsEditingHomepage(false);
          toast.warning('Saved locally only', {
            description: 'Database sync failed. Changes saved locally for now.',
          });
        }
      } catch (error) {
        console.error('[App] Error saving homepage:', error);
        // Still save locally even if API fails
        setHomepageContent(editedContent);
        setIsEditingHomepage(false);
        toast.warning('Saved locally only', {
          description: 'Unable to sync with database. Changes saved locally.',
        });
      } finally {
        setIsSavingHomepage(false);
      }
    };

    // Set active page based on scroll position (optimized with throttle)
    useEffect(() => {
      let ticking = false;
      
      const handleScroll = () => {
        if (!ticking) {
          window.requestAnimationFrame(() => {
            const sections = ["home", "about", "projects", "org-chart", "contact"];
            const scrollPosition = window.scrollY + 100;

            for (const section of sections) {
              const element = document.getElementById(section);
              if (element) {
                const offsetTop = element.offsetTop;
                const offsetBottom = offsetTop + element.offsetHeight;
                if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
                  setActivePage(section);
                  break;
                }
              }
            }
            try {
              localStorage.setItem(LAST_SCROLL_KEY, String(window.scrollY));
            } catch {
              // Ignore storage failures.
            }
            ticking = false;
          });
          ticking = true;
        }
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const currentView = useMemo(() => {
      if (showFeedbackPage) return "feedback";
      if (showMembershipApplicationsPage && isPageAllowed("membership-editor")) return "membership-editor";
      if (showMembershipApplications) return "membership-applications";
      if (showOfficerDirectory && isPageAllowed("officer-directory")) return "officer-directory";
      if (showAttendanceDashboard && isPageAllowed("attendance-dashboard")) return "attendance-dashboard";
      if (showAttendanceRecording && isPageAllowed("attendance-recording")) return "attendance-recording";
      if (showManageEvents && isPageAllowed("manage-events")) return "manage-events";
      if (showMyQRID && isPageAllowed("my-qr-id")) return "my-qr-id";
      if (showAttendanceTransparency && isPageAllowed("attendance-transparency")) return "attendance-transparency";
      if (showMyProfile && isPageAllowed("my-profile")) return "my-profile";
      if (showAnnouncements && isPageAllowed("announcements")) return "announcements";
      if (showAccessLogs && isPageAllowed("access-logs")) return "access-logs";
      if (showSystemTools && isPageAllowed("system-tools")) return "system-tools";
      if (showManageMembers && isPageAllowed("manage-members")) return "manage-members";
      if (showKaagapAIMeet && isPageAllowed("kaagapai-meet")) return "kaagapai-meet";
      if (showSettings && isPageAllowed("settings")) return "settings";
      return activePage;
    }, [
      activePage,
      isPageAllowed,
      showAccessLogs,
      showAnnouncements,
      showAttendanceDashboard,
      showAttendanceRecording,
      showAttendanceTransparency,
      showFeedbackPage,
      showManageEvents,
      showManageMembers,
      showKaagapAIMeet,
      showMembershipApplications,
      showMembershipApplicationsPage,
      showMyProfile,
      showMyQRID,
      showOfficerDirectory,
      showSettings,
      showSystemTools,
    ]);

    useEffect(() => {
      if (!sessionChecked || !hasRestoredViewRef.current) return;
      try {
        localStorage.setItem(LAST_VIEW_KEY, currentView);
      } catch {
        // Ignore storage failures.
      }
    }, [currentView, sessionChecked]);

    const openStoredView = useCallback((view: string) => {
      if (!view) return false;

      switch (view) {
        case "home":
        case "about":
        case "projects":
        case "contact":
        case "org-chart":
          setActivePage(view);
          return true;
        case "feedback":
          setActivePage("feedback");
          setShowFeedbackPage(true);
          return true;
        case "membership-applications":
        setActivePage("membership-applications");
        setShowMembershipApplications(true);
        return true;
      
      // FIXED SECTION START
      // FIXED SECTION START
      case "membership-editor":
        if (isPageAllowed("membership-editor")) {
          setActivePage("membership-editor");
          setShowMembershipApplicationsPage(true);
          return true;
        }
        if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
        return false;
      // FIXED SECTION END
      // FIXED SECTION END

      case "officer-directory":
          if (isPageAllowed("officer-directory")) {
            setActivePage("officer-directory");
            setShowOfficerDirectory(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "attendance-dashboard":
          if (isPageAllowed("attendance-dashboard")) {
            setActivePage("attendance-dashboard");
            setShowAttendanceDashboard(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "attendance-recording":
          if (isPageAllowed("attendance-recording")) {
            setActivePage("attendance-recording");
            setShowAttendanceRecording(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "manage-events":
          if (isPageAllowed("manage-events")) {
            setActivePage("manage-events");
            setShowManageEvents(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "my-qr-id":
        case "my-qrid":
          if (isPageAllowed("my-qr-id")) {
            setActivePage("my-qr-id");
            setShowMyQRID(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "attendance-transparency":
          if (isPageAllowed("attendance-transparency")) {
            setActivePage("attendance-transparency");
            setShowAttendanceTransparency(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "my-profile":
          if (isPageAllowed("my-profile")) {
            setActivePage("my-profile");
            setShowMyProfile(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "announcements":
          if (isPageAllowed("announcements")) {
            setActivePage("announcements");
            setShowAnnouncements(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "access-logs":
          if (isPageAllowed("access-logs")) {
            setActivePage("access-logs");
            setShowAccessLogs(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "system-tools":
          if (isPageAllowed("system-tools")) {
            setActivePage("system-tools");
            setShowSystemTools(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "manage-members":
          if (isPageAllowed("manage-members")) {
            setActivePage("manage-members");
            setShowManageMembers(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "kaagapai-meet":
          if (isPageAllowed("kaagapai-meet")) {
            setActivePage("kaagapai-meet");
            setShowKaagapAIMeet(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        case "settings":
          if (isPageAllowed("settings")) {
            setActivePage("settings");
            setShowSettings(true);
            return true;
          }
          if (PAGE_ACCESS_DEBUG) console.warn("[AccessDebug] Stored view blocked", { view, userRole, isAdmin, pageAccessByPath });
          return false;
        default:
          return false;
      }
    }, [
      isPageAllowed,
      setActivePage,
      setShowAccessLogs,
      setShowAnnouncements,
      setShowAttendanceDashboard,
      setShowAttendanceRecording,
      setShowAttendanceTransparency,
      setShowFeedbackPage,
      setShowManageEvents,
      setShowManageMembers,
      setShowKaagapAIMeet,
      setShowMembershipApplications,
      setShowMembershipApplicationsPage,
      setShowMyProfile,
      setShowMyQRID,
      setShowOfficerDirectory,
      setShowSettings,
      setShowSystemTools,
      userRole,
      isAdmin,
      pageAccessByPath,
    ]);

    useEffect(() => {
      if (!sessionChecked || hasRestoredViewRef.current) return;

      let storedView: string | null = null;
      let storedScroll: string | null = null;
      try {
        storedView = localStorage.getItem(LAST_VIEW_KEY);
        storedScroll = localStorage.getItem(LAST_SCROLL_KEY);
      } catch {
        hasRestoredViewRef.current = true;
        return;
      }

      if (storedScroll) {
        const parsed = Number(storedScroll);
        if (!Number.isNaN(parsed)) {
          pendingScrollRestoreRef.current = parsed;
        }
      }

      if (!currentPage && storedView) {
        const opened = openStoredView(storedView);
        if (!opened) {
          setActivePage("home");
        }
      }

      hasRestoredViewRef.current = true;
    }, [currentPage, openStoredView, sessionChecked]);

    useEffect(() => {
      if (hasRestoredScrollRef.current) return;
      if (pendingScrollRestoreRef.current === null) return;
      if (isLoadingHomepage || isLoadingProjects) return;

      const targetScroll = pendingScrollRestoreRef.current;
      const timer = window.setTimeout(() => {
        window.scrollTo({ top: targetScroll, behavior: "auto" });
        hasRestoredScrollRef.current = true;
      }, 0);

      return () => window.clearTimeout(timer);
    }, [currentView, isLoadingHomepage, isLoadingProjects]);

    // Check for Full PWA Maintenance Mode (blocks logged-in features only)
    // Public home page remains accessible with Login and Feedback buttons (if not in maintenance)
    const isFullMaintenance = isFullPWAInMaintenance();
    const fullMaintenanceConfig = getFullPWAMaintenanceConfig();
    
    // Auto-logout users when full PWA maintenance is enabled
    useEffect(() => {
      if (isFullMaintenance && isAdmin) {
        toast.warning("System Under Maintenance", {
          description: "You have been logged out due to system maintenance",
        });
        handleLogout();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isFullMaintenance]);

    const projectsContent = useMemo(() => {
      if (isLoadingProjects) {
        return <SkeletonCardGrid count={6} />;
      }

      if (projects.length === 0) {
        return (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400 mb-2">No Projects Yet</h3>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {isAdmin ? "Click 'Add Project' to create your first project" : "Check back soon for upcoming projects!"}
            </p>
          </div>
        );
      }

      return (
        <div 
          className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" 
          style={{ 
            WebkitOverflowScrolling: 'touch', 
            whiteSpace: 'nowrap', 
            paddingBottom: 8, 
            minHeight: 370,
            willChange: 'transform', // Optimize for scrolling
          }}
        >
          {projects.map((project, index) => (
            <LazyProjectCard key={project.projectId} index={index}>
              <GlowingCard
                isDark={isDark}
                glowOnHover={true}
                className={`overflow-hidden cursor-pointer transition-all duration-250 hover:scale-[1.03] relative ${
                  selectedProjectIds.includes(project.projectId) ? "ring-2 ring-blue-500 ring-offset-2" : ""
                }`}
              >
                {/* Checkbox for Admin */}
                {isAdmin && (
                  <div
                    className="absolute top-3 left-3 z-10 flex gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-800 rounded-md shadow-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedProjectIds.includes(project.projectId)}
                        onChange={() => toggleProjectSelection(project.projectId)}
                        className="sr-only"
                      />
                      {selectedProjectIds.includes(project.projectId) && (
                        <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </label>
                    <button
                      onClick={() => startEditProject(project)}
                      className="flex items-center justify-center w-6 h-6 bg-white dark:bg-gray-800 rounded-md shadow-lg cursor-pointer border-2 border-gray-300 dark:border-gray-600 hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors"
                      title="Edit project"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-orange-500" />
                    </button>
                  </div>
                )}
                <div 
                  onClick={() => openProjectModal(project)}
                  className="w-full"
                >
                  <div className="w-full h-48 overflow-hidden relative">
                    <ImageWithFallback
                      src={project.imageUrl}
                      alt={project.title}
                      className="w-full h-full object-cover object-center transition-transform duration-300 hover:scale-110"
                    />
                  </div>
                  <div className="p-4">
                    <h3
                      className="mb-2 line-clamp-2"
                      style={{
                        fontFamily: "var(--font-headings)",
                        fontSize: "1.125rem",
                        fontWeight: "var(--font-weight-bold)",
                        color: "#f6421f",
                        lineHeight: "1.4",
                      }}
                    >
                      <FormattedText text={project.title} />
                    </h3>
                    <div
                      className="text-sm text-gray-600 dark:text-gray-400 line-clamp-3"
                      style={{ lineHeight: "1.5" }}
                    >
                      <FormattedText text={project.description} />
                    </div>
                  </div>
                </div>
              </GlowingCard>
            </LazyProjectCard>
          ))}
        </div>
      );
    }, [isAdmin, isDark, isLoadingProjects, openProjectModal, projects, selectedProjectIds, startEditProject, toggleProjectSelection]);

    // Handler for chatbot to trigger profile edit mode
    const handleTriggerProfileEditMode = () => {
      if (showMyProfile) {
        setTriggerProfileEditMode(true);
        // Reset the trigger after a short delay
        setTimeout(() => setTriggerProfileEditMode(false), 100);
      }
    };

    const chatbotForceHidden =
      isEditingProfile ||
      isEditingHomepage ||
      accessLogsModalOpen ||
      issuanceModalOpen ||
      attendanceDashboardModalOpen ||
      manageEventsModalOpen ||
      attendanceTransparencyModalOpen ||
      !!modalProject ||
      showLoginPanel ||
      showFounderModal ||
      showDeveloperModal ||
      membershipAppsModalOpen ||
      manageMembersModalOpen ||
      systemToolsModalOpen;

    useEffect(() => {
      document.body.classList.toggle("ysp-modal-open", chatbotForceHidden);
      return () => {
        document.body.classList.remove("ysp-modal-open");
      };
    }, [chatbotForceHidden]);

    const chatbot = (
      <>
        <YSPChatBot
          userRole={userRole}
          orgChartUrl={orgChartUrl}
          onOfficerDirectorySearch={handleOfficerDirectorySearch}
          onRequestCacheClear={handleRequestCacheClear}
          currentPage={activePage}
          hidden={chatbotForceHidden}
          onTriggerEditMode={handleTriggerProfileEditMode}
          attendanceDashboardContext={attendanceDashboardContext}
          isDark={isDark}
        />
        {showLoginPrepLoader && (
          <LoadingScreen
            isDark={false}
            steps={loginPrepSteps}
            onComplete={() => setShowLoginPrepLoader(false)}
          />
        )}
      </>
    );

    const getPageLoadingFallback = (pageName: string) => (
      <LoadingScreen
        isDark={isDark}
        steps={[
          {
            id: `${pageName.toLowerCase().replace(/\s+/g, "-")}-loading`,
            label: `Opening ${pageName}`,
            status: "loading",
          },
        ]}
        statusPhrases={[
          `Opening ${pageName}...`,
          `Preparing ${pageName}...`,
          `Loading ${pageName} content...`,
        ]}
      />
    );

    // Show Full PWA Maintenance Screen (for non-admin users)
    if (isFullMaintenance && !isAdmin) {
      return (
        <>
          <MaintenanceScreen
            isDark={isDark}
            message={fullMaintenanceConfig.message}
            estimatedTime={fullMaintenanceConfig.estimatedTime}
            isFullPWA={true}
            pageName="Youth Service Philippines Tagum Chapter Web Portal"
            onContactDeveloper={() => setShowDeveloperModal(true)}
          />
          <Suspense fallback={null}>
            <DeveloperModal
              isOpen={showDeveloperModal}
              onClose={() => setShowDeveloperModal(false)}
              isDark={isDark}
              isAdmin={isAdmin}
            />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show Feedback page if flag is true
    if (showFeedbackPage) {
      if (isPageInMaintenance("feedback")) {
        const config = getPageMaintenanceConfig("feedback");
        return (
          <>
            <MaintenanceScreen
              isDark={isDark}
              message={config.message}
              estimatedTime={config.estimatedTime}
              onBack={() => setShowFeedbackPage(false)}
              pageName="Feedback"
              onContactDeveloper={() => setShowDeveloperModal(true)}
            />
            <Suspense fallback={null}>
              <DeveloperModal
                isOpen={showDeveloperModal}
                onClose={() => setShowDeveloperModal(false)}
                isDark={isDark}
                isAdmin={isAdmin}
              />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster
            position="top-center"
            richColors
            closeButton
            theme={isDark ? "dark" : "light"}
            toastOptions={{
              style: {
                fontFamily: "var(--font-sans)",
              },
            }}
          />
          <Suspense fallback={getPageLoadingFallback("Feedback")}>
            <FeedbackPage
              onClose={() => setShowFeedbackPage(false)}
              isAdmin={userRole === 'admin' || userRole === 'auditor'}
              isDark={isDark}
              userRole={userRole}
              username={userUsername || 'guest'}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
              initialFeedbackId={deepLinkParams.id}
              buildShareableUrl={buildShareableUrl}
            />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show Membership Applications page if flag is true
    if (showMembershipApplicationsPage && isPageAllowed("membership-editor")) {
      if (isPageInMaintenance("membership-editor")) {
        const config = getPageMaintenanceConfig("membership-editor");
        return (
          <>
            <MaintenanceScreen
              isDark={isDark}
              message={config.message}
              estimatedTime={config.estimatedTime}
              pageName="Membership Application Form Editor"
              onBack={() => setShowMembershipApplicationsPage(false)}
              onContactDeveloper={() => setShowDeveloperModal(true)}
            />
            <Suspense fallback={null}>
              <DeveloperModal
                isOpen={showDeveloperModal}
                onClose={() => setShowDeveloperModal(false)}
                isDark={isDark}
                isAdmin={isAdmin}
              />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster
            position="top-center"
            richColors
            closeButton
            theme={isDark ? "dark" : "light"}
            toastOptions={{
              style: {
                fontFamily: "var(--font-sans)",
              },
            }}
          />
          <Suspense fallback={getPageLoadingFallback("Applications")}>
            <MembershipApplicationsPage
              onClose={() => setShowMembershipApplicationsPage(false)}
              isDark={isDark}
              userRole={userRole}
              isLoggedIn={isAdmin || userRole !== 'guest'}
              pendingApplications={pendingApplications}
              setPendingApplications={setPendingApplications}
              username={userUsername || 'admin'}
              onModalStateChange={setMembershipAppsModalOpen}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
            />
          </Suspense>
          <UploadToastContainer messages={uploadToastMessages} onDismiss={removeUploadToast} isDark={isDark} />
          {chatbot}
        </>
      );
    }

    // Show Officer Directory page
    if (showOfficerDirectory && isPageAllowed("officer-directory")) {
      if (isPageInMaintenance("officer-directory")) {
        const config = getPageMaintenanceConfig("officer-directory");
        return (
          <>
            <MaintenanceScreen
              isDark={isDark}
              message={config.message}
              estimatedTime={config.estimatedTime}
              pageName="Officer Directory"
              onBack={() => setShowOfficerDirectory(false)}
              onContactDeveloper={() => setShowDeveloperModal(true)}
            />
            <Suspense fallback={null}>
              <DeveloperModal
                isOpen={showDeveloperModal}
                onClose={() => setShowDeveloperModal(false)}
                isDark={isDark}
                isAdmin={isAdmin}
              />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster
            position="top-center"
            richColors
            closeButton
            theme={isDark ? "dark" : "light"}
            toastOptions={{
              style: {
                fontFamily: "var(--font-sans)",
              },
            }}
          />
          <Suspense fallback={getPageLoadingFallback("Officer Directory")}>
            <OfficerDirectoryPage
              onClose={() => setShowOfficerDirectory(false)}
              isDark={isDark}
              searchRequest={directorySearchRequest}
            />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show Attendance Dashboard page
    if (showAttendanceDashboard && isPageAllowed("attendance-dashboard")) {
      if (isPageInMaintenance("attendance-dashboard")) {
        const config = getPageMaintenanceConfig("attendance-dashboard");
        return (
          <>
            <MaintenanceScreen
              isDark={isDark}
              message={config.message}
              estimatedTime={config.estimatedTime}
              pageName="Attendance Dashboard"
              onBack={() => setShowAttendanceDashboard(false)}
              onContactDeveloper={() => setShowDeveloperModal(true)}
            />
            <Suspense fallback={null}>
              <DeveloperModal
                isOpen={showDeveloperModal}
                onClose={() => setShowDeveloperModal(false)}
                isDark={isDark}
                isAdmin={isAdmin}
              />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster
            position="top-center"
            richColors
            closeButton
            theme={isDark ? "dark" : "light"}
            toastOptions={{
              style: {
                fontFamily: "var(--font-sans)",
              },
            }}
          />
          <Suspense fallback={getPageLoadingFallback("Attendance Dashboard")}>
            <AttendanceDashboardPage
              onClose={() => setShowAttendanceDashboard(false)}
              isDark={isDark}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
              onDashboardContextUpdate={setAttendanceDashboardContext}
              onModalStateChange={setAttendanceDashboardModalOpen}
            />
          </Suspense>
          {/* Upload Toast Container for export progress */}
          <UploadToastContainer
            messages={uploadToastMessages}
            onDismiss={removeUploadToast}
            isDark={isDark}
          />
          {chatbot}
        </>
      );
    }

    // Show QR Scanner page
    // Show Attendance Recording page (combined QR + Manual)
    if (showAttendanceRecording && isPageAllowed("attendance-recording")) {
      if (isPageInMaintenance("attendance-recording")) {
        const config = getPageMaintenanceConfig("attendance-recording");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Attendance Recording" onBack={() => setShowAttendanceRecording(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("Attendance Recording")}>
            <AttendanceRecordingPage 
              onClose={() => setShowAttendanceRecording(false)} 
              isDark={isDark}
              initialEventId={deepLinkParams.eventId}
              initialMode={deepLinkParams.mode}
              buildShareableUrl={buildShareableUrl}
            />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show Manage Events page
    if (showManageEvents && isPageAllowed("manage-events")) {
      if (isPageInMaintenance("manage-events")) {
        const config = getPageMaintenanceConfig("manage-events");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Manage Events" onBack={() => setShowManageEvents(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("Manage Events")}>
            <ManageEventsPage 
              onClose={() => setShowManageEvents(false)} 
              isDark={isDark} 
              username={userUsername || 'admin'} 
              onModalStateChange={setManageEventsModalOpen}
              initialEventId={deepLinkParams.eventId}
              buildShareableUrl={buildShareableUrl}
            />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show My QR ID page
    if (showMyQRID && isPageAllowed("my-qr-id")) {
      if (isPageInMaintenance("my-qr-id") || isPageInMaintenance("my-qrid")) {
        const config = isPageInMaintenance("my-qr-id")
          ? getPageMaintenanceConfig("my-qr-id")
          : getPageMaintenanceConfig("my-qrid");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="My QR ID" onBack={() => setShowMyQRID(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <MyQRIDPage 
            onClose={() => setShowMyQRID(false)} 
            isDark={isDark}
            addUploadToast={addUploadToast}
            updateUploadToast={updateUploadToast}
            removeUploadToast={removeUploadToast}
          />
          <UploadToastContainer messages={uploadToastMessages} onDismiss={removeUploadToast} isDark={isDark} />
          {chatbot}
        </>
      );
    }

    // Show Attendance Transparency page
    if (showAttendanceTransparency && isPageAllowed("attendance-transparency")) {
      if (isPageInMaintenance("attendance-transparency")) {
        const config = getPageMaintenanceConfig("attendance-transparency");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Attendance Transparency" onBack={() => setShowAttendanceTransparency(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("Attendance Transparency")}>
            <AttendanceTransparencyPage onClose={() => setShowAttendanceTransparency(false)} isDark={isDark} userName={userName} memberId={userIdCode} />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show My Profile page
    if (showMyProfile && isPageAllowed("my-profile")) {
      if (isPageInMaintenance("my-profile")) {
        const config = getPageMaintenanceConfig("my-profile");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="My Profile" onBack={() => setShowMyProfile(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("My Profile")}>
            <MyProfilePage 
              onClose={() => {
                setShowMyProfile(false);
                setIsEditingProfile(false);
              }} 
              onOpenSettings={
                isPageAllowed("settings")
                  ? () => {
                      setActivePage("settings");
                      setShowSettings(true);
                      setShowMyProfile(false);
                    }
                  : undefined
              }
              isDark={isDark}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
              onProfilePictureChange={(newUrl) => setUserProfilePicture(newUrl)}
              onEditingChange={setIsEditingProfile}
              startInEditMode={triggerProfileEditMode}
            />
          </Suspense>
          <UploadToastContainer
            messages={uploadToastMessages}
            onDismiss={removeUploadToast}
            isDark={isDark}
          />
          {chatbot}
        </>
      );
    }

    // Show Announcements page
    if (showAnnouncements && isPageAllowed("announcements")) {
      if (isPageInMaintenance("announcements")) {
        const config = getPageMaintenanceConfig("announcements");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Announcements" onBack={() => setShowAnnouncements(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("Announcements")}>
            <AnnouncementsPage 
              onClose={() => setShowAnnouncements(false)} 
              isDark={isDark} 
              userRole={userRole} 
              username={userUsername || 'admin'}
              initialAnnouncementId={deepLinkParams.id}
              buildShareableUrl={buildShareableUrl}
            />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show Issuance Center page
    if (showIssuanceCenter && isPageAllowed("issuance-center")) {
      if (isPageInMaintenance("issuance")) {
        const config = getPageMaintenanceConfig("issuance");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Issuance Center" onBack={() => setShowIssuanceCenter(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("Issuance Center")}>
            <IssuanceCenterPage 
              onClose={() => setShowIssuanceCenter(false)} 
              isDark={isDark} 
              userRole={userRole} 
              username={userUsername || 'admin'} 
              userEmail={userEmail} 
              userProfilePicture={userProfilePicture} 
              onModalStateChange={setIssuanceModalOpen}
              initialIssuanceId={deepLinkParams.id}
              buildShareableUrl={buildShareableUrl}
            />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show Access Logs page
    if (showAccessLogs && isPageAllowed("access-logs")) {
      if (isPageInMaintenance("access-logs")) {
        const config = getPageMaintenanceConfig("access-logs");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Access Logs" onBack={() => setShowAccessLogs(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("Access Logs")}>
            <AccessLogsPage 
              onClose={() => setShowAccessLogs(false)} 
              isDark={isDark} 
              username={userUsername || 'admin'} 
              addUploadToast={addUploadToast} 
              updateUploadToast={updateUploadToast} 
              removeUploadToast={removeUploadToast}
              onModalStateChange={setAccessLogsModalOpen}
            />
          </Suspense>
          <UploadToastContainer messages={uploadToastMessages} onDismiss={removeUploadToast} isDark={isDark} />
          {chatbot}
        </>
      );
    }

    // Show System Tools page
    if (showSystemTools && isPageAllowed("system-tools")) {
      if (isPageInMaintenance("system-tools")) {
        const config = getPageMaintenanceConfig("system-tools");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="System Tools" onBack={() => setShowSystemTools(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("System Tools")}>
            <SystemToolsPage 
              onClose={() => setShowSystemTools(false)} 
              isDark={isDark} 
              username={userUsername || 'admin'}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              onModalStateChange={setSystemToolsModalOpen}
            />
          </Suspense>
          <UploadToastContainer messages={uploadToastMessages} onDismiss={removeUploadToast} isDark={isDark} />
          {chatbot}
        </>
      );
    }

    // Show Manage Members page
    if (showManageMembers && isPageAllowed("manage-members")) {
      if (isPageInMaintenance("manage-members")) {
        const config = getPageMaintenanceConfig("manage-members");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Manage Members" onBack={() => setShowManageMembers(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("Manage Members")}>
            <ManageMembersPage onClose={() => setShowManageMembers(false)} isDark={isDark} pendingApplications={pendingApplications} setPendingApplications={setPendingApplications} currentUserName={userUsername || userName} onModalStateChange={setManageMembersModalOpen} />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show KaagapAI Meet page
    if (showKaagapAIMeet && isPageAllowed("kaagapai-meet")) {
      if (isPageInMaintenance("kaagapai-meet")) {
        const config = getPageMaintenanceConfig("kaagapai-meet");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="KaagapAI Meet" onBack={() => setShowKaagapAIMeet(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("KaagapAI Meet")}>
            <KaagapAIMeetPage
              onClose={() => setShowKaagapAIMeet(false)}
              isDark={isDark}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
            />
          </Suspense>
          {chatbot}
        </>
      );
    }

    // Show Membership Applications page
    if (showMembershipApplications) {
      if (isPageInMaintenance("membership-applications")) {
        const config = getPageMaintenanceConfig("membership-applications");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Membership Applications" onBack={() => setShowMembershipApplications(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={getPageLoadingFallback("Membership Applications")}>
            <MembershipApplicationsPage onClose={() => setShowMembershipApplications(false)} isDark={isDark} userRole={userRole} isLoggedIn={isAdmin || userRole !== 'guest'} pendingApplications={pendingApplications} setPendingApplications={setPendingApplications} username={userUsername || 'admin'} onModalStateChange={setMembershipAppsModalOpen} addUploadToast={addUploadToast} updateUploadToast={updateUploadToast} removeUploadToast={removeUploadToast} />
          </Suspense>
          <UploadToastContainer messages={uploadToastMessages} onDismiss={removeUploadToast} isDark={isDark} />
          {chatbot}
        </>
      );
    }

    // Show Settings page
    if (showSettings && isPageAllowed("settings")) {
      if (isPageInMaintenance("settings")) {
        const config = getPageMaintenanceConfig("settings");
        return (
          <>
            <MaintenanceScreen
              isDark={isDark}
              message={config.message}
              estimatedTime={config.estimatedTime}
              pageName="Settings"
              onBack={() => setShowSettings(false)}
              onContactDeveloper={() => setShowDeveloperModal(true)}
            />
            <Suspense fallback={null}>
              <DeveloperModal
                isOpen={showDeveloperModal}
                onClose={() => setShowDeveloperModal(false)}
                isDark={isDark}
                isAdmin={isAdmin}
              />
            </Suspense>
            {chatbot}
          </>
        );
      }
      return (
        <>
          <Toaster
            position="top-center"
            richColors
            closeButton
            theme={isDark ? "dark" : "light"}
            toastOptions={{
              style: {
                fontFamily: "var(--font-sans)",
              },
            }}
          />
          <Suspense fallback={getPageLoadingFallback("Settings")}>
            <SettingsPage
              onClose={() => setShowSettings(false)}
              isDark={isDark}
              onToggleDark={toggleDark}
              onRequestCacheClear={handleRequestCacheClear}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
            />
          </Suspense>
          <UploadToastContainer messages={uploadToastMessages} onDismiss={removeUploadToast} isDark={isDark} />
          <CacheRefreshModal
            isOpen={showCacheRefreshModal}
            isDark={isDark}
            onConfirm={handleConfirmHardRefresh}
            onClose={handleDismissHardRefresh}
          />
          <SessionRecoveryModal
            isOpen={showSessionRecoveryModal}
            isDark={isDark}
            onRelogin={handleReloginFromSessionRecovery}
            onHardRefresh={handleHardRefreshFromSessionRecovery}
          />
          {roleChangeInfo && (
            <RoleChangeModal
              isOpen={showRoleChangeModal}
              isDark={isDark}
              changeType={roleChangeInfo.changeType}
              oldRole={roleChangeInfo.oldRole}
              newRole={roleChangeInfo.newRole}
              userName={userName}
              onConfirm={handleConfirmRoleChange}
              onClose={handleDismissRoleChange}
            />
          )}
          {chatbot}
        </>
      );
    }

    const isDefaultHeroHeading =
      homepageContent.hero.mainHeading === "Welcome to Youth Service Philippines" &&
      homepageContent.hero.subHeading === "Tagum Chapter";
    const heroMainHeading = isDefaultHeroHeading
      ? "Youth Service Philippines Tagum Portal"
      : homepageContent.hero.mainHeading;
    const heroSubHeading = isDefaultHeroHeading ? "" : homepageContent.hero.subHeading;
    const normalizedThemeSongUrl = normalizeThemeSongUrl(homepageContent.themeSong.url);
    const themeSongTitle = homepageContent.themeSong.title;
    const themeSongUrl = normalizedThemeSongUrl;

    return (
      <div className="min-h-screen transition-colors duration-300" style={{ 
        overflow: 'visible',
        background: isDark ? '#0f172a' : '#f8fafc'
      }}>

      {/* ⬇️ PASTE THIS BLOCK HERE ⬇️ */}
        <Helmet>
          <title>{seoMeta.title}</title>
          <meta name="description" content={seoMeta.description} />
          <meta name="keywords" content={seoMeta.keywords} />
          <meta name="robots" content={robotsContent} />
          <link rel="canonical" href={canonicalUrl} />
          <meta property="og:type" content="website" />
          <meta property="og:site_name" content={SITE_NAME} />
          <meta property="og:title" content={seoMeta.title} />
          <meta property="og:description" content={seoMeta.description} />
          <meta property="og:url" content={canonicalUrl} />
          <meta property="og:image" content={DEFAULT_OG_IMAGE} />
          <meta property="og:locale" content="en_PH" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={seoMeta.title} />
          <meta name="twitter:description" content={seoMeta.description} />
          <meta name="twitter:image" content={DEFAULT_OG_IMAGE} />
          <script type="application/ld+json">{websiteJsonLd}</script>
        </Helmet>
        {/* ⬆️ END PASTE ⬆️ */}

        {/* Animated Background Blobs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-200/40 dark:bg-orange-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob" />
          <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-yellow-200/40 dark:bg-yellow-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
          <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-red-200/40 dark:bg-red-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-4000" />
          <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-pink-200/40 dark:bg-pink-500/10 rounded-full mix-blend-multiply dark:mix-blend-normal filter blur-3xl opacity-70 animate-blob animation-delay-6000" />
        </div>

        {/* Toast Notifications */}
        <Toaster
          position="top-center"
          richColors
          closeButton
          theme={isDark ? "dark" : "light"}
          toastOptions={{
            style: {
              fontFamily: "var(--font-sans)",
            },
          }}
        />
        <PwaInstallPrompt enabled={!isAdmin && activePage === "home"} delayMs={800} />

        {/* Music Player */}
        <MusicPlayer
          themeSongUrl={themeSongUrl}
          themeSongTitle={themeSongTitle}
          isVisible={Boolean(themeSongUrl) && !isAdmin}
          isDark={isDark}
        />

        {/* Top Bar - Floating Header - Only on Homepage */}
        {!showOfficerDirectory && !showAttendanceDashboard && !showAttendanceRecording && 
        !showManageEvents && !showMyQRID && 
        !showAttendanceTransparency && !showAnnouncements && !showIssuanceCenter && !showAccessLogs && 
        !showSystemTools && !showManageMembers && !showFeedbackPage && 
        !showMembershipApplicationsPage && !showMyProfile && !showSettings && !showKaagapAIMeet && (
          <TopBar
            isDark={isDark}
            onToggleDark={toggleDark}
            isMenuOpen={isMenuOpen}
            onToggleMenu={() => {
              setIsSidebarOpen(!isSidebarOpen);
            }}
            logoUrl={logoError ? fallbackLogoUrl : primaryLogoUrl}
            fallbackLogoUrl={fallbackLogoUrl}
            onHomeClick={() => {
              setActivePage("home");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onAboutClick={() => {
              setActivePage("about");
              document.getElementById("about")?.scrollIntoView({ behavior: "smooth" });
            }}
            onProjectsClick={() => {
              setActivePage("projects");
              document.getElementById("projects")?.scrollIntoView({ behavior: "smooth" });
            }}
            onContactClick={() => {
              setActivePage("contact");
              document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" });
            }}
            onOrgChartClick={() => {
              setActivePage("org-chart");
              document.getElementById("org-chart")?.scrollIntoView({ behavior: "smooth" });
            }}
            onFeedbackClick={() => {
              setActivePage("feedback");
              setShowFeedbackPage(true);
            }}
            onLoginClick={() => {
              setShowLoginPanel(true);
            }}
            onLogoutClick={handleLogout}
            isLoggedIn={isAdmin}
            activePage={activePage}
          />
        )}

        {/* Sidebar - Always Visible (Desktop and Mobile) */}
        <SideBar
          isDark={isDark}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          navigationGroups={visibleGroups}
          activePage={activePage}
          openMobileGroup={openMobileGroup}
          onMobileGroupToggle={setOpenMobileGroup}
          isLoggedIn={isAdmin}
          userRole={userRole}
          userName={userName}
          userProfilePicture={userProfilePicture}
          onToggleDark={toggleDark}
          onProfileClick={() => {
            if (!isPageAllowed("my-profile")) {
              if (PAGE_ACCESS_DEBUG) {
                console.warn("[AccessDebug] Profile click blocked", {
                  pageId: "my-profile",
                  backendPath: PAGE_BACKEND_PATHS["my-profile"],
                  userRole,
                  isAdmin,
                  pageAccessByPath,
                });
              }
              setIsSidebarOpen(false);
              return;
            }
            setActivePage("my-profile");
            setShowMyProfile(true);
            setIsSidebarOpen(false);
          }}
          onLogout={handleLogout}
          onHomeClick={() => {
            setActivePage("home");
            // Close all page views
            setShowOfficerDirectory(false);
            setShowAttendanceDashboard(false);
            setShowAttendanceRecording(false);
            setShowManageEvents(false);
            setShowMyQRID(false);
            setShowAttendanceTransparency(false);
            setShowAnnouncements(false);
            setShowIssuanceCenter(false);
            setShowAccessLogs(false);
            setShowSystemTools(false);
            setShowFeedbackPage(false);
            setShowMyProfile(false);
            setShowKaagapAIMeet(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          onLoginClick={() => {
            setShowLoginPanel(true);
            setIsSidebarOpen(false);
          }}
          logoUrl={logoError ? fallbackLogoUrl : primaryLogoUrl}
        />

        {/* Top Controls when logged in */}
        {isAdmin && (
          <>
            {/* Hamburger - Fixed Top LEFT (Mobile Only) - Hide when sidebar is open */}
            {!isSidebarOpen && (
              <div className="md:hidden fixed top-4 left-4" style={{ zIndex: 45 }}>
                <AnimatedHamburger
                  isOpen={isSidebarOpen}
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  isDark={isDark}
                  className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md shadow-lg border border-gray-200 dark:border-gray-800"
                />
              </div>
            )}

            {/* Theme Toggle - Fixed Top RIGHT (Mobile Only) - Hide when sidebar is open */}
            {!isSidebarOpen && (
              <div className="md:hidden fixed top-4 right-4" style={{ zIndex: 45 }}>
                <button
                  onClick={toggleDark}
                  className="p-2 rounded-lg bg-white/80 dark:bg-gray-900/80 backdrop-blur-md hover:bg-white dark:hover:bg-gray-900 transition-all shadow-lg border border-gray-200 dark:border-gray-800"
                  aria-label="Toggle dark mode"
                >
                  {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            )}
          </>
        )}

        {/* Main Content - Adjusted for sidebar when logged in */}
        <div className={`relative z-10 transition-all duration-300 ${isAdmin ? 'md:pl-[60px]' : ''}`}>
          {/* Edit Homepage Controls - Fixed Position */}
          {(userRole === 'admin' || userRole === 'auditor') && !isEditingHomepage && (
            <div
              className="fixed"
              style={{
                zIndex: 45,
                bottom: "24px",
                left: isAdmin ? "76px" : "24px",
              }}
            >
              <button
                onClick={handleStartEditing}
                className="flex items-center justify-center px-3 py-2 rounded-lg text-white transition-all duration-300 shadow-md"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
                aria-label="Edit homepage"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Save/Cancel Controls - Fixed Position */}
          {isEditingHomepage && (
            <div
              className="fixed flex flex-col gap-3"
              style={{
                zIndex: 45,
                bottom: "24px",
                left: isAdmin ? "76px" : "24px",
              }}
            >
              <button
                onClick={handleCancelEditing}
                disabled={isSavingHomepage}
                className="flex items-center justify-center px-3 py-2 rounded-lg text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
                aria-label="Cancel homepage edits"
              >
                <X className="w-5 h-5" />
              </button>
              <button
                onClick={handleSaveEditing}
                disabled={isSavingHomepage}
                className="flex items-center justify-center px-3 py-2 rounded-lg text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
                aria-label="Save homepage edits"
              >
                {isSavingHomepage ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
              </button>
            </div>
          )}

          {/* Hero Section */}
          <section
            id="home"
            className={`text-center pb-12 md:pb-20 px-4 md:px-6 relative transition-all duration-300 ${isAdmin ? 'pt-24 md:pt-28' : isFullMaintenance ? 'pt-36 md:pt-40' : 'pt-28 md:pt-32'}`}
          >
          {/* Error State for Homepage Content */}
          {homepageError && !isLoadingHomepage && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <p className="text-amber-700 dark:text-amber-300 text-sm flex-1">{homepageError}</p>
                <button
                  onClick={retryLoadHomepage}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-100 dark:bg-amber-800/50 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            </div>
          )}

          <div className="max-w-4xl mx-auto">
            {isEditingHomepage ? (
              // Edit Mode - Hero Section
              <>
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2 text-left">Main Heading</label>
                  <input
                    type="text"
                    value={editedContent.hero.mainHeading}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        hero: { ...editedContent.hero, mainHeading: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    style={{
                      fontFamily: "var(--font-headings)",
                      fontWeight: "var(--font-weight-bold)",
                      fontSize: "1.5rem",
                    }}
                  />
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2 text-left">Sub Heading</label>
                  <input
                    type="text"
                    value={editedContent.hero.subHeading}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        hero: { ...editedContent.hero, subHeading: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    style={{
                      fontFamily: "var(--font-headings)",
                      fontWeight: "600",
                      fontSize: "1.25rem",
                    }}
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2 text-left">Tagline</label>
                  <textarea
                    value={editedContent.hero.tagline}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        hero: { ...editedContent.hero, tagline: e.target.value },
                      })
                    }
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2 text-left">Theme Song Title</label>
                  <input
                    type="text"
                    value={editedContent.themeSong.title}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        themeSong: { ...editedContent.themeSong, title: e.target.value },
                      })
                    }
                    className="w-full px-4 py-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="mb-6">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2 text-left">Theme Song Audio URL</label>
                  <input
                    type="url"
                    value={editedContent.themeSong.url}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        themeSong: { ...editedContent.themeSong, url: e.target.value },
                      })
                    }
                    placeholder="https://example.com/theme-song.mp3"
                    className="w-full px-4 py-3 rounded-xl border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </>
            ) : (
              // Display Mode - Hero Section
              <>
                <h1
                  className="text-3xl sm:text-4xl lg:text-5xl mb-4 tracking-tight"
                  style={{
                    fontFamily: "var(--font-headings)",
                    fontWeight: "var(--font-weight-bold)",
                    color: "#f6421f",
                    lineHeight: "1.3",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {heroMainHeading}
                  {heroSubHeading.trim().length > 0 ? (
                    <>
                      <br />
                      <span
                        className="text-2xl sm:text-3xl lg:text-4xl"
                        style={{
                          color: "#ee8724",
                          fontWeight: "600",
                        }}
                      >
                        {heroSubHeading}
                      </span>
                    </>
                  ) : null}
                </h1>

                <p
                  className="text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto"
                  style={{ lineHeight: "1.5" }}
                >
                  {homepageContent.hero.tagline}
                </p>
              </>
            )}

            {/* Button Group - Hide Login and Opportunities when logged in */}
            {!isAdmin && (
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
                {/* Primary Button - Log In */}
                <button
                  onClick={() => setShowLoginPanel(true)}
                  className="w-full sm:w-44 h-12 px-6 rounded-xl text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl flex items-center justify-center"
                  style={{
                    background:
                      "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                    fontWeight: "600",
                    fontSize: "16px",
                    boxShadow: "0 4px 12px rgba(246, 66, 31, 0.3)",
                  }}
                >
                  Log In
                </button>

                {/* Secondary Button - Opportunities */}
                <button
                  onClick={() => setShowMembershipApplications(true)}
                  className="w-full sm:w-44 h-12 px-5 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg flex items-center justify-center"
                  style={{
                    color: "#f6421f",
                    border: "2px solid #f6421f",
                    background: "transparent",
                    fontWeight: "600",
                    fontSize: "16px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background =
                      "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)";
                    e.currentTarget.style.color = "white";
                    e.currentTarget.style.borderColor =
                      "transparent";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background =
                      "transparent";
                    e.currentTarget.style.color = "#f6421f";
                    e.currentTarget.style.borderColor = "#f6421f";
                  }}
                >
                  Opportunities!
                </button>
              </div>
            )}
          </div>
        </section>

        {/* About Section */}
        <section
          id="about"
          className="max-w-6xl mx-auto px-4 md:px-6 mb-8 relative"
        >
          {isLoadingHomepage ? (
            <SkeletonSection lines={5} />
          ) : (
          <div className="ysp-card p-6 md:p-8">
            {isEditingHomepage ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Section Title</label>
                  <input
                    type="text"
                    value={editedContent.about.title}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        about: { ...editedContent.about, title: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    style={{
                      fontFamily: "var(--font-headings)",
                      fontWeight: "var(--font-weight-bold)",
                      fontSize: "1.25rem",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Content</label>
                  <textarea
                    value={editedContent.about.content}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        about: { ...editedContent.about, content: e.target.value },
                      })
                    }
                    rows={8}
                    className="w-full px-4 py-3 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </>
            ) : (
              <>
                <h2
                  className="mb-4 text-left"
                  style={{
                    fontFamily: "var(--font-headings)",
                    fontSize: "1.5rem",
                    fontWeight: "var(--font-weight-bold)",
                    color: "#f6421f",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {homepageContent.about.title}
                </h2>

                <p
                  className="text-justify text-gray-800 dark:text-gray-100"
                  style={{
                    fontSize: "1rem",
                    lineHeight: "1.625",
                    letterSpacing: "0.01em",
                    fontWeight: "500",
                  }}
                >
                  {homepageContent.about.content}
                </p>
              </>
            )}
          </div>
          )}
        </section>

        {/* Mission Section */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 mb-8 relative">
          {isLoadingHomepage ? (
            <SkeletonSection lines={4} />
          ) : (
          <div className="ysp-card p-6 md:p-8">
            {isEditingHomepage ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Section Title</label>
                  <input
                    type="text"
                    value={editedContent.mission.title}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        mission: { ...editedContent.mission, title: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    style={{
                      fontFamily: "var(--font-headings)",
                      fontWeight: "var(--font-weight-bold)",
                      fontSize: "1.25rem",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Content</label>
                  <textarea
                    value={editedContent.mission.content}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        mission: { ...editedContent.mission, content: e.target.value },
                      })
                    }
                    rows={8}
                    className="w-full px-4 py-3 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </>
            ) : (
              <>
                <h2
                  className="mb-4 text-left"
                  style={{
                    fontFamily: "var(--font-headings)",
                    fontSize: "1.5rem",
                    fontWeight: "var(--font-weight-bold)",
                    color: "#f6421f",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {homepageContent.mission.title}
                </h2>
                <p
                  className="text-justify text-gray-800 dark:text-gray-100"
                  style={{
                    fontSize: "1rem",
                    lineHeight: "1.625",
                    letterSpacing: "0.01em",
                    fontWeight: "500",
                  }}
                >
                  {homepageContent.mission.content}
                </p>
              </>
            )}
          </div>
          )}
        </section>

        {/* Vision Section */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 mb-8 relative">
          {isLoadingHomepage ? (
            <SkeletonSection lines={4} />
          ) : (
          <div className="ysp-card p-6 md:p-8">
            {isEditingHomepage ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Section Title</label>
                  <input
                    type="text"
                    value={editedContent.vision.title}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        vision: { ...editedContent.vision, title: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    style={{
                      fontFamily: "var(--font-headings)",
                      fontWeight: "var(--font-weight-bold)",
                      fontSize: "1.25rem",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Content</label>
                  <textarea
                    value={editedContent.vision.content}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        vision: { ...editedContent.vision, content: e.target.value },
                      })
                    }
                    rows={8}
                    className="w-full px-4 py-3 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
                  />
                </div>
              </>
            ) : (
              <>
                <h2
                  className="mb-4 text-left"
                  style={{
                    fontFamily: "var(--font-headings)",
                    fontSize: "1.5rem",
                    fontWeight: "var(--font-weight-bold)",
                    color: "#f6421f",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {homepageContent.vision.title}
                </h2>
                <p
                  className="text-justify text-gray-800 dark:text-gray-100"
                  style={{
                    fontSize: "1rem",
                    lineHeight: "1.625",
                    letterSpacing: "0.01em",
                    fontWeight: "500",
                  }}
                >
                  {homepageContent.vision.content}
                </p>
              </>
            )}
          </div>
          )}
        </section>

        {/* Advocacy Pillars Section */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 mb-8 relative">
          {isLoadingHomepage ? (
            <SkeletonSection lines={8} />
          ) : (
          <div className="ysp-card p-6 md:p-8">
            {isEditingHomepage ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Section Title</label>
                  <input
                    type="text"
                    value={editedContent.advocacyPillars.title}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        advocacyPillars: { ...editedContent.advocacyPillars, title: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    style={{
                      fontFamily: "var(--font-headings)",
                      fontWeight: "var(--font-weight-bold)",
                      fontSize: "1.25rem",
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Content</label>
                  <textarea
                    value={editedContent.advocacyPillars.content}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        advocacyPillars: { ...editedContent.advocacyPillars, content: e.target.value },
                      })
                    }
                    rows={12}
                    className="w-full px-4 py-3 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-y"
                    style={{
                      textAlign: "justify",
                      lineHeight: "1.75",
                      whiteSpace: "pre-wrap",
                    }}
                    placeholder="Enter the advocacy pillars content here. Use line breaks for formatting."
                  />
                </div>
              </>
            ) : (
              <>
                <h2
                  className="mb-4 text-left"
                  style={{
                    fontFamily: "var(--font-headings)",
                    fontSize: "1.5rem",
                    fontWeight: "var(--font-weight-bold)",
                    color: "#f6421f",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {homepageContent.advocacyPillars.title}
                </h2>
                <div
                  className="text-gray-800 dark:text-gray-100"
                  style={{
                    fontSize: "1rem",
                    lineHeight: "1.75",
                    letterSpacing: "0.01em",
                    fontWeight: "500",
                    textAlign: "justify",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {homepageContent.advocacyPillars.content}
                </div>
              </>
            )}
          </div>
          )}
        </section>

        {/* Projects Section */}
        <section
          id="projects"
          className="max-w-6xl mx-auto px-4 md:px-6 mb-8 relative"
        >
          <div className="ysp-card p-6 md:p-8">
            <h2
              className="mb-6 text-center md:text-left"
              style={{
                fontFamily: "var(--font-headings)",
                fontSize: "1.5rem",
                fontWeight: "var(--font-weight-bold)",
                color: "#f6421f",
                letterSpacing: "-0.01em",
              }}
            >
              Projects Implemented
            </h2>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="flex gap-3 mb-6 flex-wrap items-center">
                <button
                  onClick={() => setShowUploadProjectModal(true)}
                  className="flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                  style={{
                    background:
                      "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  <Upload className="w-4 h-4" />
                  Upload Project
                </button>
                <button
                  onClick={handleDeleteSelectedProjects}
                  disabled={selectedProjectIds.length === 0}
                  className="flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  style={{
                    background:
                      "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Selected {selectedProjectIds.length > 0 && `(${selectedProjectIds.length})`}
                </button>
                {selectedProjectIds.length > 0 && (
                  <button
                    onClick={() => setSelectedProjectIds([])}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            )}

            {/* Projects Grid - Show skeleton while loading */}
            {projectsContent}
          </div>
        </section>

        {/* Organizational Chart Section */}
        <section id="org-chart" className="max-w-6xl mx-auto px-4 md:px-6 mb-8 relative">
          {isLoadingHomepage ? (
            <SkeletonOrgChart />
          ) : (
          <div className="ysp-card p-6 md:p-8">
            <h2
              className="mb-6 flex items-center justify-center gap-3 text-center md:justify-start md:text-left"
              style={{
                fontFamily: "var(--font-headings)",
                fontSize: "1.5rem",
                fontWeight: "var(--font-weight-bold)",
                color: "#f6421f",
                letterSpacing: "-0.01em",
              }}
            >
              <Network className="w-6 h-6" style={{ color: "#f6421f" }} />
              Organizational Chart
            </h2>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="flex gap-3 mb-6 flex-wrap">
                <label
                  className={`flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg cursor-pointer ${isUploadingOrgChart ? 'opacity-50 pointer-events-none' : ''}`}
                  style={{
                    background:
                      "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  {isUploadingOrgChart ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Chart
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingOrgChart}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleOrgChartUpload(file);
                      e.target.value = ''; // Reset so same file can be selected again
                    }}
                  />
                </label>
                <button
                  onClick={() => setShowDeleteOrgChartModal(true)}
                  disabled={!orgChartUrl}
                  className={`flex items-center justify-center gap-2 h-10 px-5 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${!orgChartUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={{
                    background:
                      "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                    fontWeight: "600",
                    fontSize: "14px",
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Chart
                </button>
              </div>
            )}

            {/* Founder Information - Clickable */}
            <button
              onClick={() => setShowFounderModal(true)}
              className="w-full mb-6 p-4 md:p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-xl transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer active:scale-[0.98] text-left"
            >
              <h3
                className="mb-2"
                style={{
                  fontFamily: "var(--font-headings)",
                  fontSize: "1.125rem",
                  fontWeight: "600",
                  color: "#f6421f",
                }}
              >
                Founder
              </h3>
              <p
                className="text-gray-900 dark:text-white"
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "600",
                }}
              >
                Juanquine Carlo R. Castro
              </p>
              <p
                className="text-gray-800 dark:text-gray-100 mt-1"
                style={{
                  fontSize: "0.875rem",
                  fontStyle: "italic",
                  fontWeight: "500",
                }}
              >
                a.k.a Wacky Racho
              </p>
              <p
                className="text-gray-600 dark:text-gray-400 mt-2 flex items-center gap-2"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: "500",
                }}
              >
                <ExternalLink className="w-3 h-3" />
                Click to view full profile
              </p>
            </button>

            {/* Chart Display with Zoom Indicator */}
            {orgChartUrl ? (
              <div
                className="relative cursor-pointer rounded-xl overflow-hidden group"
                onClick={() =>
                  openProjectModal({
                    projectId: "org-chart",
                    title: "Organizational Chart",
                    description:
                      "Youth Service Philippines - Tagum Chapter organizational structure",
                    imageUrl: orgChartUrl,
                    status: "Active",
                  })
                }
              >
                <ImageWithFallback
                  src={orgChartUrl}
                  alt="Organizational Chart"
                  className="w-full h-auto rounded-lg shadow-lg transition-opacity duration-250 group-hover:opacity-90"
                />

                {/* Zoom Indicator */}
                <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-4 h-4 text-white" />
                  <span
                    className="text-sm text-white"
                    style={{ fontWeight: "500" }}
                  >
                    Click to expand
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600">
                <Network className="w-16 h-16 text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-400 text-center font-medium">
                  No organizational chart uploaded yet
                </p>
                {isAdmin && (
                  <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                    Use the "Upload Chart" button above to add one
                  </p>
                )}
              </div>
            )}
          </div>
          )}
        </section>

        {/* Contact Section */}
        <section
          id="contact"
          className="max-w-6xl mx-auto px-4 md:px-6 mb-8 pb-8 relative"
        >
          {isLoadingHomepage ? (
            <SkeletonContact />
          ) : (
          <div className="ysp-card p-6 md:p-8">
            {isEditingHomepage ? (
              <>
                {/* Editing Mode */}
                <div className="mb-6">
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Section Title</label>
                  <input
                    type="text"
                    value={editedContent.contact.title}
                    onChange={(e) =>
                      setEditedContent({
                        ...editedContent,
                        contact: { ...editedContent.contact, title: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 rounded-lg border-2 border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    style={{
                      fontFamily: "var(--font-headings)",
                      fontWeight: "var(--font-weight-bold)",
                      fontSize: "1.25rem",
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {/* Email */}
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={editedContent.contact.email}
                      onChange={(e) =>
                        setEditedContent({
                          ...editedContent,
                          contact: { ...editedContent.contact, email: e.target.value },
                        })
                      }
                      placeholder="example@email.com"
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Phone Number</label>
                    <input
                      type="tel"
                      value={editedContent.contact.phone}
                      onChange={(e) =>
                        setEditedContent({
                          ...editedContent,
                          contact: { ...editedContent.contact, phone: e.target.value },
                        })
                      }
                      placeholder="+63 917 123 4567"
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Location */}
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Location</label>
                    <input
                      type="text"
                      value={editedContent.contact.location}
                      onChange={(e) =>
                        setEditedContent({
                          ...editedContent,
                          contact: { ...editedContent.contact, location: e.target.value },
                        })
                      }
                      placeholder="City, Province, Country"
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Location Link */}
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Google Maps Link</label>
                    <input
                      type="url"
                      value={editedContent.contact.locationLink}
                      onChange={(e) =>
                        setEditedContent({
                          ...editedContent,
                          contact: { ...editedContent.contact, locationLink: e.target.value },
                        })
                      }
                      placeholder="https://maps.google.com/..."
                      className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Social Links */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Social Media Links</label>
                    <button
                      onClick={() => {
                        const newLink = { id: Date.now(), url: "", label: "" };
                        setEditedContent({
                          ...editedContent,
                          contact: {
                            ...editedContent.contact,
                            socialLinks: [...editedContent.contact.socialLinks, newLink],
                          },
                        });
                      }}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Link
                    </button>
                  </div>
                  <div className="space-y-3">
                    {editedContent.contact.socialLinks.map((link, index) => {
                      const platform = detectSocialPlatform(link.url);
                      return (
                        <div key={link.id} className="flex gap-3 items-start p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                          {/* Platform Icon Preview */}
                          <div 
                            className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: link.url ? platform.color + '20' : '#f3f4f6' }}
                          >
                            {link.url ? (
                              <div style={{ color: platform.color }}>
                                <SocialIcon platform={platform.icon} className="w-5 h-5" />
                              </div>
                            ) : (
                              <Globe className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <input
                              type="url"
                              value={link.url}
                              onChange={(e) => {
                                const newLinks = [...editedContent.contact.socialLinks];
                                newLinks[index].url = e.target.value;
                                // Auto-detect platform name if label is empty
                                if (!newLinks[index].label && e.target.value) {
                                  const detected = detectSocialPlatform(e.target.value);
                                  newLinks[index].label = detected.name !== 'Website' ? detected.name : '';
                                }
                                setEditedContent({
                                  ...editedContent,
                                  contact: { ...editedContent.contact, socialLinks: newLinks },
                                });
                              }}
                              placeholder="https://facebook.com/yourpage"
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            <input
                              type="text"
                              value={link.label}
                              onChange={(e) => {
                                const newLinks = [...editedContent.contact.socialLinks];
                                newLinks[index].label = e.target.value;
                                setEditedContent({
                                  ...editedContent,
                                  contact: { ...editedContent.contact, socialLinks: newLinks },
                                });
                              }}
                              placeholder="Display name (e.g., YSP Tagum Chapter)"
                              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            {link.url && (
                              <p className="text-xs text-gray-500">
                                Detected: <span style={{ color: platform.color, fontWeight: 600 }}>{platform.name}</span>
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              const newLinks = editedContent.contact.socialLinks.filter((_, i) => i !== index);
                              setEditedContent({
                                ...editedContent,
                                contact: { ...editedContent.contact, socialLinks: newLinks },
                              });
                            }}
                            className="shrink-0 p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                    {editedContent.contact.socialLinks.length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No social links added. Click "Add Link" to add one.</p>
                    )}
                  </div>
                </div>

                {/* Partner Section */}
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Partnership Section</h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Title</label>
                      <input
                        type="text"
                        value={editedContent.contact.partnerTitle}
                        onChange={(e) =>
                          setEditedContent({
                            ...editedContent,
                            contact: { ...editedContent.contact, partnerTitle: e.target.value },
                          })
                        }
                        placeholder="🤝 Become Our Partner"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Description</label>
                      <textarea
                        value={editedContent.contact.partnerDescription}
                        onChange={(e) =>
                          setEditedContent({
                            ...editedContent,
                            contact: { ...editedContent.contact, partnerDescription: e.target.value },
                          })
                        }
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm resize-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Button Text</label>
                        <input
                          type="text"
                          value={editedContent.contact.partnerButtonText}
                          onChange={(e) =>
                            setEditedContent({
                              ...editedContent,
                              contact: { ...editedContent.contact, partnerButtonText: e.target.value },
                            })
                          }
                          placeholder="Partner with Us"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          Google Form Link OR Email Address (leave empty to hide)
                        </label>
                        <input
                          type="text"
                          value={editedContent.contact.partnerButtonLink}
                          onChange={(e) =>
                            setEditedContent({
                              ...editedContent,
                              contact: { ...editedContent.contact, partnerButtonLink: e.target.value },
                            })
                          }
                          placeholder="https://forms.gle/... OR email@example.com"
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    </div>
                    {!editedContent.contact.partnerButtonLink && (
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        ⚠️ No link provided - Partnership section will be hidden
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Display Mode */}
                <h2
                  className="mb-6 text-center md:text-left"
                  style={{
                    fontFamily: "var(--font-headings)",
                    fontSize: "1.5rem",
                    fontWeight: "var(--font-weight-bold)",
                    color: "#f6421f",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {homepageContent.contact.title}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Email Card - PWA friendly: opens native email app */}
                  <button
                    type="button"
                    onClick={() => openEmailApp(homepageContent.contact.email)}
                    className="flex items-center gap-4 p-4 md:p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl transition-all duration-250 hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98] text-left w-full"
                  >
                    <div className="shrink-0">
                      <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-gray-900 dark:text-white mb-1"
                        style={{ fontSize: "16px", fontWeight: "500" }}
                      >
                        Email
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 break-all">
                        {homepageContent.contact.email}
                      </p>
                    </div>
                  </button>

                  {/* Phone Card - PWA friendly: opens native phone app */}
                  <button
                    type="button"
                    onClick={() => openPhoneApp(homepageContent.contact.phone)}
                    className="flex items-center gap-4 p-4 md:p-5 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl transition-all duration-250 hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98] text-left w-full"
                  >
                    <div className="shrink-0">
                      <Phone className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-gray-900 dark:text-white mb-1"
                        style={{ fontSize: "16px", fontWeight: "500" }}
                      >
                        Phone
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {homepageContent.contact.phone}
                      </p>
                    </div>
                  </button>

                  {/* Location Card */}
                  <a
                    href={homepageContent.contact.locationLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 md:p-5 bg-orange-50 dark:bg-yellow-900/20 border border-orange-100 dark:border-yellow-800 rounded-xl transition-all duration-250 hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]"
                  >
                    <div className="shrink-0">
                      <MapPin className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3
                        className="text-gray-900 dark:text-white mb-1"
                        style={{ fontSize: "16px", fontWeight: "500" }}
                      >
                        Location
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {homepageContent.contact.location}
                      </p>
                    </div>
                  </a>

                  {/* Social Media Cards */}
                  {homepageContent.contact.socialLinks.map((link) => {
                    const platform = detectSocialPlatform(link.url);
                    return (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-4 p-4 md:p-5 ${platform.bgColor} ${platform.darkBgColor} border ${platform.borderColor} ${platform.darkBorderColor} rounded-xl transition-all duration-250 hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]`}
                      >
                        <div className="shrink-0" style={{ color: platform.color }}>
                          <SocialIcon platform={platform.icon} className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3
                            className="text-gray-900 dark:text-white mb-1"
                            style={{ fontSize: "16px", fontWeight: "500" }}
                          >
                            {platform.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {link.label || link.url}
                          </p>
                        </div>
                      </a>
                    );
                  })}
                </div>

                {/* Partner with Us Button - Smart Detection for Email vs Link */}
                {homepageContent.contact.partnerButtonLink && homepageContent.contact.partnerButtonLink.trim() !== "" && (
                  <div className="mt-8 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border-2 border-orange-200 dark:border-orange-800 rounded-2xl text-center">
                    <h3
                      className="mb-3"
                      style={{
                        fontFamily: "var(--font-headings)",
                        fontSize: "1.25rem",
                        fontWeight: "600",
                        color: "#f6421f",
                      }}
                    >
                      {homepageContent.contact.partnerTitle}
                    </h3>
                    <p
                      className="text-sm text-gray-800 dark:text-gray-100 mb-4 max-w-xl mx-auto"
                      style={{ fontWeight: "500" }}
                    >
                      {homepageContent.contact.partnerDescription}
                    </p>
                    
                    {/* LOGIC: Determine if it is an email or a web link - PWA friendly */}
                    {(() => {
                      let linkValue = homepageContent.contact.partnerButtonLink || "";
                      linkValue = linkValue.trim();
                      
                      // Check if it is an email
                      const isEmail = linkValue.includes("@") && !linkValue.toLowerCase().includes("http");
                      
                      if (isEmail) {
                        // PWA-friendly: Use button with onClick to open native email app
                        return (
                          <button
                            type="button"
                            onClick={() => openEmailApp(linkValue)}
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:scale-105"
                            style={{
                              background:
                                "linear-gradient(135deg, #f6421f 0%, #ee8724 50%, #fbcb29 100%)",
                              fontFamily: "var(--font-headings)",
                              fontWeight: "600",
                              fontSize: "1.125rem",
                              boxShadow: "0 4px 16px rgba(246, 66, 31, 0.4)",
                            }}
                          >
                            <Mail className="w-5 h-5" />
                            {homepageContent.contact.partnerButtonText}
                          </button>
                        );
                      } else {
                        // Standard Web Link
                        let finalHref = linkValue;
                        if (!linkValue.startsWith("http://") && !linkValue.startsWith("https://")) {
                          finalHref = `https://${linkValue}`;
                        }
                        return (
                          <a
                            href={finalHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:scale-105"
                            style={{
                              background:
                                "linear-gradient(135deg, #f6421f 0%, #ee8724 50%, #fbcb29 100%)",
                              fontFamily: "var(--font-headings)",
                              fontWeight: "600",
                              fontSize: "1.125rem",
                              boxShadow: "0 4px 16px rgba(246, 66, 31, 0.4)",
                            }}
                          >
                            <Globe className="w-5 h-5" />
                            {homepageContent.contact.partnerButtonText}
                          </a>
                        );
                      }
                    })()}
                  </div>
                )}
              </>
            )}
          </div>
          )}
        </section>

        {/* Developer Info Section */}
        <section className="max-w-6xl mx-auto px-4 md:px-6 mb-8 pb-8 relative">
          {isLoadingHomepage ? (
            <SkeletonProfileCard />
          ) : (
          <div
            className="ysp-card p-6 md:p-8 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 border-2 border-blue-200 dark:border-blue-800"
            style={{
              boxShadow:
                "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                style={{
                  fontFamily: "var(--font-headings)",
                  fontSize: "1.125rem",
                  fontWeight: "500",
                  color: "#f6421f",
                  letterSpacing: "-0.01em",
                }}
              >
                Developer Info
              </h3>
              <button
                onClick={() => setShowDeveloperModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-300 hover:shadow-md active:scale-95"
                style={{
                  color: "#3b82f6",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                }}
                aria-label="View full developer profile"
              >
                <Plus className="w-4 h-4" />
                <span>View Full Profile</span>
              </button>
            </div>

            <div className="space-y-2">
              <p
                className="text-gray-900 dark:text-white"
                style={{
                  fontSize: "1.125rem",
                  fontWeight: "600",
                }}
              >
                Ezequiel John B. Crisostomo
              </p>
              <p
                className="text-gray-800 dark:text-gray-100"
                style={{ fontSize: "1rem", fontWeight: "500" }}
              >
                Membership and Internal Affairs Officer
              </p>
              <p
                className="text-gray-800 dark:text-gray-100"
                style={{ fontSize: "1rem", fontWeight: "500" }}
              >
                Youth Service Philippines - Tagum Chapter
              </p>

              <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-600">
                <p
                  className="text-sm text-gray-700 dark:text-gray-200 text-justify"
                  style={{
                    lineHeight: "1.625",
                    letterSpacing: "0.01em",
                    fontWeight: "500",
                  }}
                >
                  Should you encounter any issues, errors, or
                  technical difficulties while using this Web App,
                  please do not hesitate to reach out to us. You
                  may contact our support team through our
                  official{" "}
                  <a
                    href="https://www.facebook.com/YSPTagumChapter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                    style={{ fontWeight: "500" }}
                  >
                    Facebook Page
                  </a>{" "}
                  or send us an Email:{" "}
                  <a
                    href={`mailto:${"ysptagumchapter+portal@gmail.com".replace(/\+/g, '%2B')}`}
                    onClick={(e) => {
                      e.preventDefault();
                      openEmailApp("ysptagumchapter+portal@gmail.com");
                    }}
                    className="text-[#f6421f] dark:text-[#ee8724] hover:underline transition-colors"
                    style={{ fontWeight: "500" }}
                  >
                    YSPTagumChapter+portal@gmail.com
                  </a>{" "}
                  for further assistance. We value your feedback
                  and will address your concerns as promptly as
                  possible to ensure a smooth user experience.
                </p>
              </div>

              {/* Support Section */}
              <div className="mt-6 pt-6 border-t border-gray-300 dark:border-gray-600 text-center">
                <p
                  className="text-sm text-gray-700 dark:text-gray-200 mb-4"
                  style={{ fontWeight: "500" }}
                >
                  Share your thoughts and help us improve our community service initiatives.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                  <button
                    onClick={() => setShowFeedbackPage(true)}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:scale-105"
                    style={{
                      background:
                        "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                      fontWeight: "700",
                      fontSize: "1rem",
                      boxShadow:
                        "0 4px 12px rgba(246, 66, 31, 0.4)",
                    }}
                  >
                    <MessageCircle className="w-5 h-5" />
                    Share Feedback
                  </button>
                </div>
              </div>
            </div>
          </div>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8 relative">
          <div className="max-w-6xl mx-auto px-4 md:px-6 text-center text-sm text-muted-foreground">
            <p>
              &copy; 2025 Youth Service Philippines - Tagum
              Chapter. All rights reserved.
            </p>
            <p className="mt-2">
              Shaping the Future to a Greater Society
            </p>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              App version: {appVersion} | Cache version: {cacheVersion}
            </p>
          </div>
        </footer>

        </div>
        {/* End Main Content Wrapper */}

        {/* Project Modal */}
        {modalProject && (
          <div
            className="fixed flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 animate-[fadeIn_0.25s_ease] overflow-y-auto"
            style={{ 
              zIndex: 10001,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh',
              minHeight: '100vh',
              paddingTop: 'calc(1rem + env(safe-area-inset-top))',
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            onClick={closeModal}
          >
            {/* Modal Content - Floating Card */}
            <div
              className="relative w-full max-w-4xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl animate-[scaleIn_0.3s_ease] mx-auto my-auto"
              style={{
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                maxHeight: "calc(100vh - 2rem)",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button - Inside the modal */}
              <button
                onClick={closeModal}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all duration-300 hover:rotate-90 hover:scale-110"
                style={{ 
                  zIndex: 10,
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                  boxShadow: '0 4px 12px rgba(246, 66, 31, 0.4)'
                }}
                aria-label="Close modal"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </button>

              {/* Scrollable Content Area */}
              <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 10rem)" }}>
                {/* Project Image - Click to open full image */}
                <div 
                  className="relative w-full cursor-pointer group overflow-hidden"
                  onClick={() => window.open(modalProject.imageUrl, '_blank')}
                >
                  <ImageWithFallback
                    src={modalProject.imageUrl}
                    alt={modalProject.title}
                    className="w-full h-auto object-cover"
                    style={{ maxHeight: "calc(100vh - 14rem)" }}
                  />
                  {/* Hover overlay with "View Full Image" indicator */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/70 backdrop-blur-sm px-4 py-2 rounded-lg flex items-center gap-2">
                      <ZoomIn className="w-5 h-5 text-white" />
                      <span className="text-white font-medium">Click to view full image</span>
                    </div>
                  </div>
                </div>

                {/* Project Details */}
                <div className="p-5 sm:p-6 md:p-8" style={{ overflowX: 'hidden' }}>
                  <h2
                    className="mb-3 md:mb-4 text-xl sm:text-2xl md:text-3xl text-left"
                    style={{
                      fontFamily: "var(--font-headings)",
                      fontWeight: "var(--font-weight-bold)",
                      color: "#f6421f",
                      lineHeight: "1.2",
                    }}
                  >
                    <FormattedText text={modalProject.title} />
                  </h2>

                  <div
                    className="text-gray-700 dark:text-gray-300 text-sm sm:text-base md:text-lg"
                    style={{
                      lineHeight: "1.75",
                      letterSpacing: "0.01em",
                      textAlign: "justify",
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                    }}
                  >
                    <FormattedText text={modalProject.description} />
                  </div>
                </div>
              </div>

              {/* Fixed Footer with Action Button */}
              {modalProject.link && (
                <div className="flex justify-center p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-3xl">
                  <a
                    href={modalProject.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg text-sm sm:text-base group min-w-0"
                    style={{
                      background:
                        "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                      fontWeight: "600",
                      boxShadow:
                        "0 2px 8px rgba(246, 66, 31, 0.3)",
                    }}
                  >
                    <ExternalLink className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                    <span className="truncate">{modalProject.linkText || suggestLinkTextFromUrl(modalProject.link)}</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Upload/Edit Project Modal */}
        {showUploadProjectModal && (
          <div
            className="fixed flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-12 animate-[fadeIn_0.25s_ease] overflow-y-auto"
            style={{ 
              zIndex: 10001,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh',
              minHeight: '100vh',
              paddingTop: 'calc(1rem + env(safe-area-inset-top))',
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            onClick={closeProjectModal}
          >
            {/* Modal Content */}
            <div
              className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl animate-[scaleIn_0.3s_ease] mx-auto my-auto"
              style={{
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
                maxHeight: "calc(100vh - 4rem)",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <h2
                  className="flex-1 text-xl sm:text-2xl text-center md:text-left"
                  style={{
                    fontFamily: "var(--font-headings)",
                    fontWeight: "var(--font-weight-bold)",
                    color: "#f6421f",
                  }}
                >
                  {editingProject ? "Edit Project" : "Upload New Project"}
                </h2>
                <button
                  onClick={closeProjectModal}
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Form Content */}
              <div className="p-5 sm:p-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 16rem)" }}>
                <div className="space-y-5">
                  {/* Title */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Project Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newProject.title}
                      onChange={(e) => setNewProject({ ...newProject, title: e.target.value })}
                      placeholder="Enter project title"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800 transition-all"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      placeholder="Enter project description"
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800 transition-all resize-none"
                      style={{ textAlign: "justify" }}
                    />
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Project Image <span className="text-red-500">*</span>
                    </label>
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all"
                      onClick={() => document.getElementById('projectImageInput')?.click()}
                    >
                      <input
                        id="projectImageInput"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setProjectImageFile(file);
                          }
                        }}
                        className="hidden"
                      />
                      {projectImageFile ? (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-green-600 dark:text-green-400">✓ {projectImageFile.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Click to change</p>
                        </div>
                      ) : newProject.imageUrl ? (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">✓ Current image loaded</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Click to change</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Click to upload or drag and drop</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, GIF up to 10MB</p>
                        </div>
                      )}
                    </div>
                    {/* Show preview: new file takes priority, then existing URL */}
                    {(projectImageFile || newProject.imageUrl) && (
                      <div className="mt-3 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600 w-20 h-20">
                        <img
                          src={projectImageFile ? URL.createObjectURL(projectImageFile) : newProject.imageUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                  </div>

                  {/* Link */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Project Link <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="url"
                      value={newProject.link}
                      onChange={(e) => {
                        const url = e.target.value;
                        const suggestedText = suggestLinkTextFromUrl(url);
                        setNewProject({ 
                          ...newProject, 
                          link: url,
                          // Only auto-fill if linkText is empty or was previously auto-suggested
                          linkText: newProject.linkText === '' || 
                                    newProject.linkText === suggestLinkTextFromUrl(newProject.link)
                                    ? suggestedText 
                                    : newProject.linkText
                        });
                      }}
                      placeholder="https://facebook.com/post-link"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800 transition-all"
                    />
                  </div>

                  {/* Link Text */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Link Button Text <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={newProject.linkText}
                      onChange={(e) => setNewProject({ ...newProject, linkText: e.target.value })}
                      placeholder="Learn More on Facebook"
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-orange-500 focus:ring-2 focus:ring-orange-200 dark:focus:ring-orange-800 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row gap-3 p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={closeProjectModal}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-semibold flex-1"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
                <button
                  onClick={handleUploadProject}
                  disabled={isUploadingProjectImage}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl font-semibold flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                    boxShadow: "0 4px 12px rgba(246, 66, 31, 0.3)",
                  }}
                >
                  {isUploadingProjectImage ? (
                    <>
                      <span className="inline-block animate-spin">⏳</span>
                      Uploading...
                    </>
                  ) : editingProject ? (
                    <>
                      <Save className="w-5 h-5" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Upload className="w-5 h-5" />
                      Upload Project
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirmModal && (
          <div
            className="fixed flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.25s_ease]"
            style={{ 
              zIndex: 10001,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh',
              minHeight: '100vh',
              paddingTop: 'calc(1rem + env(safe-area-inset-top))',
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            onClick={() => setShowDeleteConfirmModal(false)}
          >
            <div
              className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl animate-[scaleIn_0.3s_ease] mx-auto"
              style={{
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h2
                      className="text-xl text-center md:text-left"
                      style={{
                        fontFamily: "var(--font-headings)",
                        fontWeight: "var(--font-weight-bold)",
                        color: "#dc2626",
                      }}
                    >
                      Confirm Delete
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This action cannot be undone
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Are you sure you want to delete <strong>{selectedProjectIds.length}</strong> project{selectedProjectIds.length > 1 ? "s" : ""}?
                </p>
                
                {/* List of projects to be deleted */}
                <div className="max-h-48 overflow-y-auto space-y-2 mb-4">
                  {projects
                    .filter((p) => selectedProjectIds.includes(p.projectId))
                    .map((project) => (
                      <div
                        key={project.projectId}
                        className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                      >
                        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0">
                          <img
                            src={project.imageUrl}
                            alt={project.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            <FormattedText text={project.title} />
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {project.description.substring(0, 60)}...
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row gap-3 p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                <button
                  onClick={() => setShowDeleteConfirmModal(false)}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-semibold flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteProjects}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl font-semibold flex-1"
                  style={{
                    background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                    boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
                  }}
                >
                  <Trash2 className="w-5 h-5" />
                  Delete {selectedProjectIds.length} Project{selectedProjectIds.length > 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Org Chart Confirmation Modal */}
        {showDeleteOrgChartModal && (
          <div
            className="fixed flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.25s_ease]"
            style={{ 
              zIndex: 10001,
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh',
              minHeight: '100vh',
              paddingTop: 'calc(1rem + env(safe-area-inset-top))',
              paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
            onClick={() => setShowDeleteOrgChartModal(false)}
          >
            <div
              className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-2xl animate-[scaleIn_0.3s_ease] mx-auto"
              style={{
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-5 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h2
                      className="text-xl text-center md:text-left"
                      style={{
                        fontFamily: "var(--font-headings)",
                        fontWeight: "var(--font-weight-bold)",
                        color: "#dc2626",
                      }}
                    >
                      Delete Organizational Chart
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      This action cannot be undone
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-5 sm:p-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4">
                  Are you sure you want to delete the organizational chart?
                </p>
                
                {/* Preview of chart to be deleted */}
                {orgChartUrl && (
                  <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="w-20 h-14 rounded-lg overflow-hidden shrink-0">
                      <img
                        src={orgChartUrl}
                        alt="Organizational Chart"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Organizational Chart
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        YSP Tagum Chapter structure
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-col sm:flex-row gap-3 p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
                <button
                  onClick={() => setShowDeleteOrgChartModal(false)}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all font-semibold flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteOrgChart}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl font-semibold flex-1"
                  style={{
                    background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                    boxShadow: "0 4px 12px rgba(220, 38, 38, 0.3)",
                  }}
                >
                  <Trash2 className="w-5 h-5" />
                  Delete Chart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Founder Modal */}
        <Suspense fallback={null}>
          <FounderModal
            isOpen={showFounderModal}
            onClose={() => setShowFounderModal(false)}
            isDark={isDark}
            isAdmin={isAdmin}
            addUploadToast={addUploadToast}
            updateUploadToast={updateUploadToast}
            removeUploadToast={removeUploadToast}
          />
        </Suspense>

        {/* Developer Modal */}
        <Suspense fallback={null}>
          <DeveloperModal
            isOpen={showDeveloperModal}
            onClose={() => setShowDeveloperModal(false)}
            isDark={isDark}
            isAdmin={isAdmin}
            addUploadToast={addUploadToast}
            updateUploadToast={updateUploadToast}
            removeUploadToast={removeUploadToast}
          />
        </Suspense>

        {/* Login Panel */}
        {!showLoginPrepLoader && (
          <Suspense fallback={null}>
            <LoginPanel
              isOpen={showLoginPanel}
              onClose={() => setShowLoginPanel(false)}
              onLogin={handleLogin}
              onContinueSession={handleContinueSession}
              canContinueSession={hasActiveSession() && !!getStoredUser()}
              continueUserName={getStoredUser()?.name || ''}
              isDark={isDark}
            />
          </Suspense>
        )}



        {/* Upload Toast Container - Progress bars at bottom-right */}
        {!showLoginPrepLoader && (
          <UploadToastContainer
            messages={uploadToastMessages}
            onDismiss={removeUploadToast}
            isDark={isDark}
          />
        )}

{/* 👈 ADD THIS: Global Cache Refresh Modal */}
        <CacheRefreshModal
          isOpen={showCacheRefreshModal}
          isDark={isDark}
          onConfirm={handleConfirmHardRefresh}
          onClose={handleDismissHardRefresh}
        />
        <SessionRecoveryModal
          isOpen={showSessionRecoveryModal}
          isDark={isDark}
          onRelogin={handleReloginFromSessionRecovery}
          onHardRefresh={handleHardRefreshFromSessionRecovery}
        />

{/* 👈 Role Change Modal - Shown when user's role is changed by admin */}
        {roleChangeInfo && (
          <RoleChangeModal
            isOpen={showRoleChangeModal}
            isDark={isDark}
            changeType={roleChangeInfo.changeType}
            oldRole={roleChangeInfo.oldRole}
            newRole={roleChangeInfo.newRole}
            userName={userName}
            onConfirm={handleConfirmRoleChange}
            onClose={handleDismissRoleChange}
          />
        )}

{/* YSP AI Chatbot */}
        {chatbot}
        
      </div>
    );
  }


