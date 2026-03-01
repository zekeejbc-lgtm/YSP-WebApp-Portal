/**
 * =============================================================================
 * MY QR ID PAGE
 * =============================================================================
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Uses PageLayout master component
 * ✅ QR Code: 280px desktop, 200px mobile
 * ✅ Orange outline: 4px thickness
 * ✅ Download dropdown: Full ID Card or QR Only
 * ✅ Full ID Card: Front & Back design with YSP branding
 * ✅ Center-aligned layout
 * ✅ Real backend integration via getStoredUser()
 * ✅ Skeleton loading while fetching user data
 * ✅ PDF export with standard ID card size (CR80: 85.6mm x 53.98mm)
 * 
 * =============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { Download, Smartphone, ChevronDown, CreditCard, QrCode, FileImage, FileText, AlertCircle, X, ShieldAlert, Lock } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { PageLayout, DESIGN_TOKENS, Button } from "./design-system";
import { getStoredUser, fetchUserProfile, checkEmailVerified } from "../services/gasLoginService";
import { loadUserProfileFromCache } from "../services/localStorageCache";
import type { UploadToastMessage } from "./UploadToast";

interface MyQRIDPageProps {
  onClose: () => void;
  isDark: boolean;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast?: (id: string) => void;
  onNavigate?: (page: string) => void;
}

// Extended user data interface for full ID card
interface ExtendedUserData {
  fullName: string;
  idCode: string;
  position: string;
  birthday?: string;
  contactNumber?: string;
  email?: string;
  profilePictureURL?: string;
  chapter?: string;
  committee?: string;
  dateJoined?: string;
  // Emergency contact
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactNumber?: string;
  // Additional info
  address?: string;
  bloodType?: string;
  // Required directory fields (non-optional for QR access)
  gender?: string;
  civilStatus?: string;
  religion?: string;
  nationality?: string;
  barangay?: string;
  city?: string;
  province?: string;
  zipCode?: string;
}

// Required fields for QR access (excluding optional social media fields)
const REQUIRED_DIRECTORY_FIELDS: { key: keyof ExtendedUserData; label: string }[] = [
  { key: 'fullName', label: 'Full Name' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'gender', label: 'Gender' },
  { key: 'contactNumber', label: 'Contact Number' },
  { key: 'email', label: 'Email' },
  { key: 'civilStatus', label: 'Civil Status' },
  { key: 'religion', label: 'Religion' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'address', label: 'Address' },
  { key: 'barangay', label: 'Barangay' },
  { key: 'city', label: 'City' },
  { key: 'emergencyContactName', label: 'Emergency Contact Name' },
  { key: 'emergencyContactRelation', label: 'Emergency Contact Relation' },
  { key: 'emergencyContactNumber', label: 'Emergency Contact Number' },
  { key: 'province', label: 'Province' },
  { key: 'zipCode', label: 'Zip Code' },
  { key: 'profilePictureURL', label: 'Profile Picture' },
];

// Cache key for generated ID cards - increment version to invalidate cache
const ID_CARD_CACHE_KEY = 'ysp_id_card_cache';
const ID_CARD_CACHE_VERSION = '3.3'; // Bump this when ID card design changes
const MYQR_DEBUG_LOGS = import.meta.env.DEV && import.meta.env.VITE_DEBUG_MYQR === 'true';
const logMyQRDebug = (...args: unknown[]) => {
  if (MYQR_DEBUG_LOGS) {
    console.warn(...args);
  }
};

// YSP Organization constants
const YSP_LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const YSP_ORG_NAME = "Youth Service Philippines";
const YSP_CHAPTER = "Tagum Chapter";
const YSP_TAGLINE = "Shaping the Future to a Greater Society";

// Standard ID Card size (CR80) in PORTRAIT orientation: 53.98mm x 85.6mm
// Portrait means width < height
const ID_CARD_WIDTH_MM = 53.98;
const ID_CARD_HEIGHT_MM = 85.6;

// Canvas dimensions for high-quality output (300 DPI equivalent)
const ID_CARD_SCALE = 4; // 4x for high resolution
const ID_CARD_WIDTH_PX = Math.round(ID_CARD_WIDTH_MM * 3.78 * ID_CARD_SCALE); // ~816px
const ID_CARD_HEIGHT_PX = Math.round(ID_CARD_HEIGHT_MM * 3.78 * ID_CARD_SCALE); // ~1295px

// Shared shimmer styles - matches SkeletonCard.tsx pattern
const ShimmerStyles = () => (
  <style>{`
    .skeleton-shimmer {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.4) 50%,
        transparent 100%
      );
      animation: shimmer 1.5s infinite;
    }

    .dark .skeleton-shimmer {
      background: linear-gradient(
        90deg,
        transparent 0%,
        rgba(255, 255, 255, 0.1) 50%,
        transparent 100%
      );
    }

    @keyframes shimmer {
      0% {
        transform: translateX(-100%);
      }
      100% {
        transform: translateX(100%);
      }
    }
  `}</style>
);

// Skeleton Loading Component - matches existing design system
function SkeletonLoader({ isDark }: { isDark: boolean }) {
  const qrSize = typeof window !== "undefined" && window.innerWidth < 768 
    ? DESIGN_TOKENS.media.qrCode.sizeMobile 
    : DESIGN_TOKENS.media.qrCode.sizeDesktop;

  return (
    <div className={isDark ? 'dark' : ''}>
      <ShimmerStyles />
      
      {/* QR Code Skeleton */}
      <div
        className="inline-block rounded-2xl mx-auto"
        style={{
          padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          border: `${DESIGN_TOKENS.media.qrCode.outlineThickness}px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
        }}
      >
        <div 
          className={`rounded-lg relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ 
            width: qrSize,
            height: qrSize,
          }}
        >
          <div className="skeleton-shimmer" />
        </div>
      </div>

      {/* User Info Skeleton */}
      <div style={{ marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px` }}>
        {/* Name */}
        <div 
          className={`rounded-lg mx-auto relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ 
            height: '32px', 
            width: '200px',
            marginBottom: `${DESIGN_TOKENS.spacing.scale.sm}px`,
          }}
        >
          <div className="skeleton-shimmer" />
        </div>
        {/* Position */}
        <div 
          className={`rounded-lg mx-auto relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ 
            height: '24px', 
            width: '150px',
            marginBottom: `${DESIGN_TOKENS.spacing.scale.xs}px`,
          }}
        >
          <div className="skeleton-shimmer" />
        </div>
        {/* ID Code */}
        <div 
          className={`rounded-lg mx-auto relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ 
            height: '20px', 
            width: '120px',
          }}
        >
          <div className="skeleton-shimmer" />
        </div>
      </div>

      {/* Instructions Skeleton */}
      <div
        className="border-t pt-6 max-w-md mx-auto"
        style={{
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        }}
      >
        <div 
          className={`rounded-lg mx-auto relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}
          style={{ height: '16px', width: '280px' }}
        >
          <div className="skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}

export default function MyQRIDPage({
  onClose,
  isDark,
  addUploadToast,
  updateUploadToast,
  removeUploadToast,
  onNavigate,
}: MyQRIDPageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<ExtendedUserData | null>(null);
  const [showDownloadDropdown, setShowDownloadDropdown] = useState(false);
  const [showFormatModal, setShowFormatModal] = useState<'full' | 'qr' | null>(null);
  const [showIncompleteModal, setShowIncompleteModal] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isProfileLocked, setIsProfileLocked] = useState(false);
  const [lockReason, setLockReason] = useState<'email' | 'profile' | null>(null);
  const [missingProfileFields, setMissingProfileFields] = useState<string[]>([]);
  const [cachedFrontCard, setCachedFrontCard] = useState<string | null>(null);
  const [cachedBackCard, setCachedBackCard] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const hiddenQrRef = useRef<HTMLDivElement>(null);

  // Handle navigation to profile page
  const handleGoToProfile = () => {
    if (onNavigate) {
      onNavigate('my-profile');
    } else {
      onClose();
    }
  };

  // Fetch user data from stored session on mount
  useEffect(() => {
    const loadUserData = async () => {
      // Helper to check if a value is actually filled
      const hasValue = (val: string | undefined | null): boolean => {
        if (!val) return false;
        const trimmed = val.trim().toLowerCase();
        return trimmed !== '' && trimmed !== 'n/a' && trimmed !== 'null' && trimmed !== 'undefined';
      };

      // Helper to build ExtendedUserData from profile
      const buildExtendedData = (p: Record<string, unknown>, fallbackName: string, fallbackId: string, fallbackPosition: string): ExtendedUserData => ({
        fullName: (p.fullName as string) || fallbackName,
        idCode: (p.idCode as string) || fallbackId,
        position: (p.position as string) || fallbackPosition || 'Member',
        birthday: p.birthday as string | undefined,
        contactNumber: p.contactNumber as string | undefined,
        email: (p.email || p.personalEmail) as string | undefined,
        profilePictureURL: p.profilePictureURL as string | undefined,
        chapter: p.chapter as string | undefined,
        committee: p.committee as string | undefined,
        dateJoined: p.dateJoined as string | undefined,
        emergencyContactName: p.emergencyContactName as string | undefined,
        emergencyContactRelation: p.emergencyContactRelation as string | undefined,
        emergencyContactNumber: p.emergencyContactNumber as string | undefined,
        address: p.address as string | undefined,
        gender: p.gender as string | undefined,
        civilStatus: p.civilStatus as string | undefined,
        religion: p.religion as string | undefined,
        nationality: p.nationality as string | undefined,
        barangay: p.barangay as string | undefined,
        city: p.city as string | undefined,
        province: p.province as string | undefined,
        zipCode: p.zipCode as string | undefined,
      });

      // Helper to check profile completeness and set lock state
      const checkAndSetLockState = (extendedData: ExtendedUserData, emailVerified: boolean) => {
        const missingFields: string[] = [];
        for (const field of REQUIRED_DIRECTORY_FIELDS) {
          const value = extendedData[field.key];
          if (!hasValue(value as string | undefined)) {
            missingFields.push(field.label);
          }
        }

        logMyQRDebug('[MyQRIDPage] Profile completeness:', { 
          emailVerified, 
          missingFields,
          requiredFieldsCount: REQUIRED_DIRECTORY_FIELDS.length
        });

        if (!emailVerified) {
          setIsProfileLocked(true);
          setLockReason('email');
        } else if (missingFields.length > 0) {
          setIsProfileLocked(true);
          setLockReason('profile');
          setMissingProfileFields(missingFields);
        } else {
          setIsProfileLocked(false);
          setLockReason(null);
        }
      };

      try {
        // First try to get from stored session
        const storedUser = getStoredUser();
        
        if (!storedUser) {
          toast.error('Please log in to view your QR ID');
          onClose();
          return;
        }

        // Keep showing skeleton loader until we verify profile completeness
        // This prevents the "Complete Your Profile" screen from appearing as a loading state
        setIsLoading(true);

        // Get cached profile for fallback, but DON'T show it immediately
        const cachedProfile = loadUserProfileFromCache(storedUser.username);
        let emailVerified = false;
        let finalUserData: ExtendedUserData | null = null;

        // FETCH FRESH DATA FIRST before deciding what to show
        try {
          const profileResponse = await fetchUserProfile(storedUser.username);
          logMyQRDebug('[MyQRIDPage] Profile response:', profileResponse);
          
          if (profileResponse.success && profileResponse.profile) {
            const p = profileResponse.profile;
            logMyQRDebug('[MyQRIDPage] Raw profile data:', {
              birthday: p.birthday,
              contactNumber: p.contactNumber,
              emergencyContactName: p.emergencyContactName,
              emergencyContactNumber: p.emergencyContactNumber,
            });

            finalUserData = buildExtendedData(
              p as unknown as Record<string, unknown>,
              storedUser.name,
              storedUser.id,
              storedUser.position || 'Member'
            );

            // Check email verification status
            const userEmail = p.email || p.personalEmail;
            if (userEmail) {
              try {
                const verifyResult = await checkEmailVerified(storedUser.username, userEmail);
                if (verifyResult.success && verifyResult.verified) {
                  emailVerified = true;
                  setIsEmailVerified(true);
                }
              } catch (e) {
                logMyQRDebug('Email verification check failed:', e);
              }
            }
          } else if (cachedProfile?.data) {
            // Fetch returned no data, use cache as fallback
            logMyQRDebug('[MyQRIDPage] Using cached profile as fallback');
            const p = cachedProfile.data;
            emailVerified = p.emailVerified || false;
            setIsEmailVerified(emailVerified);

            finalUserData = buildExtendedData(
              p as unknown as Record<string, unknown>,
              storedUser.name,
              storedUser.id,
              storedUser.position || 'Member'
            );
          } else {
            // No fresh data and no cache - use minimal stored user data
            finalUserData = {
              fullName: storedUser.name,
              idCode: storedUser.id,
              position: storedUser.position || 'Member',
            };
          }
        } catch (fetchError) {
          logMyQRDebug('[MyQRIDPage] Profile fetch failed:', fetchError);
          
          // Use cache as fallback if available
          if (cachedProfile?.data) {
            logMyQRDebug('[MyQRIDPage] Using cached profile after fetch error');
            const p = cachedProfile.data;
            emailVerified = p.emailVerified || false;
            setIsEmailVerified(emailVerified);

            finalUserData = buildExtendedData(
              p as unknown as Record<string, unknown>,
              storedUser.name,
              storedUser.id,
              storedUser.position || 'Member'
            );
          } else {
            // No cache available, use minimal data
            finalUserData = {
              fullName: storedUser.name,
              idCode: storedUser.id,
              position: storedUser.position || 'Member',
            };
          }
        }

        // NOW that we have all the data, set everything at once
        if (finalUserData) {
          setUserData(finalUserData);
          checkAndSetLockState(finalUserData, emailVerified);
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        toast.error('Failed to load user data');
      } finally {
        // Only stop loading AFTER we've determined what to show
        setIsLoading(false);
      }
    };

    loadUserData();
  }, [onClose]);

  // Pre-generate ID card in background when profile is loaded and complete
  useEffect(() => {
    const preGenerateIDCard = async () => {
      if (!userData || isProfileLocked || isLoading) return;
      
      // Check if already cached
      if (cachedFrontCard && cachedBackCard) {
        logMyQRDebug('[MyQRIDPage] ID cards already in memory cache');
        return;
      }
      
      // Check localStorage cache
      const cached = loadCachedIDCard(userData.idCode);
      if (cached) {
        setCachedFrontCard(cached.front);
        setCachedBackCard(cached.back);
        logMyQRDebug('[MyQRIDPage] Loaded ID cards from localStorage cache');
        return;
      }
      
      // Generate in background
      logMyQRDebug('[MyQRIDPage] Pre-generating ID cards in background...');
      try {
        const frontCanvas = await generateIDCardFront();
        const backCanvas = await generateIDCardBack();
        const frontDataUrl = frontCanvas.toDataURL('image/png');
        const backDataUrl = backCanvas.toDataURL('image/png');
        
        setCachedFrontCard(frontDataUrl);
        setCachedBackCard(backDataUrl);
        cacheIDCard(userData.idCode, frontDataUrl, backDataUrl);
        logMyQRDebug('[MyQRIDPage] ID cards pre-generated and cached');
      } catch (e) {
        logMyQRDebug('[MyQRIDPage] Background ID card generation failed:', e);
      }
    };
    
    // Delay pre-generation slightly to not block initial render
    const timer = setTimeout(preGenerateIDCard, 500);
    return () => clearTimeout(timer);
  }, [userData, isProfileLocked, isLoading]);

  // Check if profile is complete for full ID card
  const checkProfileComplete = (): { isComplete: boolean; missing: string[] } => {
    const missing: string[] = [];
    
    // Helper to check if a value is actually filled (not empty string, null, undefined, or "N/A")
    const hasValue = (val: string | undefined | null): boolean => {
      if (!val) return false;
      const trimmed = val.trim().toLowerCase();
      return trimmed !== '' && trimmed !== 'n/a' && trimmed !== 'null' && trimmed !== 'undefined';
    };
    
    if (!hasValue(userData?.fullName)) missing.push('Full Name');
    if (!hasValue(userData?.idCode)) missing.push('ID Code');
    if (!hasValue(userData?.position)) missing.push('Position');
    if (!hasValue(userData?.birthday)) missing.push('Birthday');
    if (!hasValue(userData?.contactNumber)) missing.push('Contact Number');
    if (!hasValue(userData?.emergencyContactName)) missing.push('Emergency Contact Name');
    if (!hasValue(userData?.emergencyContactNumber)) missing.push('Emergency Contact Number');
    
    // Debug log to help identify issues
    logMyQRDebug('[MyQRIDPage] Profile completeness check:', {
      fullName: userData?.fullName,
      idCode: userData?.idCode,
      position: userData?.position,
      birthday: userData?.birthday,
      contactNumber: userData?.contactNumber,
      emergencyContactName: userData?.emergencyContactName,
      emergencyContactNumber: userData?.emergencyContactNumber,
      missing
    });
    
    return { isComplete: missing.length === 0, missing };
  };

  // Handle download option selection
  const handleDownloadOption = (option: 'full' | 'qr') => {
    setShowDownloadDropdown(false);
    
    if (option === 'full') {
      const { isComplete, missing } = checkProfileComplete();
      if (!isComplete) {
        setMissingFields(missing);
        setShowIncompleteModal(true);
        return;
      }
    }
    
    setShowFormatModal(option);
  };

  // Format date for display
  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  // Cache ID card to localStorage for faster subsequent loads
  const cacheIDCard = (idCode: string, frontDataUrl: string, backDataUrl: string) => {
    try {
      const cacheData = {
        idCode,
        front: frontDataUrl,
        back: backDataUrl,
        timestamp: Date.now(),
        version: ID_CARD_CACHE_VERSION
      };
      localStorage.setItem(`${ID_CARD_CACHE_KEY}_${idCode}`, JSON.stringify(cacheData));
      logMyQRDebug('[MyQRIDPage] ID card cached successfully, version:', ID_CARD_CACHE_VERSION);
    } catch (e) {
      logMyQRDebug('[MyQRIDPage] Failed to cache ID card:', e);
    }
  };

  // Load cached ID card from localStorage
  const loadCachedIDCard = (idCode: string): { front: string; back: string } | null => {
    try {
      const cached = localStorage.getItem(`${ID_CARD_CACHE_KEY}_${idCode}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Check version matches AND cache is less than 24 hours old
        if (data.version === ID_CARD_CACHE_VERSION && 
            data.timestamp && 
            Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
          logMyQRDebug('[MyQRIDPage] Using cached ID card, version:', data.version);
          return { front: data.front, back: data.back };
        } else {
          logMyQRDebug('[MyQRIDPage] Cache invalidated - version mismatch or expired. Cached:', data.version, 'Current:', ID_CARD_CACHE_VERSION);
          // Clear old cache
          localStorage.removeItem(`${ID_CARD_CACHE_KEY}_${idCode}`);
        }
      }
    } catch (e) {
      logMyQRDebug('[MyQRIDPage] Failed to load cached ID card:', e);
    }
    return null;
  };

  // Clear ID card cache (when profile is updated)
  const clearIDCardCache = (idCode: string) => {
    try {
      localStorage.removeItem(`${ID_CARD_CACHE_KEY}_${idCode}`);
    } catch (e) {
      logMyQRDebug('[MyQRIDPage] Failed to clear ID card cache:', e);
    }
  };

  // Convert Google Drive URL to a more accessible format
  const getAccessibleImageUrl = (url: string): string => {
    if (!url) return url;
    
    // Skip data URLs (base64) - they're already accessible
    if (url.startsWith('data:')) {
      return url;
    }
    
    // Skip non-Google URLs
    if (!url.includes('google') && !url.includes('drive.google.com')) {
      return url;
    }
    
    // Extract file ID from various Google Drive URL formats
    let fileId = '';
    
    // Match patterns like: ?id=FILE_ID or /d/FILE_ID
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const dMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const lh3Match = url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
    
    if (idMatch) {
      fileId = idMatch[1];
    } else if (dMatch) {
      fileId = dMatch[1];
    } else if (lh3Match) {
      fileId = lh3Match[1];
    }
    
    if (fileId) {
      // Use lh3.googleusercontent.com format which is more CORS-friendly
      return `https://lh3.googleusercontent.com/d/${fileId}=s500`;
    }
    
    return url;
  };

  // Load image as promise - with CORS handling and Google Drive support
  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      // Convert Google Drive URL to accessible format
      const accessibleUrl = getAccessibleImageUrl(src);
      logMyQRDebug('[loadImage] Original URL:', src.substring(0, 80));
      logMyQRDebug('[loadImage] Accessible URL:', accessibleUrl.substring(0, 80));
      
      const img = new Image();
      
      // For Google Drive images, we need crossOrigin for canvas operations
      img.crossOrigin = 'anonymous';
      
      // Set referrer policy for Google APIs
      img.referrerPolicy = 'no-referrer';
      
      img.onload = () => {
        logMyQRDebug('[loadImage] Successfully loaded:', accessibleUrl.substring(0, 50) + '...');
        resolve(img);
      };
      img.onerror = (e) => {
        console.error('[loadImage] Failed to load:', accessibleUrl, e);
        
        // Try alternative URL formats for Google Drive
        if (accessibleUrl.includes('lh3.googleusercontent.com')) {
          // Try thumbnail format
          const fileIdMatch = src.match(/[?&]id=([a-zA-Z0-9_-]+)/) || 
                              src.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                              src.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
          if (fileIdMatch) {
            const altUrl = `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w500`;
            logMyQRDebug('[loadImage] Trying thumbnail fallback:', altUrl);
            const img2 = new Image();
            img2.crossOrigin = 'anonymous';
            img2.referrerPolicy = 'no-referrer';
            img2.onload = () => resolve(img2);
            img2.onerror = () => {
              // Last resort: try without crossOrigin
              const img3 = new Image();
              img3.referrerPolicy = 'no-referrer';
              img3.onload = () => resolve(img3);
              img3.onerror = reject;
              img3.src = altUrl;
            };
            img2.src = altUrl;
            return;
          }
        }
        reject(e);
      };
      img.src = accessibleUrl;
    });
  };

  // Generate QR Code as data URL
  const getQRCodeDataUrl = async (value: string, size: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      // Create a temporary container
      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      // Create QR code using canvas
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        document.body.removeChild(container);
        reject(new Error('Unable to create canvas context'));
        return;
      }

      // Use the hidden QR ref if available
      if (hiddenQrRef.current) {
        const svg = hiddenQrRef.current.querySelector('svg');
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url = URL.createObjectURL(svgBlob);
          
          const img = new Image();
          img.onload = () => {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, size, size);
            ctx.drawImage(img, 0, 0, size, size);
            URL.revokeObjectURL(url);
            document.body.removeChild(container);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            document.body.removeChild(container);
            reject(new Error('Failed to load QR image'));
          };
          img.src = url;
          return;
        }
      }

      document.body.removeChild(container);
      reject(new Error('QR code not available'));
    });
  };

  // Draw rounded rectangle helper
  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  // Helper function to fit text within a maximum width
  const fitText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    baseFontSize: number,
    fontWeight: string = 'normal',
    fontFamily: string = 'Roboto, sans-serif'
  ): number => {
    let fontSize = baseFontSize;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    
    while (ctx.measureText(text).width > maxWidth && fontSize > 6) {
      fontSize -= 0.5;
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    }
    
    return fontSize;
  };

  // Generate Full ID Card (Front) - PORTRAIT ORIENTATION
  const generateIDCardFront = async (): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = ID_CARD_WIDTH_PX;
    canvas.height = ID_CARD_HEIGHT_PX;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || !userData) throw new Error('Unable to create canvas');

    const scale = ID_CARD_SCALE;
    const padding = 6 * scale;
    
    // Background - White
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Punch hole area at top (for lanyard) - seamless with header
    const punchHoleHeight = 12 * scale;
    const punchHoleRadius = 4 * scale;
    
    // Top header section with gradient - taller to fit logo, org name, chapter, and MEMBER ID badge
    const headerHeight = canvas.height * 0.26 + punchHoleHeight;
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, headerHeight);
    gradient.addColorStop(0, DESIGN_TOKENS.colors.brand.red);
    gradient.addColorStop(0.5, DESIGN_TOKENS.colors.brand.orange);
    gradient.addColorStop(1, DESIGN_TOKENS.colors.brand.red);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, headerHeight);
    
    // Punch hole - cut out circle on the orange header
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, punchHoleHeight / 2, punchHoleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Add a subtle ring around the punch hole for visibility
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, punchHoleHeight / 2, punchHoleRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Logo at top center (adjusted for header starting at Y=0)
    const headerContentStartY = punchHoleHeight;
    try {
      const logo = await loadImage(YSP_LOGO_URL);
      const logoSize = 26 * scale;
      const logoX = (canvas.width - logoSize) / 2;
      const logoY = headerContentStartY + 3 * scale;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 2*scale, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    } catch (e) {
      logMyQRDebug('Logo load failed:', e);
    }

    // Organization name below logo
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = `bold ${7 * scale}px Lexend, sans-serif`;
    ctx.fillText(YSP_ORG_NAME, canvas.width / 2, headerContentStartY + 38 * scale);
    ctx.font = `${5.5 * scale}px Lexend, sans-serif`;
    ctx.fillText(YSP_CHAPTER, canvas.width / 2, headerContentStartY + 46 * scale);

    // "MEMBER ID" badge
    ctx.font = `bold ${5 * scale}px Lexend, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillText('MEMBER ID', canvas.width / 2, headerHeight - 5 * scale);

    // Profile photo area (circular) - CENTER aligned with header edge
    // This means exactly half the circle is in the header, half is below
    const photoSize = 56 * scale;
    const photoX = (canvas.width - photoSize) / 2;
    const photoCenterY = headerHeight;  // Center of circle at header edge
    const photoY = photoCenterY - photoSize / 2;  // Top of photo

    // Photo shadow & border
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 6 * scale;
    ctx.shadowOffsetY = 2 * scale;
    ctx.fillStyle = DESIGN_TOKENS.colors.brand.orange;
    ctx.beginPath();
    ctx.arc(photoX + photoSize/2, photoY + photoSize/2, photoSize/2 + 3*scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Photo background (white)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(photoX + photoSize/2, photoY + photoSize/2, photoSize/2, 0, Math.PI * 2);
    ctx.fill();

    // Load and draw profile picture
    logMyQRDebug('Profile Picture URL:', userData.profilePictureURL);
    if (userData.profilePictureURL) {
      try {
        logMyQRDebug('Attempting to load profile picture...');
        const photo = await loadImage(userData.profilePictureURL);
        logMyQRDebug('Profile picture loaded successfully:', photo.width, 'x', photo.height);
        ctx.save();
        ctx.beginPath();
        ctx.arc(photoX + photoSize/2, photoY + photoSize/2, photoSize/2 - 2*scale, 0, Math.PI * 2);
        ctx.clip();
        const imgAspect = photo.width / photo.height;
        let drawWidth = photoSize - 4*scale;
        let drawHeight = photoSize - 4*scale;
        let drawX = photoX + 2*scale;
        let drawY = photoY + 2*scale;
        if (imgAspect > 1) {
          drawWidth = drawHeight * imgAspect;
          drawX = photoX + 2*scale - (drawWidth - (photoSize - 4*scale)) / 2;
        } else {
          drawHeight = drawWidth / imgAspect;
          drawY = photoY + 2*scale - (drawHeight - (photoSize - 4*scale)) / 2;
        }
        ctx.drawImage(photo, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
      } catch (e) {
        console.error('Profile picture load failed:', e, 'URL:', userData.profilePictureURL);
        ctx.fillStyle = '#d1d5db';
        ctx.beginPath();
        ctx.arc(photoX + photoSize/2, photoY + photoSize/2, photoSize/2 - 2*scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b7280';
        ctx.font = `bold ${20 * scale}px Lexend, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(userData.fullName.charAt(0).toUpperCase(), photoX + photoSize/2, photoY + photoSize/2);
      }
    } else {
      logMyQRDebug('No profile picture URL available');
      ctx.fillStyle = '#d1d5db';
      ctx.beginPath();
      ctx.arc(photoX + photoSize/2, photoY + photoSize/2, photoSize/2 - 2*scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b7280';
      ctx.font = `bold ${20 * scale}px Lexend, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(userData.fullName.charAt(0).toUpperCase(), photoX + photoSize/2, photoY + photoSize/2);
    }

    // NAME - BIG and prominent - more spacing below photo
    const nameStartY = photoY + photoSize + 20 * scale;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const nameFontSize = fitText(ctx, userData.fullName.toUpperCase(), canvas.width - padding * 2, 14 * scale, 'bold', 'Lexend, sans-serif');
    ctx.fillStyle = DESIGN_TOKENS.colors.brand.red;
    ctx.font = `bold ${nameFontSize}px Lexend, sans-serif`;
    ctx.fillText(userData.fullName.toUpperCase(), canvas.width / 2, nameStartY);

    // Position - smaller than name
    const positionFontSize = fitText(ctx, userData.position, canvas.width - padding * 2, 8 * scale, '600', 'Lexend, sans-serif');
    ctx.fillStyle = DESIGN_TOKENS.colors.brand.orange;
    ctx.font = `600 ${positionFontSize}px Lexend, sans-serif`;
    ctx.fillText(userData.position, canvas.width / 2, nameStartY + 11 * scale);

    // INFO SECTION - LEFT ALIGNED (justified on sides) - BIGGER TEXT
    const infoStartY = nameStartY + 24 * scale;
    const lineHeight = 10.5 * scale;
    const labelColor = '#6b7280';
    const valueColor = '#1f2937';
    const infoFontSize = 7.5 * scale;
    const infoLeftX = padding + 4 * scale;
    const labelWidth = 52 * scale;
    const colonX = infoLeftX + labelWidth;
    const valueX = colonX + 6 * scale;
    const maxValueWidth = canvas.width - valueX - padding;

    // Helper to draw left-aligned info row
    const drawInfoRow = (label: string, value: string, yPos: number) => {
      ctx.textAlign = 'left';
      ctx.fillStyle = labelColor;
      ctx.font = `${infoFontSize}px Roboto, sans-serif`;
      ctx.fillText(label, infoLeftX, yPos);
      ctx.fillText(':', colonX, yPos);
      
      const valueFontSize = fitText(ctx, value, maxValueWidth, infoFontSize, 'bold', 'Roboto, sans-serif');
      ctx.fillStyle = valueColor;
      ctx.font = `bold ${valueFontSize}px Roboto, sans-serif`;
      ctx.fillText(value, valueX, yPos);
    };

    drawInfoRow('ID NO', userData.idCode, infoStartY);
    drawInfoRow('D.O.B', formatDate(userData.birthday), infoStartY + lineHeight);
    drawInfoRow('PHONE', userData.contactNumber || 'N/A', infoStartY + lineHeight * 2);
    drawInfoRow('EMAIL', userData.email || 'N/A', infoStartY + lineHeight * 3);
    drawInfoRow('COMMITTEE', userData.committee || 'N/A', infoStartY + lineHeight * 4);
    drawInfoRow('DATE JOINED', formatDate(userData.dateJoined), infoStartY + lineHeight * 5);

    // Footer with YSP motto
    const footerHeight = 14 * scale;
    const footerY = canvas.height - footerHeight;
    const footerGradient = ctx.createLinearGradient(0, footerY, canvas.width, footerY);
    footerGradient.addColorStop(0, DESIGN_TOKENS.colors.brand.red);
    footerGradient.addColorStop(0.5, DESIGN_TOKENS.colors.brand.orange);
    footerGradient.addColorStop(1, DESIGN_TOKENS.colors.brand.red);
    ctx.fillStyle = footerGradient;
    ctx.fillRect(0, footerY, canvas.width, footerHeight);
    
    ctx.font = `italic ${5 * scale}px Lexend, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`"${YSP_TAGLINE}"`, canvas.width / 2, footerY + 9 * scale);

    // Emergency Contact section - just above footer
    const emergencyBoxHeight = 28 * scale;
    const emergencyBoxY = footerY - emergencyBoxHeight - 4 * scale;
    
    // Light background for emergency section
    ctx.fillStyle = '#fef3c7';
    drawRoundedRect(ctx, padding, emergencyBoxY, canvas.width - padding * 2, emergencyBoxHeight, 3 * scale);
    ctx.fill();
    
    ctx.fillStyle = DESIGN_TOKENS.colors.brand.red;
    ctx.font = `bold ${6 * scale}px Lexend, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('IN CASE OF EMERGENCY', canvas.width / 2, emergencyBoxY + 8 * scale);

    // Emergency contact details
    const emergencyName = userData.emergencyContactRelation 
      ? `${userData.emergencyContactName || 'N/A'} (${userData.emergencyContactRelation})`
      : userData.emergencyContactName || 'N/A';
    
    ctx.fillStyle = '#374151';
    ctx.font = `${5.5 * scale}px Roboto, sans-serif`;
    const contactText = `CONTACT: ${emergencyName}`;
    const contactFontSize = fitText(ctx, contactText, canvas.width - padding * 4, 5.5 * scale, 'normal', 'Roboto, sans-serif');
    ctx.font = `${contactFontSize}px Roboto, sans-serif`;
    ctx.fillText(contactText, canvas.width / 2, emergencyBoxY + 17 * scale);
    
    ctx.font = `${5.5 * scale}px Roboto, sans-serif`;
    ctx.fillText(`PHONE: ${userData.emergencyContactNumber || 'N/A'}`, canvas.width / 2, emergencyBoxY + 24 * scale);

    return canvas;
  };

  // Generate Full ID Card (Back) - PORTRAIT ORIENTATION
  const generateIDCardBack = async (): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = ID_CARD_WIDTH_PX;
    canvas.height = ID_CARD_HEIGHT_PX;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || !userData) throw new Error('Unable to create canvas');

    const scale = ID_CARD_SCALE;
    const padding = 6 * scale;
    
    // Punch hole area at top - seamless with gradient
    const punchHoleHeight = 12 * scale;
    const punchHoleRadius = 4 * scale;
    
    // Background gradient - full card (seamless punch hole)
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, DESIGN_TOKENS.colors.brand.red);
    gradient.addColorStop(0.3, DESIGN_TOKENS.colors.brand.orange);
    gradient.addColorStop(0.7, DESIGN_TOKENS.colors.brand.orange);
    gradient.addColorStop(1, DESIGN_TOKENS.colors.brand.red);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Punch hole - cut out circle on the gradient
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, punchHoleHeight / 2, punchHoleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    
    // Add a subtle ring around the punch hole for visibility
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.arc(canvas.width / 2, punchHoleHeight / 2, punchHoleRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Logo at top (after punch hole)
    const logoStartY = punchHoleHeight + 6 * scale;
    try {
      const logo = await loadImage(YSP_LOGO_URL);
      const logoSize = 30 * scale;
      const logoX = (canvas.width - logoSize) / 2;
      const logoY = logoStartY;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 2*scale, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
    } catch (e) {
      logMyQRDebug('Logo load failed:', e);
    }

    // Organization name
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.font = `bold ${8 * scale}px Lexend, sans-serif`;
    ctx.fillText(YSP_ORG_NAME, canvas.width / 2, logoStartY + 42 * scale);
    ctx.font = `${6 * scale}px Lexend, sans-serif`;
    ctx.fillText(YSP_CHAPTER, canvas.width / 2, logoStartY + 51 * scale);

    // QR Code section - BIGGER & CENTERED
    const qrSize = 105 * scale;
    const qrBoxPadding = 6 * scale;
    const qrBoxSize = qrSize + qrBoxPadding * 2;
    const qrBoxX = (canvas.width - qrBoxSize) / 2;
    const qrBoxY = logoStartY + 56 * scale;
    const qrX = qrBoxX + qrBoxPadding;
    const qrY = qrBoxY + qrBoxPadding;

    // White background for QR with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
    ctx.shadowBlur = 8 * scale;
    ctx.shadowOffsetY = 3 * scale;
    ctx.fillStyle = '#FFFFFF';
    drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 5*scale);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Generate and draw QR code
    try {
      const qrDataUrl = await getQRCodeDataUrl(userData.idCode, qrSize);
      const qrImg = await loadImage(qrDataUrl);
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
    } catch (e) {
      logMyQRDebug('QR generation failed:', e);
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
    }

    // ID Number below QR
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `bold ${8 * scale}px Roboto, sans-serif`;
    ctx.textAlign = 'center';
    const idY = qrBoxY + qrBoxSize + 12 * scale;
    ctx.fillText(`ID: ${userData.idCode}`, canvas.width / 2, idY);

    // Footer motto - just floating text at very bottom (no border/background)
    ctx.font = `italic ${5 * scale}px Lexend, sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText(`"${YSP_TAGLINE}"`, canvas.width / 2, canvas.height - 6 * scale);

    // Contact & Reminders card - just above footer
    const contactCardHeight = 42 * scale;
    const contactCardY = canvas.height - 6 * scale - 8 * scale - contactCardHeight;
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    drawRoundedRect(ctx, padding, contactCardY, canvas.width - padding * 2, contactCardHeight, 4 * scale);
    ctx.fill();

    // IF FOUND header
    ctx.fillStyle = DESIGN_TOKENS.colors.brand.red;
    ctx.font = `bold ${5.5 * scale}px Lexend, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('IF FOUND, PLEASE CONTACT:', canvas.width / 2, contactCardY + 8 * scale);

    // Contact links
    ctx.fillStyle = '#374151';
    ctx.font = `${5 * scale}px Roboto, sans-serif`;
    ctx.fillText('fb.com/YSPTagumChapter  •  youthservicephilippinestagum.me', canvas.width / 2, contactCardY + 16 * scale);

    // Reminders - smaller text
    ctx.fillStyle = '#6b7280';
    ctx.font = `${4.5 * scale}px Roboto, sans-serif`;
    ctx.fillText('• This ID is non-transferable', canvas.width / 2, contactCardY + 26 * scale);
    ctx.fillText('• Report if lost immediately', canvas.width / 2, contactCardY + 32 * scale);
    ctx.fillText('• Valid for YSP events only', canvas.width / 2, contactCardY + 38 * scale);

    return canvas;
  };

  // Download QR Code only
  const handleDownloadQROnly = async (format: 'png' | 'pdf') => {
    if (!userData || !qrRef.current) {
      toast.error('Unable to generate QR Code');
      return;
    }

    try {
      const svg = qrRef.current.querySelector('svg');
      if (!svg) {
        toast.error('QR Code not found');
        return;
      }

      // Create canvas for QR with styling
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error('Unable to create canvas');
        return;
      }

      const padding = 40;
      const orangeBorderWidth = 4;
      const qrPadding = 16;
      const nameHeight = 40;
      const idHeight = 30;
      const spacingBetween = 20;
      
      const svgRect = svg.getBoundingClientRect();
      const qrBoxWidth = svgRect.width + (qrPadding * 2) + (orangeBorderWidth * 2);
      const qrBoxHeight = svgRect.height + (qrPadding * 2) + (orangeBorderWidth * 2);
      
      canvas.width = Math.max(qrBoxWidth, 300) + (padding * 2);
      canvas.height = nameHeight + spacingBetween + qrBoxHeight + spacingBetween + idHeight + (padding * 2);

      // White background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // User name
      ctx.fillStyle = DESIGN_TOKENS.colors.brand.red;
      ctx.font = 'bold 24px Lexend, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(userData.fullName, canvas.width / 2, padding + (nameHeight / 2));

      // QR box position
      const qrBoxX = (canvas.width - qrBoxWidth) / 2;
      const qrBoxY = padding + nameHeight + spacingBetween;

      // Orange border
      ctx.fillStyle = DESIGN_TOKENS.colors.brand.orange;
      drawRoundedRect(ctx, qrBoxX, qrBoxY, qrBoxWidth, qrBoxHeight, 16);
      ctx.fill();

      // White inside
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, qrBoxX + orangeBorderWidth, qrBoxY + orangeBorderWidth, 
        qrBoxWidth - (orangeBorderWidth * 2), qrBoxHeight - (orangeBorderWidth * 2), 12);
      ctx.fill();

      // Draw QR code
      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      const img = await loadImage(url);
      const qrX = qrBoxX + orangeBorderWidth + qrPadding;
      const qrY = qrBoxY + orangeBorderWidth + qrPadding;
      ctx.drawImage(img, qrX, qrY);
      URL.revokeObjectURL(url);

      // ID code
      ctx.fillStyle = '#6B7280';
      ctx.font = '600 18px Lexend, sans-serif';
      ctx.fillText(`ID: ${userData.idCode}`, canvas.width / 2, qrBoxY + qrBoxHeight + spacingBetween + (idHeight / 2));

      if (format === 'png') {
        // Use blob download for better compatibility
        canvas.toBlob((blob) => {
          if (!blob) {
            toast.error('Failed to generate image');
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `${userData.idCode}_${userData.fullName.replace(/\s/g, '_')}_QR.png`;
          link.href = blobUrl;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(blobUrl);
          toast.success('QR Code Downloaded');
        }, 'image/png');
      } else {
        // PDF format
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [canvas.width / 3.78, canvas.height / 3.78]
        });
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width / 3.78, canvas.height / 3.78);
        doc.save(`${userData.idCode}_${userData.fullName.replace(/\s/g, '_')}_QR.pdf`);
        toast.success('QR Code PDF Downloaded');
      }

      setShowFormatModal(null);
    } catch (error) {
      console.error('Error downloading QR:', error);
      toast.error('Failed to download QR Code');
    }
  };

  // Download Full ID Card
  const handleDownloadFullID = async (format: 'png' | 'pdf') => {
    if (!userData) {
      toast.error('Unable to generate ID Card');
      return;
    }

    const toastId = `id-card-${Date.now()}`;
    
    // Show progress toast
    if (addUploadToast) {
      addUploadToast({
        id: toastId,
        title: 'Generating ID Card',
        message: 'Checking cache...',
        status: 'loading',
        progress: 5,
      });
    }

    try {
      let frontDataUrl: string;
      let backDataUrl: string;

      // Check if we have cached cards in state
      if (cachedFrontCard && cachedBackCard) {
        logMyQRDebug('[MyQRIDPage] Using in-memory cached cards');
        frontDataUrl = cachedFrontCard;
        backDataUrl = cachedBackCard;
        
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            message: 'Using cached ID card...',
            progress: 70,
          });
        }
      } else {
        // Check localStorage cache
        const cachedCards = loadCachedIDCard(userData.idCode);
        
        if (cachedCards) {
          frontDataUrl = cachedCards.front;
          backDataUrl = cachedCards.back;
          setCachedFrontCard(frontDataUrl);
          setCachedBackCard(backDataUrl);
          
          if (updateUploadToast) {
            updateUploadToast(toastId, {
              message: 'Loaded from cache...',
              progress: 70,
            });
          }
        } else {
          // Generate fresh cards
          if (updateUploadToast) {
            updateUploadToast(toastId, {
              message: 'Creating front side...',
              progress: 10,
            });
          }

          const frontCanvas = await generateIDCardFront();
          frontDataUrl = frontCanvas.toDataURL('image/png');
          
          if (updateUploadToast) {
            updateUploadToast(toastId, {
              message: 'Creating back side...',
              progress: 50,
            });
          }
          
          const backCanvas = await generateIDCardBack();
          backDataUrl = backCanvas.toDataURL('image/png');
          
          // Cache the generated cards
          setCachedFrontCard(frontDataUrl);
          setCachedBackCard(backDataUrl);
          cacheIDCard(userData.idCode, frontDataUrl, backDataUrl);
        }
      }
      
      if (updateUploadToast) {
        updateUploadToast(toastId, {
          message: format === 'png' ? 'Combining images...' : 'Creating PDF...',
          progress: 80,
        });
      }

      if (format === 'png') {
        // Combine front and back side by side for easy viewing
        const gap = 40; // 40px gap between cards
        const combinedCanvas = document.createElement('canvas');
        combinedCanvas.width = ID_CARD_WIDTH_PX * 2 + gap;
        combinedCanvas.height = ID_CARD_HEIGHT_PX;
        const ctx = combinedCanvas.getContext('2d');
        
        if (ctx) {
          // Load the data URLs back to images
          const frontImg = await loadImage(frontDataUrl);
          const backImg = await loadImage(backDataUrl);
          
          ctx.fillStyle = '#f3f4f6';
          ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);
          ctx.drawImage(frontImg, 0, 0);
          ctx.drawImage(backImg, ID_CARD_WIDTH_PX + gap, 0);

          // Use blob download for better compatibility
          combinedCanvas.toBlob((blob) => {
            if (!blob) {
              if (updateUploadToast) {
                updateUploadToast(toastId, {
                  title: 'Generation Failed',
                  message: 'Failed to generate PNG image',
                  status: 'error',
                  progress: 0,
                });
              }
              return;
            }
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.download = `${userData.idCode}_${userData.fullName.replace(/\s/g, '_')}_ID_Card.png`;
            link.href = blobUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
            
            if (updateUploadToast) {
              updateUploadToast(toastId, {
                title: 'ID Card Downloaded',
                message: 'Front and back saved as PNG',
                status: 'success',
                progress: 100,
              });
            }
          }, 'image/png');
        }
      } else {
        // PDF with exact ID card dimensions - PORTRAIT orientation
        const doc = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: [ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM]
        });

        // Front side
        doc.addImage(
          frontDataUrl, 
          'PNG', 
          0, 0, 
          ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM
        );

        // Back side on new page - also portrait
        doc.addPage([ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM], 'portrait');
        doc.addImage(
          backDataUrl, 
          'PNG', 
          0, 0, 
          ID_CARD_WIDTH_MM, ID_CARD_HEIGHT_MM
        );

        doc.save(`${userData.idCode}_${userData.fullName.replace(/\s/g, '_')}_ID_Card.pdf`);
        
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            title: 'ID Card PDF Downloaded',
            message: 'Ready for standard ID card printing (CR80)',
            status: 'success',
            progress: 100,
          });
        }
      }

      setShowFormatModal(null);
    } catch (error) {
      console.error('Error generating ID card:', error);
      if (updateUploadToast) {
        updateUploadToast(toastId, {
          title: 'Generation Failed',
          message: 'Failed to generate ID Card',
          status: 'error',
          progress: 0,
        });
      }
    }
  };

  // Determine QR size based on screen
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const qrSize = isMobile
    ? DESIGN_TOKENS.media.qrCode.sizeMobile
    : DESIGN_TOKENS.media.qrCode.sizeDesktop;

  return (
    <PageLayout
      title="My QR ID"
      subtitle="Present this QR code during events for attendance recording"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Attendance Management", onClick: undefined },
        { label: "My QR ID", onClick: undefined },
      ]}
      actions={undefined}
    >
      {/* Hidden QR for high-res generation */}
      <div ref={hiddenQrRef} style={{ position: 'absolute', left: '-9999px' }}>
        {userData && <QRCodeSVG value={userData.idCode} size={320} level="H" />}
      </div>

      {/* QR Code Card */}
      <div
        className="border rounded-lg text-center"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale["2xl"]}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          background: isDark
            ? `rgba(17, 24, 39, ${DESIGN_TOKENS.glass.backdropOpacity.dark})`
            : `rgba(255, 255, 255, ${DESIGN_TOKENS.glass.backdropOpacity.light})`,
          backdropFilter: `blur(${DESIGN_TOKENS.glass.blur}px)`,
          WebkitBackdropFilter: `blur(${DESIGN_TOKENS.glass.blur}px)`,
        }}
      >
        {isLoading ? (
          <SkeletonLoader isDark={isDark} />
        ) : isProfileLocked ? (
          // LOCKED STATE - Email not verified or profile incomplete
          <div className="flex flex-col items-center justify-center py-8">
            <div 
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{ 
                background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}20, ${DESIGN_TOKENS.colors.brand.orange}20)`,
                border: `2px solid ${DESIGN_TOKENS.colors.brand.red}40`
              }}
            >
              {lockReason === 'email' ? (
                <ShieldAlert className="w-10 h-10" style={{ color: DESIGN_TOKENS.colors.brand.red }} />
              ) : (
                <Lock className="w-10 h-10" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              )}
            </div>
            
            <h3 
              className="text-xl font-semibold mb-2"
              style={{ 
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                color: DESIGN_TOKENS.colors.brand.red
              }}
            >
              {lockReason === 'email' ? 'Email Verification Required' : 'Complete Your Profile'}
            </h3>
            
            <p 
              className="text-center max-w-md mb-6"
              style={{ 
                color: isDark ? '#9ca3af' : '#6b7280',
                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`
              }}
            >
              {lockReason === 'email' 
                ? 'Please verify your email address in your Profile page before you can access your QR ID and download your ID card.'
                : 'Please complete all required fields in your Profile before you can access your QR ID. The following information is missing:'}
            </p>

            {lockReason === 'profile' && missingProfileFields.length > 0 && (
              <div 
                className="mb-6 p-4 rounded-lg w-full max-w-sm"
                style={{ 
                  background: isDark ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.15)',
                  border: '1px solid rgba(251, 191, 36, 0.3)'
                }}
              >
                <ul className="text-sm space-y-1">
                  {missingProfileFields.slice(0, 5).map((field, idx) => (
                    <li key={idx} className="flex items-center gap-2" style={{ color: isDark ? '#fbbf24' : '#b45309' }}>
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {field}
                    </li>
                  ))}
                  {missingProfileFields.length > 5 && (
                    <li className="text-xs italic mt-2" style={{ color: isDark ? '#fbbf24' : '#b45309' }}>
                      ...and {missingProfileFields.length - 5} more fields
                    </li>
                  )}
                </ul>
              </div>
            )}

            <Button
              onClick={handleGoToProfile}
              className="px-6 py-3"
              style={{
                background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}, ${DESIGN_TOKENS.colors.brand.orange})`,
                color: 'white',
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                borderRadius: `${DESIGN_TOKENS.radius.button}px`,
              }}
            >
              Go to Profile
            </Button>
          </div>
        ) : userData ? (
          <>

            {/* QR Code Container with Orange Outline */}
            <div
              ref={qrRef}
              className="inline-block bg-white rounded-2xl mx-auto"
              style={{
                padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
                border: `${DESIGN_TOKENS.media.qrCode.outlineThickness}px solid ${DESIGN_TOKENS.colors.brand.orange}`,
                marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
              }}
            >
              <QRCodeSVG
                value={userData.idCode}
                size={qrSize}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* User Information: Name, Position, ID Code */}
            <div
              style={{
                marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
              }}
            >
              <h2
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.red,
                  marginBottom: `${DESIGN_TOKENS.spacing.scale.sm}px`,
                }}
              >
                {userData.fullName}
              </h2>
              <p
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                  marginBottom: `${DESIGN_TOKENS.spacing.scale.xs}px`,
                }}
              >
                {userData.position}
              </p>
              <p
                className="text-muted-foreground"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
                }}
              >
                ID: {userData.idCode}
              </p>
            </div>

            {/* Download Dropdown Button */}
            <div className="mb-6 flex justify-center relative">
              <button
                onClick={() => setShowDownloadDropdown(!showDownloadDropdown)}
                className="px-6 py-3 rounded-xl bg-[#f6421f] text-white hover:bg-[#d93819] transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <Download className="w-5 h-5" />
                Download
                <ChevronDown className={`w-4 h-4 transition-transform ${showDownloadDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Download Dropdown Menu */}
              {showDownloadDropdown && (
                <>
                  <div
                    className="absolute top-full mt-2 w-64 rounded-xl border shadow-xl overflow-hidden"
                    style={{
                      background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                      backdropFilter: 'blur(20px)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      zIndex: 100,
                    }}
                  >
                    <button
                      onClick={() => handleDownloadOption('full')}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <CreditCard className="w-5 h-5 text-[#f6421f]" />
                      <div>
                        <div className="font-medium">Full ID Card</div>
                        <div className="text-xs text-muted-foreground">Official member ID with photo</div>
                      </div>
                    </button>
                    <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }} />
                    <button
                      onClick={() => handleDownloadOption('qr')}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                    >
                      <QrCode className="w-5 h-5 text-[#ee8724]" />
                      <div>
                        <div className="font-medium">QR Code Only</div>
                        <div className="text-xs text-muted-foreground">Quick scan code for check-in</div>
                      </div>
                    </button>
                  </div>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0" 
                    style={{ zIndex: 50 }}
                    onClick={() => setShowDownloadDropdown(false)}
                  />
                </>
              )}
            </div>

            {/* Instructions */}
            <div
              className="border-t pt-6 max-w-md mx-auto"
              style={{
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
            >
              <p
                className="text-muted-foreground"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
                }}
              >
                <Smartphone className="w-4 h-4 inline-block mr-2" />
                Show this QR code to event organizers for quick check-in
              </p>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Unable to load QR Code. Please try logging in again.</p>
          </div>
        )}
      </div>

      {/* Format Selection Modal */}
      {showFormatModal && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 99999 }}>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowFormatModal(null)}
          />
          
          {/* Modal - centered with proper constraints */}
          <div
            className="relative rounded-2xl border shadow-2xl p-6 mx-4"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              width: '100%',
              maxWidth: '380px',
            }}
          >
            <button
              onClick={() => setShowFormatModal(null)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <h3
              className="text-lg font-semibold mb-2"
              style={{ color: DESIGN_TOKENS.colors.brand.red }}
            >
              Choose Format
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {showFormatModal === 'full' 
                ? 'Select format for your official ID card' 
                : 'Select format for your QR code'}
            </p>

            <div className="space-y-3">
              {/* PNG Option */}
              <button
                onClick={() => showFormatModal === 'full' 
                  ? handleDownloadFullID('png') 
                  : handleDownloadQROnly('png')}
                className="w-full px-4 py-4 rounded-xl border flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                >
                  <FileImage className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">PNG Image</div>
                  <div className="text-xs text-muted-foreground">High quality image for sharing</div>
                </div>
              </button>

              {/* PDF Option */}
              <button
                onClick={() => showFormatModal === 'full' 
                  ? handleDownloadFullID('pdf') 
                  : handleDownloadQROnly('pdf')}
                className="w-full px-4 py-4 rounded-xl border flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                style={{
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                >
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">PDF Document</div>
                  <div className="text-xs text-muted-foreground">
                    {showFormatModal === 'full' 
                      ? 'Standard ID size for printing (CR80)' 
                      : 'Printable document format'}
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incomplete Profile Modal */}
      {showIncompleteModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999 }}>
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowIncompleteModal(false)}
          />
          
          {/* Modal */}
          <div
            className="relative w-full max-w-md rounded-2xl border shadow-2xl p-6"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <button
              onClick={() => setShowIncompleteModal(false)}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: DESIGN_TOKENS.colors.brand.red }}
                >
                  Profile Incomplete
                </h3>
                <p className="text-sm text-muted-foreground">
                  Complete your profile to download the full ID card
                </p>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 mb-6">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
                Missing Information:
              </p>
              <ul className="space-y-1">
                {missingFields.map((field, index) => (
                  <li key={index} className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    {field}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
              Please update your profile with the missing information to generate your official member ID card.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowIncompleteModal(false)}
                className="flex-1 px-4 py-3 rounded-xl border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                style={{
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowIncompleteModal(false);
                  // You can add navigation to profile page here
                  toast.info('Please update your profile from the sidebar menu');
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors font-medium"
              >
                Update Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}


