/**
 * =============================================================================
 * ATTENDANCE TRANSPARENCY PAGE
 * =============================================================================
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Uses PageLayout master component
 * ✅ Table row height: 48px
 * ✅ StatusChip components for status display
 * ✅ Summary boxes with proper spacing
 * ✅ Glassmorphism cards
 * 
 * =============================================================================
 */

import { useState } from "react";
import { Calendar, Clock, Search, Filter, User, LayoutGrid, Table as TableIcon, X } from "lucide-react";
import { PageLayout, StatusChip, DESIGN_TOKENS, getGlassStyle, Button } from "./design-system";
import CustomDropdown from "./CustomDropdown";

interface AttendanceRecord {
  date: string;
  event: string;
  timeIn: string;
  timeOut: string;
  status: "present" | "late" | "excused" | "absent";
  scannedByTimeIn: string;
  scannedByTimeOut: string;
}

interface AttendanceTransparencyPageProps {
  onClose: () => void;
  isDark: boolean;
  userName?: string;
}

export default function AttendanceTransparencyPage({
  onClose,
  isDark,
  userName = "Juan Dela Cruz",
}: AttendanceTransparencyPageProps) {
  const [sortBy, setSortBy] = useState<"date" | "event">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  // View mode: detect mobile and set default view
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [viewMode, setViewMode] = useState<"tile" | "table">(isMobile ? "tile" : "table");
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const attendanceRecords: AttendanceRecord[] = [
    {
      date: "2025-02-01",
      event: "Community Outreach 2025",
      timeIn: "09:00 AM",
      timeOut: "05:00 PM",
      status: "present",
      scannedByTimeIn: "Maria Santos (Admin)",
      scannedByTimeOut: "Maria Santos (Admin)",
    },
    {
      date: "2025-01-28",
      event: "Tree Planting Initiative",
      timeIn: "08:30 AM",
      timeOut: "12:30 PM",
      status: "present",
      scannedByTimeIn: "Carlos Reyes (Auditor)",
      scannedByTimeOut: "Maria Santos (Admin)",
    },
    {
      date: "2025-01-25",
      event: "Leadership Training",
      timeIn: "10:15 AM",
      timeOut: "04:00 PM",
      status: "late",
      scannedByTimeIn: "Ana Lopez (Committee Head)",
      scannedByTimeOut: "Carlos Reyes (Auditor)",
    },
    {
      date: "2025-01-20",
      event: "Health Mission",
      timeIn: "N/A",
      timeOut: "N/A",
      status: "excused",
      scannedByTimeIn: "N/A",
      scannedByTimeOut: "N/A",
    },
    {
      date: "2025-01-15",
      event: "Youth Summit",
      timeIn: "N/A",
      timeOut: "N/A",
      status: "absent",
      scannedByTimeIn: "N/A",
      scannedByTimeOut: "N/A",
    },
    {
      date: "2025-01-10",
      event: "Environmental Conservation Drive",
      timeIn: "07:00 AM",
      timeOut: "01:00 PM",
      status: "present",
      scannedByTimeIn: "Maria Santos (Admin)",
      scannedByTimeOut: "Ana Lopez (Committee Head)",
    },
    {
      date: "2025-01-05",
      event: "Disaster Response Training",
      timeIn: "09:30 AM",
      timeOut: "04:30 PM",
      status: "late",
      scannedByTimeIn: "Carlos Reyes (Auditor)",
      scannedByTimeOut: "Carlos Reyes (Auditor)",
    },
  ];

  // Filter and search logic
  const filteredRecords = attendanceRecords.filter((record) => {
    const matchesSearch = 
      record.event.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.date.includes(searchQuery) ||
      record.scannedByTimeIn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.scannedByTimeOut.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDate = dateFilter === "" || record.date === dateFilter;
    const matchesStatus = statusFilter === "all" || record.status === statusFilter;
    
    return matchesSearch && matchesDate && matchesStatus;
  });

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

  const glassStyle = getGlassStyle(isDark);

  return (
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
      {/* Summary Cards */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{
          marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
        }}
      >
        {/* Summary Stats */}
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
          background:
            attendanceRate >= 80
              ? `rgba(16, 185, 129, 0.1)`
              : attendanceRate >= 60
              ? `rgba(245, 158, 11, 0.1)`
              : `rgba(239, 68, 68, 0.1)`,
        }}
      >
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
      </div>

      {/* Search and Filter Bar */}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div className="md:col-span-1">
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

          {/* Date Filter */}
          <div className="md:col-span-1">
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
          <div className="md:col-span-1">
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

      {/* View Toggle Buttons */}
      <div className="flex justify-end mb-4 gap-2">
        <button
          onClick={() => setViewMode("tile")}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
            viewMode === "tile"
              ? "bg-[#f6421f] text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
          style={{
            borderRadius: `${DESIGN_TOKENS.radius.button}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
          }}
        >
          <LayoutGrid className="w-4 h-4" />
          <span className="hidden sm:inline">Tile View</span>
        </button>
        <button
          onClick={() => setViewMode("table")}
          className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
            viewMode === "table"
              ? "bg-[#f6421f] text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
          }`}
          style={{
            borderRadius: `${DESIGN_TOKENS.radius.button}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
          }}
        >
          <TableIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Table View</span>
        </button>
      </div>

      {/* Tile View */}
      {viewMode === "tile" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredRecords.map((record, index) => (
            <div
              key={index}
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
                    {record.date}
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

      {/* Table View */}
      {viewMode === "table" && (
        <div
          className="border rounded-lg overflow-hidden mb-8"
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
                {filteredRecords.map((record, index) => (
                  <tr
                    key={index}
                    className="border-b hover:bg-white/30 dark:hover:bg-white/5 transition-colors"
                    style={{
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.05)"
                        : "rgba(0, 0, 0, 0.05)",
                      transitionDuration: `${DESIGN_TOKENS.motion.duration.fast}ms`,
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
                        {record.date}
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
                        {record.scannedByTimeIn}
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
                        {record.scannedByTimeOut}
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

      {/* Detail Modal */}
      {showDetailModal && selectedRecord && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 md:p-8"
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="rounded-xl p-6 md:p-8 w-full max-w-md md:max-w-2xl border max-h-[85vh] overflow-y-auto"
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
            {/* Modal Header */}
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                    marginBottom: `${DESIGN_TOKENS.spacing.scale.xs}px`,
                  }}
                >
                  Attendance Details
                </h2>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                    {selectedRecord.date}
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
                    {selectedRecord.scannedByTimeIn}
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
                    {selectedRecord.scannedByTimeOut}
                  </p>
                </div>
              </div>
            </div>

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
      )}
    </PageLayout>
  );
}