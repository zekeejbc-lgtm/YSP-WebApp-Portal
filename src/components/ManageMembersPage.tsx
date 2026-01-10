/**
 * =============================================================================
 * MANAGE MEMBERS PAGE
 * =============================================================================
 * 
 * Admin page for managing YSP members and pending applications
 * Features:
 * - Member table with search and filters
 * - Total population stats
 * - Pending applications modal
 * - Resume-style application viewer
 * - Approve/Reject/Email actions
 * - Real backend integration via GAS
 * - Skeleton loading for better UX
 * 
 * =============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, UserPlus, Download, Eye, Edit, Mail, FileText, CheckCircle, XCircle, Clock, X, LayoutGrid, Table as TableIcon, User, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import { AddMemberModal, EditMemberModal, ViewMemberModal } from "./ManageMembersModals";
import AccountCreationModal from "./AccountCreationModal";
import RejectionModal from "./RejectionModal";
import EmailComposerModal from "./EmailComposerModal";
import CustomDropdown from "./CustomDropdown";
import { UploadToastContainer, type UploadToastMessage } from "./UploadToast";
import {
  getAllOfficers,
  searchOfficers,
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

function StatsCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="rounded-xl p-6 border"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <Skeleton isDark={isDark} className="h-4 w-24 mb-3" />
      <Skeleton isDark={isDark} className="h-10 w-16" />
    </div>
  );
}

function MemberTileSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="p-4 rounded-xl border"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <Skeleton isDark={isDark} className="h-4 w-32 mb-2" />
          <Skeleton isDark={isDark} className="h-3 w-40 mb-1" />
          <Skeleton isDark={isDark} className="h-3 w-20" />
        </div>
        <Skeleton isDark={isDark} className="h-5 w-14 rounded-full" />
      </div>
      <div className="flex gap-2 mb-3">
        <Skeleton isDark={isDark} className="h-5 w-14 rounded-full" />
        <Skeleton isDark={isDark} className="h-5 w-24 rounded" />
      </div>
      <Skeleton isDark={isDark} className="h-3 w-28 mb-3" />
      <div className="flex gap-2">
        <Skeleton isDark={isDark} className="h-8 flex-1 rounded-lg" />
        <Skeleton isDark={isDark} className="h-8 flex-1 rounded-lg" />
        <Skeleton isDark={isDark} className="h-8 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

function MemberTableSkeleton({ isDark, rows = 5 }: { isDark: boolean; rows?: number }) {
  return (
    <div className="overflow-x-auto rounded-xl border" style={{
      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.5)",
    }}>
      <table className="w-full">
        <thead className="bg-gray-100 dark:bg-gray-800">
          <tr>
            {["ID", "Name", "Position", "Role", "Committee", "Status", "Actions"].map((header) => (
              <th key={header} className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-4 w-20" /></td>
              <td className="px-6 py-4">
                <Skeleton isDark={isDark} className="h-4 w-32 mb-1" />
                <Skeleton isDark={isDark} className="h-3 w-40" />
              </td>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-4 w-24" /></td>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-5 w-14 rounded-full" /></td>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-4 w-28" /></td>
              <td className="px-6 py-4"><Skeleton isDark={isDark} className="h-5 w-14 rounded-full" /></td>
              <td className="px-6 py-4">
                <div className="flex gap-2">
                  <Skeleton isDark={isDark} className="h-8 w-8 rounded-lg" />
                  <Skeleton isDark={isDark} className="h-8 w-8 rounded-lg" />
                  <Skeleton isDark={isDark} className="h-8 w-8 rounded-lg" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =================== TYPE MAPPER ===================

/**
 * Maps DirectoryOfficer from backend to Member interface for this page
 */
function mapOfficerToMember(officer: DirectoryOfficer): Member {
  // Determine status from backend status field
  let status: "Active" | "Inactive" | "Suspended" = "Active";
  const backendStatus = officer.status?.toLowerCase() || "";
  if (backendStatus === "inactive") status = "Inactive";
  else if (backendStatus === "suspended") status = "Suspended";

  return {
    id: officer.idCode || "",
    name: officer.fullName || "",
    position: officer.position || "Member",
    role: officer.role || "Member",
    committee: officer.committee || "",
    status,
    email: officer.email || "",
    phone: officer.contactNumber || "",
    dateJoined: officer.dateJoined || "",
    // Extended info
    address: "", // Not directly in DirectoryOfficer visible fields
    dateOfBirth: officer.birthday || "",
    age: officer.age || 0,
    gender: officer.gender || "",
    civilStatus: officer.civilStatus || "",
    nationality: officer.nationality || "",
    emergencyContact: "", // Would need backend extension
    emergencyPhone: "",
    profilePicture: officer.profilePicture || "",
  };
}

interface Member {
  id: string;
  name: string;
  position: string;
  role: string;
  committee: string;
  status: "Active" | "Inactive" | "Suspended";
  email: string;
  phone: string;
  dateJoined: string;
  // Extended info for view modal
  address?: string;
  dateOfBirth?: string;
  age?: number;
  gender?: string;
  civilStatus?: string;
  nationality?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  bloodType?: string;
  medicalConditions?: string;
  profilePicture?: string;
}

interface PendingApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateApplied: string;
  committee: string;
  status: "pending" | "approved" | "rejected";
  // Full application data
  fullData: ApplicationData;
}

interface ApplicationData {
  // Basic Info
  fullName: string;
  email: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  civilStatus: string;
  nationality: string;
  
  // YSP Info
  chapter: string;
  committeePreference: string;
  desiredRole: string;
  
  // Additional Info (dynamic)
  skills?: string;
  education?: string;
  certifications?: string;
  experience?: string;
  achievements?: string;
  volunteerHistory?: string;
  reasonForJoining?: string;
  personalStatement?: string;
  
  // Emergency Contact
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactNumber?: string;
  
  // Social Media
  facebook?: string;
  instagram?: string;
  twitter?: string;
  
  // Attachments
  attachments?: {
    type: string;
    name: string;
    url: string;
  }[];
  
  // Profile Picture
  profilePicture?: string;
}

interface ManageMembersPageProps {
  onClose: () => void;
  isDark: boolean;
  pendingApplications: PendingApplication[];
  setPendingApplications: (apps: PendingApplication[]) => void;
  currentUserName: string;
}

export default function ManageMembersPage({ 
  onClose, 
  isDark, 
  pendingApplications,
  setPendingApplications,
  currentUserName
}: ManageMembersPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterCommittee, setFilterCommittee] = useState("all");
  const [viewMode, setViewMode] = useState<"tile" | "table">("table");
  const [showPendingsModal, setShowPendingsModal] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<PendingApplication | null>(null);
  
  // New states for Add, Edit, View
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [showViewMemberModal, setShowViewMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  
  // Account Creation Modal states
  const [showAccountCreationModal, setShowAccountCreationModal] = useState(false);
  const [applicantToApprove, setApplicantToApprove] = useState<PendingApplication | null>(null);
  
  // Rejection Modal states
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [applicantToReject, setApplicantToReject] = useState<PendingApplication | null>(null);
  
  // Email Composer Modal states
  const [showEmailComposerModal, setShowEmailComposerModal] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState({ email: "", name: "" });
  
  // Backend data state
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Debounce timer ref for search
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Upload Toast state for backend sync progress
  const [uploadToastMessages, setUploadToastMessages] = useState<UploadToastMessage[]>([]);

  // Toast management functions
  const addUploadToast = useCallback((message: UploadToastMessage) => {
    setUploadToastMessages(prev => [...prev, message]);
  }, []);

  const updateUploadToast = useCallback((id: string, updates: Partial<UploadToastMessage>) => {
    setUploadToastMessages(prev =>
      prev.map(msg => (msg.id === id ? { ...msg, ...updates } : msg))
    );
  }, []);

  const removeUploadToast = useCallback((id: string) => {
    setUploadToastMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  // =================== FETCH MEMBERS FROM BACKEND ===================
  
  const fetchMembers = useCallback(async (query?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let response;
      
      if (query && query.trim().length >= 2) {
        // Use search endpoint for queries
        response = await searchOfficers(query);
      } else {
        // Use getAllOfficers for full list
        response = await getAllOfficers(1, 100); // Get first 100 members
      }
      
      if (response.success && response.officers) {
        const mappedMembers = response.officers.map(mapOfficerToMember);
        setMembers(mappedMembers);
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error("Fetch members error:", err);
      
      if (err instanceof DirectoryAPIError) {
        if (err.code === DirectoryErrorCodes.NO_API_URL) {
          setError("Member service not configured. Please contact administrator.");
        } else if (err.code === DirectoryErrorCodes.TIMEOUT_ERROR) {
          setError("Request timed out. Please try again.");
        } else if (err.code === DirectoryErrorCodes.NETWORK_ERROR) {
          setError("Network error. Please check your connection.");
        } else {
          setError(err.message);
        }
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
      
      setMembers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Debounced search effect
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (searchQuery.trim().length >= 2) {
      searchTimerRef.current = setTimeout(() => {
        fetchMembers(searchQuery);
      }, 400); // 400ms debounce
    } else if (searchQuery.trim().length === 0) {
      // Reset to full list when search is cleared
      fetchMembers();
    }

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery, fetchMembers]);

  // Filter members locally after backend fetch
  const filteredMembers = members.filter((member) => {
    const matchesRole = filterRole === "all" || member.role === filterRole;
    const matchesCommittee = filterCommittee === "all" || member.committee === filterCommittee;
    return matchesRole && matchesCommittee;
  });

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === "Active").length;
  const pendingCount = pendingApplications.filter((a) => a.status === "pending").length;

  const handleExport = () => {
    toast.success("Exporting members...", {
      description: "Your CSV file will download shortly",
    });
  };

  const handleViewApplication = (application: PendingApplication) => {
    setSelectedApplication(application);
    setShowPendingsModal(false);
  };

  const handleApproveApplication = (applicationId: string) => {
    toast.success("Application Approved!", {
      description: "Member has been added to the system",
    });
    setSelectedApplication(null);
  };

  const handleRejectApplication = (applicationId: string) => {
    toast.error("Application Rejected", {
      description: "Applicant will be notified via email",
    });
    setSelectedApplication(null);
  };

  const handleSendEmail = (email: string) => {
    // Open Gmail compose in a new tab with the recipient email pre-filled
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`;
    window.open(gmailUrl, '_blank');
    
    toast.info("Email Composer", {
      description: `Opening Gmail to ${email}`,
    });
  };

  const glassStyle = getGlassStyle(isDark);

  return (
    <PageLayout
      title="Manage Members"
      subtitle="Oversee member roster and pending applications"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Dashboard & Directory", onClick: undefined },
        { label: "Manage Members", onClick: undefined },
      ]}
      actions={
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="secondary"
            onClick={() => setShowPendingsModal(true)}
            icon={<Clock className="w-5 h-5" />}
            size="sm"
          >
            <span className="hidden sm:inline">Pendings</span> ({pendingCount})
          </Button>
          <Button
            variant="ghost"
            onClick={handleExport}
            icon={<Download className="w-5 h-5" />}
            size="sm"
          >
            <span className="hidden sm:inline">Export</span>
          </Button>
          <Button
            variant="primary"
            onClick={() => setShowAddMemberModal(true)}
            icon={<UserPlus className="w-5 h-5" />}
            size="sm"
          >
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        {isLoading ? (
          <>
            <StatsCardSkeleton isDark={isDark} />
            <StatsCardSkeleton isDark={isDark} />
            <StatsCardSkeleton isDark={isDark} />
          </>
        ) : (
          <>
            <div
              className="rounded-xl p-6 border"
              style={{
                background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <p className="text-muted-foreground text-sm mb-2">Total Members</p>
              <h3
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                {totalMembers}
              </h3>
            </div>

            <div
              className="rounded-xl p-6 border"
              style={{
                background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <p className="text-muted-foreground text-sm mb-2">Active Members</p>
              <h3
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: "#10b981",
                }}
              >
                {activeMembers}
              </h3>
            </div>

            <div
              className="rounded-xl p-6 border"
              style={{
                background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <p className="text-muted-foreground text-sm mb-2">Pending Applications</p>
              <h3
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                {pendingCount}
              </h3>
            </div>
          </>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, or email..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
            style={{
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          />
        </div>

        <CustomDropdown
          value={filterRole}
          onChange={setFilterRole}
          options={[
            { value: "all", label: "All Roles" },
            { value: "Admin", label: "Admin" },
            { value: "Officer", label: "Officer" },
            { value: "Member", label: "Member" },
            { value: "Volunteer", label: "Volunteer" },
          ]}
          isDark={isDark}
          size="md"
          className="min-w-[180px]"
        />

        <CustomDropdown
          value={filterCommittee}
          onChange={setFilterCommittee}
          options={[
            { value: "all", label: "All Committees" },
            { value: "Executive Board", label: "Executive Board" },
            { value: "Community Development", label: "Community Development" },
            { value: "Environmental Conservation", label: "Environmental Conservation" },
            { value: "Youth Development", label: "Youth Development" },
          ]}
          isDark={isDark}
          size="md"
          className="min-w-[180px]"
        />
      </div>

      {/* View Mode Toggle */}
      <div className="flex justify-end gap-2 mb-6">
        <button
          onClick={() => setViewMode("tile")}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
            viewMode === "tile" ? "shadow-lg" : "hover:shadow-md"
          }`}
          style={{
            background: viewMode === "tile"
              ? `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`
              : isDark
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(255, 255, 255, 0.8)",
            color: viewMode === "tile" ? "#ffffff" : isDark ? "#e5e7eb" : "#374151",
            fontSize: "14px",
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            border: viewMode === "tile"
              ? "none"
              : `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
          }}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="hidden sm:inline">Tile View</span>
        </button>
        <button
          onClick={() => setViewMode("table")}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
            viewMode === "table" ? "shadow-lg" : "hover:shadow-md"
          }`}
          style={{
            background: viewMode === "table"
              ? `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`
              : isDark
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(255, 255, 255, 0.8)",
            color: viewMode === "table" ? "#ffffff" : isDark ? "#e5e7eb" : "#374151",
            fontSize: "14px",
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            border: viewMode === "table"
              ? "none"
              : `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
          }}
        >
          <TableIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Table View</span>
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div
          className="rounded-xl p-8 border text-center mb-6"
          style={{
            background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)',
            borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
          }}
        >
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h3
            className="mb-2"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: isDark ? '#fca5a5' : '#dc2626',
            }}
          >
            Failed to Load Members
          </h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button
            variant="primary"
            onClick={() => fetchMembers()}
            icon={<RefreshCw className="w-4 h-4" />}
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Tile View */}
      {viewMode === "tile" && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading ? (
            // Skeleton loading for tiles
            Array.from({ length: 6 }).map((_, i) => (
              <MemberTileSkeleton key={i} isDark={isDark} />
            ))
          ) : filteredMembers.length > 0 ? (
            filteredMembers.map((member) => (
              <div 
                key={member.id} 
                className="p-4 rounded-xl border transition-all hover:shadow-lg"
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                  backdropFilter: 'blur(20px)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-sm mb-1" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      {member.name}
                    </div>
                    <div className="text-xs text-muted-foreground mb-1">{member.email}</div>
                    <div className="text-xs text-muted-foreground">{member.id}</div>
                  </div>
                  <span
                    className="px-2 py-1 rounded-full text-xs"
                    style={{
                      backgroundColor: member.status === "Active" ? "#10b98120" : "#6b728020",
                      color: member.status === "Active" ? "#10b981" : "#6b7280",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {member.status}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  <span
                    className="px-2 py-1 rounded-full text-xs"
                    style={{
                      backgroundColor:
                        member.role === "Admin"
                          ? "#f6421f20"
                          : member.role === "Officer"
                          ? "#ee872420"
                          : "#10b98120",
                      color:
                        member.role === "Admin"
                          ? "#f6421f"
                          : member.role === "Officer"
                          ? "#ee8724"
                          : "#10b981",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {member.role}
                  </span>
                  <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                    {member.position}
                  </span>
                </div>
                
                <div className="text-xs text-muted-foreground mb-3">{member.committee}</div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedMember(member);
                      setShowViewMemberModal(true);
                    }}
                    className="flex-1 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                  >
                    <Eye className="w-4 h-4 inline mr-1" />
                    View
                  </button>
                  <button
                    onClick={() => {
                      setSelectedMember(member);
                      setShowEditMemberModal(true);
                    }}
                    className="flex-1 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                  >
                    <Edit className="w-4 h-4 inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleSendEmail(member.email)}
                    className="flex-1 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-sm"
                  >
                    <Mail className="w-4 h-4 inline mr-1" />
                    Email
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-muted-foreground">No members found matching your criteria</p>
            </div>
          )}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && !error && (
        isLoading ? (
          // Skeleton loading for table
          <MemberTableSkeleton isDark={isDark} rows={5} />
        ) : (
          <div className="overflow-x-auto rounded-xl border" style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.5)",
          }}>
            <table className="w-full">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                    Position
                  </th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                    Committee
                  </th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs uppercase tracking-wider text-muted-foreground" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {member.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                          {member.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{member.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {member.position}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="px-2 py-1 rounded-full text-xs"
                        style={{
                          backgroundColor:
                            member.role === "Admin"
                              ? "#f6421f20"
                              : member.role === "Officer"
                              ? "#ee872420"
                              : "#10b98120",
                          color:
                            member.role === "Admin"
                              ? "#f6421f"
                              : member.role === "Officer"
                              ? "#ee8724"
                              : "#10b981",
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        }}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">{member.committee}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="px-2 py-1 rounded-full text-xs"
                        style={{
                          backgroundColor: member.status === "Active" ? "#10b98120" : "#6b728020",
                          color: member.status === "Active" ? "#10b981" : "#6b7280",
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        }}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowViewMemberModal(true);
                          }}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedMember(member);
                            setShowEditMemberModal(true);
                          }}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSendEmail(member.email)}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Send Email"
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {filteredMembers.length === 0 && (
              <div className="col-span-full text-center py-12">
                <User className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-muted-foreground">No members found matching your criteria</p>
              </div>
            )}
          </div>
        )
      )}

      {/* Pendings Modal */}
      {showPendingsModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPendingsModal(false)}
        >
          <div
            className="rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto border"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                Pending Applications ({pendingCount})
              </h3>
              <button
                onClick={() => setShowPendingsModal(false)}
                className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {pendingApplications.filter(a => a.status === "pending").map((application) => (
                <div
                  key={application.id}
                  className="rounded-xl p-6 border cursor-pointer hover:shadow-lg transition-all"
                  style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                  onClick={() => handleViewApplication(application)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4
                        className="mb-2"
                        style={{
                          fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                          color: DESIGN_TOKENS.colors.brand.orange,
                        }}
                      >
                        {application.name}
                      </h4>
                      <p className="text-sm text-muted-foreground mb-1">{application.email}</p>
                      <p className="text-sm text-muted-foreground mb-2">{application.phone}</p>
                      <div className="flex gap-2">
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300">
                          {application.committee}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300">
                          Applied: {new Date(application.dateApplied).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      className="px-4 py-2 rounded-lg text-white transition-all hover:scale-105"
                      style={{
                        background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      View Application
                    </button>
                  </div>
                </div>
              ))}

              {pendingApplications.filter(a => a.status === "pending").length === 0 && (
                <div className="text-center py-12">
                  <Clock className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-muted-foreground">No pending applications</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Application Panel (Resume Style) - will be in a separate component due to size */}
      {selectedApplication && (
        <ApplicationPanel
          application={selectedApplication}
          isDark={isDark}
          onClose={() => setSelectedApplication(null)}
          onApprove={handleApproveApplication}
          onReject={handleRejectApplication}
          onSendEmail={handleSendEmail}
        />
      )}

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <AddMemberModal
          isDark={isDark}
          onClose={() => setShowAddMemberModal(false)}
          onSave={(newMember) => {
            setMembers([...members, { ...newMember, id: `MEM-00${members.length + 1}`, dateJoined: new Date().toISOString().split('T')[0] }]);
            setShowAddMemberModal(false);
            toast.success("Member added successfully!");
          }}
        />
      )}

      {/* Edit Member Modal */}
      {showEditMemberModal && selectedMember && (
        <EditMemberModal
          isDark={isDark}
          member={selectedMember}
          onClose={() => {
            setShowEditMemberModal(false);
            setSelectedMember(null);
          }}
          onSave={(updatedMember) => {
            setMembers(members.map(m => m.id === updatedMember.id ? updatedMember : m));
            setShowEditMemberModal(false);
            setSelectedMember(null);
          }}
          addUploadToast={addUploadToast}
          updateUploadToast={updateUploadToast}
        />
      )}

      {/* View Member Modal */}
      {showViewMemberModal && selectedMember && (
        <ViewMemberModal
          isDark={isDark}
          member={selectedMember}
          onClose={() => {
            setShowViewMemberModal(false);
            setSelectedMember(null);
          }}
          onEdit={() => {
            setShowViewMemberModal(false);
            setShowEditMemberModal(true);
          }}
        />
      )}

      {/* Upload Toast Container - Progress bars at bottom-right */}
      <UploadToastContainer
        messages={uploadToastMessages}
        onDismiss={removeUploadToast}
        isDark={isDark}
      />
    </PageLayout>
  );
}

// Application Panel Component (Resume Style)
interface ApplicationPanelProps {
  application: PendingApplication;
  isDark: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSendEmail: (email: string) => void;
}

function ApplicationPanel({
  application,
  isDark,
  onClose,
  onApprove,
  onReject,
  onSendEmail,
}: ApplicationPanelProps) {
  const data = application.fullData;
  const [statusAction, setStatusAction] = useState<"approve" | "reject" | "pending" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [showAccountModal, setShowAccountModal] = useState(false);

  const handleApproveClick = () => {
    setShowAccountModal(true);
  };

  const handleAccountCreation = (accountData: any) => {
    console.log("Account created:", accountData);
    
    // Simulate email sending
    toast.success("Account Created Successfully!", {
      description: `Welcome email sent to ${data.email}`,
    });
    
    setShowAccountModal(false);
    onApprove(application.id);
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="rounded-xl p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto border my-8"
          style={{
            background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
            <div className="flex gap-6 flex-1">
              {/* Profile Picture */}
              <div
                className="rounded-full flex items-center justify-center bg-gradient-to-br from-[#f6421f] to-[#ee8724] text-white overflow-hidden"
                style={{
                  width: '120px',
                  height: '120px',
                  border: '4px solid #ee8724',
                }}
              >
                {data.profilePicture ? (
                  <img src={data.profilePicture} alt={data.fullName} className="w-full h-full object-cover" />
                ) : (
                  <span style={{ fontSize: '48px', fontWeight: DESIGN_TOKENS.typography.fontWeight.bold }}>
                    {data.fullName.charAt(0)}
                  </span>
                )}
              </div>

              {/* Basic Info */}
              <div className="flex-1">
                <h2
                  className="mb-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: '32px',
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                    color: DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  {data.fullName}
                </h2>
                <p className="text-muted-foreground mb-1 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  {data.email}
                </p>
                <p className="text-muted-foreground mb-1">📞 {data.phone}</p>
                <p className="text-muted-foreground">📍 {data.address}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 ml-4">
              <button
                onClick={handleApproveClick}
                className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-all flex items-center gap-2"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => onReject(application.id)}
                className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all flex items-center gap-2"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={() => onSendEmail(data.email)}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-all flex items-center gap-2"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button
                onClick={() => toast.info("PDF download feature coming soon!")}
                className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white transition-all flex items-center gap-2"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <FileText className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Info Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <InfoCard title="Gender" value={data.gender} isDark={isDark} />
            <InfoCard title="Date of Birth" value={new Date(data.dateOfBirth).toLocaleDateString()} isDark={isDark} />
            <InfoCard title="Age" value={`${data.age} years old`} isDark={isDark} />
            <InfoCard title="Civil Status" value={data.civilStatus} isDark={isDark} />
            <InfoCard title="Nationality" value={data.nationality} isDark={isDark} />
            <InfoCard title="YSP Chapter" value={data.chapter} isDark={isDark} />
            <InfoCard title="Committee Preference" value={data.committeePreference} isDark={isDark} />
            <InfoCard title="Desired Role" value={data.desiredRole} isDark={isDark} />
          </div>

          {/* Additional Information Sections */}
          {data.skills && <DetailCard title="Skills" content={data.skills} isDark={isDark} />}
          {data.education && <DetailCard title="Education" content={data.education} isDark={isDark} />}
          {data.certifications && <DetailCard title="Certifications" content={data.certifications} isDark={isDark} />}
          {data.experience && <DetailCard title="Experience" content={data.experience} isDark={isDark} />}
          {data.achievements && <DetailCard title="Achievements" content={data.achievements} isDark={isDark} />}
          {data.volunteerHistory && <DetailCard title="Volunteer History" content={data.volunteerHistory} isDark={isDark} />}
          {data.reasonForJoining && <DetailCard title="Reason for Joining" content={data.reasonForJoining} isDark={isDark} />}
          {data.personalStatement && <DetailCard title="Personal Statement" content={data.personalStatement} isDark={isDark} />}

          {/* Emergency Contact */}
          {data.emergencyContactName && (
            <div className="mb-6">
              <h4
                className="mb-3"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Emergency Contact
              </h4>
              <div className="grid md:grid-cols-3 gap-4">
                <InfoCard title="Name" value={data.emergencyContactName} isDark={isDark} />
                <InfoCard title="Relation" value={data.emergencyContactRelation || ""} isDark={isDark} />
                <InfoCard title="Contact" value={data.emergencyContactNumber || ""} isDark={isDark} />
              </div>
            </div>
          )}

          {/* Social Media */}
          {(data.facebook || data.instagram || data.twitter) && (
            <div className="mb-6">
              <h4
                className="mb-3"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Social Media
              </h4>
              <div className="grid md:grid-cols-3 gap-4">
                {data.facebook && <InfoCard title="Facebook" value={data.facebook} isDark={isDark} />}
                {data.instagram && <InfoCard title="Instagram" value={data.instagram} isDark={isDark} />}
                {data.twitter && <InfoCard title="Twitter" value={data.twitter} isDark={isDark} />}
              </div>
            </div>
          )}

          {/* Attachments */}
          {data.attachments && data.attachments.length > 0 && (
            <div className="mb-6">
              <h4
                className="mb-3"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Attachments
              </h4>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.attachments.map((attachment, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg p-4 border"
                    style={{
                      background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  >
                    <p className="text-sm text-muted-foreground mb-1">{attachment.type}</p>
                    <p className="text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                      {attachment.name}
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="text-xs px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                        onClick={() => window.open(attachment.url, '_blank')}
                      >
                        View
                      </button>
                      <button
                        className="text-xs px-2 py-1 rounded bg-green-500 text-white hover:bg-green-600 transition-colors"
                        onClick={() => toast.success("Download started")}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Notes Section */}
          <div
            className="rounded-lg p-4 border mt-6"
            style={{
              background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <h4
              className="mb-3"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              Admin Notes
            </h4>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add internal notes about this application..."
              className="w-full px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none resize-none"
              rows={3}
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Account Creation Modal */}
      {showAccountModal && (
        <AccountCreationModal
          isOpen={showAccountModal}
          isDark={isDark}
          applicantData={data}
          onClose={() => setShowAccountModal(false)}
          onCreateAccount={handleAccountCreation}
        />
      )}
    </>
  );
}

// Helper Components
interface InfoCardProps {
  title: string;
  value: string;
  isDark: boolean;
}

function InfoCard({ title, value, isDark }: InfoCardProps) {
  return (
    <div
      className="rounded-lg p-4 border"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <p className="text-xs text-muted-foreground mb-1">{title}</p>
      <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
        {value}
      </p>
    </div>
  );
}

interface DetailCardProps {
  title: string;
  content: string;
  isDark: boolean;
}

function DetailCard({ title, content, isDark }: DetailCardProps) {
  return (
    <div
      className="rounded-lg p-4 border mb-4"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <h4
        className="mb-2"
        style={{
          fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
          fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
          color: DESIGN_TOKENS.colors.brand.orange,
        }}
      >
        {title}
      </h4>
      <p className="text-sm text-muted-foreground">{content}</p>
    </div>
  );
}