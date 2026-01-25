/**
 * =============================================================================
 * ATTENDANCE TRANSPARENCY PAGE
 * =============================================================================
 * 
 * SMART SPEC COMPLIANCE:
 * ✓ Uses PageLayout master component
 * ✓ Table row height: 48px
 * ✓ StatusChip components for status display
 * ✓ Summary boxes with proper spacing
 * ✓ Glassmorphism cards
 * ✓ Skeleton loading states
 * ✓ Real backend data integration
 * 
 * =============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { Calendar, Clock, Search, User, LayoutGrid, Table as TableIcon, X, RefreshCw, FileText, AlertCircle } from "lucide-react";
import { PageLayout, StatusChip, DESIGN_TOKENS, getGlassStyle, Button } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { getMemberAttendanceHistory, type AttendanceRecord as BackendAttendanceRecord } from "../services/gasAttendanceService";
import { fetchEvents, type EventData } from "../services/gasEventsService";
import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

// =====================================================
// TYPES
// =====================================================

interface AttendanceRecord {
  id: string;
  date: string;
  event: string;
  eventId: string;
  timeIn: string;
  timeOut: string;
  status: "present" | "late" | "excused" | "absent";
  scannedByTimeIn: string;
  scannedByTimeOut: string;
  notes?: string;
}

interface AttendanceTransparencyPageProps {
  onClose: () => void;
  isDark: boolean;
  userName?: string;
  memberId?: string;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Normalize status from backend to frontend format
 */
function normalizeStatus(status: string): "present" | "late" | "excused" | "absent" {
  const normalized = status?.toLowerCase()?.trim() || "absent";
  switch (normalized) {
    case "present":
    case "checkedin":
    case "checkedout":
      return "present";
    case "late":
      return "late";
    case "excused":
      return "excused";
    case "absent":
    default:
      return "absent";
  }
}

/**
 * Format time from backend - handles various formats including ISO dates
 * The backend returns time as formatted strings like "09:00 AM" or "hh:mm a"
 */
function formatTime(timeValue: unknown): string {
  if (!timeValue) return "N/A";
  
  const timeStr = String(timeValue);
  
  // If it's already a formatted time string like "09:00 AM", return as is
  if (/^\d{1,2}:\d{2}\s*(AM|PM|am|pm)?$/i.test(timeStr.trim())) {
    return timeStr.trim();
  }
  
  // If it's an ISO date string (from Google Sheets time-only values)
  // Format: 1899-12-30T14:34:00.000Z (Google Sheets stores time as date)
  if (timeStr.includes('T') && timeStr.includes('Z')) {
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch {
      // Fall through to return original
    }
  }
  
  // If it looks like 24-hour format (14:30)
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr.trim())) {
    try {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    } catch {
      return timeStr;
    }
  }
  
  return timeStr || "N/A";
}

/**
 * Format date for display
 */
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return "N/A";
  try {
    // Handle yyyy-MM-dd format from backend
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
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

// =====================================================
// SKELETON COMPONENTS
// =====================================================

function SkeletonCard({ isDark }: { isDark: boolean }) {
  const shimmer = isDark 
    ? "bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700" 
    : "bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200";
  
  return (
    <div
      className="border rounded-lg p-5 animate-pulse"
      style={{
        borderRadius: `${DESIGN_TOKENS.radius.card}px`,
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.02)",
      }}
    >
      <div className={`h-5 w-3/4 rounded ${shimmer} mb-3`} style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      <div className={`h-4 w-1/2 rounded ${shimmer} mb-4`} style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className={`h-4 w-20 rounded ${shimmer}`} style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          <div className={`h-4 w-16 rounded ${shimmer}`} style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
        </div>
        <div className="flex justify-between">
          <div className={`h-4 w-20 rounded ${shimmer}`} style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
          <div className={`h-4 w-16 rounded ${shimmer}`} style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
        </div>
      </div>
      <div className="flex justify-end mt-4">
        <div className={`h-6 w-20 rounded-full ${shimmer}`} style={{ backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
      </div>
    </div>
  );
}

function SkeletonTableRow({ isDark }: { isDark: boolean }) {
  const shimmer = isDark 
    ? "bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700" 
    : "bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200";
  
  return (
    <tr
      className="border-b animate-pulse"
      style={{
        borderColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
        height: "48px",
      }}
    >
      <td className="px-6 py-4"><div className={`h-4 w-24 rounded ${shimmer}`} /></td>
      <td className="px-6 py-4"><div className={`h-4 w-32 rounded ${shimmer}`} /></td>
      <td className="px-6 py-4"><div className={`h-4 w-20 rounded ${shimmer}`} /></td>
      <td className="px-6 py-4"><div className={`h-4 w-24 rounded ${shimmer}`} /></td>
      <td className="px-6 py-4"><div className={`h-4 w-20 rounded ${shimmer}`} /></td>
      <td className="px-6 py-4"><div className={`h-4 w-24 rounded ${shimmer}`} /></td>
      <td className="px-6 py-4"><div className={`h-6 w-16 rounded-full ${shimmer}`} /></td>
    </tr>
  );
}

function SkeletonSummaryCard({ isDark }: { isDark: boolean }) {
  const shimmer = isDark 
    ? "bg-gradient-to-r from-gray-700 via-gray-600 to-gray-700" 
    : "bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200";
  
  return (
    <div
      className="border rounded-lg text-center animate-pulse"
      style={{
        borderRadius: `${DESIGN_TOKENS.radius.card}px`,
        padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.02)",
      }}
    >
      <div className={`h-10 w-12 mx-auto rounded ${shimmer} mb-2`} />
      <div className={`h-4 w-16 mx-auto rounded ${shimmer}`} />
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function AttendanceTransparencyPage({
  onClose,
  isDark,
  userName = "Member",
  memberId = "",
}: AttendanceTransparencyPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  
  // View mode: detect mobile and set default view
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [viewMode, setViewMode] = useState<"tile" | "table">(isMobile ? "tile" : "table");
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Data state
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // =====================================================
  // DATA FETCHING
  // =====================================================

  const fetchAttendanceData = useCallback(async () => {
    if (!memberId) {
      setError("Member ID not available. Please log in again.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch both attendance records and events in parallel
      const [backendRecords, events] = await Promise.all([
        getMemberAttendanceHistory(memberId, 100),
        fetchEvents().catch(() => [] as EventData[])
      ]);

      // Build events map for quick lookup by EventID
      const eventMap = new Map<string, EventData>();
      events.forEach((event: EventData) => {
        if (event.EventID) eventMap.set(event.EventID, event);
      });

      // Transform backend records to frontend format
      const transformedRecords: AttendanceRecord[] = backendRecords.map((record: BackendAttendanceRecord) => {
        const event = eventMap.get(record.eventId);
        const eventName = event?.Title;
        
        return {
          id: record.attendanceId,
          date: record.date || "",
          event: eventName || `Event ${record.eventId}`,
          eventId: record.eventId,
          timeIn: formatTime(record.timeIn),
          timeOut: formatTime(record.timeOut),
          status: normalizeStatus(record.status),
          scannedByTimeIn: record.recordedByTimeIn || "",
          scannedByTimeOut: record.recordedByTimeOut || "",
          notes: record.notes,
        };
      });

      setAttendanceRecords(transformedRecords);
      setLastFetchTime(new Date());
    } catch (err) {
      console.error("Error fetching attendance data:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load attendance records";
      setError(errorMessage);
      toast.error("Failed to load attendance", { description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    fetchAttendanceData();
  }, [fetchAttendanceData]);

  // =====================================================
  // FILTERING & SORTING
  // =====================================================

  const filteredRecords = attendanceRecords.filter((record) => {
    const matchesSearch = 
      record.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.date.includes(searchQuery) ||
      record.scannedByTimeIn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.scannedByTimeOut.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = dateFilter === "" || record.date === dateFilter;
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    
    return matchesSearch && matchesDate && matchesStatus;
  }).sort((a, b) => {
    // Sort by date descending (newest first)
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / ITEMS_PER_PAGE));
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, dateFilter, statusFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // =====================================================
  // STATISTICS
  // =====================================================

  const statusCounts = {
    present: filteredRecords.filter((r) => r.status === "present").length,
    late: filteredRecords.filter((r) => r.status === "late").length,
    excused: filteredRecords.filter((r) => r.status === "excused").length,
    absent: filteredRecords.filter((r) => r.status === "absent").length,
  };

  const totalEvents = filteredRecords.length;
  const attendanceRate = totalEvents > 0 ? Math.round(
    ((statusCounts.present + statusCounts.late) / totalEvents) * 100
  ) : 0;

  const viewToggleLabel = viewMode === "table" ? "Table View" : "Tile View";
  const glassStyle = getGlassStyle(isDark);

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <>
    <PageLayout
      title="Attendance Transparency"
      subtitle={`Viewing attendance records for ${userName}`}
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Attendance Management", onClick: undefined },
        { label: "Attendance Transparency", onClick: undefined },
      ]}
    >
      {/* Last Updated & Refresh */}
      {lastFetchTime && !isLoading && (
        <div className="flex items-center justify-end gap-2 mb-4">
          <span className="text-xs text-muted-foreground">
            Last updated: {lastFetchTime.toLocaleTimeString()}
          </span>
          <button 
            onClick={fetchAttendanceData} 
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" 
            title="Refresh data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{
          marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
        }}
      >
        {isLoading ? (
          <>
            <SkeletonSummaryCard isDark={isDark} />
            <SkeletonSummaryCard isDark={isDark} />
            <SkeletonSummaryCard isDark={isDark} />
            <SkeletonSummaryCard isDark={isDark} />
          </>
        ) : (
          <>
            {/* Present */}
            <div
              className="border rounded-lg text-center"
              style={{
                borderRadius: `${DESIGN_TOKENS.radius.card}px`,
                padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
                ...glassStyle,
              }}
            >
              <div
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: DESIGN_TOKENS.colors.status.present,
                  marginBottom: `${DESIGN_TOKENS.spacing.scale.sm}px`,
                }}
              >
                {statusCounts.present}
              </div>
              <div
                className="text-muted-foreground"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                Present
              </div>
            </div>

            {/* Late */}
            <div
              className="border rounded-lg text-center"
              style={{
                borderRadius: `${DESIGN_TOKENS.radius.card}px`,
                padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
                ...glassStyle,
              }}
            >
              <div
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: DESIGN_TOKENS.colors.status.late,
                  marginBottom: `${DESIGN_TOKENS.spacing.scale.sm}px`,
                }}
              >
                {statusCounts.late}
              </div>
              <div
                className="text-muted-foreground"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                Late
              </div>
            </div>

            {/* Excused */}
            <div
              className="border rounded-lg text-center"
              style={{
                borderRadius: `${DESIGN_TOKENS.radius.card}px`,
                padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
                ...glassStyle,
              }}
            >
              <div
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: DESIGN_TOKENS.colors.status.excused,
                  marginBottom: `${DESIGN_TOKENS.spacing.scale.sm}px`,
                }}
              >
                {statusCounts.excused}
              </div>
              <div
                className="text-muted-foreground"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                Excused
              </div>
            </div>

            {/* Absent */}
            <div
              className="border rounded-lg text-center"
              style={{
                borderRadius: `${DESIGN_TOKENS.radius.card}px`,
                padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
                ...glassStyle,
              }}
            >
              <div
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h1}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: DESIGN_TOKENS.colors.status.absent,
                  marginBottom: `${DESIGN_TOKENS.spacing.scale.sm}px`,
                }}
              >
                {statusCounts.absent}
              </div>
              <div
                className="text-muted-foreground"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                Absent
              </div>
            </div>
          </>
        )}
      </div>

      {/* Attendance Rate Banner */}
      <div
        className="border rounded-lg mb-6 text-center"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
          background: isLoading 
            ? (isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.02)")
            : attendanceRate >= 80
              ? `rgba(16, 185, 129, 0.1)`
              : attendanceRate >= 60
              ? `rgba(245, 158, 11, 0.1)`
              : `rgba(239, 68, 68, 0.1)`,
        }}
      >
        {isLoading ? (
          <div className="animate-pulse">
            <div className={`h-7 w-64 mx-auto rounded ${isDark ? "bg-gray-700" : "bg-gray-200"} mb-2`} />
            <div className={`h-4 w-32 mx-auto rounded ${isDark ? "bg-gray-700" : "bg-gray-200"}`} />
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color:
                  attendanceRate >= 80
                    ? DESIGN_TOKENS.colors.status.present
                    : attendanceRate >= 60
                    ? DESIGN_TOKENS.colors.status.late
                    : DESIGN_TOKENS.colors.status.absent,
              }}
            >
              Overall Attendance Rate: {attendanceRate}%
            </div>
            <p
              className="text-muted-foreground"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                marginTop: `${DESIGN_TOKENS.spacing.scale.xs}px`,
              }}
            >
              {totalEvents} total events tracked
            </p>
          </>
        )}
      </div>

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex flex-col items-center justify-center py-12 mb-6">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(239, 68, 68, 0.1)", border: "2px solid rgba(239, 68, 68, 0.3)" }}>
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <p className="text-lg font-medium mb-2" style={{ color: isDark ? "#fff" : "#000" }}>Failed to Load Attendance</p>
          <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">{error}</p>
          <Button onClick={fetchAttendanceData} variant="primary" size="md">
            <RefreshCw className="w-4 h-4 mr-2" />Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && attendanceRecords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 mb-6">
          <div 
            className="w-20 h-20 rounded-full flex items-center justify-center mb-6" 
            style={{ 
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.03)", 
              border: `2px dashed ${isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)"}` 
            }}
          >
            <FileText className="w-10 h-10" style={{ color: DESIGN_TOKENS.colors.brand.orange, opacity: 0.7 }} />
          </div>
          <p className="text-xl font-semibold mb-2" style={{ color: isDark ? "#fff" : "#000", fontFamily: DESIGN_TOKENS.typography.fontFamily.headings }}>
            No Attendance Records Yet
          </p>
          <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
            Your attendance records will appear here once you've attended events.
          </p>
            <Button onClick={fetchAttendanceData} variant="secondary" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
        </div>
      )}

      {/* Search and Filter Bar - Only show if we have records or are loading */}
      {(isLoading || attendanceRecords.length > 0) && !error && (
        <div
          className="border rounded-lg mb-6 relative z-10"
          style={{
            borderRadius: `${DESIGN_TOKENS.radius.card}px`,
            padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.1)",
            ...glassStyle,
          }}
        >
          <div className="flex flex-col gap-4">
            {/* Search Input */}
            <div>
              <label
                className="block mb-2"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Search
              </label>
              <div className="relative">
                <Search 
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
                />
                <input
                  type="text"
                  placeholder="Search events, dates, scanners..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-transparent transition-all"
                  style={{
                    borderRadius: `${DESIGN_TOKENS.radius.input}px`,
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.1)",
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date Filter */}
              <div>
                <label
                  className="block mb-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  Filter by Date
                </label>
                <div className="relative">
                  <Calendar 
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" 
                  />
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-transparent transition-all"
                    style={{
                      borderRadius: `${DESIGN_TOKENS.radius.input}px`,
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.1)"
                        : "rgba(0, 0, 0, 0.1)",
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                    }}
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label
                  className="block mb-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  Filter by Status
                </label>
                <CustomDropdown
                  value={statusFilter}
                  onChange={(value) => setStatusFilter(value)}
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "present", label: "Present" },
                    { value: "late", label: "Late" },
                    { value: "excused", label: "Excused" },
                    { value: "absent", label: "Absent" },
                  ]}
                  isDark={isDark}
                  size="md"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Toggle Button */}
      {(isLoading || attendanceRecords.length > 0) && !error && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setViewMode(viewMode === "table" ? "tile" : "table")}
            className="px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 hover:shadow-md"
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
        </div>
      )}

      {/* Tile View - Loading */}
      {isLoading && viewMode === "tile" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} isDark={isDark} />
          ))}
        </div>
      )}

      {/* Tile View - Data */}
      {!isLoading && !error && viewMode === "tile" && filteredRecords.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {paginatedRecords.map((record) => (
            <div
              key={record.id}
              onClick={() => {
                setSelectedRecord(record);
                setShowDetailModal(true);
              }}
              className="border-2 rounded-lg p-5 cursor-pointer hover:scale-[1.02] transition-transform"
              style={{
                borderRadius: `${DESIGN_TOKENS.radius.card}px`,
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.3)"
                  : "rgba(0, 0, 0, 0.2)",
                background: isDark
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(255, 255, 255, 0.9)",
                boxShadow: isDark
                  ? "0 4px 12px rgba(0, 0, 0, 0.3)"
                  : "0 2px 8px rgba(0, 0, 0, 0.1)",
              }}
            >
              {/* Event Name and Date */}
              <div className="mb-4">
                <h3
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    marginBottom: `${DESIGN_TOKENS.spacing.scale.xs}px`,
                  }}
                >
                  {record.event}
                </h3>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                    {formatDisplayDate(record.date)}
                  </span>
                </div>
              </div>

              {/* Time In/Out */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                      Time In:
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {record.timeIn}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                      Time Out:
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {record.timeOut}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="flex justify-end">
                <StatusChip status={record.status} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && viewMode === "tile" && filteredRecords.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRecords.length}
          pageSize={ITEMS_PER_PAGE}
          isDark={isDark}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Table View - Loading */}
      {isLoading && viewMode === "table" && (
        <div
          className="border rounded-lg overflow-hidden pb-6"
          style={{
            borderRadius: `${DESIGN_TOKENS.radius.card}px`,
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.1)",
            ...glassStyle,
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.1)",
                    background: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.02)",
                  }}
                >
                  <th className="text-left px-6 py-4" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Date</th>
                  <th className="text-left px-6 py-4" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Event Name</th>
                  <th className="text-left px-6 py-4" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Time In</th>
                  <th className="text-left px-6 py-4" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Scanned By</th>
                  <th className="text-left px-6 py-4" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Time Out</th>
                  <th className="text-left px-6 py-4" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Scanned By</th>
                  <th className="text-left px-6 py-4" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <SkeletonTableRow key={i} isDark={isDark} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table View - Data */}
      {!isLoading && !error && viewMode === "table" && filteredRecords.length > 0 && (
        <div
          className="border rounded-lg overflow-hidden pb-6"
          style={{
            borderRadius: `${DESIGN_TOKENS.radius.card}px`,
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.1)",
            ...glassStyle,
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr
                  className="border-b"
                  style={{
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.1)"
                      : "rgba(0, 0, 0, 0.1)",
                    background: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.02)",
                  }}
                >
                  <th
                    className="text-left px-6 py-4"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Date
                  </th>
                  <th
                    className="text-left px-6 py-4"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Event Name
                  </th>
                  <th
                    className="text-left px-6 py-4"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Time In
                  </th>
                  <th
                    className="text-left px-6 py-4"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Scanned By
                  </th>
                  <th
                    className="text-left px-6 py-4"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Time Out
                  </th>
                  <th
                    className="text-left px-6 py-4"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Scanned By
                  </th>
                  <th
                    className="text-left px-6 py-4"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map((record) => (
                  <tr
                    key={record.id}
                    onClick={() => {
                      setSelectedRecord(record);
                      setShowDetailModal(true);
                    }}
                    className="border-b hover:bg-white/30 dark:hover:bg-white/5 transition-colors cursor-pointer"
                    style={{
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.05)",
                      transitionDuration: `${DESIGN_TOKENS.motion.duration.fast}ms`,
                      height: "48px",
                    }}
                  >
                    <td
                      className="px-6 py-4"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {formatDisplayDate(record.date)}
                      </div>
                    </td>
                    <td
                      className="px-6 py-4"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                      }}
                    >
                      {record.event}
                    </td>
                    <td
                      className="px-6 py-4 text-muted-foreground"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {record.timeIn}
                      </div>
                    </td>
                    <td
                      className="px-6 py-4"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {record.scannedByTimeIn || "—"}
                      </div>
                    </td>
                    <td
                      className="px-6 py-4 text-muted-foreground"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {record.timeOut}
                      </div>
                    </td>
                    <td
                      className="px-6 py-4"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        {record.scannedByTimeOut || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusChip status={record.status} size="sm" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* No Results State (after filtering) */}
      {!isLoading && !error && attendanceRecords.length > 0 && filteredRecords.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Search className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">No matching records</p>
          <p className="text-muted-foreground text-sm text-center">Try adjusting your search or filters</p>
          <button 
            onClick={() => { 
              setSearchQuery(""); 
              setDateFilter(""); 
              setStatusFilter("all"); 
            }} 
            className="mt-4 px-4 py-2 text-sm rounded-lg transition-colors" 
            style={{ 
              color: DESIGN_TOKENS.colors.brand.orange, 
              background: isDark ? "rgba(246, 66, 31, 0.1)" : "rgba(246, 66, 31, 0.05)" 
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {!isLoading && !error && viewMode === "table" && filteredRecords.length > 0 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredRecords.length}
          pageSize={ITEMS_PER_PAGE}
          isDark={isDark}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Shimmer animation styles */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </PageLayout>

      {/* ===========================================
        DETAIL MODAL - MOVED OUTSIDE PAGE LAYOUT
        ===========================================
        This ensures the modal stacks ON TOP of the PageLayout 
        (and its header/footer) rather than being trapped inside it.
      */}
      {showDetailModal && selectedRecord && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 md:p-8"
          style={{ zIndex: 9999 }}
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="rounded-xl w-full max-w-md md:max-w-2xl border max-h-[85vh] overflow-hidden flex flex-col"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              boxShadow: isDark 
                ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
                : '0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
              borderRadius: `${DESIGN_TOKENS.radius.modal}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header - Sticky */}
            <div 
              className="flex justify-between items-start p-6 md:p-8 pb-4 md:pb-4 border-b shrink-0"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                    marginBottom: `${DESIGN_TOKENS.spacing.scale.xs}px`,
                    color: DESIGN_TOKENS.colors.primary.main,
                  }}
                >
                  Attendance Details
                </h2>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                    {formatDisplayDate(selectedRecord.date)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="p-6 md:p-8 pt-4 md:pt-4 overflow-y-auto flex-1">
              {/* Event Name */}
              <div className="mb-6">
                <label
                  className="block mb-2 text-muted-foreground"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  Event Name
                </label>
                <p
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                {selectedRecord.event}
              </p>
            </div>

            {/* Time In Section */}
            <div className="mb-6">
              <label
                className="block mb-3"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Time In
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                      Time
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {selectedRecord.timeIn}
                  </p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <User className="w-4 h-4" />
                    <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                      Scanned By
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                    }}
                  >
                    {selectedRecord.scannedByTimeIn || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Time Out Section */}
            <div className="mb-6">
              <label
                className="block mb-3"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Time Out
              </label>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Clock className="w-4 h-4" />
                    <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                      Time
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {selectedRecord.timeOut}
                  </p>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <User className="w-4 h-4" />
                    <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                      Scanned By
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                    }}
                  >
                    {selectedRecord.scannedByTimeOut || "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* Notes (if any) */}
            {selectedRecord.notes && (
              <div className="mb-6">
                <label
                  className="block mb-2 text-muted-foreground"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  Notes
                </label>
                <p className="text-muted-foreground" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px` }}>
                  {selectedRecord.notes}
                </p>
              </div>
            )}

            {/* Status */}
            <div>
              <label
                className="block mb-2 text-muted-foreground"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Status
              </label>
              <StatusChip status={selectedRecord.status} size="md" />
            </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
