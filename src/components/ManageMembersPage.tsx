/**
 * =============================================================================
 * MANAGE MEMBERS PAGE
 * =============================================================================
 * * Admin page for managing YSP members and pending applications
 * Features:
 * - Landscape PDF Export with Branded Header
 * - Specific Committee Colors & Counts
 * - Member table with search and filters
 * - Total population stats
 * * FIX: Modals moved outside PageLayout with high z-index to sit above Header
 * =============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, UserPlus, Eye, Edit, Mail, FileText, CheckCircle, XCircle, Clock, X, LayoutGrid, Table as TableIcon, User } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import { AddMemberModal, EditMemberModal, ViewMemberModal, type Member } from "./ManageMembersModals";
import AccountCreationModal from "./AccountCreationModal";
import CustomDropdown from "./CustomDropdown";
import { UploadToastContainer, type UploadToastMessage } from "./UploadToast";
import {
  getAllOfficers,
  searchOfficers,
  DirectoryOfficer,
  DirectoryAPIError,
  DirectoryErrorCodes,
  clearDirectoryCache,
} from "../services/gasDirectoryService";
import { updateUserProfileAsAdmin, type UserProfile } from "../services/gasLoginService";

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

function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  isDark,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  isDark: boolean;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const maxButtons = 5;
  const half = Math.floor(maxButtons / 2);
  const startPage = Math.max(1, Math.min(currentPage - half, totalPages - maxButtons + 1));
  const endPage = Math.min(totalPages, startPage + maxButtons - 1);
  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pb-6">
      <div className="text-xs text-muted-foreground">
        Showing {startItem}-{endItem} of {totalItems}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.85)",
            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
          }}
        >
          Prev
        </button>
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background:
                page === currentPage
                  ? `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`
                  : isDark
                  ? "rgba(255, 255, 255, 0.06)"
                  : "rgba(255, 255, 255, 0.85)",
              color: page === currentPage ? "#ffffff" : undefined,
              border:
                page === currentPage
                  ? "none"
                  : `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
            }}
          >
            {page}
          </button>
        ))}
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="px-3 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          style={{
            background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.85)",
            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}

// =================== TYPE MAPPER ===================

function mapOfficerToMember(officer: DirectoryOfficer): Member {
  let status: "Active" | "Inactive" | "Suspended" = "Active";
  const backendStatus = officer.status?.toLowerCase() || "";
  if (backendStatus === "inactive") status = "Inactive";
  else if (backendStatus === "suspended") status = "Suspended";

  return {
    id: officer.idCode || "",
    username: officer.username || "",
    name: officer.fullName || "",
    position: officer.position || "Member",
    role: officer.role || "Member",
    committee: officer.committee || "",
    status,
    email: officer.email || "",
    phone: officer.contactNumber || "",
    dateJoined: officer.dateJoined || "",
    address: "",
    dateOfBirth: officer.birthday || "",
    age: officer.age || 0,
    gender: officer.gender || "",
    civilStatus: officer.civilStatus || "",
    nationality: officer.nationality || "",
    emergencyContact: "",
    emergencyPhone: "",
    profilePicture: officer.profilePicture || "",
  };
}

interface PendingApplication {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateApplied: string;
  committee: string;
  status: "pending" | "approved" | "rejected";
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

interface ManageMembersPageProps {
  onClose: () => void;
  isDark: boolean;
  pendingApplications: PendingApplication[];
  setPendingApplications: (apps: PendingApplication[]) => void;
  currentUserName: string;
}

// Logo URL for PDF export
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const ITEMS_PER_PAGE = 10;

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
  
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(false);
  const [showViewMemberModal, setShowViewMemberModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);

  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploadToastMessages, setUploadToastMessages] = useState<UploadToastMessage[]>([]);

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
        response = await searchOfficers(query);
      } else {
        response = await getAllOfficers(1, 100);
      }
      
      if (response.success && response.officers) {
        const mappedMembers = response.officers.map(mapOfficerToMember);
        setMembers(mappedMembers);
      } else {
        setMembers([]);
      }
    } catch (err: any) {
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

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchQuery.trim().length >= 2) {
      searchTimerRef.current = setTimeout(() => {
        fetchMembers(searchQuery);
      }, 400);
    } else if (searchQuery.trim().length === 0) {
      fetchMembers();
    }
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, fetchMembers]);

  const filteredMembers = members.filter((member) => {
    const matchesRole = filterRole === "all" || member.role === filterRole;
    const matchesCommittee = filterCommittee === "all" || member.committee === filterCommittee;
    return matchesRole && matchesCommittee;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / ITEMS_PER_PAGE));
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalMembers = members.length;
  const activeMembers = members.filter((m) => m.status === "Active").length;
  const pendingCount = pendingApplications.filter((a) => a.status === "pending").length;
  const viewToggleLabel = viewMode === "table" ? "Table View" : "Tile View";

  const [exportType, setExportType] = useState("");

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRole, filterCommittee]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleExportCSV = () => {
    if (!filteredMembers.length) {
      toast.error("No members to export");
      return;
    }
    const headers = [
      "ID", "Name", "Position", "Role", "Committee", "Status", "Email", "Phone", "Date Joined"
    ];
    const rows = filteredMembers.map(m => [
      m.id, m.name, m.position, m.role, m.committee, m.status, m.email, m.phone, m.dateJoined
    ]);
    const csvContent = [headers, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `YSP_Members_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV exported successfully!");
  };

  /**
   * PDF EXPORT HANDLER
   * - Orientation: Landscape (A4)
   * - Page 1: Header (Red, Logo), Stats Cards, Committee Cards (Specific Colors)
   * - Page 2+: Member Table
   */
  const handleExportPDF = async () => {
    if (!filteredMembers.length) {
      toast.error("No members to export");
      return;
    }

    // Initialize in Landscape mode
    const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth(); // ~297mm
    const pageHeight = doc.internal.pageSize.getHeight(); // ~210mm
    const margin = 14;
    
    // --- HEADER SECTION (Page 1) ---
    // Red Background
    doc.setFillColor(246, 66, 31); // Brand Red
    doc.rect(0, 0, pageWidth, 45, 'F');
    
    // Add Logo (Attempt to load from URL)
    try {
      const img = new Image();
      img.src = ORG_LOGO_URL;
      img.crossOrigin = "Anonymous"; 
      await new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve; 
      });
      // Draw Logo: 26mm x 26mm, positioned at x=15, y=9
      doc.addImage(img, 'PNG', 15, 9, 26, 26);
    } catch (e) {
      doc.setFillColor(255, 255, 255);
      doc.circle(28, 22, 12, 'F');
    }

    // Header Text
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text("Youth Service Philippines", 50, 20);
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(16);
    doc.text("Tagum Chapter", 50, 29);
    
    doc.setFontSize(10);
    doc.text(`MEMBERS LIST EXPORT`, 50, 38);
    doc.text(`Exported: ${new Date().toLocaleString()}`, pageWidth - margin, 38, { align: 'right' });

    // --- SUMMARY SECTION (Page 1) ---
    let yPosition = 60;
    
    // Section Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('MEMBER SUMMARY', margin, yPosition);
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(1);
    doc.line(margin, yPosition + 3, margin + 50, yPosition + 3);
    yPosition += 15;

    // TOP ROW STATS (Active, Inactive, Total, Exec Board)
    const activeCount = filteredMembers.filter(m => m.status === 'Active').length;
    const inactiveCount = filteredMembers.filter(m => m.status === 'Inactive').length;
    const totalCount = filteredMembers.length;
    const executiveCount = filteredMembers.filter(m => m.committee === 'Executive Board').length;
    
    const statusCounts = [
      { name: 'ACTIVE', color: [16, 185, 129], count: activeCount },
      { name: 'INACTIVE', color: [239, 68, 68], count: inactiveCount },
      { name: 'TOTAL', color: [246, 66, 31], count: totalCount },
      { name: 'EXECUTIVE BOARD', color: [59, 130, 246], count: executiveCount },
    ];

    const boxGap = 8;
    const boxHeight = 32;
    // Calculate width for 4 boxes across available width
    const boxWidth = (pageWidth - (2 * margin) - (3 * boxGap)) / 4;

    statusCounts.forEach((status, index) => {
      const boxX = margin + index * (boxWidth + boxGap);
      // @ts-ignore
      doc.setFillColor(...status.color);
      doc.roundedRect(boxX, yPosition, boxWidth, boxHeight, 3, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(String(status.count), boxX + boxWidth / 2, yPosition + 16, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(status.name, boxX + boxWidth / 2, yPosition + 26, { align: 'center' });
    });

    yPosition += boxHeight + 15;

    // BOTTOM ROW: COMMITTEES (SPECIFIC COLORS & NAMES)
    const committeeList = [
      "Membership and Internal Affairs Committee",
      "External Relations Committee",
      "Secretariat and Documentation Committee",
      "Finance and Treasury Committee",
      "Program Development Committee",
      "Communications and Marketing Committee"
    ];

    // Colors matched to user request: Red, Orange, Yellow, Green, Blue, Purple
    const committeeColors = [
      [239, 68, 68],   // Red (Membership)
      [249, 115, 22],  // Orange (External)
      [234, 179, 8],   // Yellow (Secretariat) - Darker yellow for text visibility
      [34, 197, 94],   // Green (Finance)
      [59, 130, 246],  // Blue (Program)
      [168, 85, 247],  // Purple (Comms)
    ];

    const committeeCounts = committeeList.map((c, i) => ({
      name: c,
      count: filteredMembers.filter(m => m.committee === c).length,
      color: committeeColors[i % committeeColors.length],
    }));

    const commBoxHeight = 35;
    const commBoxGap = 6;
    // Calculate width for 6 boxes across available width
    const commBoxWidth = (pageWidth - (2 * margin) - (5 * commBoxGap)) / 6;

    committeeCounts.forEach((committee, idx) => {
      const commX = margin + idx * (commBoxWidth + commBoxGap);
      
      // Card Background
      // @ts-ignore
      doc.setFillColor(...committee.color);
      doc.roundedRect(commX, yPosition, commBoxWidth, commBoxHeight, 3, 3, 'F');
      
      // Count
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(String(committee.count), commX + commBoxWidth / 2, yPosition + 12, { align: 'center' });
      
      // Name (Auto-wrapping text)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7); 
      
      // Split text to fit width
      const textLines = doc.splitTextToSize(committee.name, commBoxWidth - 4);
      const textStartY = yPosition + 22; 
      
      doc.text(textLines, commX + commBoxWidth / 2, textStartY, { align: 'center', lineHeightFactor: 1.2 });
    });

    // --- TABLE SECTION (Page 2) ---
    doc.addPage(); 
    
    // Page 2 Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('MEMBER LIST', margin, 20);
    doc.setDrawColor(246, 66, 31);
    doc.line(margin, 23, margin + 40, 23);

    autoTable(doc, {
      startY: 30,
      head: [["ID", "Name", "Position", "Role", "Committee", "Status", "Email", "Phone", "Date Joined"]],
      body: filteredMembers.map(m => [
        m.id || "", m.name, m.position, m.role, m.committee, m.status, m.email, m.phone, m.dateJoined || ""
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [246, 66, 31],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: 3,
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [50, 50, 50],
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [254, 249, 244],
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center', fontStyle: 'bold' }, // ID
        1: { cellWidth: 45 }, // Name
        2: { cellWidth: 25 }, // Position
        3: { cellWidth: 20 }, // Role
        4: { cellWidth: 35 }, // Committee
        5: { cellWidth: 20, halign: 'center' }, // Status
        6: { cellWidth: 45 }, // Email
        7: { cellWidth: 25 }, // Phone
        8: { cellWidth: 25 }, // Date
      },
      margin: { left: margin, right: margin, bottom: 20 },
      didDrawPage: (data) => {
        // Footer for Table Pages
        doc.setDrawColor(246, 66, 31);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text(
          'Youth Service Philippines - Tagum Chapter',
          margin,
          pageHeight - 10
        );
        doc.text(
          `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
          pageWidth - margin,
          pageHeight - 10,
          { align: 'right' }
        );
      },
    });

    const filename = `YSP_Members_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
    toast.success("PDF exported successfully!");
  };

  useEffect(() => {
    if (exportType === "csv") handleExportCSV();
    if (exportType === "pdf") handleExportPDF();
    setExportType("");
  }, [exportType]);

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
    const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(email)}`;
    window.open(gmailUrl, '_blank');
    
    toast.info("Email Composer", {
      description: `Opening Gmail to ${email}`,
    });
  };

  const glassStyle = getGlassStyle(isDark);

  return (
    <>
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
        <div className="flex flex-col gap-4 mb-4">
          <div className="relative">
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

          <div className="flex flex-col sm:flex-row gap-4">
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
        </div>

        {/* Controls Row: View Mode Toggle + Actions */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-6">
          <button
            onClick={() => setViewMode(viewMode === "table" ? "tile" : "table")}
            className="self-start md:self-auto w-fit px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 hover:shadow-md"
            style={{
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              border: "none",
            }}
          >
            {viewMode === "table" ? <TableIcon className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            <span className="hidden sm:inline">{viewToggleLabel}</span>
          </button>
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => setShowPendingsModal(true)}
              icon={<Clock className="w-5 h-5" />}
              size="sm"
            >
              <span className="hidden sm:inline">Pendings</span> ({pendingCount})
            </Button>
            <div style={{ minWidth: 140 }}>
              <CustomDropdown
                value={exportType}
                onChange={setExportType}
                options={[
                  { value: "csv", label: "Export as CSV" },
                  { value: "pdf", label: "Export as PDF" },
                ]}
                placeholder="Export"
                isDark={isDark}
                size="sm"
              />
            </div>
            <Button
              variant="primary"
              onClick={() => setShowAddMemberModal(true)}
              icon={<UserPlus className="w-5 h-5" />}
              size="sm"
            >
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
        </div>

        {/* Tile View */}
        {viewMode === "tile" && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              // Skeleton loading for tiles
              Array.from({ length: 6 }).map((_, i) => (
                <MemberTileSkeleton key={i} isDark={isDark} />
              ))
            ) : filteredMembers.length > 0 ? (
              paginatedMembers.map((member) => (
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

        {viewMode === "tile" && !error && !isLoading && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredMembers.length}
            pageSize={ITEMS_PER_PAGE}
            isDark={isDark}
            onPageChange={setCurrentPage}
          />
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
                  {paginatedMembers.map((member) => (
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

        {viewMode === "table" && !error && !isLoading && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredMembers.length}
            pageSize={ITEMS_PER_PAGE}
            isDark={isDark}
            onPageChange={setCurrentPage}
          />
        )}
      </PageLayout>

      {/* ===========================================
        MODALS - MOVED OUTSIDE PAGE LAYOUT
        ===========================================
        This ensures they stack ON TOP of the PageLayout 
        (and its sticky header) rather than being trapped inside it.
      */}

      {/* Pendings Modal */}
      {showPendingsModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 'var(--z-modal, 1000)' }}
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

      {/* Application Panel (Resume Style) */}
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
          onSave={async (updatedMember, signal) => {
            if (!updatedMember.username) {
              throw new Error("Member username is missing. Please refresh the list and try again.");
            }

            const updateData: Partial<UserProfile> = {};
            if (selectedMember) {
              if (updatedMember.name !== selectedMember.name) updateData.fullName = updatedMember.name;
              if (updatedMember.position !== selectedMember.position) updateData.position = updatedMember.position;
              if (updatedMember.role !== selectedMember.role) updateData.role = updatedMember.role;
              if (updatedMember.committee !== selectedMember.committee) updateData.committee = updatedMember.committee;
              if (updatedMember.status !== selectedMember.status) updateData.status = updatedMember.status;
            } else {
              updateData.fullName = updatedMember.name;
              updateData.position = updatedMember.position;
              updateData.role = updatedMember.role;
              updateData.committee = updatedMember.committee;
              updateData.status = updatedMember.status;
            }

            if (Object.keys(updateData).length === 0) {
              return;
            }

            await updateUserProfileAsAdmin(
              updatedMember.username,
              updateData,
              currentUserName,
              signal
            );

            setMembers(members.map(m => m.id === updatedMember.id ? updatedMember : m));
            clearDirectoryCache();
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

      {/* Account Creation Modal */}
      {showAccountModal && (
        <AccountCreationModal
          isOpen={showAccountModal}
          isDark={isDark}
          applicantData={selectedApplication?.fullData ?? {
            fullName: "",
            email: "",
            committeePreference: "",
            desiredRole: "",
          }}
          onClose={() => setShowAccountModal(false)}
          onCreateAccount={(data) => {
             // ... handle creation
             setShowAccountModal(false);
          }}
        />
      )}

      {/* Upload Toast Container - Progress bars at bottom-right */}
      <UploadToastContainer
        messages={uploadToastMessages}
        onDismiss={removeUploadToast}
        isDark={isDark}
      />
    </>
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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto"
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
    <div className="mb-6">
      <h4
        className="mb-2"
        style={{
          fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
          fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
          color: DESIGN_TOKENS.colors.brand.orange,
        }}
      >
        {title}
      </h4>
      <div
        className="rounded-lg p-4 border"
        style={{
          background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  );
}
