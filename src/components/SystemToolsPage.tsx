/**
 * =============================================================================
 * SYSTEM TOOLS PAGE
 * =============================================================================
 * 
 * Admin tools for system management
 * Features:
 * - Database backup/restore
 * - Clear cache
 * - System health monitoring
 * - User management tools
 * - Export data
 * 
 * Uses Design System Components
 * =============================================================================
 */

import { useState } from "react";
import { PageLayout, Button, DESIGN_TOKENS } from "./design-system";
import { toast } from "sonner";
import {
  getMaintenanceMode,
  enableFullPWAMaintenance,
  disableFullPWAMaintenance,
  enablePageMaintenance,
  disablePageMaintenance,
  clearAllMaintenance,
  AVAILABLE_PAGES,
  type MaintenanceModeState,
} from "../utils/maintenanceMode";
import MaintenanceModeModal, { type MaintenanceFormData } from "./MaintenanceModeModal";

import {
  Database,
  HardDrive,
  Wifi,
  RefreshCw,
  Activity,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Upload,
  Download,
  Wrench,
  Power,
  Shield,
} from "lucide-react";

interface SystemToolsPageProps {
  onClose: () => void;
  isDark: boolean;
}

interface SystemHealth {
  database: "healthy" | "warning" | "error";
  storage: number; // percentage used
  api: "online" | "offline";
  lastBackup: string;
}

export default function SystemToolsPage({
  onClose,
  isDark,
}: SystemToolsPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceModeState>(getMaintenanceMode());
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceTime, setMaintenanceTime] = useState("");
  const [systemHealth] = useState<SystemHealth>({
    database: "healthy",
    storage: 45,
    api: "online",
    lastBackup: "2025-02-14 23:00:00",
  });

  const handleBackupDatabase = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Database Backup Created", {
        description: "Backup file has been downloaded",
      });
    }, 2000);
  };

  const handleClearCache = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("Cache Cleared", {
        description: "System cache has been cleared successfully",
      });
    }, 1500);
  };

  const handleExportData = () => {
    toast.info("Export Data", {
      description: "This will export all system data. Coming soon!",
    });
  };

  const handleRestoreDatabase = () => {
    toast.warning("Restore Database", {
      description: "This is a critical operation. Please contact system administrator.",
    });
  };

  const handleRefreshHealth = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast.success("System Health Refreshed");
    }, 1000);
  };

  // Maintenance Mode Handlers
  const handleToggleFullPWA = () => {
    if (maintenanceMode.fullPWA.enabled) {
      disableFullPWAMaintenance();
      toast.success("Full PWA Maintenance Disabled");
      setMaintenanceMode(getMaintenanceMode());
    } else {
      setSelectedPage(null);
      setShowMaintenanceModal(true);
    }
  };

  const handleTogglePage = (pageId: string) => {
    const isEnabled = maintenanceMode.pages[pageId]?.enabled;
    if (isEnabled) {
      disablePageMaintenance(pageId);
      toast.success("Page Maintenance Disabled");
      setMaintenanceMode(getMaintenanceMode());
    } else {
      setSelectedPage(pageId);
      setShowMaintenanceModal(true);
    }
  };

  const handleMaintenanceProceed = (config: MaintenanceFormData) => {
    if (selectedPage) {
      // Page-specific maintenance
      enablePageMaintenance(
        selectedPage,
        config.reason,
        config.reason,
        config.estimatedTime,
        config.maintenanceDate,
        config.durationDays
      );
      toast.warning("Page Maintenance Enabled");
    } else {
      // Full PWA maintenance
      enableFullPWAMaintenance(
        config.reason,
        config.reason,
        config.estimatedTime,
        config.maintenanceDate,
        config.durationDays
      );
      toast.warning("Full PWA Maintenance Enabled", {
        description: "All users will see maintenance screen",
      });
    }
    setMaintenanceMode(getMaintenanceMode());
  };

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all maintenance modes?")) {
      clearAllMaintenance();
      setMaintenanceMode(getMaintenanceMode());
      toast.success("All Maintenance Modes Cleared");
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
      case "online":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "error":
      case "offline":
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Activity className="w-5 h-5 text-gray-500" />;
    }
  };

  const getHealthColor = (status: string) => {
    switch (status) {
      case "healthy":
      case "online":
        return "#10b981";
      case "warning":
        return "#f59e0b";
      case "error":
      case "offline":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const tools = [
    {
      title: "Database Backup",
      description: "Create a backup of the entire database",
      icon: <Database className="w-6 h-6" />,
      action: handleBackupDatabase,
      variant: "primary" as const,
      danger: false,
    },
    {
      title: "Restore Database",
      description: "Restore database from a backup file",
      icon: <Upload className="w-6 h-6" />,
      action: handleRestoreDatabase,
      variant: "secondary" as const,
      danger: true,
    },
    {
      title: "Clear Cache",
      description: "Clear all system cache to free up memory",
      icon: <Trash2 className="w-6 h-6" />,
      action: handleClearCache,
      variant: "secondary" as const,
      danger: false,
    },
    {
      title: "Export Data",
      description: "Export all system data to CSV/JSON",
      icon: <Download className="w-6 h-6" />,
      action: handleExportData,
      variant: "secondary" as const,
      danger: false,
    },
  ];

  return (
    <PageLayout
      title="System Tools"
      subtitle="Manage and maintain system operations"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "System Management", onClick: undefined },
        { label: "System Tools", onClick: undefined },
      ]}
    >
      {/* System Health Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            }}
          >
            System Health
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefreshHealth}
            icon={<RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Database Status */}
          <div
            className="p-6 rounded-xl border"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(255, 255, 255, 0.7)",
              backdropFilter: "blur(12px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <Database className="w-8 h-8" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              {getHealthIcon(systemHealth.database)}
            </div>
            <div
              className="mb-1"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              Database
            </div>
            <div
              className="capitalize"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: getHealthColor(systemHealth.database),
              }}
            >
              {systemHealth.database}
            </div>
          </div>

          {/* Storage Status */}
          <div
            className="p-6 rounded-xl border"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(255, 255, 255, 0.7)",
              backdropFilter: "blur(12px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <HardDrive className="w-8 h-8" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              {getHealthIcon(systemHealth.storage > 80 ? "warning" : "healthy")}
            </div>
            <div
              className="mb-1"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              Storage
            </div>
            <div
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: systemHealth.storage > 80 ? "#f59e0b" : "#10b981",
              }}
            >
              {systemHealth.storage}% Used
            </div>
          </div>

          {/* API Status */}
          <div
            className="p-6 rounded-xl border"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(255, 255, 255, 0.7)",
              backdropFilter: "blur(12px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <Wifi className="w-8 h-8" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              {getHealthIcon(systemHealth.api)}
            </div>
            <div
              className="mb-1"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              API Status
            </div>
            <div
              className="capitalize"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: getHealthColor(systemHealth.api),
              }}
            >
              {systemHealth.api}
            </div>
          </div>

          {/* Last Backup */}
          <div
            className="p-6 rounded-xl border"
            style={{
              background: isDark
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(255, 255, 255, 0.7)",
              backdropFilter: "blur(12px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <RefreshCw className="w-8 h-8" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div
              className="mb-1"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              Last Backup
            </div>
            <div
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              {systemHealth.lastBackup}
            </div>
          </div>
        </div>
      </div>

      {/* System Tools Section */}
      <div>
        <h2
          className="mb-4"
          style={{
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
          }}
        >
          Management Tools
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tools.map((tool, index) => (
            <div
              key={index}
              className="p-6 rounded-xl border hover:border-[#f6421f]/30 transition-all"
              style={{
                background: isDark
                  ? "rgba(255, 255, 255, 0.05)"
                  : "rgba(255, 255, 255, 0.7)",
                backdropFilter: "blur(12px)",
                borderColor: isDark
                  ? "rgba(255, 255, 255, 0.1)"
                  : "rgba(0, 0, 0, 0.1)",
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="p-3 rounded-lg"
                  style={{
                    backgroundColor: tool.danger
                      ? "rgba(239, 68, 68, 0.1)"
                      : isDark
                      ? "rgba(246, 66, 31, 0.1)"
                      : "rgba(246, 66, 31, 0.1)",
                    color: tool.danger ? "#ef4444" : DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  {tool.icon}
                </div>
                <div className="flex-1">
                  <h3
                    className="mb-2"
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {tool.title}
                  </h3>
                  <p
                    className="mb-4"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      color: isDark ? "#9ca3af" : "#6b7280",
                    }}
                  >
                    {tool.description}
                  </p>
                  <Button
                    variant={tool.variant}
                    size="sm"
                    onClick={tool.action}
                    disabled={isLoading}
                  >
                    {tool.danger ? "Proceed with Caution" : "Execute"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Maintenance Mode Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-4">
          <h2
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            }}
          >
            Maintenance Mode
          </h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleClearAll}
            icon={<Power className="w-4 h-4" />}
          >
            Clear All
          </Button>
        </div>

        {/* Full PWA Maintenance */}
        <div
          className="p-6 rounded-xl border mb-4"
          style={{
            background: maintenanceMode.fullPWA.enabled
              ? isDark
                ? "rgba(239, 68, 68, 0.1)"
                : "rgba(239, 68, 68, 0.05)"
              : isDark
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(12px)",
            borderColor: maintenanceMode.fullPWA.enabled
              ? "#ef4444"
              : isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.1)",
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1">
              <div
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: maintenanceMode.fullPWA.enabled
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(238, 135, 36, 0.1)",
                  color: maintenanceMode.fullPWA.enabled
                    ? "#ef4444"
                    : DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                <Wrench className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Full PWA Maintenance
                  </h3>
                  {maintenanceMode.fullPWA.enabled && (
                    <span
                      className="px-2 py-1 rounded text-xs"
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.2)",
                        color: "#ef4444",
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      ACTIVE
                    </span>
                  )}
                </div>
                <p
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                    color: isDark ? "#9ca3af" : "#6b7280",
                  }}
                >
                  {maintenanceMode.fullPWA.enabled
                    ? "Entire application is blocked. All users will see the maintenance screen."
                    : "Block the entire PWA for all users during system-wide maintenance."}
                </p>
              </div>
            </div>
            <Button
              variant={maintenanceMode.fullPWA.enabled ? "secondary" : "primary"}
              size="sm"
              onClick={handleToggleFullPWA}
            >
              {maintenanceMode.fullPWA.enabled ? "Disable" : "Enable"}
            </Button>
          </div>
        </div>

        {/* Page-Specific Maintenance */}
        <div
          className="p-6 rounded-xl border"
          style={{
            background: isDark
              ? "rgba(255, 255, 255, 0.05)"
              : "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(12px)",
            borderColor: isDark
              ? "rgba(255, 255, 255, 0.1)"
              : "rgba(0, 0, 0, 0.1)",
          }}
        >
          <h3
            className="mb-4"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            }}
          >
            Page-Specific Maintenance
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {AVAILABLE_PAGES.map((page) => {
              const isActive = maintenanceMode.fullPWA.enabled || maintenanceMode.pages[page.id]?.enabled;
              return (
                <div
                  key={page.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                  style={{
                    background: isActive
                      ? isDark
                        ? "rgba(251, 203, 41, 0.1)"
                        : "rgba(251, 203, 41, 0.15)"
                      : isDark
                      ? "rgba(255, 255, 255, 0.03)"
                      : "rgba(255, 255, 255, 0.5)",
                    borderColor: isActive
                      ? DESIGN_TOKENS.colors.brand.yellow
                      : isDark
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(0, 0, 0, 0.05)",
                  }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {isActive && (
                      <Shield
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: DESIGN_TOKENS.colors.brand.yellow }}
                      />
                    )}
                    <span
                      className="truncate"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                        fontWeight: isActive
                          ? DESIGN_TOKENS.typography.fontWeight.semibold
                          : DESIGN_TOKENS.typography.fontWeight.normal,
                        color: isActive
                          ? DESIGN_TOKENS.colors.brand.yellow
                          : undefined,
                      }}
                    >
                      {page.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleTogglePage(page.id)}
                    className="ml-2 px-2 py-1 rounded text-xs transition-all hover:scale-105"
                    disabled={maintenanceMode.fullPWA.enabled}
                    style={{
                      backgroundColor: isActive
                        ? "rgba(251, 203, 41, 0.2)"
                        : isDark
                        ? "rgba(246, 66, 31, 0.1)"
                        : "rgba(246, 66, 31, 0.1)",
                      color: isActive
                        ? DESIGN_TOKENS.colors.brand.yellow
                        : DESIGN_TOKENS.colors.brand.red,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      opacity: maintenanceMode.fullPWA.enabled ? 0.5 : 1,
                      cursor: maintenanceMode.fullPWA.enabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {isActive ? "ON" : "OFF"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Warning Notice */}
      <div
        className="mt-8 p-4 rounded-xl border-l-4"
        style={{
          background: isDark
            ? "rgba(239, 68, 68, 0.1)"
            : "rgba(239, 68, 68, 0.05)",
          borderColor: "#ef4444",
        }}
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <div
              className="mb-1"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: "#ef4444",
              }}
            >
              Critical Operations Warning
            </div>
            <p
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#fca5a5" : "#dc2626",
              }}
            >
              System tools perform critical operations that can affect data integrity and
              system availability. Always create a backup before making major changes.
              Contact the system administrator if you're unsure about any operation.
            </p>
          </div>
        </div>
      </div>

      {/* Maintenance Mode Configuration Modal */}
      <MaintenanceModeModal
        isOpen={showMaintenanceModal}
        onClose={() => setShowMaintenanceModal(false)}
        onProceed={handleMaintenanceProceed}
        title={selectedPage ? `Enable Maintenance Mode` : "Enable Full PWA Maintenance"}
        isDark={isDark}
      />
    </PageLayout>
  );
}