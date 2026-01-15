/**
 * =============================================================================
 * ACCESS LOGS PAGE
 * =============================================================================
 * 
 * System access logs for admin monitoring
 * Features:
 * - View all user access logs from real backend
 * - Filter by date, user, action type
 * - Export logs to PDF or Spreadsheet
 * - Search functionality
 * - Tile and Table view modes
 * - Skeleton loading during data fetch
 * - Progress toast notifications
 * 
 * Uses Design System Components
 * =============================================================================
 */

import { 
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
import { useState, useEffect, useCallback } from "react";
import { PageLayout, Button, SearchInput, StatusChip, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CustomDropdown from "./CustomDropdown";

// Organization branding (match AttendanceDashboardPage)
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const ORG_NAME = "Youth Service Philippines";
const ORG_CHAPTER = "Tagum Chapter";

// Helper to load image as base64 for jsPDF
function loadImage(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject("No canvas context");
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = url;
  });
}
import { type UploadToastMessage } from "./UploadToast";

interface AccessLog {
  id: string;
  user: string;
  action: string;
  type: string; // Can be: login, logout, view, edit, create, delete
  timestamp: string;
  ipAddress: string;
  device: string;
  status: string; // Can be: success, failed, warning
}

interface AccessLogsPageProps {
  onClose: () => void;
  isDark: boolean;
  username?: string;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast?: (id: string) => void;
}

const GAS_SYSTEM_TOOLS_API_URL =
  import.meta.env.VITE_GAS_SYSTEM_TOOLS_API_URL ||
  import.meta.env.VITE_GAS_LOGIN_API_URL ||
  '';

export default function AccessLogsPage({
  onClose,
  isDark,
  username = 'auditor',
  addUploadToast = () => {},
  updateUploadToast = () => {},
  removeUploadToast = () => {},
}: AccessLogsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"tile" | "table">("table");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AccessLog | null>(null);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalLogs: 0,
    successful: 0,
    failed: 0,
    warnings: 0,
  });
  const [exportType, setExportType] = useState("");

  const actionTypes = [
    { value: "all", label: "All", icon: Filter },
    { value: "login", label: "Login", icon: LogIn },
    { value: "logout", label: "Logout", icon: LogOut },
    { value: "view", label: "View", icon: Eye },
    { value: "edit", label: "Edit", icon: Edit },
    { value: "create", label: "Create", icon: Plus },
    { value: "delete", label: "Delete", icon: Trash2 },
  ];

  /**
   * Fetch access logs from backend
   */
  const fetchAccessLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(GAS_SYSTEM_TOOLS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'getAccessLogs',
          page: 1,
          limit: 1000,
          filterType: selectedType !== 'all' ? selectedType : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch logs');
      }

      // Transform API response to component format
      const formattedLogs = (data.data?.logs || []).map((log: any) => ({
        id: String(log.id ?? ''),
        user: String(log.user ?? ''),
        action: String(log.action ?? ''),
        type: String(log.type ?? 'view').toLowerCase(),
        status: String(log.status ?? 'success').toLowerCase(),
        timestamp: String(log.timestamp ?? ''),
        ipAddress: String(log.ipAddress ?? ''),
        device: String(log.device ?? ''),
      })) as AccessLog[];

      setLogs(formattedLogs);

      // Calculate stats
      const totalLogs = formattedLogs.length;
      const successCount = formattedLogs.filter(l => l.status === 'success').length;
      const failCount = formattedLogs.filter(l => l.status === 'failed').length;
      const warnCount = formattedLogs.filter(l => l.status === 'warning').length;

      setStats({
        totalLogs,
        successful: successCount,
        failed: failCount,
        warnings: warnCount,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch access logs';
      setError(errorMsg);
      console.error('Error fetching access logs:', err);
      toast.error('Failed to load access logs', {
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedType]);

  /**
   * Load logs on component mount and when selectedType changes
   */
  useEffect(() => {
    fetchAccessLogs();
  }, [fetchAccessLogs]);

  const filteredLogs = logs.filter((log) => {
    const userText = String(log.user ?? "");
    const actionText = String(log.action ?? "");
    const matchesSearch =
      userText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      actionText.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType =
      selectedType === "all" || log.type === selectedType;
    return matchesSearch && matchesType;
  });

  /**
   * Export logs to PDF with progress tracking
   */

  const handleExportPDF = async () => {
    if (filteredLogs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const toastId = `access-logs-pdf-export-${Date.now()}`;
    let cancelled = false;

    addUploadToast({
      id: toastId,
      title: 'Exporting PDF',
      message: 'Preparing document...',
      status: 'loading',
      progress: 0,
      onCancel: () => {
        cancelled = true;
        updateUploadToast(toastId, {
          status: 'info',
          progress: 100,
          title: 'Cancelled',
          message: 'PDF export cancelled',
        });
      },
    });

    try {
      // Step 1: Initialize PDF (10%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Initializing document...', progress: 10 });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      const doc = new jsPDF('landscape', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;

      // Step 2: Add header and branding (25%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Adding header and branding...', progress: 25 });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Try to load logo and draw header
      let logoLoaded = false;
      let logoImg: string | undefined = undefined;
      try {
        logoImg = await loadImage(ORG_LOGO_URL);
        // Orange header bar
        doc.setFillColor(246, 66, 31); // #f6421f
        doc.rect(0, 0, pageWidth, 45, 'F');
        // White circle for logo
        const logoSize = 30;
        const logoX = margin;
        const logoY = 7.5;
        doc.setFillColor(255, 255, 255);
        doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2, 'F');
        doc.addImage(logoImg, 'PNG', logoX, logoY, logoSize, logoSize);
        logoLoaded = true;
      } catch (e) {
        // Fallback: just orange bar
        doc.setFillColor(246, 66, 31);
        doc.rect(0, 0, pageWidth, 45, 'F');
      }

      // Org name and chapter
      doc.setTextColor(255, 255, 255);
      const orgNameX = logoLoaded ? margin + 35 : margin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(ORG_NAME, orgNameX, 18);
      doc.setFontSize(12);
      doc.text(ORG_CHAPTER, orgNameX, 26);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('ACCESS LOGS REPORT', orgNameX, 35);

      // Date on right
      const dateStr = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      doc.setFontSize(9);
      doc.text(`Generated: ${dateStr}`, pageWidth - margin, 35, { align: 'right' });

      let yPosition = 50;

      // Step 3: Add statistics summary (40%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Calculating statistics...', progress: 40 });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Add divider line
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);

      // Stats boxes
      const boxWidth = (pageWidth - 2 * margin - 9) / 4;
      const boxHeight = 14;
      const statuses = [
        { name: 'TOTAL', color: [100, 100, 100], count: filteredLogs.length },
        { name: 'SUCCESS', color: [16, 185, 129], count: filteredLogs.filter(l => l.status === 'success').length },
        { name: 'FAILED', color: [239, 68, 68], count: filteredLogs.filter(l => l.status === 'failed').length },
        { name: 'WARNING', color: [245, 158, 11], count: filteredLogs.filter(l => l.status === 'warning').length },
      ];

      statuses.forEach((stat, index) => {
        const boxX = margin + index * (boxWidth + 3);
        
        doc.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
        doc.roundedRect(boxX, yPosition, boxWidth, boxHeight, 2, 2, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text(String(stat.count), boxX + boxWidth / 2, yPosition + 7, { align: 'center' });
        
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(stat.name, boxX + boxWidth / 2, yPosition + 11, { align: 'center' });
      });

      yPosition += boxHeight + 10;


      // Step 4: Prepare table data (60%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Preparing table data...', progress: 60 });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      const tableData = filteredLogs.map((log, index) => [
        String(index + 1),
        log.user,
        log.action,
        log.type.charAt(0).toUpperCase() + log.type.slice(1),
        log.status.charAt(0).toUpperCase() + log.status.slice(1),
        new Date(log.timestamp).toLocaleString(),
        log.ipAddress,
        log.device.length > 30 ? log.device.substring(0, 27) + '...' : log.device,
      ]);

      // Step 5: Generate table (80%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Generating table...', progress: 80 });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      autoTable(doc, {
        startY: yPosition,
        head: [['#', 'User', 'Action', 'Type', 'Status', 'Timestamp', 'IP Address', 'Device']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [246, 66, 31],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: 2,
          halign: 'center',
        },
        bodyStyles: {
          fontSize: 7,
          textColor: [50, 50, 50],
          cellPadding: 2,
        },
        alternateRowStyles: {
          fillColor: [254, 249, 244],
        },
        // Wider columns for better use of page
        columnStyles: {
          0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 38 },
          2: { cellWidth: 44 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 22, halign: 'center' },
          5: { cellWidth: 44, halign: 'center' },
          6: { cellWidth: 38 },
          7: { cellWidth: 44 },
        },
        styles: {
          lineColor: [220, 220, 220],
          lineWidth: 0.1,
        },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          // Footer line
          doc.setDrawColor(246, 66, 31);
          doc.setLineWidth(0.5);
          doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
          // Footer text
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          doc.setFont('helvetica', 'normal');
          doc.text(
            `${ORG_NAME} - System Access Audit Report`,
            margin,
            pageHeight - 8
          );
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            pageWidth - margin,
            pageHeight - 8,
            { align: 'right' }
          );
        },
      });

      // Step 6: Save file (100%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Saving PDF file...', progress: 100 });
      await new Promise(resolve => setTimeout(resolve, 200));
      if (cancelled) return;

      const dateStr2 = new Date().toISOString().split('T')[0];
      const filename = `AccessLogs_${dateStr2}.pdf`;

      doc.save(filename);

      updateUploadToast(toastId, {
        message: `File saved as "${filename}"`,
        status: 'success',
        progress: 100,
      });

      setTimeout(() => removeUploadToast(toastId), 3000);
    } catch (error) {
      if (cancelled) {
        return;
      }
      console.error('PDF Export Error:', error);
      updateUploadToast(toastId, {
        message: 'An error occurred while generating the PDF.',
        status: 'error',
        progress: 0,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };

  /**
   * Export logs to Google Sheets
   */
  const handleExportSpreadsheet = async () => {
    if (filteredLogs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const toastId = `access-logs-sheet-export-${Date.now()}`;
    let cancelled = false;

    addUploadToast({
      id: toastId,
      title: 'Exporting to Spreadsheet',
      message: 'Preparing data...',
      status: 'loading',
      progress: 0,
      onCancel: () => {
        cancelled = true;
        updateUploadToast(toastId, {
          status: 'info',
          progress: 100,
          title: 'Cancelled',
          message: 'Export cancelled',
        });
      },
    });

    try {
      // Step 1: Format data (20%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Formatting data...', progress: 20 });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Prepare spreadsheet data
      const headers = ['User', 'Action', 'Type', 'Status', 'Timestamp', 'IP Address', 'Device'];
      const data = filteredLogs.map(log => [
        log.user,
        log.action,
        log.type,
        log.status,
        log.timestamp,
        log.ipAddress,
        log.device,
      ]);

      // Step 2: Create CSV content (50%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Generating spreadsheet...', progress: 50 });
      await new Promise(resolve => setTimeout(resolve, 200));
      if (cancelled) return;

      const csvContent = [
        headers.join(','),
        ...data.map(row => row.map(cell => `"${cell}"`).join(',')),
      ].join('\n');

      // Step 3: Prepare download (80%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Preparing download...', progress: 80 });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `AccessLogs_${dateStr}.csv`;

      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);

      // Step 4: Save file (100%)
      if (cancelled) return;
      updateUploadToast(toastId, { message: 'Saving file...', progress: 100 });
      link.click();

      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      updateUploadToast(toastId, {
        message: `File saved as "${filename}"`,
        status: 'success',
        progress: 100,
      });

      setTimeout(() => removeUploadToast(toastId), 3000);
    } catch (error) {
      if (cancelled) {
        return;
      }
      console.error('Spreadsheet Export Error:', error);
      updateUploadToast(toastId, {
        message: 'An error occurred while exporting the spreadsheet.',
        status: 'error',
        progress: 0,
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };

  useEffect(() => {
    if (exportType === "pdf") handleExportPDF();
    if (exportType === "csv") handleExportSpreadsheet();
    setExportType("");
  }, [exportType]);

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

  // Shimmer animation styles
  const ShimmerStyles = () => (
    <style>{`
      .access-logs-shimmer {
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
        animation: accessLogsShimmer 1.5s infinite;
      }
      .dark .access-logs-shimmer {
        background: linear-gradient(
          90deg,
          transparent 0%,
          rgba(255, 255, 255, 0.1) 50%,
          transparent 100%
        );
      }
      @keyframes accessLogsShimmer {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    `}</style>
  );

  // Skeleton line component
  const SkeletonLine = ({ width = '100%', height = '1rem', className = '' }: { width?: string; height?: string; className?: string }) => (
    <div 
      className={`rounded relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'} ${className}`}
      style={{ width, height }}
    >
      <div className="access-logs-shimmer" />
    </div>
  );

  // Stats card skeleton
  const StatsCardSkeleton = () => (
    <div
      className="p-4 sm:p-5 rounded-xl border animate-pulse"
      style={{
        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(12px)",
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      }}
    >
      <SkeletonLine width="60%" height="0.875rem" className="mb-2" />
      <SkeletonLine width="50%" height="2rem" />
    </div>
  );

  // Tile view skeleton
  const TileCardSkeleton = () => (
    <div
      className="p-5 rounded-xl border animate-pulse"
      style={{
        background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(12px)",
        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      }}
    >
      <ShimmerStyles />
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full relative overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div className="access-logs-shimmer" />
          </div>
          <SkeletonLine width="100px" height="1rem" />
        </div>
        <SkeletonLine width="70px" height="1.5rem" className="rounded-full" />
      </div>
      {/* Action */}
      <div className="mb-3">
        <SkeletonLine width="50px" height="0.75rem" className="mb-1" />
        <SkeletonLine width="80%" height="1rem" />
      </div>
      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
        <div>
          <SkeletonLine width="40px" height="0.75rem" className="mb-1" />
          <SkeletonLine width="90%" height="0.75rem" />
        </div>
        <div>
          <SkeletonLine width="50px" height="0.75rem" className="mb-1" />
          <SkeletonLine width="80%" height="0.75rem" />
        </div>
      </div>
      {/* IP Address */}
      <div className="mt-3 pt-3 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
        <SkeletonLine width="120px" height="0.75rem" />
      </div>
    </div>
  );

  // Table row skeleton
  const TableRowSkeleton = () => (
    <tr
      className="border-b"
      style={{
        borderColor: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
        height: "64px",
      }}
    >
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full relative overflow-hidden flex-shrink-0 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
            <div className="access-logs-shimmer" />
          </div>
          <SkeletonLine width="100px" height="1rem" />
        </div>
      </td>
      <td className="px-4 py-4">
        <SkeletonLine width="140px" height="1rem" />
      </td>
      <td className="px-4 py-4">
        <SkeletonLine width="80px" height="1.5rem" className="rounded-lg" />
      </td>
      <td className="px-4 py-4">
        <SkeletonLine width="70px" height="1.5rem" className="rounded-full" />
      </td>
      <td className="px-4 py-4">
        <SkeletonLine width="150px" height="1rem" />
      </td>
      <td className="px-4 py-4">
        <SkeletonLine width="100px" height="1rem" />
      </td>
      <td className="px-4 py-4">
        <SkeletonLine width="120px" height="1rem" />
      </td>
    </tr>
  );

  // Table skeleton
  const TableSkeleton = () => (
    <div className="overflow-x-auto rounded-xl border" style={{
      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
      background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.5)",
    }}>
      <ShimmerStyles />
      <table className="w-full">
        <thead>
          <tr
            className="border-b"
            style={{
              background: isDark ? "rgba(246, 66, 31, 0.05)" : "rgba(246, 66, 31, 0.03)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            }}
          >
            {["User", "Action", "Type", "Status", "Timestamp", "IP Address", "Device"].map((header) => (
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
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(8)].map((_, i) => (
            <TableRowSkeleton key={i} />
          ))}
        </tbody>
      </table>
    </div>
  );

  // Tile grid skeleton
  const TileGridSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <ShimmerStyles />
      {[...Array(6)].map((_, i) => (
        <TileCardSkeleton key={i} />
      ))}
    </div>
  );

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
            placeholder="Search logs by user or action..."
            isDark={isDark}
          />
        </div>
        <div className="flex gap-3">
          <div className="min-w-[160px]">
            <CustomDropdown
              value={exportType}
              onChange={setExportType}
              options={[
                { value: "pdf", label: "Export as PDF" },
                { value: "csv", label: "Export as CSV" },
              ]}
              placeholder="Export"
              isDark={isDark}
              size="md"
              disabled={isLoading || filteredLogs.length === 0}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {isLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          [
            { label: "Total Logs", value: stats.totalLogs.toString(), color: DESIGN_TOKENS.colors.brand.red },
            {
              label: "Successful",
              value: stats.successful.toString(),
              color: "#10b981",
            },
            {
              label: "Failed",
              value: stats.failed.toString(),
              color: "#ef4444",
            },
            {
              label: "Warnings",
              value: stats.warnings.toString(),
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
          ))
        )}
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
                disabled={isLoading}
                className={`px-3 sm:px-4 py-2 rounded-lg transition-all whitespace-nowrap flex items-center gap-2 disabled:opacity-50 ${
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
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 ${
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
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 ${
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

      {/* Loading State */}
      {isLoading && (
        viewMode === "table" ? <TableSkeleton /> : <TileGridSkeleton />
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-200">Error Loading Logs</h3>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchAccessLogs}
                className="mt-3"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tile View */}
      {viewMode === "tile" && !isLoading && !error && (
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
                      background: `${getActionColor(log.type)}20`,
                      color: getActionColor(log.type),
                    }}
                  >
                    {getActionTypeIcon(log.type)}
                  </div>
                  <div>
                    <div
                      className="text-sm"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      {log.user}
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
                    {new Date(log.timestamp).toLocaleString()}
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
      {viewMode === "table" && !isLoading && !error && (
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
                          background: `${getActionColor(log.type)}20`,
                          color: getActionColor(log.type),
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
                          {log.user}
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
                        background: `${getActionColor(log.type)}20`,
                        color: getActionColor(log.type),
                        fontSize: "13px",
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      {getActionTypeIcon(log.type)}
                      <span className="capitalize">{log.type}</span>
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
                        {new Date(log.timestamp).toLocaleString()}
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
      {filteredLogs.length === 0 && !isLoading && !error && (
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
                      background: `${getActionColor(selectedLog.type)}20`,
                      color: getActionColor(selectedLog.type),
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
                      {selectedLog.user}
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
                      background: `${getActionColor(selectedLog.type)}20`,
                      color: getActionColor(selectedLog.type),
                      fontSize: "13px",
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {getActionTypeIcon(selectedLog.type)}
                    <span className="capitalize">{selectedLog.type}</span>
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
                      {new Date(selectedLog.timestamp).toLocaleString()}
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
