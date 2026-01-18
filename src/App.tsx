  import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";
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
    Menu,
    ZoomIn,
    ExternalLink,
    ChevronDown,
    User,
    Home,
    LayoutDashboard,
    Calendar,
    MessageSquare,
    FileText,
    QrCode,
    Users,
    ClipboardList,
    HandHeart,
    MessageCircle,
    Network,
    Plus,
    Edit2,
    Edit3,
    Save,
    Loader2,
    RefreshCw,
    AlertCircle,
    Settings,
  } from "lucide-react";
  import {
    fetchHomepageContent,
    updateHomepageContent,
    getDefaultHomepageContent,
    uploadOrgChart,
    fetchHomepageOtherContent,
    updateHomepageOtherContent,
    invalidateOtherContentCache,
    type HomepageMainContent,
  } from "./services/gasHomepageService";
  import {
    fetchAllProjects,
    addProject,
    updateProject,
    deleteProject,
    type Project,
  } from "./services/projectsService";
  import {
    authenticateUser,
    clearSession,
    getStoredUser,
    hasActiveSession,
    LoginErrorCodes,
    type LoginUser,
  } from "./services/gasLoginService";
  // ADDED getMaintenanceModeFromBackend HERE:
  import {
    logLogin,
    logLogout,
    getMaintenanceModeFromBackend,
    getCacheVersionFromBackend,
    getLocalCacheVersion,
    setLocalCacheVersion,
  } from "./services/gasSystemToolsService";
  import { ImageWithFallback } from "./components/figma/ImageWithFallback";
  import { toast, Toaster } from "sonner";
  import { Helmet } from 'react-helmet-async';
  const DonationPage = lazy(() => import("./components/DonationPage"));
  const LoginPanel = lazy(() => import("./components/LoginPanel"));
  const FeedbackPage = lazy(() => import("./components/FeedbackPage"));
  const OfficerDirectoryPage = lazy(() => import("./components/OfficerDirectoryPage"));
  const AttendanceDashboardPage = lazy(() => import("./components/AttendanceDashboardPage"));
  const AttendanceRecordingPage = lazy(() => import("./components/AttendanceRecordingPage"));
  const ManageEventsPage = lazy(() => import("./components/ManageEventsPage"));
  const MyQRIDPage = lazy(() => import("./components/MyQRIDPage"));
  const AttendanceTransparencyPage = lazy(() => import("./components/AttendanceTransparencyPage"));
  const MyProfilePage = lazy(() => import("./components/MyProfilePage"));
  const AnnouncementsPage = lazy(() => import("./components/AnnouncementsPage_Enhanced"));
  const SystemToolsPage = lazy(() => import("./components/SystemToolsPage"));
  const ManageMembersPage = lazy(() => import("./components/ManageMembersPage"));
  const MembershipApplicationsPage = lazy(() => import("./components/MembershipApplicationsPage"));
  const SettingsPage = lazy(() => import("./components/SettingsPage"));
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
    SkeletonPartnership 
  } from "./components/SkeletonCard";
  import { SideBar } from "./components/design-system";
  import TopBar from "./components/design-system/TopBar";
  import AnimatedHamburger from "./components/design-system/AnimatedHamburger";
  import GlowingCard from "./components/GlowingCard";
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
   * Suggests link button text based on the URL domain
   * @param url The URL to analyze
   * @returns Suggested button text based on the domain
   */
  function suggestLinkTextFromUrl(url: string): string {
    if (!url) return '';
    
    try {
      // Clean up the URL
      let cleanUrl = url.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      
      const urlObj = new URL(cleanUrl);
      const hostname = urlObj.hostname.toLowerCase();
      
      // Domain to button text mapping
      const domainMappings: { [key: string]: string } = {
        // Social Media
        'facebook.com': 'View on Facebook',
        'www.facebook.com': 'View on Facebook',
        'fb.com': 'View on Facebook',
        'fb.watch': 'Watch on Facebook',
        'instagram.com': 'View on Instagram',
        'www.instagram.com': 'View on Instagram',
        'twitter.com': 'View on Twitter',
        'www.twitter.com': 'View on Twitter',
        'x.com': 'View on X',
        'www.x.com': 'View on X',
        'linkedin.com': 'View on LinkedIn',
        'www.linkedin.com': 'View on LinkedIn',
        'tiktok.com': 'Watch on TikTok',
        'www.tiktok.com': 'Watch on TikTok',
        'threads.net': 'View on Threads',
        'www.threads.net': 'View on Threads',
        
        // Video Platforms
        'youtube.com': 'Watch on YouTube',
        'www.youtube.com': 'Watch on YouTube',
        'youtu.be': 'Watch on YouTube',
        'vimeo.com': 'Watch on Vimeo',
        'www.vimeo.com': 'Watch on Vimeo',
        'twitch.tv': 'Watch on Twitch',
        'www.twitch.tv': 'Watch on Twitch',
        
        // Google
        'docs.google.com': 'Open Google Doc',
        'drive.google.com': 'Open Google Drive',
        'forms.google.com': 'Open Google Form',
        'forms.gle': 'Open Google Form',
        'sheets.google.com': 'Open Google Sheet',
        'slides.google.com': 'Open Google Slides',
        'meet.google.com': 'Join Google Meet',
        'calendar.google.com': 'View on Google Calendar',
        'maps.google.com': 'View on Google Maps',
        'www.google.com': 'Search on Google',
        
        // Communication
        'zoom.us': 'Join Zoom Meeting',
        'discord.com': 'Join Discord',
        'discord.gg': 'Join Discord',
        'slack.com': 'Open Slack',
        'telegram.org': 'Open Telegram',
        't.me': 'Open Telegram',
        'wa.me': 'Chat on WhatsApp',
        'whatsapp.com': 'Chat on WhatsApp',
        
        // News & Articles
        'medium.com': 'Read on Medium',
        'dev.to': 'Read on Dev.to',
        'substack.com': 'Read on Substack',
        
        // Code & Development
        'github.com': 'View on GitHub',
        'www.github.com': 'View on GitHub',
        'gitlab.com': 'View on GitLab',
        'bitbucket.org': 'View on Bitbucket',
        'codepen.io': 'View on CodePen',
        'codesandbox.io': 'Open CodeSandbox',
        'replit.com': 'Open Replit',
        'stackblitz.com': 'Open StackBlitz',
        
        // E-commerce & Donations
        'shopee.ph': 'Shop on Shopee',
        'lazada.com.ph': 'Shop on Lazada',
        'amazon.com': 'Shop on Amazon',
        'gofundme.com': 'Donate on GoFundMe',
        'patreon.com': 'Support on Patreon',
        'ko-fi.com': 'Support on Ko-fi',
        'buymeacoffee.com': 'Buy Me a Coffee',
        
        // Filipino Platforms
        'gcash.com': 'Pay with GCash',
        'maya.ph': 'Pay with Maya',
        'grab.com': 'Open Grab',
        
        // Events
        'eventbrite.com': 'Register on Eventbrite',
        'www.eventbrite.com': 'Register on Eventbrite',
        'ticketmaster.com': 'Get Tickets',
        
        // Design
        'figma.com': 'View on Figma',
        'www.figma.com': 'View on Figma',
        'canva.com': 'View on Canva',
        'www.canva.com': 'View on Canva',
        'dribbble.com': 'View on Dribbble',
        'behance.net': 'View on Behance',
      };
      
      // Check for exact match first
      if (domainMappings[hostname]) {
        return domainMappings[hostname];
      }
      
      // Check for partial matches (subdomains)
      for (const [domain, text] of Object.entries(domainMappings)) {
        if (hostname.endsWith('.' + domain) || hostname === domain) {
          return text;
        }
      }
      
      // Default fallback
      return 'Learn More!';
    } catch {
      return 'Learn More!';
    }
  }

  // Donation type definition
  interface Donation {
    id: number;
    name: string;
    amount: number;
    date: string;
    status: "pending" | "verified" | "rejected";
    receiptUrl?: string;
  }

  // Pending Application type definition
  interface PendingApplication {
    id: string;
    name: string;
    email: string;
    phone: string;
    dateApplied: string;
    committee: string;
    status: "pending" | "approved" | "rejected";
    rejectionReason?: string;
    rejectionMessage?: string;
    adminNotes?: string;
    approvedBy?: string;
    approvedDate?: string;
    rejectedBy?: string;
    rejectedDate?: string;
    accountCreated?: boolean;
    fullData: ApplicationData;
  }

  interface ApplicationData {
    fullName: string;
    email: string;
    phone: string;
    address: string;
    dateOfBirth: string;
    age: number;
    gender: string;
    civilStatus: string;
    nationality: string;
    chapter: string;
    committeePreference: string;
    desiredRole: string;
    skills?: string;
    education?: string;
    certifications?: string;
    experience?: string;
    achievements?: string;
    volunteerHistory?: string;
    reasonForJoining?: string;
    personalStatement?: string;
    emergencyContactName?: string;
    emergencyContactRelation?: string;
    emergencyContactNumber?: string;
    facebook?: string;
    instagram?: string;
    twitter?: string;
    attachments?: {
      type: string;
      name: string;
      url: string;
    }[];
    profilePicture?: string;
  }

  // Navigation types
  interface NavPage {
    id: string;
    label: string;
    action: () => void;
    roles?: string[]; // Optional: roles that can see this page
    icon?: React.ReactNode;
  }

  interface NavGroup {
    id: string;
    label: string;
    pages: NavPage[];
    roles?: string[]; // Optional: roles that can see this group
    icon?: React.ReactNode;
  }

  // Social Media Platform Detection Helper
  interface SocialPlatform {
    name: string;
    color: string;
    bgColor: string;
    darkBgColor: string;
    borderColor: string;
    darkBorderColor: string;
    icon: string; // SVG path or emoji
  }

  const detectSocialPlatform = (url: string): SocialPlatform => {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('facebook.com') || urlLower.includes('fb.com')) {
      return { name: 'Facebook', color: '#1877F2', bgColor: 'bg-blue-50', darkBgColor: 'dark:bg-blue-900/20', borderColor: 'border-blue-100', darkBorderColor: 'dark:border-blue-800', icon: 'facebook' };
    }
    if (urlLower.includes('instagram.com')) {
      return { name: 'Instagram', color: '#E4405F', bgColor: 'bg-pink-50', darkBgColor: 'dark:bg-pink-900/20', borderColor: 'border-pink-100', darkBorderColor: 'dark:border-pink-800', icon: 'instagram' };
    }
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) {
      return { name: 'X (Twitter)', color: '#000000', bgColor: 'bg-gray-50', darkBgColor: 'dark:bg-gray-800', borderColor: 'border-gray-200', darkBorderColor: 'dark:border-gray-700', icon: 'twitter' };
    }
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) {
      return { name: 'YouTube', color: '#FF0000', bgColor: 'bg-red-50', darkBgColor: 'dark:bg-red-900/20', borderColor: 'border-red-100', darkBorderColor: 'dark:border-red-800', icon: 'youtube' };
    }
    if (urlLower.includes('tiktok.com')) {
      return { name: 'TikTok', color: '#000000', bgColor: 'bg-gray-50', darkBgColor: 'dark:bg-gray-800', borderColor: 'border-gray-200', darkBorderColor: 'dark:border-gray-700', icon: 'tiktok' };
    }
    if (urlLower.includes('linkedin.com')) {
      return { name: 'LinkedIn', color: '#0A66C2', bgColor: 'bg-blue-50', darkBgColor: 'dark:bg-blue-900/20', borderColor: 'border-blue-100', darkBorderColor: 'dark:border-blue-800', icon: 'linkedin' };
    }
    if (urlLower.includes('discord.com') || urlLower.includes('discord.gg')) {
      return { name: 'Discord', color: '#5865F2', bgColor: 'bg-indigo-50', darkBgColor: 'dark:bg-indigo-900/20', borderColor: 'border-indigo-100', darkBorderColor: 'dark:border-indigo-800', icon: 'discord' };
    }
    if (urlLower.includes('telegram.org') || urlLower.includes('t.me')) {
      return { name: 'Telegram', color: '#26A5E4', bgColor: 'bg-cyan-50', darkBgColor: 'dark:bg-cyan-900/20', borderColor: 'border-cyan-100', darkBorderColor: 'dark:border-cyan-800', icon: 'telegram' };
    }
    if (urlLower.includes('messenger.com') || urlLower.includes('m.me')) {
      return { name: 'Messenger', color: '#0084FF', bgColor: 'bg-blue-50', darkBgColor: 'dark:bg-blue-900/20', borderColor: 'border-blue-100', darkBorderColor: 'dark:border-blue-800', icon: 'messenger' };
    }
    if (urlLower.includes('whatsapp.com') || urlLower.includes('wa.me')) {
      return { name: 'WhatsApp', color: '#25D366', bgColor: 'bg-green-50', darkBgColor: 'dark:bg-green-900/20', borderColor: 'border-green-100', darkBorderColor: 'dark:border-green-800', icon: 'whatsapp' };
    }
    if (urlLower.includes('viber.com')) {
      return { name: 'Viber', color: '#7360F2', bgColor: 'bg-purple-50', darkBgColor: 'dark:bg-purple-900/20', borderColor: 'border-purple-100', darkBorderColor: 'dark:border-purple-800', icon: 'viber' };
    }
    if (urlLower.includes('github.com')) {
      return { name: 'GitHub', color: '#181717', bgColor: 'bg-gray-50', darkBgColor: 'dark:bg-gray-800', borderColor: 'border-gray-200', darkBorderColor: 'dark:border-gray-700', icon: 'github' };
    }
    if (urlLower.includes('threads.net')) {
      return { name: 'Threads', color: '#000000', bgColor: 'bg-gray-50', darkBgColor: 'dark:bg-gray-800', borderColor: 'border-gray-200', darkBorderColor: 'dark:border-gray-700', icon: 'threads' };
    }
    if (urlLower.includes('pinterest.com')) {
      return { name: 'Pinterest', color: '#E60023', bgColor: 'bg-red-50', darkBgColor: 'dark:bg-red-900/20', borderColor: 'border-red-100', darkBorderColor: 'dark:border-red-800', icon: 'pinterest' };
    }
    if (urlLower.includes('snapchat.com')) {
      return { name: 'Snapchat', color: '#FFFC00', bgColor: 'bg-yellow-50', darkBgColor: 'dark:bg-yellow-900/20', borderColor: 'border-yellow-100', darkBorderColor: 'dark:border-yellow-800', icon: 'snapchat' };
    }
    // Default/Unknown
    return { name: 'Website', color: '#6B7280', bgColor: 'bg-gray-50', darkBgColor: 'dark:bg-gray-800', borderColor: 'border-gray-200', darkBorderColor: 'dark:border-gray-700', icon: 'globe' };
  };

  // Social Media Icon Component
  const SocialIcon = ({ platform, className = "w-6 h-6" }: { platform: string; className?: string }) => {
    const icons: Record<string, React.ReactElement> = {
      facebook: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      instagram: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
      ),
      twitter: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      youtube: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
        </svg>
      ),
      tiktok: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
        </svg>
      ),
      linkedin: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      ),
      discord: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/>
        </svg>
      ),
      telegram: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
      messenger: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.259L19.752 8l-6.561 6.963z"/>
        </svg>
      ),
      whatsapp: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
      viber: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.398.002C9.473.028 5.331.344 3.014 2.467 1.294 4.177.518 6.769.506 10.201L.5 10.372v.065c.01 3.477.82 6.095 2.604 7.826 1.131 1.092 2.617 1.769 4.252 2.233-.004.98-.018 2.021-.018 2.021 0 0-.029.612.378.747.428.143.68-.267.68-.267s3.819-4.534 4.207-4.97c3.652-.118 6.54-1.15 6.845-1.253.69-.234 4.635-.73 5.285-5.952.668-5.382-.315-8.777-2.054-10.329C21.056 1.034 18.36.204 15.037.03c-.093-.003-.18-.012-.27-.017C14.18-.009 12.737-.018 11.398.002zm.336 1.904c1.215-.017 2.539.003 3.065.023 2.776.134 5.103.76 6.4 1.94 1.312 1.192 2.09 3.904 1.511 8.548-.507 4.052-3.6 4.468-4.165 4.659-.244.08-2.72 1.022-5.72 1.182l-.031-.002c-.323.367-2.077 2.378-3.137 3.606 0 0-.5.55-1.078-.062-.383-.405-.38-1.124-.38-1.124v-2.63l-.096-.002c-2.254-.267-4.012-1.064-5.116-2.13-1.365-1.318-1.955-3.438-1.962-6.487l.005-.152c.011-2.999.619-5.136 1.975-6.487 1.758-1.6 5.259-1.832 7.147-1.858.467-.005.95-.014 1.582-.024zm-.073 2.076h-.024c-.9.01-4.74.164-6.12 1.48-.94.909-1.394 2.5-1.403 4.944v.04c.005 2.545.533 4.225 1.573 5.135.73.65 1.835 1.063 3.264 1.246h.002c.164.012.295.122.316.28l.026 1.947c.717-.82 1.505-1.721 2.006-2.288.232-.247.56-.388.903-.386h.079c2.647-.097 5.029-.86 5.395-.989.306-.104 2.736-.34 3.151-3.642.43-3.463-.109-5.848-1.043-6.702-.936-.872-2.73-1.38-4.813-1.488-.456-.027-2.248-.577-3.312-.577zm.23 1.49c.25-.006.48.19.483.435v.021a.442.442 0 01-.438.448c-.004 0-2.704-.098-4.168 1.518-1.138 1.26-1.088 2.9-1.084 2.917.019.247-.16.466-.403.497h-.048c-.232 0-.432-.175-.456-.407-.017-.108-.103-2.01 1.349-3.611 1.72-1.897 4.667-1.813 4.766-1.818zm-.232 2.024c.259.004.463.216.46.475v.003a.468.468 0 01-.466.462h-.01c-.034-.003-.89-.033-1.507.613-.584.611-.545 1.367-.543 1.374a.468.468 0 01-.464.473h-.012a.467.467 0 01-.466-.463c-.002-.043-.07-1.116.756-1.98.88-.919 2.146-.954 2.252-.957zm2.35.96c.052-.007.1.02.15.02.35.077.629.29.77.589l.01.022c.024.07.05.14.058.217l.004.053c-.001.08-.02.157-.052.226a.588.588 0 01-.138.196.59.59 0 01-.182.116l-.023.01c-.144.051-.299.062-.45.026a.65.65 0 01-.172-.072 1.093 1.093 0 01-.257-.224l-.073-.1c-.026-.032-.046-.065-.062-.104a.502.502 0 01-.05-.14l-.005-.052a.653.653 0 01.033-.188.595.595 0 01.108-.19l.023-.025a.58.58 0 01.16-.112l.026-.012c.069-.03.132-.044.122-.056zm-2.188-.055c.247-.01.45.183.463.427.012.244-.182.45-.427.462-1.227.062-1.228.948-1.228.978a.446.446 0 01-.447.446h-.006c-.247-.004-.446-.202-.444-.448.005-.106.02-1.828 2.089-1.865zm5.136 1.156c.247 0 .448.2.448.448 0 2.89-2.174 4.925-5.287 4.954a.448.448 0 01-.452-.444c-.002-.248.197-.45.444-.452 2.634-.025 4.4-1.722 4.4-4.058 0-.247.2-.448.447-.448z"/>
        </svg>
      ),
      github: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
      ),
      threads: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.59 12c.025 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.899-.746 2.13-1.109 3.658-1.076 1.085.022 2.063.168 2.936.432-.018-.864-.173-1.556-.463-2.062-.37-.647-.976-1.001-1.856-1.083l-.118-.01c-1.049-.073-2.282.042-3.112.553l-1.043-1.765c1.23-.756 2.869-.985 4.236-.896l.16.014c1.464.137 2.594.706 3.36 1.69.643.826.985 1.878 1.02 3.128l.003.182c1.065.557 1.91 1.29 2.506 2.182.786 1.18 1.09 2.594.878 4.084-.283 1.986-1.266 3.627-2.845 4.747C17.463 23.353 15.06 24 12.186 24zM10.5 14.147c-.71 0-1.37.162-1.91.464-.632.357-.952.807-.928 1.303.02.397.197.73.528.994.4.319 1.002.482 1.79.482 1.074-.04 1.902-.37 2.464-1.003.37-.416.627-.983.764-1.685-.773-.263-1.687-.4-2.708-.555z"/>
        </svg>
      ),
      pinterest: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
        </svg>
      ),
      snapchat: (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.032.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301a.69.69 0 01.286-.07.61.61 0 01.326.09 1.65 1.65 0 01-.042.18c-.06.18-.181.436-.391.655-.33.346-.91.639-1.634.818-.18.045-.344.073-.493.088a.556.556 0 00-.428.267c-.102.165-.13.351-.047.52.226.46.557.893.972 1.283.67.626 1.58 1.07 2.71 1.324.403.092.566.328.596.516a.574.574 0 01-.12.407c-.63.75-1.915 1.162-3.543 1.363-.24.029-.295.142-.326.299-.025.126-.052.262-.138.398-.165.261-.405.374-.634.374-.13 0-.256-.031-.37-.092a2.17 2.17 0 01-.353-.146c-.271-.135-.603-.299-1.105-.299-.27 0-.559.036-.869.115-1.168.295-1.959 1.075-3.022 1.075l-.045-.001c-1.069 0-1.86-.78-3.022-1.075a3.21 3.21 0 00-.869-.115c-.502 0-.834.164-1.105.299-.115.057-.232.101-.353.146-.114.061-.24.092-.37.092-.229 0-.469-.113-.634-.374-.086-.136-.113-.272-.138-.398-.031-.157-.086-.27-.326-.299-1.628-.2-2.913-.613-3.543-1.363a.574.574 0 01-.12-.407c.03-.188.193-.424.596-.516 1.13-.254 2.04-.698 2.71-1.324.415-.39.746-.823.972-1.283.083-.169.055-.355-.047-.52a.556.556 0 00-.428-.267 3.327 3.327 0 01-.493-.088c-.724-.179-1.304-.472-1.634-.818-.21-.219-.331-.475-.391-.655a1.65 1.65 0 01-.042-.18.61.61 0 01.326-.09c.076 0 .182.025.286.07.374.181.733.285 1.033.301.198 0 .326-.045.401-.09-.01-.165-.02-.33-.032-.51l-.003-.06c-.104-1.628-.23-3.654.299-4.847C7.853 1.07 11.21.793 12.2.793h.006z"/>
        </svg>
      ),
      globe: (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      ),
    };
    
    return icons[platform] || icons.globe;
  };

  const LazyFallback = ({ isDark, label = "Loading..." }: { isDark: boolean; label?: string }) => (
    <div className="flex items-center justify-center py-12">
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border ${
          isDark ? "bg-gray-900/60 text-gray-200 border-gray-700/60" : "bg-white/80 text-gray-600 border-gray-200/60"
        }`}
      >
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </div>
  );

  export default function App() {
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
          console.log("System maintenance status synced.");
        } catch (error) {
          console.error("Failed to sync maintenance status:", error);
        }
      };
      initMaintenanceMode();
    }, []);
    // --- END NEW CODE ---
    // ... rest of your code
    const [isAdmin, setIsAdmin] = useState(false);
    const [sessionChecked, setSessionChecked] = useState(false);
    const [userRole, setUserRole] = useState<string>("guest"); // guest, member, admin
    const [userName, setUserName] = useState<string>("");
    const [userIdCode, setUserIdCode] = useState<string>("");
    const [userPosition, setUserPosition] = useState<string>("");
    const [userProfilePicture, setUserProfilePicture] = useState<string>("");
    const [logoError, setLogoError] = useState(false);
    const [showDonationPage, setShowDonationPage] =
      useState(false);
    const [showLoginPanel, setShowLoginPanel] = useState(false);
    const [showFeedbackPage, setShowFeedbackPage] = useState(false);
    const [showMembershipApplicationsPage, setShowMembershipApplicationsPage] = useState(false);
    const [showOfficerDirectory, setShowOfficerDirectory] = useState(false);
    const [showAttendanceDashboard, setShowAttendanceDashboard] = useState(false);
    const [showAttendanceRecording, setShowAttendanceRecording] = useState(false);
    const [showManageEvents, setShowManageEvents] = useState(false);
    const [showMyQRID, setShowMyQRID] = useState(false);
    const [showAttendanceTransparency, setShowAttendanceTransparency] = useState(false);
    const [showMyProfile, setShowMyProfile] = useState(false);
    const [showAnnouncements, setShowAnnouncements] = useState(false);
    const [showAccessLogs, setShowAccessLogs] = useState(false);
    const [showSystemTools, setShowSystemTools] = useState(false);
    const [showManageMembers, setShowManageMembers] = useState(false);
    const [showMembershipApplications, setShowMembershipApplications] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [showFounderModal, setShowFounderModal] = useState(false);
    const [showDeveloperModal, setShowDeveloperModal] = useState(false);
    const [cacheVersion, setCacheVersion] = useState<number>(() => {
      try {
        return getLocalCacheVersion();
      } catch {
        return 0;
      }
    });
    const appVersion = import.meta.env.VITE_APP_VERSION || "1.0.0";

    useEffect(() => {
      let isMounted = true;

      const syncCacheVersion = async () => {
        try {
          const backendVersion = await getCacheVersionFromBackend();
          if (!isMounted) return;
          setLocalCacheVersion(backendVersion);
          setCacheVersion(backendVersion);
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

      const handleCacheVersionChange = () => {
        setCacheVersion(getLocalCacheVersion());
      };

      syncCacheVersion();
      window.addEventListener("storage", handleStorage);
      window.addEventListener("cache-version-changed", handleCacheVersionChange);

      return () => {
        isMounted = false;
        window.removeEventListener("storage", handleStorage);
        window.removeEventListener("cache-version-changed", handleCacheVersionChange);
      };
    }, []);
    
    // Upload Toast State for progress bar at bottom-right
    const [uploadToastMessages, setUploadToastMessages] = useState<UploadToastMessage[]>([]);
    
    // Upload Toast Helper Functions
    const addUploadToast = (message: UploadToastMessage) => {
      setUploadToastMessages(prev => [...prev.filter(m => m.id !== message.id), message]);
    };
    
    const updateUploadToast = (id: string, updates: Partial<UploadToastMessage>) => {
      setUploadToastMessages(prev => 
        prev.map(m => m.id === id ? { ...m, ...updates } : m)
      );
    };
    
    const removeUploadToast = (id: string) => {
      setUploadToastMessages(prev => prev.filter(m => m.id !== id));
    };

    const [activePage, setActivePage] = useState<string>("home");
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
      return {
        ...defaults,
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
    });

    // Restore session on mount
    useEffect(() => {
      const storedUser = getStoredUser();
      if (storedUser && hasActiveSession()) {
        // Restore user data from stored session
        setIsAdmin(true);
        setUserRole(storedUser.role);
        setUserName(storedUser.name);
        setUserIdCode(storedUser.id || '');
        setUserPosition(storedUser.position || '');
        setUserProfilePicture(storedUser.profilePic || '');
        console.log('[App] Session restored for user:', storedUser.name);
      }
      setSessionChecked(true);
    }, []);

    // Fetch homepage content from GAS backend on mount
    useEffect(() => {
      const loadHomepageContent = async () => {
        const toastId = `homepage-sync-${Date.now()}`;
        addUploadToast({
          id: toastId,
          title: 'Syncing Homepage',
          message: 'Connecting to backend...',
          status: 'loading',
          progress: 0,
          progressLabel: 'Starting...',
        });
        setIsLoadingHomepage(true);
        setHomepageError(null);
        
        try {
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
          }));
          console.log('[App] Homepage content loaded from GAS');
          updateUploadToast(toastId, {
            status: 'success',
            progress: 100,
            title: 'Homepage Synced',
            message: 'Content loaded from backend.',
          });
          setTimeout(() => removeUploadToast(toastId), 3000);
        } catch (error) {
          console.error('[App] Error loading homepage content:', error);
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
        } finally {
          setIsLoadingHomepage(false);
        }
      };

      loadHomepageContent();
    }, []);

    // Fetch projects from backend on mount
    useEffect(() => {
      const loadProjects = async () => {
        setIsLoadingProjects(true);
        try {
          console.log('[App] Fetching projects from backend...');
          const result = await fetchAllProjects();
          
          if (result.error) {
            console.error('[App] Error loading projects:', result.error);
            toast.error('Failed to load projects');
          } else {
            console.log('[App] Loaded projects:', result.projects);
            setProjects(result.projects);
          }
        } catch (error) {
          console.error('[App] Error loading projects:', error);
          toast.error('Failed to load projects');
        } finally {
          setIsLoadingProjects(false);
        }
      };

      loadProjects();
    }, []);

    // Fetch org chart URL AND Contact Info from backend on mount
    useEffect(() => {
      const loadOtherContent = async () => {
        try {
          // Invalidate cache to ensure we get fresh data on mount
          invalidateOtherContentCache();
          
          console.log('[App] Fetching other content (Contact/OrgChart) from backend...');
          const otherContent = await fetchHomepageOtherContent();
          
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
              socialLinks: otherContent.socialLinks?.map((link: any) => ({
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

          console.log('[App] Contact info updated from backend');
        } catch (error) {
          console.error('[App] Error loading other content:', error);
        }
      };

      loadOtherContent();
    }, []);

    // Retry loading homepage content
    const retryLoadHomepage = async () => {
      const toastId = `homepage-retry-${Date.now()}`;
      addUploadToast({
        id: toastId,
        title: 'Reloading Homepage',
        message: 'Connecting to backend...',
        status: 'loading',
        progress: 0,
        progressLabel: 'Starting...',
      });
      setIsLoadingHomepage(true);
      setHomepageError(null);
      
      try {
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
        }));
        updateUploadToast(toastId, {
          status: 'success',
          progress: 100,
          title: 'Homepage Refreshed',
          message: 'Homepage content updated.',
        });
        setTimeout(() => removeUploadToast(toastId), 3000);
      } catch (error) {
        console.error('[App] Error retrying homepage content:', error);
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
      } finally {
        setIsLoadingHomepage(false);
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

    // Mock donation data
    const [donations, setDonations] = useState<Donation[]>([
      {
        id: 1,
        name: "Anonymous",
        amount: 500,
        date: "2025-01-28",
        status: "verified",
        receiptUrl:
          "https://images.unsplash.com/photo-1554224311-beee4f94860b?w=400",
      },
      {
        id: 2,
        name: "Maria Santos",
        amount: 1000,
        date: "2025-01-27",
        status: "verified",
        receiptUrl:
          "https://images.unsplash.com/photo-1554224311-beee4f94860b?w=400",
      },
      {
        id: 3,
        name: "Juan Dela Cruz",
        amount: 250,
        date: "2025-01-26",
        status: "verified",
        receiptUrl:
          "https://images.unsplash.com/photo-1554224311-beee4f94860b?w=400",
      },
      {
        id: 4,
        name: "Anonymous",
        amount: 750,
        date: "2025-01-25",
        status: "pending",
        receiptUrl:
          "https://images.unsplash.com/photo-1554224311-beee4f94860b?w=400",
      },
    ]);

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

    // YSP Logo URLs
    const primaryLogoUrl = "/icons/pwa-192x192.png";
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
            id: "membership-editor",
            label: "Be a Member Editor",
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
        id: "account-settings",
        label: "Account",
        icon: <Settings className="w-5 h-5" />,
        pages: [
          {
            id: "settings",
            label: "Settings",
            action: () => {
              setActivePage("settings");
              setShowSettings(true);
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
    // auditor (highest) > admin > head > member > suspended > banned (no access)
    const hasRoleAccess = useCallback((requiredRoles: string[] | undefined): boolean => {
      if (!requiredRoles || requiredRoles.length === 0) return true; // Public access
      
      // Define role hierarchy levels (higher number = more access)
      const roleHierarchy: Record<string, number> = {
        banned: 0,      // No access
        suspended: 1,   // Minimal access
        member: 2,      // Standard access
        head: 3,        // Leadership access
        admin: 4,       // Management access
        auditor: 5,     // Highest access
      };

      const userLevel = roleHierarchy[userRole] || 0;
      
      // Check if user's role level meets ANY of the required roles
      return requiredRoles.some(role => {
        const requiredLevel = roleHierarchy[role] || 0;
        return userLevel >= requiredLevel;
      });
    }, [userRole]);

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
            {
              id: "settings",
              label: "Settings",
              action: () => {
                setActivePage("settings");
                setShowSettings(true);
                setIsSidebarOpen(false);
              },
            },
          ],
        }];
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
            return hasRoleAccess(page.roles);
          }),
        }))
        .filter((group) => group.pages.length > 0);
    }, [hasRoleAccess, isAdmin, navigationGroups, userRole]);

    const toggleDark = useCallback(() => {
      setIsDark(!isDark);
      document.documentElement.classList.toggle("dark");
    }, [isDark]);

    const openProjectModal = useCallback((project: Project) => {
      setModalProject(project);
    }, []);

    const closeModal = useCallback(() => {
      setModalProject(null);
    }, []);

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
        console.log('[App] Starting org chart upload:', file.name);
        
        const result = await uploadOrgChart(file, signal);
        console.log('[App] Upload result:', result);

        if (signal.aborted) {
          return;
        }
        
        if (result.success && result.imageUrl) {
          // The backend already saves the URL to the sheet, just update local state
          console.log('[App] Setting org chart URL to:', result.imageUrl);
          setOrgChartUrl(result.imageUrl);
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
        console.log('[App] Deleting org chart from backend...');
        const success = await updateHomepageOtherContent({ orgChartUrl: '' }, signal);
        console.log('[App] Delete result:', success);

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

    const handleLogin = async (username: string, password: string) => {
      // Real authentication via GAS backend
      try {
        const response = await authenticateUser(username, password);
        
        if (response.success && response.user) {
          const user = response.user;
          
          // Handle BANNED accounts - no access
          if (user.role === 'banned') {
            toast.error('Account Banned', {
              description: 'This account has been permanently banned. Contact admin for assistance.',
            });
            return;
          }

          // Handle SUSPENDED accounts - minimal access warning
          if (user.role === 'suspended') {
            setIsAdmin(true); // Allow login but limited
            setUserRole('suspended');
            setUserName(user.name);
            setUserIdCode(user.id || '');
            setUserPosition(user.position || '');
            setUserProfilePicture(user.profilePic || '');
            setShowLoginPanel(false);
            toast.warning('Account Suspended', {
              description: 'Your account has limited access. Contact admin for full restoration.',
            });
            return;
          }

          // Normal login for all other roles
          setIsAdmin(true);
          setUserRole(user.role);
          setUserName(user.name);
          setUserIdCode(user.id || '');
          setUserPosition(user.position || '');
          setUserProfilePicture(user.profilePic || '');
          setShowLoginPanel(false);

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
        }
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
              break;
            case LoginErrorCodes.ACCOUNT_BANNED:
              toast.error('Account Banned', {
                description: loginError.message || 'This account has been permanently banned.',
              });
              break;
            case LoginErrorCodes.TIMEOUT_ERROR:
              toast.error('Connection Timeout', {
                description: 'The server is taking too long to respond. Please try again.',
              });
              break;
            case LoginErrorCodes.NETWORK_ERROR:
              toast.error('Network Error', {
                description: 'Unable to connect to the server. Please check your internet connection.',
              });
              break;
            case LoginErrorCodes.NO_API_URL:
              toast.error('Service Unavailable', {
                description: 'Login service is not configured. Please contact administrator.',
              });
              break;
            default:
              toast.error('Login Failed', {
                description: loginError.message || 'An unexpected error occurred. Please try again.',
              });
          }
        } else {
          toast.error('Login Failed', {
            description: 'An unexpected error occurred. Please try again.',
          });
        }
      }
    };

    const handleLogout = () => {
      // Log logout before clearing session (need username)
      if (userName) {
        logLogout(userName);
      }
      
      // Clear session from storage
      clearSession();
      
      setIsAdmin(false);
      setUserRole("guest");
      setUserName("");
      setUserIdCode("");
      setUserPosition("");
      setUserProfilePicture("");
      setActivePage("home");
      toast.success('Successfully logged out');
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

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = () => {
        setOpenDropdown(null);
      };
      if (openDropdown) {
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
      }
    }, [openDropdown]);

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
      if (showMembershipApplicationsPage) return "membership-editor";
      if (showMembershipApplications) return "membership-applications";
      if (showOfficerDirectory) return "officer-directory";
      if (showAttendanceDashboard) return "attendance-dashboard";
      if (showAttendanceRecording) return "attendance-recording";
      if (showManageEvents) return "manage-events";
      if (showMyQRID) return "my-qrid";
      if (showAttendanceTransparency) return "attendance-transparency";
      if (showMyProfile) return "my-profile";
      if (showAnnouncements) return "announcements";
      if (showAccessLogs) return "access-logs";
      if (showSystemTools) return "system-tools";
      if (showManageMembers) return "manage-members";
      if (showSettings) return "settings";
      if (showDonationPage) return "donation";
      return activePage;
    }, [
      activePage,
      showAccessLogs,
      showAnnouncements,
      showAttendanceDashboard,
      showAttendanceRecording,
      showAttendanceTransparency,
      showDonationPage,
      showFeedbackPage,
      showManageEvents,
      showManageMembers,
      showMembershipApplications,
      showMembershipApplicationsPage,
      showMyProfile,
      showMyQRID,
      showOfficerDirectory,
      showSettings,
      showSystemTools,
    ]);

    useEffect(() => {
      try {
        localStorage.setItem(LAST_VIEW_KEY, currentView);
      } catch {
        // Ignore storage failures.
      }
    }, [currentView]);

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
        if (hasRoleAccess(["admin", "auditor"])) { 
          setActivePage("membership-editor");
          setShowMembershipApplicationsPage(true);
          return true;
        }
        return false;
      // FIXED SECTION END
      // FIXED SECTION END

      case "officer-directory":
          // CHANGED: "member" -> "head"
          if (hasRoleAccess(["head"])) { 
            setActivePage("officer-directory");
            setShowOfficerDirectory(true);
            return true;
          }
          return false;
        case "attendance-dashboard":
          if (hasRoleAccess(["head"])) {
            setActivePage("attendance-dashboard");
            setShowAttendanceDashboard(true);
            return true;
          }
          return false;
        case "attendance-recording":
          if (hasRoleAccess(["head"])) {
            setActivePage("attendance-recording");
            setShowAttendanceRecording(true);
            return true;
          }
          return false;
        case "manage-events":
          if (hasRoleAccess(["admin"])) {
            setActivePage("manage-events");
            setShowManageEvents(true);
            return true;
          }
          return false;
        case "my-qrid":
          if (hasRoleAccess(["member"])) {
            setActivePage("my-qrid");
            setShowMyQRID(true);
            return true;
          }
          return false;
        case "attendance-transparency":
          if (hasRoleAccess(["member"])) {
            setActivePage("attendance-transparency");
            setShowAttendanceTransparency(true);
            return true;
          }
          return false;
        case "my-profile":
          if (isAdmin || userRole === "suspended") {
            setActivePage("my-profile");
            setShowMyProfile(true);
            return true;
          }
          return false;
        case "announcements":
          if (hasRoleAccess(["member"])) {
            setActivePage("announcements");
            setShowAnnouncements(true);
            return true;
          }
          return false;
        case "access-logs":
          if (hasRoleAccess(["auditor"])) {
            setActivePage("access-logs");
            setShowAccessLogs(true);
            return true;
          }
          return false;
        case "system-tools":
          // CHANGED: "admin" -> "auditor"
          if (hasRoleAccess(["auditor"])) {
            setActivePage("system-tools");
            setShowSystemTools(true);
            return true;
          }
          return false;
        case "manage-members":
          if (hasRoleAccess(["admin"])) {
            setActivePage("manage-members");
            setShowManageMembers(true);
            return true;
          }
          return false;
        case "settings":
          if (hasRoleAccess(["member"])) {
            setActivePage("settings");
            setShowSettings(true);
            return true;
          }
          return false;
        case "donation":
          if (isAdmin) {
            setActivePage("donation");
            setShowDonationPage(true);
            return true;
          }
          return false;
        default:
          return false;
      }
    }, [
      hasRoleAccess,
      isAdmin,
      userRole,
      setActivePage,
      setShowAccessLogs,
      setShowAnnouncements,
      setShowAttendanceDashboard,
      setShowAttendanceRecording,
      setShowAttendanceTransparency,
      setShowDonationPage,
      setShowFeedbackPage,
      setShowManageEvents,
      setShowManageMembers,
      setShowMembershipApplications,
      setShowMembershipApplicationsPage,
      setShowMyProfile,
      setShowMyQRID,
      setShowOfficerDirectory,
      setShowSettings,
      setShowSystemTools,
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

      if (storedView) {
        const opened = openStoredView(storedView);
        if (!opened) {
          setActivePage("home");
        }
      }

      hasRestoredViewRef.current = true;
    }, [openStoredView, sessionChecked]);

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
    }, [isFullMaintenance]);

    // Check for Page-Specific Maintenance Mode
    const pageMaintenanceMap: { [key: string]: string } = {
      feedback: "feedback",
      "membership-editor": "membership-editor",
      "officer-directory": "officer-directory",
      "attendance-dashboard": "attendance-dashboard",
      "attendance-recording": "attendance-recording",
      "manage-events": "manage-events",
      "my-qrid": "my-qrid",
      "attendance-transparency": "attendance-transparency",
      "my-profile": "my-profile",
      announcements: "announcements",
      "access-logs": "access-logs",
      "system-tools": "system-tools",
      "manage-members": "manage-members",
      "membership-applications": "membership-applications",
      donation: "donation",
    };

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
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100" style={{ WebkitOverflowScrolling: 'touch', whiteSpace: 'nowrap', paddingBottom: 8, minHeight: 370 }}>
          {projects.map((project) => (
            <span key={project.projectId} style={{ display: 'inline-block', verticalAlign: 'top', marginRight: 24, width: 350, maxWidth: '90vw' }}>
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
            </span>
          ))}
        </div>
      );
    }, [isAdmin, isDark, isLoadingProjects, openProjectModal, projects, selectedProjectIds, startEditProject, toggleProjectSelection]);

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
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading feedback..." />}>
            <FeedbackPage
              onClose={() => setShowFeedbackPage(false)}
              isAdmin={isAdmin}
              isDark={isDark}
              userRole={userRole}
              username={userName || (userRole === 'guest' ? 'Guest' : 'admin')}
            />
          </Suspense>
        </>
      );
    }

    // Show Membership Applications page if flag is true
    if (showMembershipApplicationsPage) {
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
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading applications..." />}>
            <MembershipApplicationsPage
              onClose={() => setShowMembershipApplicationsPage(false)}
              isDark={isDark}
              userRole={userRole}
              isLoggedIn={isAdmin}
              pendingApplications={pendingApplications}
              setPendingApplications={setPendingApplications}
              username={userName || 'admin'}
            />
          </Suspense>
        </>
      );
    }

    // Show Officer Directory page
    if (showOfficerDirectory) {
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
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading directory..." />}>
            <OfficerDirectoryPage
              onClose={() => setShowOfficerDirectory(false)}
              isDark={isDark}
            />
          </Suspense>
        </>
      );
    }

    // Show Attendance Dashboard page
    if (showAttendanceDashboard) {
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
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading dashboard..." />}>
            <AttendanceDashboardPage
              onClose={() => setShowAttendanceDashboard(false)}
              isDark={isDark}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
            />
          </Suspense>
          {/* Upload Toast Container for export progress */}
          <UploadToastContainer
            messages={uploadToastMessages}
            onDismiss={removeUploadToast}
            isDark={isDark}
          />
        </>
      );
    }

    // Show QR Scanner page
    // Show Attendance Recording page (combined QR + Manual)
    if (showAttendanceRecording) {
      if (isPageInMaintenance("attendance-recording")) {
        const config = getPageMaintenanceConfig("attendance-recording");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Attendance Recording" onBack={() => setShowAttendanceRecording(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading attendance..." />}>
            <AttendanceRecordingPage onClose={() => setShowAttendanceRecording(false)} isDark={isDark} />
          </Suspense>
        </>
      );
    }

    // Show Manage Events page
    if (showManageEvents) {
      if (isPageInMaintenance("manage-events")) {
        const config = getPageMaintenanceConfig("manage-events");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Manage Events" onBack={() => setShowManageEvents(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading events..." />}>
            <ManageEventsPage onClose={() => setShowManageEvents(false)} isDark={isDark} username={userName || 'admin'} />
          </Suspense>
        </>
      );
    }

    // Show My QR ID page
    if (showMyQRID) {
      if (isPageInMaintenance("my-qrid")) {
        const config = getPageMaintenanceConfig("my-qrid");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="My QR ID" onBack={() => setShowMyQRID(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading QR..." />}>
            <MyQRIDPage onClose={() => setShowMyQRID(false)} isDark={isDark} />
          </Suspense>
        </>
      );
    }

    // Show Attendance Transparency page
    if (showAttendanceTransparency) {
      if (isPageInMaintenance("attendance-transparency")) {
        const config = getPageMaintenanceConfig("attendance-transparency");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Attendance Transparency" onBack={() => setShowAttendanceTransparency(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading attendance..." />}>
            <AttendanceTransparencyPage onClose={() => setShowAttendanceTransparency(false)} isDark={isDark} userName={userName} memberId={userIdCode} />
          </Suspense>
        </>
      );
    }

    // Show My Profile page
    if (showMyProfile) {
      if (isPageInMaintenance("my-profile")) {
        const config = getPageMaintenanceConfig("my-profile");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="My Profile" onBack={() => setShowMyProfile(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading profile..." />}>
            <MyProfilePage 
              onClose={() => setShowMyProfile(false)} 
              isDark={isDark}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
              onProfilePictureChange={(newUrl) => setUserProfilePicture(newUrl)}
            />
          </Suspense>
          <UploadToastContainer
            messages={uploadToastMessages}
            onDismiss={removeUploadToast}
            isDark={isDark}
          />
        </>
      );
    }

    // Show Announcements page
    if (showAnnouncements) {
      if (isPageInMaintenance("announcements")) {
        const config = getPageMaintenanceConfig("announcements");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Announcements" onBack={() => setShowAnnouncements(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading announcements..." />}>
            <AnnouncementsPage onClose={() => setShowAnnouncements(false)} isDark={isDark} userRole={userRole} username={userName || 'admin'} />
          </Suspense>
        </>
      );
    }

    // Show Access Logs page
    if (showAccessLogs) {
      if (isPageInMaintenance("access-logs")) {
        const config = getPageMaintenanceConfig("access-logs");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Access Logs" onBack={() => setShowAccessLogs(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading access logs..." />}>
            <AccessLogsPage onClose={() => setShowAccessLogs(false)} isDark={isDark} username={userName || 'admin'} addUploadToast={addUploadToast} updateUploadToast={updateUploadToast} removeUploadToast={removeUploadToast} />
          </Suspense>
        </>
      );
    }

    // Show System Tools page
    if (showSystemTools) {
      if (isPageInMaintenance("system-tools")) {
        const config = getPageMaintenanceConfig("system-tools");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="System Tools" onBack={() => setShowSystemTools(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading system tools..." />}>
            <SystemToolsPage 
              onClose={() => setShowSystemTools(false)} 
              isDark={isDark} 
              username={userName || 'admin'}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
            />
          </Suspense>
          <UploadToastContainer messages={uploadToastMessages} onDismiss={removeUploadToast} isDark={isDark} />
        </>
      );
    }

    // Show Manage Members page
    if (showManageMembers) {
      if (isPageInMaintenance("manage-members")) {
        const config = getPageMaintenanceConfig("manage-members");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Manage Members" onBack={() => setShowManageMembers(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading members..." />}>
            <ManageMembersPage onClose={() => setShowManageMembers(false)} isDark={isDark} pendingApplications={pendingApplications} setPendingApplications={setPendingApplications} currentUserName={userName} />
          </Suspense>
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
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading applications..." />}>
            <MembershipApplicationsPage onClose={() => setShowMembershipApplications(false)} isDark={isDark} userRole={userRole} isLoggedIn={isAdmin} pendingApplications={pendingApplications} setPendingApplications={setPendingApplications} username={userName || 'admin'} />
          </Suspense>
        </>
      );
    }

    // Show Settings page
    if (showSettings) {
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
          <Suspense fallback={null}>
            <SettingsPage
              onClose={() => setShowSettings(false)}
              isDark={isDark}
              onToggleDark={toggleDark}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
            />
          </Suspense>
          <UploadToastContainer messages={uploadToastMessages} onDismiss={removeUploadToast} isDark={isDark} />
        </>
      );
    }

    // Show donation page if flag is true
    if (showDonationPage) {
      if (isPageInMaintenance("donation")) {
        const config = getPageMaintenanceConfig("donation");
        return (
          <>
            <MaintenanceScreen isDark={isDark} message={config.message} estimatedTime={config.estimatedTime} pageName="Donation Tracker" onBack={() => setShowDonationPage(false)} onContactDeveloper={() => setShowDeveloperModal(true)} />
            <Suspense fallback={null}>
              <DeveloperModal isOpen={showDeveloperModal} onClose={() => setShowDeveloperModal(false)} isDark={isDark} isAdmin={isAdmin} />
            </Suspense>
          </>
        );
      }
      return (
        <>
          <Toaster position="top-center" richColors closeButton theme={isDark ? "dark" : "light"} toastOptions={{style: {fontFamily: "var(--font-sans)"}}}/>
          <Suspense fallback={<LazyFallback isDark={isDark} label="Loading donations..." />}>
            <DonationPage onClose={() => setShowDonationPage(false)} donations={donations} onDonationsUpdate={setDonations} isAdmin={isAdmin} />
          </Suspense>
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

    return (
      <div className="min-h-screen transition-colors duration-300" style={{ 
        overflow: 'visible',
        background: isDark ? '#0f172a' : '#f8fafc'
      }}>

      {/* ⬇️ PASTE THIS BLOCK HERE ⬇️ */}
        <Helmet>
          <title>Home | Youth Service Philippines Tagum</title>
          <meta 
            name="description" 
            content="Official portal of Youth Service Philippines Tagum Chapter. Join us in youth leadership, community service, and nation-building initiatives in Tagum City." 
          />
          <link rel="canonical" href="https://www.youthservicephilippinestagum.me/" />
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

        {/* Top Bar - Floating Header - Only on Homepage */}
        {!showOfficerDirectory && !showAttendanceDashboard && !showAttendanceRecording && 
        !showManageEvents && !showMyQRID && 
        !showAttendanceTransparency && !showAnnouncements && !showAccessLogs && 
        !showSystemTools && !showManageMembers && !showFeedbackPage && 
        !showMembershipApplicationsPage && !showMyProfile && !showSettings && (
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
            setShowAccessLogs(false);
            setShowSystemTools(false);
            setShowFeedbackPage(false);
            setShowMyProfile(false);
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
            <div className="fixed bottom-6 right-6" style={{ zIndex: 45 }}>
              <button
                onClick={handleStartEditing}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-white transition-all duration-300 shadow-md"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  fontWeight: "600",
                  fontSize: "14px",
                }}
              >
                <Edit3 className="w-4 h-4" />
                <span className="hidden sm:inline">Edit</span>
              </button>
            </div>
          )}

          {/* Save/Cancel Controls - Fixed Position */}
          {isEditingHomepage && (
            <div className="fixed bottom-6 right-6 flex gap-3" style={{ zIndex: 45 }}>
              <button
                onClick={handleCancelEditing}
                disabled={isSavingHomepage}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
                  fontWeight: "600",
                  fontSize: "16px",
                }}
              >
                <X className="w-5 h-5" />
                Cancel
              </button>
              <button
                onClick={handleSaveEditing}
                disabled={isSavingHomepage}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                style={{
                  background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                  fontWeight: "600",
                  fontSize: "16px",
                }}
              >
                {isSavingHomepage ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
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

            {/* Button Group - Hide Login and Be a Member when logged in */}
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

                {/* Secondary Button - Be a Member */}
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
                  Be a Member!
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
                  {/* Email Card */}
                  <a
                    // CHANGED: Use Gmail Web Compose with encodeURIComponent to handle '+' sign correctly
                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(homepageContent.contact.email)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-4 p-4 md:p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl transition-all duration-250 hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]"
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
                  </a>

                  {/* Phone Card */}
                  <a
                    href={`tel:${homepageContent.contact.phone.replace(/\s/g, '')}`}
                    className="flex items-center gap-4 p-4 md:p-5 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl transition-all duration-250 hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98]"
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
                  </a>

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
                    
                    {/* LOGIC: Determine if it is an email or a web link */}
                    {(() => {
                      let linkValue = homepageContent.contact.partnerButtonLink || "";
                      linkValue = linkValue.trim();
                      
                      // Check if it is an email
                      const isEmail = linkValue.includes("@") && !linkValue.toLowerCase().includes("http");
                      
                      let finalHref = linkValue;
                      let target = "_blank"; // Default to new tab for web
                      
                      if (isEmail) {
                        // OPTION: Force open in Gmail Web Compose
                        // We must use encodeURIComponent to handle special characters like '+' in emails
                        finalHref = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(linkValue)}`;
                        target = "_blank"; // Open Gmail in new tab
                      } else {
                        // Standard Web Link
                        if (!linkValue.startsWith("http://") && !linkValue.startsWith("https://")) {
                          finalHref = `https://${linkValue}`;
                        }
                      }
                      
                      return (
                        <a
                          href={finalHref}
                          target={target}
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
                          {isEmail ? <Mail className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
                          {homepageContent.contact.partnerButtonText}
                        </a>
                      );
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
                    href="https://mail.google.com/mail/u/0/?fs=1&to=ysptagumchapter%2Bportal@gmail.com&tf=cm"
                    target="_blank"
                    rel="noopener noreferrer"
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
                className="absolute top-3 right-3 sm:top-4 sm:right-4 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all duration-300 hover:rotate-90 hover:scale-110"
                style={{ zIndex: 10 }}
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
                <div className="p-5 sm:p-6 md:p-8">
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
                    }}
                  >
                    <FormattedText text={modalProject.description} />
                  </div>
                </div>
              </div>

              {/* Fixed Footer with Action Buttons */}
              <div className="grid grid-cols-2 gap-3 p-5 sm:p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-3xl">
                {modalProject.link && modalProject.linkText && (
                  <a
                    href={modalProject.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg text-sm sm:text-base group min-w-0"
                    style={{
                      background:
                        "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                      fontWeight: "600",
                      boxShadow:
                        "0 2px 8px rgba(246, 66, 31, 0.3)",
                    }}
                  >
                    <ExternalLink className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                    <span className="truncate">{modalProject.linkText}</span>
                  </a>
                )}
                <button
                  onClick={closeModal}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm sm:text-base min-w-0 ${
                    modalProject.link && modalProject.linkText ? "" : "col-span-2"
                  }`}
                  style={{
                    borderColor: "#f6421f",
                    color: "#f6421f",
                    fontWeight: "600",
                  }}
                >
                  <span className="truncate">Close</span>
                </button>
              </div>
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
        <Suspense fallback={null}>
          <LoginPanel
            isOpen={showLoginPanel}
            onClose={() => setShowLoginPanel(false)}
            onLogin={handleLogin}
            isDark={isDark}
          />
        </Suspense>



        {/* Upload Toast Container - Progress bars at bottom-right */}
        <UploadToastContainer
          messages={uploadToastMessages}
          onDismiss={removeUploadToast}
          isDark={isDark}
        />
      </div>
    );
  }
