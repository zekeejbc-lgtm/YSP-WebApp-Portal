/**
 * =============================================================================
 * SYSTEM TOOLS PAGE
 * =============================================================================
 * 
 * Admin tools for system management
 * Features:
 * - Database backup (creates spreadsheet with all data)
 * - Export data (creates spreadsheet export)
 * - Clear cache (bumps global cache version)
 * - System health monitoring (real-time from backend)
 * - Maintenance mode (backend-synced)
 * 
 * Uses Design System Components
 * Progress Toast for all backend operations
 * Skeleton loading states
 * =============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { PageLayout, Button, DESIGN_TOKENS } from "./design-system";
import { toast } from "sonner";
import { UploadToastMessage } from "./UploadToast";
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
  getSystemHealth,
  createDatabaseBackup,
  exportData,
  bumpCacheVersion,
  forceClearAllCaches,
  getMaintenanceModeFromBackend,
  enableMaintenanceModeBackend,
  disableMaintenanceModeBackend,
  clearAllMaintenanceBackend,
  AVAILABLE_PAGES_BACKEND,
  type SystemHealthData,
  logCreate,
  logEdit,
} from "../services/gasSystemToolsService";

import {
  Database,
  HardDrive,
  Wifi,
  RefreshCw,
  Activity,
  CheckCircle,
  AlertTriangle,
  Trash2,
  Download,
  Wrench,
  Power,
  Shield,
  ExternalLink,
  Clock,
  Users,
} from "lucide-react";

interface SystemToolsPageProps {
  onClose: () => void;
  isDark: boolean;
  username?: string;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
}

// Skeleton Components
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
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  `}</style>
);

function SkeletonLine({ width = '100%', height = '1rem', className = '' }: { width?: string; height?: string; className?: string }) {
  return (
    <div 
      className={`rounded-md bg-gray-200 dark:bg-gray-700 relative overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <div className="skeleton-shimmer" />
    </div>
  );
}

function HealthCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="p-6 rounded-xl border"
      style={{
        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(12px)",
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      }}
    >
      <ShimmerStyles />
      <div className="flex items-center justify-between mb-3">
        <SkeletonLine width="32px" height="32px" className="rounded-lg" />
        <SkeletonLine width="20px" height="20px" className="rounded-full" />
      </div>
      <SkeletonLine width="60px" height="12px" className="mb-2" />
      <SkeletonLine width="80px" height="20px" />
    </div>
  );
}

function ToolCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className="p-6 rounded-xl border"
      style={{
        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(12px)",
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      }}
    >
      <ShimmerStyles />
      <div className="flex items-start gap-4">
        <SkeletonLine width="48px" height="48px" className="rounded-lg flex-shrink-0" />
        <div className="flex-1">
          <SkeletonLine width="120px" height="20px" className="mb-2" />
          <SkeletonLine width="100%" height="14px" className="mb-2" />
          <SkeletonLine width="80%" height="14px" className="mb-4" />
          <SkeletonLine width="100px" height="32px" className="rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function SystemToolsPage({
  onClose,
  isDark,
  username = 'admin',
  addUploadToast,
  updateUploadToast,
}: SystemToolsPageProps) {
  // Loading states
  const [isLoadingHealth, setIsLoadingHealth] = useState(true);
  const [isLoadingMaintenance, setIsLoadingMaintenance] = useState(true);
  const [isOperationLoading, setIsOperationLoading] = useState(false);
  
  // Data states
  const [systemHealth, setSystemHealth] = useState<SystemHealthData | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceModeState>(getMaintenanceMode());
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState<string | null>(null);

  // Helper functions for progress toast
  const showProgressToast = (id: string, title: string, message: string, progress: number, onCancel?: () => void) => {
    if (addUploadToast) {
      addUploadToast({ id, title, message, status: 'loading', progress, onCancel });
    }
  };

  const updateProgressToast = (id: string, updates: Partial<UploadToastMessage>) => {
    if (updateUploadToast) {
      updateUploadToast(id, updates);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'Never' || dateStr === 'Error') return dateStr;
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  // Fetch system health from backend
  const fetchSystemHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    try {
      const health = await getSystemHealth();
      setSystemHealth(health);
    } catch (error) {
      console.error('Error fetching system health:', error);
      toast.error('Failed to fetch system health');
      setSystemHealth({
        database: 'error',
        databaseRows: 0,
        storage: 0,
        totalCells: 0,
        maxCells: 10000000,
        api: 'offline',
        lastBackup: 'Error',
        lastExport: 'Error',
        cacheVersion: 0,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  // Fetch maintenance mode from backend
  const fetchMaintenanceMode = useCallback(async () => {
    setIsLoadingMaintenance(true);
    try {
      const state = await getMaintenanceModeFromBackend(true);
      setMaintenanceMode(state);
    } catch (error) {
      console.error('Error fetching maintenance mode:', error);
      // Fall back to local storage
      setMaintenanceMode(getMaintenanceMode());
    } finally {
      setIsLoadingMaintenance(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchSystemHealth();
    fetchMaintenanceMode();
  }, [fetchSystemHealth, fetchMaintenanceMode]);

  const handleBackupDatabase = async () => {
    const toastId = 'backup-' + Date.now();
    const controller = new AbortController();
    const { signal } = controller;
    setIsOperationLoading(true);
    
    showProgressToast(toastId, 'Database Backup', 'Starting backup...', 0, () => {
      controller.abort();
      updateProgressToast(toastId, {
        status: 'info',
        progress: 100,
        title: 'Cancelled',
        message: 'Backup cancelled',
      });
    });
    
    try {
      updateProgressToast(toastId, { progress: 10, message: 'Connecting to database...' });
      await new Promise(resolve => setTimeout(resolve, 500));
      if (signal.aborted) return;
      
      updateProgressToast(toastId, { progress: 30, message: 'Copying sheets...' });
      const result = await createDatabaseBackup(username, signal);
      if (signal.aborted) return;
      
      updateProgressToast(toastId, { progress: 80, message: 'Finalizing backup...' });
      await new Promise(resolve => setTimeout(resolve, 300));
      if (signal.aborted) return;
      
      updateProgressToast(toastId, {
        status: 'success',
        progress: 100,
        title: 'Backup Complete!',
        message: `${result.sheetsCount} sheets backed up successfully.`,
      });
      logCreate(username, "Database backup", result.backupName);
      
      if (result.backupUrl) {
        toast.success('Backup Created', {
          description: 'Click to open the backup spreadsheet',
          action: {
            label: 'Open',
            onClick: () => window.open(result.backupUrl, '_blank'),
          },
        });
      }
      
      if (signal.aborted) return;
      fetchSystemHealth();
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      console.error('Backup error:', error);
      updateProgressToast(toastId, {
        status: 'error',
        progress: 100,
        title: 'Backup Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleClearCache = async () => {
    const toastId = 'cache-' + Date.now();
    const controller = new AbortController();
    const { signal } = controller;
    setIsOperationLoading(true);
    
    showProgressToast(toastId, 'Clear Cache', 'Bumping cache version...', 0, () => {
      controller.abort();
      updateProgressToast(toastId, {
        status: 'info',
        progress: 100,
        title: 'Cancelled',
        message: 'Cache clear cancelled',
      });
    });
    
    try {
      updateProgressToast(toastId, { progress: 20, message: 'Updating server cache version...' });
      const result = await bumpCacheVersion(username, signal);
      if (signal.aborted) return;
      
      updateProgressToast(toastId, { progress: 60, message: 'Clearing local caches...' });
      await new Promise(resolve => setTimeout(resolve, 500));
      if (signal.aborted) return;
      
      updateProgressToast(toastId, {
        status: 'success',
        progress: 100,
        title: 'Cache Cleared!',
        message: `Version bumped from ${result.previousVersion} to ${result.newVersion}. All clients will refresh.`,
      });
      logEdit(username, "Cache version", `${result.previousVersion} -> ${result.newVersion}`);
      
      toast.info('Cache Refresh', {
        description: 'All users will see the refresh prompt on their next page load.',
        duration: 5000,
      });
      
      const confirmRefresh = window.confirm(
        'Cache version has been updated. Do you want to refresh your browser now to apply changes?'
      );
      
      if (confirmRefresh) {
        await forceClearAllCaches();
      } else {
        fetchSystemHealth();
      }
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      console.error('Clear cache error:', error);
      updateProgressToast(toastId, {
        status: 'error',
        progress: 100,
        title: 'Clear Cache Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleExportData = async () => {
    const toastId = 'export-' + Date.now();
    const controller = new AbortController();
    const { signal } = controller;
    setIsOperationLoading(true);
    
    showProgressToast(toastId, 'Export Data', 'Starting export...', 0, () => {
      controller.abort();
      updateProgressToast(toastId, {
        status: 'info',
        progress: 100,
        title: 'Cancelled',
        message: 'Export cancelled',
      });
    });
    
    try {
      updateProgressToast(toastId, { progress: 10, message: 'Connecting to database...' });
      await new Promise(resolve => setTimeout(resolve, 500));
      if (signal.aborted) return;
      
      updateProgressToast(toastId, { progress: 30, message: 'Exporting sheets...' });
      const result = await exportData(username, signal);
      if (signal.aborted) return;
      
      updateProgressToast(toastId, { progress: 80, message: 'Finalizing export...' });
      await new Promise(resolve => setTimeout(resolve, 300));
      if (signal.aborted) return;
      
      updateProgressToast(toastId, {
        status: 'success',
        progress: 100,
        title: 'Export Complete!',
        message: `${result.sheetsCount} sheets (${result.totalRows.toLocaleString()} rows) exported.`,
      });
      logCreate(username, "Database export", result.exportName);
      
      if (result.exportUrl) {
        toast.success('Data Exported', {
          description: 'Click to open the exported spreadsheet',
          action: {
            label: 'Open',
            onClick: () => window.open(result.exportUrl, '_blank'),
          },
        });
      }
      
      if (signal.aborted) return;
      fetchSystemHealth();
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      console.error('Export error:', error);
      updateProgressToast(toastId, {
        status: 'error',
        progress: 100,
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsOperationLoading(false);
    }
  };

  const handleRefreshHealth = async () => {
    await fetchSystemHealth();
    toast.success('System Health Refreshed');
  };

  // Maintenance Mode Handlers
  const handleToggleFullPWA = async () => {
    if (maintenanceMode.fullPWA.enabled) {
      await handleDisableMaintenance('fullPWA');
    } else {
      setSelectedPage(null);
      setShowMaintenanceModal(true);
    }
  };

  const handleTogglePage = async (pageId: string) => {
    const isEnabled = maintenanceMode.pages[pageId]?.enabled;
    if (isEnabled) {
      await handleDisableMaintenance(pageId);
    } else {
      setSelectedPage(pageId);
      setShowMaintenanceModal(true);
    }
  };

  const handleEnableMaintenance = async (config: MaintenanceFormData) => {
    const pageId = selectedPage || 'fullPWA';
    const toastId = 'maintenance-' + Date.now();
    const controller = new AbortController();
    const { signal } = controller;
    
    showProgressToast(toastId, 'Maintenance Mode', 'Enabling...', 0, () => {
      controller.abort();
      updateProgressToast(toastId, {
        status: 'info',
        progress: 100,
        title: 'Cancelled',
        message: 'Enable maintenance cancelled',
      });
    });
    
    try {
      updateProgressToast(toastId, { progress: 50, message: 'Updating backend...' });
      
      await enableMaintenanceModeBackend(
        pageId,
        {
          reason: config.reason,
          message: config.reason,
          estimatedTime: config.estimatedTime,
          maintenanceDate: config.maintenanceDate,
          durationDays: config.durationDays,
        },
        username,
        signal
      );
      if (signal.aborted) return;
      
      // Also update local storage for immediate effect
      if (pageId === 'fullPWA') {
        enableFullPWAMaintenance(
          config.reason,
          config.reason,
          config.estimatedTime,
          config.maintenanceDate,
          config.durationDays
        );
      } else {
        enablePageMaintenance(
          pageId,
          config.reason,
          config.reason,
          config.estimatedTime,
          config.maintenanceDate,
          config.durationDays
        );
      }
      
      updateProgressToast(toastId, {
        status: 'success',
        progress: 100,
        title: 'Maintenance Enabled',
        message: pageId === 'fullPWA' ? 'Full PWA is now in maintenance mode.' : `${pageId} is now in maintenance mode.`,
      });
      logEdit(username, "Maintenance mode", `${pageId} enabled`);
      
      if (signal.aborted) return;
      await fetchMaintenanceMode();
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      console.error('Enable maintenance error:', error);
      updateProgressToast(toastId, {
        status: 'error',
        progress: 100,
        title: 'Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    setShowMaintenanceModal(false);
    setSelectedPage(null);
  };

  const handleDisableMaintenance = async (pageId: string) => {
    const toastId = 'maintenance-' + Date.now();
    const controller = new AbortController();
    const { signal } = controller;
    
    showProgressToast(toastId, 'Maintenance Mode', 'Disabling...', 0, () => {
      controller.abort();
      updateProgressToast(toastId, {
        status: 'info',
        progress: 100,
        title: 'Cancelled',
        message: 'Disable maintenance cancelled',
      });
    });
    
    try {
      updateProgressToast(toastId, { progress: 50, message: 'Updating backend...' });
      
      await disableMaintenanceModeBackend(pageId, username, signal);
      if (signal.aborted) return;
      
      // Also update local storage
      if (pageId === 'fullPWA') {
        disableFullPWAMaintenance();
      } else {
        disablePageMaintenance(pageId);
      }
      
      updateProgressToast(toastId, {
        status: 'success',
        progress: 100,
        title: 'Maintenance Disabled',
        message: pageId === 'fullPWA' ? 'Full PWA maintenance disabled.' : `${pageId} maintenance disabled.`,
      });
      logEdit(username, "Maintenance mode", `${pageId} disabled`);
      
      if (signal.aborted) return;
      await fetchMaintenanceMode();
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      console.error('Disable maintenance error:', error);
      updateProgressToast(toastId, {
        status: 'error',
        progress: 100,
        title: 'Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Are you sure you want to clear all maintenance modes?")) return;
    
    const toastId = 'clear-maintenance-' + Date.now();
    const controller = new AbortController();
    const { signal } = controller;
    
    showProgressToast(toastId, 'Clear Maintenance', 'Clearing all...', 0, () => {
      controller.abort();
      updateProgressToast(toastId, {
        status: 'info',
        progress: 100,
        title: 'Cancelled',
        message: 'Clear maintenance cancelled',
      });
    });
    
    try {
      updateProgressToast(toastId, { progress: 50, message: 'Updating backend...' });
      
      await clearAllMaintenanceBackend(username, signal);
      if (signal.aborted) return;
      clearAllMaintenance(); // Also clear local
      
      updateProgressToast(toastId, {
        status: 'success',
        progress: 100,
        title: 'All Cleared',
        message: 'All maintenance modes have been disabled.',
      });
      logEdit(username, "Maintenance mode", "Cleared all");
      
      if (signal.aborted) return;
      await fetchMaintenanceMode();
    } catch (error) {
      if (signal.aborted) {
        return;
      }
      console.error('Clear all maintenance error:', error);
      updateProgressToast(toastId, {
        status: 'error',
        progress: 100,
        title: 'Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
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
      description: "Create a complete backup of all database sheets to a new spreadsheet. Backups are saved to Google Drive.",
      icon: <Database className="w-6 h-6" />,
      action: handleBackupDatabase,
      variant: "primary" as const,
      danger: false,
      buttonText: "Create Backup",
    },
    {
      title: "Export Data",
      description: "Export all system data to a new spreadsheet for external analysis or archiving.",
      icon: <Download className="w-6 h-6" />,
      action: handleExportData,
      variant: "secondary" as const,
      danger: false,
      buttonText: "Export All Data",
    },
    {
      title: "Clear Cache",
      description: "Bump the global cache version to force all users to refresh. This clears cached data across all devices.",
      icon: <Trash2 className="w-6 h-6" />,
      action: handleClearCache,
      variant: "secondary" as const,
      danger: true,
      buttonText: "Clear All Caches",
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
            icon={<RefreshCw className={`w-4 h-4 ${isLoadingHealth ? "animate-spin" : ""}`} />}
            disabled={isLoadingHealth}
          >
            Refresh
          </Button>
        </div>

        {isLoadingHealth ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <HealthCardSkeleton key={i} isDark={isDark} />
            ))}
          </div>
        ) : systemHealth && (
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
            <div
              className="mt-1 flex items-center gap-1"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              <Users className="w-3 h-3" />
              {systemHealth.databaseRows?.toLocaleString() || 0} users
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
              {systemHealth.storage?.toFixed(2) || 0}% Used
            </div>
            <div
              className="mt-1"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              {systemHealth.totalCells?.toLocaleString() || 0} / {systemHealth.maxCells?.toLocaleString() || 10000000} cells
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
            <div
              className="mt-1 flex items-center gap-1"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              <Activity className="w-3 h-3" />
              Cache v{systemHealth.cacheVersion || 1}
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
              <Clock className="w-5 h-5 text-blue-500" />
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
              {formatDate(systemHealth.lastBackup)}
            </div>
            <div
              className="mt-1"
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                color: isDark ? "#9ca3af" : "#6b7280",
              }}
            >
              Export: {formatDate(systemHealth.lastExport || 'Never')}
            </div>
          </div>
        </div>
        )}
      </div>

      {/* System Tools Section */}
      <div className="mb-8">
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

        {isLoadingHealth ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <ToolCardSkeleton key={i} isDark={isDark} />
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    disabled={isOperationLoading}
                    icon={!tool.danger ? <ExternalLink className="w-4 h-4" /> : undefined}
                  >
                    {tool.buttonText || 'Execute'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}
      </div>

      {/* Maintenance Mode Section */}
      <div className="mb-8">
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
            disabled={isLoadingMaintenance}
          >
            Clear All
          </Button>
        </div>

        {isLoadingMaintenance ? (
          <>
            <ToolCardSkeleton isDark={isDark} />
            <div className="mt-4 p-6 rounded-xl border" style={{
              background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.7)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            }}>
              <ShimmerStyles />
              <SkeletonLine width="200px" height="24px" className="mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                    <SkeletonLine width="100px" height="14px" />
                    <SkeletonLine width="40px" height="24px" className="rounded" />
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
        <>
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
        </>
        )}
      </div>

      {/* Warning Notice */}
      <div
        className="p-4 rounded-xl border-l-4"
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
        onClose={() => {
          setShowMaintenanceModal(false);
          setSelectedPage(null);
        }}
        onProceed={handleEnableMaintenance}
        title={selectedPage ? `Enable Maintenance: ${selectedPage}` : "Enable Full PWA Maintenance"}
        isDark={isDark}
      />
    </PageLayout>
  );
}
