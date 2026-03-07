/**
 * =============================================================================
 * OFFICER DIRECTORY SEARCH PAGE
 * =============================================================================
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Uses PageLayout master component
 * ✅ Search input height: 44px
 * ✅ Autosuggest shows up to 8 items
 * ✅ Details card: two-column layout desktop, 16px gutter
 * ✅ Clear button: Primary variant, min width 120px
 * ✅ Empty, loading, error states included
 * ✅ Skeleton loading for better UX
 * ✅ Real backend integration via GAS
 * 
 * =============================================================================
 */

import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { Mail, Phone, Calendar, User as UserIcon, Hash, Briefcase, Users, AlertCircle, RefreshCw, Facebook, Instagram, Globe, CheckCircle, XCircle, QrCode, Download, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { openEmailApp } from "../utils/externalLinks";

// Custom X (formerly Twitter) logo component
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
import { PageLayout, SearchInput, Button } from "./design-system";
import { secureGetItem, secureSetItem, secureRemoveItem } from "../utils/secureStorage";
import { 
  searchOfficers, 
  getAllOfficers,
  getOfficerByIdCode,
  DirectoryOfficer,
  DirectoryAPIError,
  DirectoryErrorCodes,
} from "../services/gasDirectoryService";

// =================== SKELETON COMPONENTS ===================

interface SkeletonProps {
  className?: string;
  isDark?: boolean;
}

function Skeleton({ className = "", isDark = false }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded ${
        isDark ? "bg-white/10" : "bg-gray-200"
      } ${className}`}
    />
  );
}

function OfficerDetailsSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={`rounded-xl border ${
        isDark
          ? "bg-[#232323] border-white/10"
          : "bg-white border-gray-200"
      } overflow-hidden`}
    >
      {/* Header with profile image skeleton */}
      <div className={`p-6 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
        <div className="flex items-start gap-4">
          {/* Profile picture skeleton */}
          <Skeleton isDark={isDark} className="w-20 h-20 rounded-full shrink-0" />
          
          <div className="flex-1 min-w-0">
            {/* Name skeleton */}
            <Skeleton isDark={isDark} className="h-6 w-48 mb-2" />
            {/* Position skeleton */}
            <Skeleton isDark={isDark} className="h-4 w-32 mb-2" />
            {/* Role badge skeleton */}
            <Skeleton isDark={isDark} className="h-5 w-16 rounded-full" />
          </div>
        </div>
      </div>

      {/* Details grid skeleton */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Generate 12 field skeletons */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={i % 6 === 0 ? "md:col-span-2" : ""}>
              <Skeleton isDark={isDark} className="h-3 w-20 mb-2" />
              <Skeleton isDark={isDark} className="h-5 w-full max-w-xs" />
            </div>
          ))}
        </div>
      </div>

      {/* Actions skeleton */}
      <div className={`p-4 border-t ${isDark ? "border-white/10" : "border-gray-100"} flex justify-end gap-3`}>
        <Skeleton isDark={isDark} className="h-10 w-24" />
        <Skeleton isDark={isDark} className="h-10 w-28" />
      </div>
    </div>
  );
}

// =================== MAIN COMPONENT ===================

interface OfficerDirectoryPageProps {
  onClose: () => void;
  isDark: boolean;
  searchRequest?: {
    query: string;
    idCode?: string;
    trigger: number;
  } | null;
}

const DIRECTORY_CACHE_KEY = "ysp_officer_directory_cache";
const DIRECTORY_ALL_CACHE_KEY = "ysp_officer_directory_all";

interface InfoRowProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  isDark: boolean;
}

function InfoRow({ label, value, icon, isDark }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3">
      {icon && (
        <div
          className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.05)",
            color: isDark ? "rgba(255, 255, 255, 0.8)" : "rgba(0, 0, 0, 0.7)",
          }}
        >
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-xs uppercase tracking-wide ${isDark ? "text-white/50" : "text-gray-500"}`}>
          {label}
        </p>
        <div className={`text-sm ${isDark ? "text-white" : "text-gray-900"} w-full`}>
          {value}
        </div>
      </div>
    </div>
  );
}

function InfoSection({
  title,
  children,
  isDark,
  fullWidth = false,
}: {
  title: string;
  children: ReactNode;
  isDark: boolean;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${fullWidth ? "md:col-span-2" : ""}`}
      style={{
        background: isDark ? "rgba(30, 41, 59, 0.65)" : "rgba(255, 255, 255, 0.85)",
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
      }}
    >
      <h3 className={`text-xs font-semibold tracking-wider ${isDark ? "text-white/70" : "text-gray-600"} mb-3`}>
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

type SocialMeta = {
  label: string;
  icon: ReactNode;
  color: string;
  background: string;
};

function getSocialMeta(url: string): SocialMeta {
  const normalized = url.toLowerCase();
  if (normalized.includes("facebook.com") || normalized.includes("fb.com")) {
    return {
      label: "Facebook",
      icon: <Facebook className="w-4 h-4" />,
      color: "#1877f2",
      background: "rgba(24, 119, 242, 0.12)",
    };
  }
  if (normalized.includes("instagram.com")) {
    return {
      label: "Instagram",
      icon: <Instagram className="w-4 h-4" />,
      color: "#e4405f",
      background: "rgba(228, 64, 95, 0.12)",
    };
  }
  if (normalized.includes("twitter.com") || normalized.includes("x.com")) {
    return {
      label: "X (Twitter)",
      icon: <XIcon className="w-4 h-4" />,
      color: "#111827",
      background: "rgba(17, 24, 39, 0.12)",
    };
  }
  return {
    label: "Website",
    icon: <Globe className="w-4 h-4" />,
    color: "#6b7280",
    background: "rgba(107, 114, 128, 0.12)",
  };
}

function SocialButton({ url, isDark }: { url: string; isDark: boolean }) {
  const normalizedUrl = url.match(/^https?:\/\//i) ? url : `https://${url}`;
  const meta = getSocialMeta(normalizedUrl);
  return (
    <a
      href={normalizedUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold transition-transform hover:scale-[1.02]"
      style={{
        color: isDark ? "#ffffff" : meta.color,
        background: isDark ? "rgba(255, 255, 255, 0.08)" : meta.background,
        border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)"}`,
      }}
    >
      <span style={{ color: meta.color }}>{meta.icon}</span>
      {meta.label}
    </a>
  );
}

function getSocialIcon(label: string): { icon: ReactNode; color: string; background: string } {
  const labelLower = label.toLowerCase();
  if (labelLower === "facebook") {
    return {
      icon: <Facebook className="w-4 h-4" />,
      color: "#1877f2",
      background: "rgba(24, 119, 242, 0.12)",
    };
  }
  if (labelLower === "instagram") {
    return {
      icon: <Instagram className="w-4 h-4" />,
      color: "#e4405f",
      background: "rgba(228, 64, 95, 0.12)",
    };
  }
  if (labelLower === "twitter" || labelLower === "x") {
    return {
      icon: <XIcon className="w-4 h-4" />,
      color: "#000000",
      background: "rgba(0, 0, 0, 0.08)",
    };
  }
  return {
    icon: <Globe className="w-4 h-4" />,
    color: "#6b7280",
    background: "rgba(107, 114, 128, 0.12)",
  };
}

function isValidUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || 
         /^(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/i.test(value) ||
         value.includes("facebook.com") ||
         value.includes("fb.com") ||
         value.includes("instagram.com") ||
         value.includes("twitter.com") ||
         value.includes("x.com");
}

function SocialLinkRow({
  label,
  url,
  isDark,
}: {
  label: string;
  url?: string;
  isDark: boolean;
}) {
  const socialMeta = getSocialIcon(label);
  const hasValue = url && url.trim().length > 0;
  const valueIsUrl = hasValue && isValidUrl(url);

  return (
    <div className="flex items-start gap-3">
      <div
        className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg"
        style={{
          background: isDark ? "rgba(255, 255, 255, 0.06)" : socialMeta.background,
          color: socialMeta.color,
        }}
      >
        {socialMeta.icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs uppercase tracking-wide ${isDark ? "text-white/50" : "text-gray-500"}`}>
          {label}
        </p>
        {hasValue ? (
          valueIsUrl ? (
            <SocialButton url={url} isDark={isDark} />
          ) : (
            <p className={`text-sm ${isDark ? "text-white" : "text-gray-900"} break-all`}>
              {url}
            </p>
          )
        ) : (
          <p className={`text-sm ${isDark ? "text-white/50" : "text-gray-400"}`}>N/A</p>
        )}
      </div>
    </div>
  );
}

export default function OfficerDirectoryPage({
  onClose,
  isDark,
  searchRequest = null,
}: OfficerDirectoryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOfficer, setSelectedOfficer] = useState<DirectoryOfficer | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allOfficers, setAllOfficers] = useState<DirectoryOfficer[]>([]);
  const [isPreloading, setIsPreloading] = useState(false);
  
  // Loading states
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Search results
  const [searchResults, setSearchResults] = useState<DirectoryOfficer[]>([]);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // QR Code modal state
  const [showQRModal, setShowQRModal] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  
  // Hide chatbot when QR modal is open
  useEffect(() => {
    if (showQRModal) {
      document.body.classList.add('ysp-modal-open');
    } else {
      document.body.classList.remove('ysp-modal-open');
    }
    return () => {
      document.body.classList.remove('ysp-modal-open');
    };
  }, [showQRModal]);
  
  // Debounce timer ref
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchRequestRef = useRef<number | null>(null);

  const filterOfficers = useCallback((list: DirectoryOfficer[], query: string) => {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];
    return list.filter((officer) =>
      [
        officer.fullName,
        officer.idCode,
        officer.committee,
        officer.position,
        officer.role,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized))
    );
  }, []);

  useEffect(() => {
    let isMounted = true;

    try {
      const cached = secureGetItem(DIRECTORY_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.officer) {
          setSelectedOfficer(parsed.officer);
          setSearchQuery(parsed.searchQuery || parsed.officer.fullName || "");
        }
      }
    } catch {
      // Ignore cache read failures
    }

    try {
      const cachedAll = secureGetItem(DIRECTORY_ALL_CACHE_KEY);
      if (cachedAll) {
        const parsed = JSON.parse(cachedAll);
        if (Array.isArray(parsed?.officers)) {
          setAllOfficers(parsed.officers);
        }
      }
    } catch {
      // Ignore cache read failures
    }

    const preloadAllOfficers = async () => {
      setIsPreloading(true);
      try {
        let page = 1;
        const collected: DirectoryOfficer[] = [];
        while (true) {
          const response = await getAllOfficers(page, 100);
          if (response.success && response.officers) {
            collected.push(...response.officers);
          }
          const totalPages = response.pagination?.totalPages;
          const hasMore = response.pagination?.hasMore;
          if (!hasMore && (!totalPages || page >= totalPages)) {
            break;
          }
          if (!response.officers || response.officers.length === 0) {
            break;
          }
          page += 1;
        }

        if (!isMounted) return;
        setAllOfficers(collected);
        secureSetItem(
          DIRECTORY_ALL_CACHE_KEY,
          JSON.stringify({ officers: collected, timestamp: Date.now() })
        );
      } catch {
        // Ignore preload failures
      } finally {
        if (isMounted) {
          setIsPreloading(false);
        }
      }
    };

    preloadAllOfficers();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedOfficer) return;
    try {
      secureSetItem(
        DIRECTORY_CACHE_KEY,
        JSON.stringify({
          officer: selectedOfficer,
          searchQuery,
          timestamp: Date.now(),
        })
      );
    } catch {
      // Ignore cache write failures
    }
  }, [selectedOfficer, searchQuery]);

  useEffect(() => {
    if (selectedOfficer) {
      setShowSuggestions(false);
    }
  }, [selectedOfficer]);

  // =================== SEARCH HANDLER ===================
  
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }

    if (allOfficers.length > 0) {
      const results = filterOfficers(allOfficers, query);
      setSearchResults(results);
      setShowSuggestions(results.length > 0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const response = await searchOfficers(query);
      
      if (response.success && response.officers) {
        setSearchResults(response.officers);
        setShowSuggestions(response.officers.length > 0);
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } catch (err) {
      console.error("Search error:", err);
      
      if (err instanceof DirectoryAPIError) {
        if (err.code === DirectoryErrorCodes.NO_API_URL) {
          setError("Directory service not configured. Please contact administrator.");
        } else if (err.code === DirectoryErrorCodes.TIMEOUT_ERROR) {
          setError("Search timed out. Please try again.");
        } else if (err.code === DirectoryErrorCodes.NETWORK_ERROR) {
          setError("Network error. Please check your connection.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      
      setSearchResults([]);
      setShowSuggestions(false);
    } finally {
      setIsSearching(false);
    }
  }, [allOfficers, filterOfficers]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimerRef.current = setTimeout(() => {
        performSearch(searchQuery);
      }, 300); // 300ms debounce
    } else {
      setSearchResults([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, performSearch]);

  // =================== SELECT OFFICER HANDLER ===================

  const handleSelectOfficer = useCallback(async (idCode: string) => {
    setIsLoadingDetails(true);
    setError(null);
    setShowSuggestions(false);

    const cachedOfficer = allOfficers.find((officer) => officer.idCode === idCode);
    if (cachedOfficer) {
      setSelectedOfficer(cachedOfficer);
      setSearchQuery(cachedOfficer.fullName);
      setIsLoadingDetails(false);
      return;
    }

    try {
      const response = await getOfficerByIdCode(idCode);
      
      if (response.success && response.officer) {
        setSelectedOfficer(response.officer);
        setSearchQuery(response.officer.fullName);
      } else {
        setError("Officer not found.");
      }
    } catch (err) {
      console.error("Get officer error:", err);
      
      if (err instanceof DirectoryAPIError) {
        if (err.code === DirectoryErrorCodes.NOT_FOUND) {
          setError("Officer not found in directory.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to load officer details.");
      }
    } finally {
      setIsLoadingDetails(false);
    }
  }, [allOfficers]);

  useEffect(() => {
    if (!searchRequest || !searchRequest.query) return;
    if (lastSearchRequestRef.current === searchRequest.trigger) return;

    lastSearchRequestRef.current = searchRequest.trigger;
    setError(null);
    setSelectedOfficer(null);
    setSearchQuery(searchRequest.query);

    if (searchRequest.idCode) {
      handleSelectOfficer(searchRequest.idCode);
      return;
    }

    if (searchRequest.query.trim().length >= 2) {
      setShowSuggestions(true);
      performSearch(searchRequest.query);
    }
  }, [searchRequest, performSearch, handleSelectOfficer]);

  // =================== EVENT HANDLERS ===================

  const handleSearch = (value: string) => {
    if (selectedOfficer && value !== selectedOfficer.fullName) {
      setSelectedOfficer(null);
    }
    setSearchQuery(value);
    setError(null);
    
    if (value.length >= 2) {
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setSearchResults([]);
    }
  };

  const handleSelectSuggestion = (suggestion: { id: string }) => {
    handleSelectOfficer(suggestion.id);
  };

  const handleClear = () => {
    setSelectedOfficer(null);
    setSearchQuery("");
    setShowSuggestions(false);
    setSearchResults([]);
    setError(null);
    secureRemoveItem(DIRECTORY_CACHE_KEY);
  };

  const handleRetry = () => {
    setError(null);
    if (searchQuery.trim().length >= 2) {
      performSearch(searchQuery);
    }
  };

  // =================== QR CODE HANDLERS ===================

  const handleDownloadQR = useCallback(() => {
    if (!selectedOfficer || !qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    // Create canvas to convert SVG to PNG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const padding = 32;
    const qrSize = 256;
    const nameHeight = 36;
    const idHeight = 28;
    const spacing = 16;

    canvas.width = qrSize + (padding * 2);
    canvas.height = nameHeight + spacing + qrSize + spacing + idHeight + (padding * 2);

    // White background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Name text
    ctx.fillStyle = '#f6421f';
    ctx.font = 'bold 18px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(selectedOfficer.fullName, canvas.width / 2, padding + (nameHeight / 2));

    // Orange border around QR
    const qrBoxX = padding;
    const qrBoxY = padding + nameHeight + spacing;
    const borderWidth = 4;
    
    ctx.fillStyle = '#ee8724';
    ctx.beginPath();
    ctx.roundRect(qrBoxX - borderWidth, qrBoxY - borderWidth, qrSize + (borderWidth * 2), qrSize + (borderWidth * 2), 12);
    ctx.fill();

    // White inner box
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(qrBoxX, qrBoxY, qrSize, qrSize, 8);
    ctx.fill();

    // Draw the QR code from SVG
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const qrPadding = 16;
      ctx.drawImage(img, qrBoxX + qrPadding, qrBoxY + qrPadding, qrSize - (qrPadding * 2), qrSize - (qrPadding * 2));
      URL.revokeObjectURL(url);

      // ID code text
      ctx.fillStyle = '#6B7280';
      ctx.font = '600 14px system-ui, -apple-system, sans-serif';
      ctx.fillText(`ID: ${selectedOfficer.idCode}`, canvas.width / 2, qrBoxY + qrSize + spacing + (idHeight / 2));

      // Download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${selectedOfficer.idCode}_${selectedOfficer.fullName.replace(/\s+/g, '_')}_QR.png`;
        link.href = blobUrl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }, 'image/png');
    };
    img.src = url;
  }, [selectedOfficer]);

  // =================== SUGGESTIONS FORMATTING ===================

  // Helper function to get initials from full name
  const getInitials = (name: string): string => {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    // Get first letter of first name and first letter of last name
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const suggestions = searchResults.slice(0, 8).map((officer) => ({
    id: officer.idCode,
    label: officer.fullName,
    subtitle: `${officer.committee || officer.position || 'Member'} • ${officer.idCode}`,
    profilePicture: officer.profilePicture,
    initials: getInitials(officer.fullName),
  }));

  const isEmailVerified = selectedOfficer ? Boolean(selectedOfficer.emailVerified) : false;
  const displayEmail = selectedOfficer
    ? (isEmailVerified ? selectedOfficer.verifiedEmail : selectedOfficer.personalEmail) || ""
    : "";

  // =================== RENDER ===================

  return (
    <PageLayout
      title="Officer Directory Search"
      subtitle="Search officers by name, committee, or ID code"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Dashboard & Directory", onClick: undefined },
        { label: "Officer Directory", onClick: undefined },
      ]}
    >
      {/* Search Input */}
      <div className="mb-6">
        <div
          className={`rounded-2xl border p-4 ${isDark ? "bg-[#1f1f1f]" : "bg-white"}`}
          style={{
            borderColor: "rgba(238, 135, 36, 0.4)",
            boxShadow: "0 0 0 2px rgba(238, 135, 36, 0.12) inset",
          }}
        >
          <SearchInput
            value={searchQuery}
            onChange={handleSearch}
            onClear={handleClear}
            placeholder="Search by Name, Committee, or ID Code..."
            suggestions={suggestions}
            onSelectSuggestion={handleSelectSuggestion}
          isLoading={isSearching || isPreloading}
            isDark={isDark}
            showSuggestions={showSuggestions && !isLoadingDetails && !selectedOfficer}
          />
          
          {/* Search hint */}
          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <p className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-gray-400"}`}>
              Type at least 2 characters to search...
            </p>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          className={`mb-6 p-4 rounded-lg border flex items-start gap-3 ${
            isDark
              ? "bg-red-500/10 border-red-500/30 text-red-400"
              : "bg-red-50 border-red-200 text-red-600"
          }`}
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Error</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="shrink-0"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Loading Details Skeleton */}
      {isLoadingDetails && <OfficerDetailsSkeleton isDark={isDark} />}

      {/* Officer Details Card */}
      {selectedOfficer && !isLoadingDetails && (
        <div
          className={`rounded-2xl border overflow-hidden ${
            isDark ? "bg-[#1f1f1f] border-white/10" : "bg-white border-gray-200"
          }`}
        >
          <div className={`p-6 border-b ${isDark ? "border-white/10" : "border-gray-100"}`}>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div
                className={`w-20 h-20 rounded-full flex items-center justify-center text-xl font-semibold ${
                  isDark ? "bg-white/10 text-white" : "bg-gray-100 text-gray-700"
                }`}
              >
                {selectedOfficer.profilePicture ? (
                  <img
                    src={selectedOfficer.profilePicture}
                    alt={selectedOfficer.fullName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  getInitials(selectedOfficer.fullName)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`text-2xl font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {selectedOfficer.fullName || "Unknown"}
                </h2>
                <p className={`text-sm ${isDark ? "text-white/60" : "text-gray-500"}`}>
                  {selectedOfficer.position || "Member"}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: "rgba(246, 66, 31, 0.15)",
                      color: "#f6421f",
                    }}
                  >
                    {(selectedOfficer.role || "Member").toUpperCase()}
                  </span>
                  <span
                    className="px-3 py-1 rounded-full text-xs font-semibold"
                    style={{
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#10b981",
                    }}
                  >
                    {(selectedOfficer.status || "Active").toUpperCase()}
                  </span>
                  {selectedOfficer.committee && (
                    <span
                      className="px-3 py-1 rounded-full text-xs font-semibold"
                      style={{
                        background: "rgba(238, 135, 36, 0.15)",
                        color: "#ee8724",
                      }}
                    >
                      {selectedOfficer.committee}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoSection title="Identity" isDark={isDark}>
                <InfoRow label="Full Name" value={selectedOfficer.fullName || "N/A"} icon={<UserIcon className="w-4 h-4" />} isDark={isDark} />
                <InfoRow label="ID Code" value={selectedOfficer.idCode || "N/A"} icon={<Hash className="w-4 h-4" />} isDark={isDark} />
                <InfoRow label="Role" value={selectedOfficer.role || "Member"} icon={<Briefcase className="w-4 h-4" />} isDark={isDark} />
              </InfoSection>

              <InfoSection title="Assignment" isDark={isDark}>
                <InfoRow label="Position" value={selectedOfficer.position || "Member"} icon={<Briefcase className="w-4 h-4" />} isDark={isDark} />
                <InfoRow label="Committee" value={selectedOfficer.committee || "N/A"} icon={<Users className="w-4 h-4" />} isDark={isDark} />
                <InfoRow label="Chapter" value={selectedOfficer.chapter || "N/A"} icon={<Users className="w-4 h-4" />} isDark={isDark} />
                <InfoRow label="Membership Type" value={selectedOfficer.membershipType || "N/A"} icon={<Users className="w-4 h-4" />} isDark={isDark} />
                <InfoRow label="Date Joined" value={selectedOfficer.dateJoined || "N/A"} icon={<Calendar className="w-4 h-4" />} isDark={isDark} />
              </InfoSection>

              <InfoSection title="Contact" isDark={isDark} fullWidth>
                <InfoRow
                  label="Personal Email Address (M)"
                  value={
                    displayEmail ? (
                      <div className="flex items-center justify-between gap-3">
                        <a
                          href={`mailto:${displayEmail?.replace(/\+/g, '%2B')}`}
                          onClick={(e) => {
                            e.preventDefault();
                            console.warn('[Email Debug] OfficerDirectory email link clicked:', displayEmail);
                            if (displayEmail) openEmailApp(displayEmail);
                          }}
                          className={`text-sm ${isDark ? "text-white" : "text-gray-900"} hover:underline underline-offset-2 break-all`}
                        >
                          {displayEmail}
                        </a>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap font-semibold ${
                            isEmailVerified
                              ? "bg-emerald-500/15 text-green-500"
                              : "bg-red-500/15 text-red-500"
                          }`}
                        >
                          {isEmailVerified ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {isEmailVerified ? "Verified" : "Unverified"}
                        </span>
                      </div>
                    ) : (
                      "N/A"
                    )
                  }
                  icon={<Mail className="w-4 h-4" />}
                  isDark={isDark}
                />
                <InfoRow label="Contact Number" value={selectedOfficer.contactNumber || "N/A"} icon={<Phone className="w-4 h-4" />} isDark={isDark} />
                <SocialLinkRow label="Facebook" url={selectedOfficer.facebook} isDark={isDark} />
                <SocialLinkRow label="Instagram" url={selectedOfficer.instagram} isDark={isDark} />
                <SocialLinkRow label="Twitter" url={selectedOfficer.twitter} isDark={isDark} />
              </InfoSection>

              <InfoSection title="Emergency Contacts" isDark={isDark} fullWidth>
                <InfoRow label="Contact Name" value={selectedOfficer.emergencyContactName || "N/A"} icon={<UserIcon className="w-4 h-4" />} isDark={isDark} />
                <InfoRow label="Relation" value={selectedOfficer.emergencyContactRelation || "N/A"} icon={<Users className="w-4 h-4" />} isDark={isDark} />
                <InfoRow label="Contact Number" value={selectedOfficer.emergencyContactNumber || "N/A"} icon={<Phone className="w-4 h-4" />} isDark={isDark} />
              </InfoSection>

              <InfoSection title="Personal" isDark={isDark}>
                <InfoRow label="Birthday" value={selectedOfficer.birthday || "N/A"} icon={<Calendar className="w-4 h-4" />} isDark={isDark} />
                <InfoRow label="Age" value={selectedOfficer.age ? `${selectedOfficer.age} years old` : "N/A"} isDark={isDark} />
                <InfoRow label="Gender" value={selectedOfficer.gender || "N/A"} isDark={isDark} />
                <InfoRow label="Pronouns" value={selectedOfficer.pronouns || "N/A"} isDark={isDark} />
                <InfoRow label="Civil Status" value={selectedOfficer.civilStatus || "N/A"} isDark={isDark} />
                <InfoRow label="Nationality" value={selectedOfficer.nationality || "N/A"} isDark={isDark} />
                <InfoRow label="Religion" value={selectedOfficer.religion || "N/A"} isDark={isDark} />
              </InfoSection>
            </div>
          </div>

          <div className={`p-4 border-t ${isDark ? "border-white/10" : "border-gray-100"} flex flex-wrap justify-end gap-2`}>
            <button
              onClick={handleClear}
              className="px-4 py-2.5 rounded-lg transition-all duration-300 hover:shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
              style={{
                background: isDark ? 'rgba(238, 135, 36, 0.15)' : 'rgba(238, 135, 36, 0.1)',
                border: '1.5px solid rgba(238, 135, 36, 0.4)',
                color: '#ee8724',
                fontWeight: '600',
              }}
            >
              Clear
            </button>
            <button
              onClick={() => setShowQRModal(true)}
              className="px-4 py-2.5 rounded-lg text-white transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                fontWeight: '600',
                boxShadow: '0 4px 15px rgba(246, 66, 31, 0.35)'
              }}
            >
              <QrCode className="w-4 h-4" />
              View QR Code
            </button>
            {displayEmail && (
              <button
                onClick={() => {
                  console.warn('[Email Debug] OfficerDirectory Send Email button clicked:', displayEmail);
                  openEmailApp(displayEmail);
                }}
                className="px-4 py-2.5 rounded-lg text-white transition-all duration-300 hover:shadow-xl hover:scale-105 active:scale-95 flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                  fontWeight: '600',
                  boxShadow: '0 4px 15px rgba(246, 66, 31, 0.35)'
                }}
              >
                <Mail className="w-4 h-4" />
                Send Email
              </button>
            )}
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && selectedOfficer && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowQRModal(false)}
        >
          <div 
            className={`relative w-full max-w-xs sm:max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl ${
              isDark ? 'bg-[#1e1e1e]' : 'bg-white'
            }`}
            style={{ 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
              scrollbarWidth: 'thin',
              scrollbarColor: isDark ? 'rgba(255,255,255,0.2) transparent' : 'rgba(0,0,0,0.2) transparent',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setShowQRModal(false)}
              className={`absolute top-3 right-3 z-10 p-2 rounded-full transition-all duration-200 ${
                isDark 
                  ? 'hover:bg-white/10 text-white/60 hover:text-white' 
                  : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'
              }`}
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Content */}
            <div className="p-5 sm:p-6">
              {/* Header */}
              <div className="text-center mb-5">
                <div 
                  className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3"
                  style={{ 
                    background: 'linear-gradient(135deg, rgba(246, 66, 31, 0.15) 0%, rgba(238, 135, 36, 0.15) 100%)',
                  }}
                >
                  <QrCode className="w-6 h-6" style={{ color: '#ee8724' }} />
                </div>
                <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Member QR Code
                </h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                  {selectedOfficer.fullName}
                </p>
              </div>

              {/* QR Code */}
              <div 
                ref={qrRef}
                className="flex justify-center p-4 sm:p-6 rounded-xl mb-4"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  border: '3px solid #ee8724',
                }}
              >
                <QRCodeSVG 
                  value={selectedOfficer.idCode} 
                  size={180} 
                  level="H"
                  bgColor="transparent"
                  fgColor={isDark ? '#ffffff' : '#000000'}
                />
              </div>

              {/* ID Code display */}
              <div 
                className={`text-center mb-5 px-4 py-2 rounded-lg ${
                  isDark ? 'bg-white/5' : 'bg-gray-50'
                }`}
              >
                <span className={`font-mono text-sm ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                  ID: {selectedOfficer.idCode}
                </span>
              </div>

              {/* Download button */}
              <button
                onClick={handleDownloadQR}
                className="w-full px-4 py-3 rounded-lg text-white transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                  fontWeight: '600',
                  boxShadow: '0 4px 15px rgba(246, 66, 31, 0.35)'
                }}
              >
                <Download className="w-4 h-4" />
                Download QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State - No Search */}
      {!selectedOfficer && !searchQuery && !error && !isLoadingDetails && (
        <div className="text-center py-12">
          <div
            className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
              isDark ? "bg-white/5" : "bg-gray-100"
            }`}
          >
            <UserIcon
              className={`w-10 h-10 ${
                isDark ? "text-white/30" : "text-gray-400"
              }`}
            />
          </div>
          <h3
            className={`text-lg font-semibold mb-2 ${
              isDark ? "text-white" : "text-gray-900"
            }`}
          >
            Search the Directory
          </h3>
          <p
            className={`max-w-md mx-auto ${
              isDark ? "text-white/60" : "text-gray-500"
            }`}
          >
            Use the search bar above to find officers by name, committee, or ID
            code. Results will appear as you type.
          </p>
        </div>
      )}

      {/* Empty State - No Results */}
      {!selectedOfficer &&
        searchQuery.length >= 2 &&
        !isSearching &&
        searchResults.length === 0 &&
        !error &&
        !isLoadingDetails && (
          <div className="text-center py-12">
            <div
              className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                isDark ? "bg-white/5" : "bg-gray-100"
              }`}
            >
              <UserIcon
                className={`w-10 h-10 ${
                  isDark ? "text-white/30" : "text-gray-400"
                }`}
              />
            </div>
            <h3
              className={`text-lg font-semibold mb-2 ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              No Officers Found
            </h3>
            <p
              className={`max-w-md mx-auto ${
                isDark ? "text-white/60" : "text-gray-500"
              }`}
            >
              No officers match "{searchQuery}". Try a different search term or
              check the spelling.
            </p>
            <Button variant="secondary" className="mt-4" onClick={handleClear}>
              Clear Search
            </Button>
          </div>
        )}
    </PageLayout>
  );
}
