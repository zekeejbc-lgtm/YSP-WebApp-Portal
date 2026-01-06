/**
 * =============================================================================
 * ACCESS LOGS PAGE
 * =============================================================================
 * 
 * System access logs for admin monitoring
 * Features:
 * - View all user access logs
 * - Filter by date, user, action type
 * - Export logs
 * - Search functionality
 * - Tile and Table view modes
 * 
 * Uses Design System Components
 * =============================================================================
 */

import { 
  Download, 
  Filter, 
  AlertCircle, 
  User, 
  Clock, 
  Shield, 
  LogIn, 
  LogOut, 
  Eye, 
  Edit, 
  Plus, 
  Trash2,
  LayoutGrid,
  Table as TableIcon,
  Monitor,
  X,
} from "lucide-react";
import { useState } from "react";
import { PageLayout, Button, SearchInput, StatusChip, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import { toast } from "sonner";

interface AccessLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  actionType: "login" | "logout" | "view" | "edit" | "create" | "delete";
  timestamp: string;
  ipAddress: string;
  device: string;
  status: "success" | "failed" | "warning";
}

interface AccessLogsPageProps {
  onClose: () => void;
  isDark: boolean;
}

export default function AccessLogsPage({
  onClose,
  isDark,
}: AccessLogsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"tile" | "table">("table");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AccessLog | null>(null);
  
  const [logs] = useState<AccessLog[]>([
    {
      id: "1",
      userId: "USR-001",
      userName: "Juan Dela Cruz",
      action: "Logged into system",
      actionType: "login",
      timestamp: "2025-02-15 14:30:22",
      ipAddress: "192.168.1.100",
      device: "Chrome on Windows",
      status: "success",
    },
    {
      id: "2",
      userId: "USR-002",
      userName: "Maria Santos",
      action: "Viewed Officer Directory",
      actionType: "view",
      timestamp: "2025-02-15 14:25:15",
      ipAddress: "192.168.1.101",
      device: "Safari on iPhone",
      status: "success",
    },
    {
      id: "3",
      userId: "USR-003",
      userName: "Pedro Reyes",
      action: "Failed login attempt",
      actionType: "login",
      timestamp: "2025-02-15 14:20:45",
      ipAddress: "192.168.1.102",
      device: "Firefox on Mac",
      status: "failed",
    },
    {
      id: "4",
      userId: "USR-001",
      userName: "Juan Dela Cruz",
      action: "Created new event",
      actionType: "create",
      timestamp: "2025-02-15 14:15:30",
      ipAddress: "192.168.1.100",
      device: "Chrome on Windows",
      status: "success",
    },
    {
      id: "5",
      userId: "USR-004",
      userName: "Ana Garcia",
      action: "Edited attendance record",
      actionType: "edit",
      timestamp: "2025-02-15 14:10:12",
      ipAddress: "192.168.1.103",
      device: "Edge on Windows",
      status: "success",
    },
    {
      id: "6",
      userId: "USR-002",
      userName: "Maria Santos",
      action: "Deleted announcement",
      actionType: "delete",
      timestamp: "2025-02-15 14:05:55",
      ipAddress: "192.168.1.101",
      device: "Safari on iPhone",
      status: "warning",
    },
    {
      id: "7",
      userId: "USR-005",
      userName: "Carlos Mendoza",
      action: "Logged out of system",
      actionType: "logout",
      timestamp: "2025-02-15 14:00:00",
      ipAddress: "192.168.1.104",
      device: "Chrome on Android",
      status: "success",
    },
  ]);

  const actionTypes = [
    { value: "all", label: "All", icon: Filter },
    { value: "login", label: "Login", icon: LogIn },
    { value: "logout", label: "Logout", icon: LogOut },
    { value: "view", label: "View", icon: Eye },
    { value: "edit", label: "Edit", icon: Edit },
    { value: "create", label: "Create", icon: Plus },
    { value: "delete", label: "Delete", icon: Trash2 },
  ];

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.userId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      selectedType === "all" || log.actionType === selectedType;
    return matchesSearch && matchesType;
  });

  const handleExport = () => {
    toast.success("Exporting logs...", {
      description: "Your log file will download shortly",
    });
  };

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case "login":
        return <LogIn className="w-4 h-4" />;
      case "logout":
        return <LogOut className="w-4 h-4" />;
      case "view":
        return <Eye className="w-4 h-4" />;
      case "edit":
        return <Edit className="w-4 h-4" />;
      case "create":
        return <Plus className="w-4 h-4" />;
      case "delete":
        return <Trash2 className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getActionColor = (type: string) => {
    switch (type) {
      case "login":
        return DESIGN_TOKENS.colors.brand.orange;
      case "logout":
        return "#6b7280";
      case "view":
        return "#3b82f6";
      case "edit":
        return "#8b5cf6";
      case "create":
        return "#10b981";
      case "delete":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const glassStyle = getGlassStyle(isDark);

  return (
    <PageLayout
      title="Access Logs"
      subtitle="Monitor system access and user activities"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Logs & Reports", onClick: undefined },
        { label: "Access Logs", onClick: undefined },
      ]}
    >
      {/* Header Actions */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search logs by user, action, or ID..."
            isDark={isDark}
          />
        </div>
        <div className="flex gap-3">
          <Button
            variant="primary"
            size="md"
            onClick={handleExport}
            icon={<Download className="w-4 h-4" />}
            className="flex-1 lg:flex-none"
          >
            <span className="hidden sm:inline">Export Logs</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { label: "Total Logs", value: logs.length.toString(), color: DESIGN_TOKENS.colors.brand.red },
          {
            label: "Successful",
            value: logs.filter((l) => l.status === "success").length.toString(),
            color: "#10b981",
          },
          {
            label: "Failed",
            value: logs.filter((l) => l.status === "failed").length.toString(),
            color: "#ef4444",
          },
          {
            label: "Warnings",
            value: logs.filter((l) => l.status === "warning").length.toString(),
            color: DESIGN_TOKENS.colors.brand.yellow,
          },
        ].map((stat, index) => (
          <div
            key={index}
            className="p-4 sm:p-5 rounded-xl border transition-all hover:shadow-lg"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(12px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              className="text-xs sm:text-sm mb-1"
              style={{
                color: isDark ? "#9ca3af" : "#6b7280",
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              {stat.label}
            </div>
            <div
              className="text-2xl sm:text-3xl"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                color: stat.color,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Action Type Filter & View Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        {/* Filter Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-2 w-full sm:w-auto">
          {actionTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.value}
                onClick={() => setSelectedType(type.value)}
                className={`px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-2 ${
                  selectedType === type.value
                    ? "shadow-lg"
                    : "hover:shadow-md"
                }`}
                style={{
                  background: selectedType === type.value
                    ? `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`
                    : isDark
                    ? "rgba(255, 255, 255, 0.05)"
                    : "rgba(255, 255, 255, 0.8)",
                  color: selectedType === type.value
                    ? "#ffffff"
                    : isDark
                    ? "#e5e7eb"
                    : "#374151",
                  fontSize: "14px",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  border: selectedType === type.value
                    ? "none"
                    : `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                }}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{type.label}</span>
              </button>
            );
          })}
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2">
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
      </div>

      {/* Tile View */}
      {viewMode === "tile" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-5 rounded-xl border transition-all hover:shadow-xl cursor-pointer"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(255, 255, 255, 0.8)",
                backdropFilter: "blur(12px)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
              onClick={() => {
                setSelectedLog(log);
                setShowDetailModal(true);
              }}
            >
              {/* Header with user and status */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{
                      background: `${getActionColor(log.actionType)}20`,
                      color: getActionColor(log.actionType),
                    }}
                  >
                    {getActionTypeIcon(log.actionType)}
                  </div>
                  <div>
                    <div
                      className="text-sm"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      {log.userName}
                    </div>
                    <div
                      className="text-xs"
                      style={{
                        color: isDark ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      {log.userId}
                    </div>
                  </div>
                </div>
                <StatusChip
                  status={log.status}
                  label={log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                />
              </div>

              {/* Action */}
              <div className="mb-3">
                <div
                  className="text-xs mb-1"
                  style={{
                    color: isDark ? "#9ca3af" : "#6b7280",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  Action
                </div>
                <div
                  className="text-sm"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  {log.action}
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                <div>
                  <div
                    className="text-xs mb-1"
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    Time
                  </div>
                  <div className="text-xs" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                    {log.timestamp}
                  </div>
                </div>
                <div>
                  <div
                    className="text-xs mb-1"
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    <Monitor className="w-3 h-3 inline mr-1" />
                    Device
                  </div>
                  <div className="text-xs truncate" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                    {log.device}
                  </div>
                </div>
              </div>

              {/* IP Address */}
              <div className="mt-3 pt-3 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                <div
                  className="text-xs"
                  style={{
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  IP: {log.ipAddress}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === "table" && (
        <div className="overflow-x-auto rounded-xl border" style={{
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
          background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.5)",
        }}>
          <table className="w-full">
            <thead>
              <tr
                className="border-b"
                style={{
                  background: isDark
                    ? "rgba(246, 66, 31, 0.05)"
                    : "rgba(246, 66, 31, 0.03)",
                  borderColor: isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                }}
              >
                {["User", "Action", "Type", "Status", "Timestamp", "IP Address", "Device"].map(
                  (header) => (
                    <th
                      key={header}
                      className="text-left px-4 py-4"
                      style={{
                        fontSize: "13px",
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: isDark ? "#e5e7eb" : "#374151",
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      }}
                    >
                      {header}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, index) => (
                <tr
                  key={log.id}
                  className="border-b transition-all hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                  style={{
                    borderColor: isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.05)",
                  }}
                  onClick={() => {
                    setSelectedLog(log);
                    setShowDetailModal(true);
                  }}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: `${getActionColor(log.actionType)}20`,
                          color: getActionColor(log.actionType),
                        }}
                      >
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div
                          className="text-sm truncate"
                          style={{
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                          }}
                        >
                          {log.userName}
                        </div>
                        <div
                          className="text-xs truncate"
                          style={{
                            color: isDark ? "#9ca3af" : "#6b7280",
                          }}
                        >
                          {log.userId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div
                      className="text-sm"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                      }}
                    >
                      {log.action}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                      style={{
                        background: `${getActionColor(log.actionType)}20`,
                        color: getActionColor(log.actionType),
                        fontSize: "13px",
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      {getActionTypeIcon(log.actionType)}
                      <span className="capitalize">{log.actionType}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusChip
                      status={log.status}
                      label={log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span
                        className="text-sm"
                        style={{
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                        }}
                      >
                        {log.timestamp}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className="text-sm font-mono"
                      style={{
                        color: isDark ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      {log.ipAddress}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-gray-400" />
                      <span className="text-sm truncate max-w-[150px]">
                        {log.device}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {filteredLogs.length === 0 && (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p
            className="text-lg mb-2"
            style={{
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            }}
          >
            No logs found
          </p>
          <p
            className="text-sm"
            style={{
              color: isDark ? "#9ca3af" : "#6b7280",
            }}
          >
            Try adjusting your filters or search query
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => setShowDetailModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border shadow-2xl"
            style={{
              background: isDark
                ? "rgba(30, 41, 59, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="px-6 py-5 border-b flex items-center justify-between"
              style={{
                background: isDark
                  ? "rgba(246, 66, 31, 0.05)"
                  : "rgba(246, 66, 31, 0.03)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
            >
              <h3
                className="text-xl"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                Log Details
              </h3>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* User Info */}
              <div>
                <div
                  className="text-xs mb-2"
                  style={{
                    color: isDark ? "#9ca3af" : "#6b7280",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  USER INFORMATION
                </div>
                <div className="flex items-center gap-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{
                      background: `${getActionColor(selectedLog.actionType)}20`,
                      color: getActionColor(selectedLog.actionType),
                    }}
                  >
                    <User className="w-8 h-8" />
                  </div>
                  <div>
                    <div
                      className="text-lg mb-1"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      {selectedLog.userName}
                    </div>
                    <div
                      className="text-sm"
                      style={{
                        color: isDark ? "#9ca3af" : "#6b7280",
                      }}
                    >
                      {selectedLog.userId}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div
                    className="text-xs mb-2"
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    ACTION
                  </div>
                  <div
                    className="text-sm"
                    style={{
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                    }}
                  >
                    {selectedLog.action}
                  </div>
                </div>
                <div>
                  <div
                    className="text-xs mb-2"
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    TYPE
                  </div>
                  <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg"
                    style={{
                      background: `${getActionColor(selectedLog.actionType)}20`,
                      color: getActionColor(selectedLog.actionType),
                      fontSize: "13px",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {getActionTypeIcon(selectedLog.actionType)}
                    <span className="capitalize">{selectedLog.actionType}</span>
                  </div>
                </div>
              </div>

              {/* Status & Timestamp */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div
                    className="text-xs mb-2"
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    STATUS
                  </div>
                  <StatusChip
                    status={selectedLog.status}
                    label={selectedLog.status.charAt(0).toUpperCase() + selectedLog.status.slice(1)}
                  />
                </div>
                <div>
                  <div
                    className="text-xs mb-2"
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    TIMESTAMP
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span
                      className="text-sm"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                      }}
                    >
                      {selectedLog.timestamp}
                    </span>
                  </div>
                </div>
              </div>

              {/* Device & IP */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div
                    className="text-xs mb-2"
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    DEVICE
                  </div>
                  <div className="flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">
                      {selectedLog.device}
                    </span>
                  </div>
                </div>
                <div>
                  <div
                    className="text-xs mb-2"
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    IP ADDRESS
                  </div>
                  <span
                    className="text-sm font-mono"
                    style={{
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    {selectedLog.ipAddress}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              className="px-6 py-4 border-t flex justify-end"
              style={{
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
            >
              <Button
                variant="secondary"
                size="md"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
