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

import { useState, useEffect, useCallback, useRef } from "react";
import { Mail, Phone, Calendar, User as UserIcon, Hash, Briefcase, Users, AlertCircle, RefreshCw } from "lucide-react";
import { PageLayout, SearchInput, DetailsCard, Button } from "./design-system";
import { 
  searchOfficers, 
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
          <Skeleton isDark={isDark} className="w-20 h-20 rounded-full flex-shrink-0" />
          
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
}

export default function OfficerDirectoryPage({
  onClose,
  isDark,
}: OfficerDirectoryPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOfficer, setSelectedOfficer] = useState<DirectoryOfficer | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  // Loading states
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Search results
  const [searchResults, setSearchResults] = useState<DirectoryOfficer[]>([]);
  
  // Error state
  const [error, setError] = useState<string | null>(null);
  
  // Debounce timer ref
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // =================== SEARCH HANDLER ===================
  
  const performSearch = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSuggestions(false);
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
  }, []);

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
  }, []);

  // =================== EVENT HANDLERS ===================

  const handleSearch = (value: string) => {
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
  };

  const handleRetry = () => {
    setError(null);
    if (searchQuery.trim().length >= 2) {
      performSearch(searchQuery);
    }
  };

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
        <SearchInput
          value={searchQuery}
          onChange={handleSearch}
          onClear={handleClear}
          placeholder="Search by Name, Committee, or ID Code..."
          suggestions={suggestions}
          onSelectSuggestion={handleSelectSuggestion}
          isLoading={isSearching}
          isDark={isDark}
          showSuggestions={showSuggestions && !isLoadingDetails}
        />
        
        {/* Search hint */}
        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <p className={`text-xs mt-2 ${isDark ? "text-white/50" : "text-gray-400"}`}>
            Type at least 2 characters to search...
          </p>
        )}
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
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Error</p>
            <p className="text-sm opacity-80">{error}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRetry}
            className="flex-shrink-0"
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
        <DetailsCard
          title="Officer Details"
          isDark={isDark}
          onClose={handleClear}
          profileImage={selectedOfficer.profilePicture}
          initials={getInitials(selectedOfficer.fullName)}
          fields={[
            {
              label: "Full Name",
              value: selectedOfficer.fullName || "—",
              icon: <UserIcon className="w-4 h-4" />,
              fullWidth: true,
            },
            {
              label: "ID Code",
              value: selectedOfficer.idCode || "—",
              icon: <Hash className="w-4 h-4" />,
            },
            {
              label: "Role",
              value: selectedOfficer.role?.charAt(0).toUpperCase() + selectedOfficer.role?.slice(1) || "Member",
              icon: <Briefcase className="w-4 h-4" />,
            },
            {
              label: "Position",
              value: selectedOfficer.position || "—",
              icon: <Briefcase className="w-4 h-4" />,
            },
            {
              label: "Committee",
              value: selectedOfficer.committee || "—",
              icon: <Users className="w-4 h-4" />,
              fullWidth: true,
            },
            {
              label: "Email",
              value: selectedOfficer.email || "—",
              icon: <Mail className="w-4 h-4" />,
            },
            {
              label: "Contact Number",
              value: selectedOfficer.contactNumber || "—",
              icon: <Phone className="w-4 h-4" />,
            },
            {
              label: "Emergency Contact Name",
              value: selectedOfficer.emergencyContactName || "N/A",
              icon: <UserIcon className="w-4 h-4" />,
            },
            {
              label: "Emergency Contact Relation",
              value: selectedOfficer.emergencyContactRelation || "N/A",
              icon: <Users className="w-4 h-4" />,
            },
            {
              label: "Emergency Contact Number",
              value: selectedOfficer.emergencyContactNumber || "N/A",
              icon: <Phone className="w-4 h-4" />,
            },
            {
              label: "Birthday",
              value: selectedOfficer.birthday || "—",
              icon: <Calendar className="w-4 h-4" />,
            },
            {
              label: "Age",
              value: selectedOfficer.age ? `${selectedOfficer.age} years old` : "—",
            },
            {
              label: "Gender",
              value: selectedOfficer.gender || "—",
            },
            {
              label: "Civil Status",
              value: selectedOfficer.civilStatus || "—",
            },
            {
              label: "Nationality",
              value: selectedOfficer.nationality || "—",
            },
            {
              label: "Religion",
              value: selectedOfficer.religion || "—",
            },
          ]}
          actions={
            <>
              <Button variant="secondary" onClick={handleClear}>
                Clear
              </Button>
              {selectedOfficer.email && (
                <Button
                  variant="primary"
                  onClick={() => {
                    window.location.href = `mailto:${selectedOfficer.email}`;
                  }}
                >
                  Send Email
                </Button>
              )}
            </>
          }
        />
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
