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
  RefreshCw,
  Calendar,
  CheckSquare,
  AlertTriangle,
  FileText,
  BarChart3,
  PieChartIcon,
  Download,
  ChevronDown,
  FileSpreadsheet,
  Loader2,
  Cloud,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PageLayout, Button, SearchInput, StatusChip, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import CustomDropdown from "./CustomDropdown";
import { logAccess, clearAllAccessLogs, clearAccessLogsByDateRange, clearSpecificAccessLogs, uploadAccessLogsPDF } from "../services/gasSystemToolsService";
import { getSessionToken } from "../services/gasLoginService";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// Organization branding (match AttendanceDashboardPage)
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const ORG_NAME = "Youth Service Philippines";
const ORG_CHAPTER = "Tagum Chapter";
const ORG_MOTTO = "Shaping the Future to a Greater Society";

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

interface AccessLog {
  id: string;
  user: string;
  fullName: string;
  profilePic: string;
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
  onModalStateChange?: (isOpen: boolean) => void;
}

const GAS_SYSTEM_TOOLS_API_URL =
  import.meta.env.VITE_GAS_SYSTEM_TOOLS_API_URL ||
  import.meta.env.VITE_GAS_LOGIN_API_URL ||
  '';
const ITEMS_PER_PAGE = 10;

export default function AccessLogsPage({
  onClose,
  isDark,
  username = 'auditor',
  addUploadToast = () => {},
  updateUploadToast = () => {},
  removeUploadToast = () => {},
  onModalStateChange = () => {},
}: AccessLogsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"tile" | "table">("table");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AccessLog | null>(null);
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    totalLogs: 0,
    successful: 0,
    failed: 0,
    warnings: 0,
  });
  const hasLoggedViewRef = useRef(false);
  const [selectedProfilePic, setSelectedProfilePic] = useState<string | null>(null);

  const [showClearLogsModal, setShowClearLogsModal] = useState(false);
  const [clearMode, setClearMode] = useState<'all' | 'dateRange' | 'selected'>('all');
  const [clearStartDate, setClearStartDate] = useState("");
  const [clearEndDate, setClearEndDate] = useState("");
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [isClearing, setIsClearing] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Export State (matching AttendanceDashboard pattern)
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'spreadsheet'>('pdf');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  
  // Charts visibility state
  const [showCharts, setShowCharts] = useState(true);
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");

  // Notify parent when any modal is open (to hide chatbot)
  useEffect(() => {
    const isAnyModalOpen = showClearLogsModal || showConfirmClear || showDetailModal || showExportPreview;
    onModalStateChange(isAnyModalOpen);
  }, [showClearLogsModal, showConfirmClear, showDetailModal, showExportPreview, onModalStateChange]);

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
      if (!hasLoggedViewRef.current) {
        hasLoggedViewRef.current = true;
        try {
          await logAccess({
            username,
            action: "Viewed Access Logs",
            actionType: "view",
            status: "success",
          });
        } catch (logError) {
          console.warn("Failed to log access logs view:", logError);
        }
      }

      const response = await fetch(GAS_SYSTEM_TOOLS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({
          action: 'getAccessLogs',
          page: 1,
          limit: 200,
          filterType: selectedType !== 'all' ? selectedType : null,
          username,
          sessionToken: getSessionToken(),
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
        fullName: String(log.fullName ?? log.user ?? ''),
        profilePic: String(log.profilePic ?? ''),
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
      // Check if this is a permission error
      const isPermissionError = errorMsg.toLowerCase().includes('auditor') || 
                                 errorMsg.toLowerCase().includes('admin') || 
                                 errorMsg.toLowerCase().includes('permission') ||
                                 errorMsg.toLowerCase().includes('access denied') ||
                                 errorMsg.toLowerCase().includes('unauthorized');
      
      if (isPermissionError) {
        setError('ACCESS_DENIED');
        console.warn('Access Logs permission check failed:', errorMsg);
        toast.warning('Access Restricted', {
          description: 'You need auditor privileges to view access logs.',
        });
      } else {
        setError(errorMsg);
        console.error('Error fetching access logs:', err);
        toast.error('Failed to load access logs', {
          description: errorMsg,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, username]);

  /**
   * Load logs on component mount and when selectedType changes
   */
  useEffect(() => {
    fetchAccessLogs();
  }, [fetchAccessLogs]);

  const filteredLogs = logs.filter((log) => {
    const userText = String(log.fullName ?? log.user ?? "");
    const usernameText = String(log.user ?? "");
    const actionText = String(log.action ?? "");
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      userText.toLowerCase().includes(q) ||
      usernameText.toLowerCase().includes(q) ||
      actionText.toLowerCase().includes(q);
    const matchesType =
      selectedType === "all" || log.type === selectedType;
    return matchesSearch && matchesType;
  });

  // Chart data calculations
  const statusChartData = useMemo(() => [
    { name: "Success", value: filteredLogs.filter(l => l.status === 'success').length, color: "#10b981" },
    { name: "Failed", value: filteredLogs.filter(l => l.status === 'failed').length, color: "#ef4444" },
    { name: "Warning", value: filteredLogs.filter(l => l.status === 'warning').length, color: "#f59e0b" },
  ].filter(item => item.value > 0), [filteredLogs]);

  const typeChartData = useMemo(() => [
    { name: "Login", value: filteredLogs.filter(l => l.type === 'login').length, color: DESIGN_TOKENS.colors.brand.orange },
    { name: "Logout", value: filteredLogs.filter(l => l.type === 'logout').length, color: "#6b7280" },
    { name: "View", value: filteredLogs.filter(l => l.type === 'view').length, color: "#3b82f6" },
    { name: "Edit", value: filteredLogs.filter(l => l.type === 'edit').length, color: "#8b5cf6" },
    { name: "Create", value: filteredLogs.filter(l => l.type === 'create').length, color: "#10b981" },
    { name: "Delete", value: filteredLogs.filter(l => l.type === 'delete').length, color: "#ef4444" },
  ].filter(item => item.value > 0), [filteredLogs]);

  // Bar chart data by action type
  const barChartData = useMemo(() => {
    const types = ['login', 'logout', 'view', 'edit', 'create', 'delete'];
    return types.map(type => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      Success: filteredLogs.filter(l => l.type === type && l.status === 'success').length,
      Failed: filteredLogs.filter(l => l.type === type && l.status === 'failed').length,
      Warning: filteredLogs.filter(l => l.type === type && l.status === 'warning').length,
    })).filter(item => item.Success > 0 || item.Failed > 0 || item.Warning > 0);
  }, [filteredLogs]);

  // Group logs by type for separate tables
  const logsByType = useMemo(() => {
    const grouped: Record<string, AccessLog[]> = {};
    filteredLogs.forEach(log => {
      const type = log.type || 'other';
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(log);
    });
    return grouped;
  }, [filteredLogs]);

  const viewToggleLabel = viewMode === "table" ? "Table View" : "Tile View";
  const ViewToggleIcon = viewMode === "table" ? TableIcon : LayoutGrid;

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedType]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // Use profile picture directly from the enriched log data (no extra API call needed)
  useEffect(() => {
    if (selectedLog?.profilePic) {
      setSelectedProfilePic(selectedLog.profilePic);
    } else {
      setSelectedProfilePic(null);
    }
  }, [selectedLog]);

  /**
   * Generate PDF document (shared logic for preview and export)
   */
  const generatePdfDocument = async (forPreview: boolean = false): Promise<jsPDF> => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;

    // Helper function to add header and footer to each page
    const addHeaderFooter = (pageNum: number, totalPages: number) => {
      // Footer line
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      // Footer text - Left: Organization name
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`${ORG_NAME} - ${ORG_CHAPTER}`, margin, pageHeight - 10);
      
      // Footer text - Center: Motto
      doc.setFont('helvetica', 'italic');
      doc.text(`"${ORG_MOTTO}"`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Footer text - Right: Page number
      doc.setFont('helvetica', 'normal');
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    };

    // Try to load logo
    let logoLoaded = false;
    let logoImg: string | undefined = undefined;
    try {
      logoImg = await loadImage(ORG_LOGO_URL);
      logoLoaded = true;
    } catch (e) {
      // Logo failed to load
    }

    // Helper to draw page header
    const drawPageHeader = (title: string) => {
      // Orange header bar
      doc.setFillColor(246, 66, 31);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      if (logoLoaded && logoImg) {
        const logoSize = 30;
        const logoX = margin;
        const logoY = 7.5;
        doc.setFillColor(255, 255, 255);
        doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2, 'F');
        doc.addImage(logoImg, 'PNG', logoX, logoY, logoSize, logoSize);
      }

      const orgNameX = logoLoaded ? margin + 35 : margin;
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(ORG_NAME, orgNameX, 18);
      doc.setFontSize(12);
      doc.text(ORG_CHAPTER, orgNameX, 26);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(title, orgNameX, 35);

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
    };

    // ========================================
    // PAGE 1: SUMMARY PAGE
    // ========================================
    drawPageHeader('SYSTEM ACCESS AUDIT REPORT');
    
    let yPosition = 55;

    // Summary Title
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('AUDIT SUMMARY', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 12;

    // Divider line
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 5, pageWidth - margin, yPosition - 5);

    // Status Summary Boxes
    const boxWidth = (pageWidth - 2 * margin - 9) / 4;
    const boxHeight = 20;
    const statuses = [
      { name: 'TOTAL LOGS', color: [100, 100, 100], count: filteredLogs.length },
      { name: 'SUCCESSFUL', color: [16, 185, 129], count: filteredLogs.filter(l => l.status === 'success').length },
      { name: 'FAILED', color: [239, 68, 68], count: filteredLogs.filter(l => l.status === 'failed').length },
      { name: 'WARNINGS', color: [245, 158, 11], count: filteredLogs.filter(l => l.status === 'warning').length },
    ];

    statuses.forEach((stat, index) => {
      const boxX = margin + index * (boxWidth + 3);
      
      doc.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
      doc.roundedRect(boxX, yPosition, boxWidth, boxHeight, 3, 3, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(String(stat.count), boxX + boxWidth / 2, yPosition + 10, { align: 'center' });
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(stat.name, boxX + boxWidth / 2, yPosition + 16, { align: 'center' });
    });

    yPosition += boxHeight + 15;

    // Log Type Summary Boxes
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('LOGS BY TYPE', margin, yPosition);
    yPosition += 8;

    const typeBoxWidth = (pageWidth - 2 * margin - 15) / 6;
    const typeBoxHeight = 18;
    const logTypes = [
      { name: 'LOGIN', type: 'login', color: [246, 66, 31] },
      { name: 'LOGOUT', type: 'logout', color: [107, 114, 128] },
      { name: 'VIEW', type: 'view', color: [59, 130, 246] },
      { name: 'EDIT', type: 'edit', color: [139, 92, 246] },
      { name: 'CREATE', type: 'create', color: [16, 185, 129] },
      { name: 'DELETE', type: 'delete', color: [239, 68, 68] },
    ];

    logTypes.forEach((logType, index) => {
      const boxX = margin + index * (typeBoxWidth + 3);
      const count = filteredLogs.filter(l => l.type === logType.type).length;
      
      doc.setFillColor(logType.color[0], logType.color[1], logType.color[2]);
      doc.roundedRect(boxX, yPosition, typeBoxWidth, typeBoxHeight, 2, 2, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(String(count), boxX + typeBoxWidth / 2, yPosition + 9, { align: 'center' });
      
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(logType.name, boxX + typeBoxWidth / 2, yPosition + 14, { align: 'center' });
    });

    yPosition += typeBoxHeight + 15;

    // Quick Stats Section
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('QUICK STATISTICS', margin, yPosition);
    yPosition += 8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);

    const uniqueUsers = new Set(filteredLogs.map(l => l.user)).size;
    const successRate = filteredLogs.length > 0 
      ? Math.round((filteredLogs.filter(l => l.status === 'success').length / filteredLogs.length) * 100) 
      : 0;
    const mostActiveType = logTypes.reduce((max, type) => {
      const count = filteredLogs.filter(l => l.type === type.type).length;
      return count > max.count ? { name: type.name, count } : max;
    }, { name: 'N/A', count: 0 });

    const quickStats = [
      `• Total unique users: ${uniqueUsers}`,
      `• Success rate: ${successRate}%`,
      `• Most common action: ${mostActiveType.name} (${mostActiveType.count} logs)`,
      `• Report period: ${filteredLogs.length > 0 ? new Date(filteredLogs[filteredLogs.length - 1]?.timestamp || '').toLocaleDateString() : 'N/A'} to ${filteredLogs.length > 0 ? new Date(filteredLogs[0]?.timestamp || '').toLocaleDateString() : 'N/A'}`,
    ];

    quickStats.forEach(stat => {
      doc.text(stat, margin, yPosition);
      yPosition += 6;
    });

    // ========================================
    // CHRONOLOGICAL TOTAL LOGS TABLE
    // ========================================
    doc.addPage();
    drawPageHeader('SYSTEM ACCESS AUDIT REPORT');

    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`ALL LOGS - CHRONOLOGICAL ORDER (${filteredLogs.length} entries)`, margin, 55);

    // Sort logs chronologically (oldest first)
    const chronologicalLogs = [...filteredLogs].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const allLogsTableData = chronologicalLogs.map((log, index) => [
      String(index + 1),
      log.fullName,
      log.type.charAt(0).toUpperCase() + log.type.slice(1),
      log.action,
      log.status.charAt(0).toUpperCase() + log.status.slice(1),
      new Date(log.timestamp).toLocaleString(),
      log.ipAddress,
      log.device.length > 20 ? log.device.substring(0, 17) + '...' : log.device,
    ]);

    autoTable(doc, {
      startY: 60,
      head: [['#', 'User', 'Type', 'Action', 'Status', 'Timestamp', 'IP Address', 'Device']],
      body: allLogsTableData,
      theme: 'grid',
      headStyles: {
        fillColor: [100, 100, 100], // Neutral gray for all logs
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
        fillColor: [248, 248, 248],
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 30 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 45 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 40, halign: 'center' },
        6: { cellWidth: 28 },
        7: { cellWidth: 35 },
      },
      styles: {
        lineColor: [220, 220, 220],
        lineWidth: 0.1,
      },
      margin: { left: margin, right: margin, bottom: 25 },
      didParseCell: (data) => {
        // Color-code the Type column based on log type
        if (data.column.index === 2 && data.section === 'body') {
          const typeValue = String(data.cell.raw).toLowerCase();
          const typeColors: Record<string, [number, number, number]> = {
            login: [246, 66, 31],
            logout: [107, 114, 128],
            view: [59, 130, 246],
            edit: [139, 92, 246],
            create: [16, 185, 129],
            delete: [239, 68, 68],
          };
          if (typeColors[typeValue]) {
            data.cell.styles.textColor = typeColors[typeValue];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        // Color-code the Status column
        if (data.column.index === 4 && data.section === 'body') {
          const statusValue = String(data.cell.raw).toLowerCase();
          if (statusValue === 'success') {
            data.cell.styles.textColor = [16, 185, 129];
          } else if (statusValue === 'failed') {
            data.cell.styles.textColor = [239, 68, 68];
          } else if (statusValue === 'warning') {
            data.cell.styles.textColor = [245, 158, 11];
          }
        }
      },
    });

    // ========================================
    // PAGES: TABLES BY LOG TYPE
    // ========================================
    const logTypeOrder = ['login', 'logout', 'view', 'edit', 'create', 'delete'];
    
    // Color mapping for each log type (matching chart colors)
    const logTypeColorMap: Record<string, { header: [number, number, number], altRow: [number, number, number] }> = {
      login: { header: [246, 66, 31], altRow: [254, 243, 240] },    // Orange
      logout: { header: [107, 114, 128], altRow: [245, 246, 247] }, // Gray
      view: { header: [59, 130, 246], altRow: [239, 246, 255] },    // Blue
      edit: { header: [139, 92, 246], altRow: [245, 241, 254] },    // Purple
      create: { header: [16, 185, 129], altRow: [236, 253, 245] },  // Green
      delete: { header: [239, 68, 68], altRow: [254, 242, 242] },   // Red
    };

    for (const logType of logTypeOrder) {
      const logsOfType = logsByType[logType];
      if (!logsOfType || logsOfType.length === 0) continue;

      doc.addPage();
      drawPageHeader('SYSTEM ACCESS AUDIT REPORT');

      // Get the color theme for this log type
      const colorTheme = logTypeColorMap[logType] || { header: [246, 66, 31], altRow: [254, 249, 244] };

      // Type title with matching color
      doc.setTextColor(colorTheme.header[0], colorTheme.header[1], colorTheme.header[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      const typeLabel = logType.charAt(0).toUpperCase() + logType.slice(1);
      doc.text(`${typeLabel.toUpperCase()} LOGS (${logsOfType.length} entries)`, margin, 55);

      const tableData = logsOfType.map((log, index) => [
        String(index + 1),
        log.fullName,
        log.action,
        log.status.charAt(0).toUpperCase() + log.status.slice(1),
        new Date(log.timestamp).toLocaleString(),
        log.ipAddress,
        log.device.length > 25 ? log.device.substring(0, 22) + '...' : log.device,
      ]);

      autoTable(doc, {
        startY: 60,
        head: [['#', 'User', 'Action', 'Status', 'Timestamp', 'IP Address', 'Device']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: colorTheme.header,
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
          fillColor: colorTheme.altRow,
        },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
          1: { cellWidth: 40 },
          2: { cellWidth: 55 },
          3: { cellWidth: 22, halign: 'center' },
          4: { cellWidth: 45, halign: 'center' },
          5: { cellWidth: 35 },
          6: { cellWidth: 50 },
        },
        styles: {
          lineColor: [220, 220, 220],
          lineWidth: 0.1,
        },
        margin: { left: margin, right: margin, bottom: 25 },
      });
    }

    // ========================================
    // LAST PAGE: STATISTICS WITH GRAPHS
    // ========================================
    doc.addPage();
    drawPageHeader('SYSTEM ACCESS AUDIT REPORT');

    // Calculate available space (page height minus header and footer)
    const statsContentTop = 55;
    const statsContentBottom = pageHeight - 25; // Leave space for footer
    const availableHeight = statsContentBottom - statsContentTop;

    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('STATISTICS & ANALYTICS', pageWidth / 2, statsContentTop, { align: 'center' });

    // Draw simple bar chart for log types
    const chartStartY = statsContentTop + 15;
    const chartHeight = Math.min(50, availableHeight * 0.35); // Limit chart height
    const chartWidth = pageWidth - 2 * margin - 20; // Add padding from edges
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Logs by Action Type', margin, chartStartY - 3);

    const maxCount = Math.max(...logTypes.map(t => filteredLogs.filter(l => l.type === t.type).length), 1);
    const barWidth = Math.min(30, (chartWidth / logTypes.length) - 8); // Limit bar width
    const totalBarsWidth = logTypes.length * barWidth + (logTypes.length - 1) * 8;
    const barsStartX = margin + (chartWidth - totalBarsWidth) / 2; // Center the bars

    logTypes.forEach((logType, index) => {
      const count = filteredLogs.filter(l => l.type === logType.type).length;
      const barHeight = Math.max((count / maxCount) * chartHeight, 2); // Minimum height of 2
      const barX = barsStartX + index * (barWidth + 8);
      const barY = chartStartY + chartHeight - barHeight;

      doc.setFillColor(logType.color[0], logType.color[1], logType.color[2]);
      doc.roundedRect(barX, barY, barWidth, barHeight, 1, 1, 'F');

      // Label
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.text(logType.name, barX + barWidth / 2, chartStartY + chartHeight + 4, { align: 'center' });
      
      // Value on top
      doc.setFont('helvetica', 'bold');
      if (count > 0) {
        doc.text(String(count), barX + barWidth / 2, barY - 2, { align: 'center' });
      }
    });

    // Status distribution section - horizontal bar chart
    const statusChartY = chartStartY + chartHeight + 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('Logs by Status', margin, statusChartY);

    const statusData = [
      { name: 'Success', color: [16, 185, 129], count: filteredLogs.filter(l => l.status === 'success').length },
      { name: 'Failed', color: [239, 68, 68], count: filteredLogs.filter(l => l.status === 'failed').length },
      { name: 'Warning', color: [245, 158, 11], count: filteredLogs.filter(l => l.status === 'warning').length },
    ];

    const statusMaxCount = Math.max(...statusData.map(s => s.count), 1);
    const maxBarLength = chartWidth - 80; // Leave space for labels and values
    const statusBarHeight = 8;
    const statusBarSpacing = 12;

    statusData.forEach((status, index) => {
      const barY = statusChartY + 8 + index * statusBarSpacing;
      const barLength = Math.max((status.count / statusMaxCount) * maxBarLength, 2);

      doc.setFillColor(status.color[0], status.color[1], status.color[2]);
      doc.roundedRect(margin + 45, barY, barLength, statusBarHeight, 1, 1, 'F');

      doc.setFontSize(7);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.text(status.name, margin, barY + 6);
      
      doc.setFont('helvetica', 'bold');
      doc.text(String(status.count), margin + 50 + barLength + 3, barY + 6);
    });

    // Add page numbers to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addHeaderFooter(i, totalPages);
    }

    return doc;
  };

  /**
   * Handle export with preview (matching AttendanceDashboard pattern)
   */
  const handleExportWithPreview = (format: 'pdf' | 'spreadsheet') => {
    if (filteredLogs.length === 0) {
      toast.error("No logs to export");
      return;
    }
    setExportFormat(format);
    setShowExportPreview(true);
    
    // Auto-generate preview for PDF
    if (format === 'pdf') {
      generatePDFPreview();
    }
  };

  /**
   * Generate PDF preview
   */
  const generatePDFPreview = async () => {
    if (filteredLogs.length === 0) return;

    setIsGeneratingPreview(true);
    
    // Revoke previous URL if exists
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }

    try {
      const doc = await generatePdfDocument(true);
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
    } catch (error) {
      console.error('PDF Preview Error:', error);
      toast.error('Failed to generate PDF preview');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  /**
   * Close export modal and cleanup
   */
  const handleCloseExportModal = () => {
    setShowExportPreview(false);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

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
      updateUploadToast(toastId, { message: 'Generating summary page...', progress: 20 });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      updateUploadToast(toastId, { message: 'Creating tables by log type...', progress: 50 });
      const doc = await generatePdfDocument(false);
      if (cancelled) return;

      updateUploadToast(toastId, { message: 'Adding statistics page...', progress: 80 });
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      updateUploadToast(toastId, { message: 'Saving PDF file...', progress: 95 });

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `SystemAccessAudit_${dateStr}.pdf`;
      doc.save(filename);

      updateUploadToast(toastId, {
        message: `File saved as "${filename}"`,
        status: 'success',
        progress: 100,
      });

      setTimeout(() => removeUploadToast(toastId), 3000);
    } catch (error) {
      if (cancelled) return;
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
        log.fullName,
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

  /**
   * Manual export to Google Drive
   * Uses the same PDF styling as the local export for consistency
   */
  const handleManualExportToDrive = async () => {
    if (filteredLogs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const toastId = `manual-export-drive-${Date.now()}`;

    addUploadToast({
      id: toastId,
      title: 'Exporting to Google Drive',
      message: 'Generating PDF...',
      status: 'loading',
      progress: 0,
    });

    try {
      updateUploadToast(toastId, { progress: 20, message: 'Generating styled PDF...' });
      
      // Generate the PDF using the same function as local export
      const doc = await generatePdfDocument(false);
      
      updateUploadToast(toastId, { progress: 50, message: 'Preparing upload...' });
      
      // Get PDF as base64
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      
      // Generate filename
      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      let fileName = `AccessLogs_Manual_Export_${dateStr}_${timeStr}`;
      if (selectedType !== 'all') {
        fileName += `_${selectedType.toUpperCase()}`;
      }
      fileName += '.pdf';
      
      updateUploadToast(toastId, { progress: 70, message: 'Uploading to Google Drive...' });
      
      const result = await uploadAccessLogsPDF(
        pdfBase64,
        fileName,
        username,
        'manual'
      );

      updateUploadToast(toastId, {
        status: 'success',
        progress: 100,
        title: 'Export Complete',
        message: `PDF saved to Google Drive`,
      });

      // Log success
      if (result.fileUrl) {
        console.warn('Manual export saved to:', result.fileUrl);
      }

      setTimeout(() => removeUploadToast(toastId), 4000);
    } catch (error) {
      console.error('Manual Export Error:', error);
      updateUploadToast(toastId, {
        status: 'error',
        progress: 100,
        title: 'Export Failed',
        message: error instanceof Error ? error.message : 'Failed to export to Google Drive',
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };

  /**
   * Handle clearing access logs based on selected mode
   * Logs are automatically archived to Google Drive before deletion
   */
  const handleClearLogs = async () => {
    if (isClearing) return;
    
    setIsClearing(true);
    const toastId = `clear-access-logs-${Date.now()}`;

    addUploadToast({
      id: toastId,
      title: 'Archiving & Clearing Access Logs',
      message: 'Processing request...',
      status: 'loading',
      progress: 0,
    });

    try {
      updateUploadToast(toastId, { progress: 20, message: 'Connecting to server...' });
      
      let result;

      if (clearMode === 'all') {
        updateUploadToast(toastId, { progress: 40, message: 'Archiving all logs to Google Drive...' });
        result = await clearAllAccessLogs(username);
      } else if (clearMode === 'dateRange') {
        if (!clearStartDate || !clearEndDate) {
          throw new Error('Please select both start and end dates');
        }
        if (new Date(clearStartDate) > new Date(clearEndDate)) {
          throw new Error('Start date must be before end date');
        }
        updateUploadToast(toastId, { progress: 40, message: 'Archiving logs by date range to Google Drive...' });
        result = await clearAccessLogsByDateRange(clearStartDate, clearEndDate, username);
      } else if (clearMode === 'selected') {
        if (selectedLogIds.length === 0) {
          throw new Error('Please select at least one log to clear');
        }
        updateUploadToast(toastId, { progress: 40, message: `Archiving ${selectedLogIds.length} selected logs to Google Drive...` });
        result = await clearSpecificAccessLogs(selectedLogIds, username);
      }

      updateUploadToast(toastId, { progress: 80, message: 'Refreshing data...' });
      
      // Refresh the logs after clearing
      await fetchAccessLogs();
      
      // Build success message with archive info
      const archiveInfo = result?.archived ? ' (Archived to Google Drive)' : '';
      const successMessage = result?.message || `Successfully archived and cleared ${result?.deletedCount || 0} log entries${archiveInfo}`;
      
      updateUploadToast(toastId, {
        status: 'success',
        progress: 100,
        title: 'Logs Archived & Cleared',
        message: successMessage,
      });

      // Reset state
      setShowClearLogsModal(false);
      setShowConfirmClear(false);
      setSelectedLogIds([]);
      setClearStartDate("");
      setClearEndDate("");

      setTimeout(() => removeUploadToast(toastId), 4000);
    } catch (error) {
      console.error('Clear Logs Error:', error);
      updateUploadToast(toastId, {
        status: 'error',
        progress: 100,
        title: 'Clear Failed',
        message: error instanceof Error ? error.message : 'Failed to clear logs',
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    } finally {
      setIsClearing(false);
    }
  };

  /**
   * Toggle selection of a log for clearing
   */
  const toggleLogSelection = (logId: string) => {
    setSelectedLogIds(prev => 
      prev.includes(logId) 
        ? prev.filter(id => id !== logId)
        : [...prev, logId]
    );
  };

  /**
   * Select/deselect all filtered logs
   */
  const toggleSelectAll = () => {
    if (selectedLogIds.length === filteredLogs.length) {
      setSelectedLogIds([]);
    } else {
      setSelectedLogIds(filteredLogs.map(log => log.id));
    }
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
    <div className="overflow-x-auto rounded-xl border pb-6" style={{
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
          {/* Export Dropdown (matching AttendanceDashboard pattern) */}
          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              disabled={isLoading || filteredLogs.length === 0}
              className="px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className={`w-4 h-4 transition-transform ${showExportDropdown ? 'rotate-180' : ''}`} />
            </button>
            
            {/* Export Dropdown Menu */}
            {showExportDropdown && (
              <div
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border shadow-xl overflow-hidden"
                style={{
                  background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(20px)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  zIndex: 100,
                }}
              >
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    handleExportWithPreview('pdf');
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <FileText className="w-5 h-5 text-[#f6421f]" />
                  <div>
                    <div className="font-medium">Export as PDF</div>
                    <div className="text-xs text-muted-foreground">With preview & charts</div>
                  </div>
                </button>
                <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }} />
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    handleExportWithPreview('spreadsheet');
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                  <div>
                    <div className="font-medium">Export as Spreadsheet</div>
                    <div className="text-xs text-muted-foreground">CSV format (local)</div>
                  </div>
                </button>
                <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }} />
                <button
                  onClick={() => {
                    setShowExportDropdown(false);
                    handleManualExportToDrive();
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                >
                  <Cloud className="w-5 h-5 text-blue-500" />
                  <div>
                    <div className="font-medium">Export to Google Drive</div>
                    <div className="text-xs text-muted-foreground">Manual export (saved online)</div>
                  </div>
                </button>
              </div>
            )}
            
            {/* Backdrop to close dropdown */}
            {showExportDropdown && (
              <div 
                className="fixed inset-0" 
                style={{ zIndex: 50 }}
                onClick={() => setShowExportDropdown(false)}
              />
            )}
          </div>
          {/* Clear Logs Button */}
          <button
            onClick={() => setShowClearLogsModal(true)}
            disabled={isLoading || logs.length === 0}
            className="px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
            style={{
              background: `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)`,
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              boxShadow: "0 2px 8px rgba(239, 68, 68, 0.25)",
            }}
            aria-label="Clear access logs"
          >
            <Trash2 className="w-4 h-4" />
            <span className="hidden sm:inline">Clear Logs</span>
          </button>
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

      {/* Charts Section */}
      {!isLoading && !error && filteredLogs.length > 0 && (
        <div className="mb-6">
          {/* Chart Header with Toggle */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="flex items-center gap-3">
              <h3
                className="text-lg"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                <BarChart3 className="w-5 h-5 inline mr-2" style={{ color: DESIGN_TOKENS.colors.brand.red }} />
                Analytics Overview
              </h3>
              <button
                onClick={() => setShowCharts(!showCharts)}
                className="text-sm px-3 py-1 rounded-lg transition-colors"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                  color: isDark ? "#9ca3af" : "#6b7280",
                }}
              >
                {showCharts ? "Hide" : "Show"}
              </button>
            </div>
            {showCharts && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setChartType("pie")}
                  className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                    chartType === "pie" ? "shadow-md" : ""
                  }`}
                  style={{
                    background:
                      chartType === "pie"
                        ? `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`
                        : isDark
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(255, 255, 255, 0.85)",
                    color: chartType === "pie" ? "#ffffff" : undefined,
                    border:
                      chartType === "pie"
                        ? "none"
                        : `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  <PieChartIcon className="w-4 h-4" />
                  Pie
                </button>
                <button
                  onClick={() => setChartType("bar")}
                  className={`px-4 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
                    chartType === "bar" ? "shadow-md" : ""
                  }`}
                  style={{
                    background:
                      chartType === "bar"
                        ? `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`
                        : isDark
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(255, 255, 255, 0.85)",
                    color: chartType === "bar" ? "#ffffff" : undefined,
                    border:
                      chartType === "bar"
                        ? "none"
                        : `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  <BarChart3 className="w-4 h-4" />
                  Bar
                </button>
              </div>
            )}
          </div>

          {/* Charts Container */}
          {showCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Status Distribution Chart */}
              <div
                className="p-5 rounded-xl border"
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
                <h4
                  className="text-sm mb-4"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: isDark ? "#e5e7eb" : "#374151",
                  }}
                >
                  Status Distribution
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  {chartType === "pie" ? (
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: { name: string; percent: number }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        innerRadius={50}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: isDark ? "#1f2937" : "#ffffff",
                          border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  ) : (
                    <BarChart data={statusChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                      <XAxis dataKey="name" tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 12 }} />
                      <YAxis tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: isDark ? "#1f2937" : "#ffffff",
                          border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="value" isAnimationActive={false}>
                        {statusChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Action Type Distribution Chart */}
              <div
                className="p-5 rounded-xl border"
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
                <h4
                  className="text-sm mb-4"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: isDark ? "#e5e7eb" : "#374151",
                  }}
                >
                  Actions by Type
                </h4>
                <ResponsiveContainer width="100%" height={250}>
                  {chartType === "pie" ? (
                    <PieChart>
                      <Pie
                        data={typeChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: { name: string; percent: number }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        innerRadius={50}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        isAnimationActive={false}
                      >
                        {typeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: isDark ? "#1f2937" : "#ffffff",
                          border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                    </PieChart>
                  ) : (
                    <BarChart data={typeChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                      <XAxis dataKey="name" tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 12 }} />
                      <YAxis tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: isDark ? "#1f2937" : "#ffffff",
                          border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                          borderRadius: "8px",
                        }}
                      />
                      <Bar dataKey="value" isAnimationActive={false}>
                        {typeChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>

              {/* Stacked Bar Chart - Actions by Status */}
              {barChartData.length > 0 && (
                <div
                  className="p-5 rounded-xl border lg:col-span-2"
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
                  <h4
                    className="text-sm mb-4"
                    style={{
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: isDark ? "#e5e7eb" : "#374151",
                    }}
                  >
                    Action Types by Status
                  </h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#e5e7eb"} />
                      <XAxis dataKey="type" tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 12 }} />
                      <YAxis tick={{ fill: isDark ? "#9ca3af" : "#6b7280", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          background: isDark ? "#1f2937" : "#ffffff",
                          border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="Success" stackId="a" fill="#10b981" isAnimationActive={false} />
                      <Bar dataKey="Failed" stackId="a" fill="#ef4444" isAnimationActive={false} />
                      <Bar dataKey="Warning" stackId="a" fill="#f59e0b" isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Type Filter & View Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        {/* Filter Dropdown */}
        <div className="w-auto" style={{ width: "min(220px, 100%)" }}>
          <CustomDropdown
            value={selectedType}
            onChange={setSelectedType}
            options={actionTypes.map((type) => ({
              value: type.value,
              label: type.label,
            }))}
              placeholder="Filter actions"
              isDark={isDark}
              size="sm"
              disabled={isLoading}
              maxHeight={360}
              forceDirection="down"
            />
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAccessLogs}
            disabled={isLoading}
            className="px-3 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
            style={{
              background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.85)",
              border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.1)"}`,
              color: isDark ? "#e5e7eb" : "#374151",
              fontSize: "12px",
              fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
            }}
            aria-label="Reload access logs"
            title="Reload access logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reload</span>
          </button>
          <button
            onClick={() => setViewMode(viewMode === "table" ? "tile" : "table")}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50 hover:shadow-md"
            style={{
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              border: "none",
            }}
          >
            <ViewToggleIcon className="w-4 h-4" />
            <span className="hidden sm:inline">{viewToggleLabel}</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        viewMode === "table" ? <TableSkeleton /> : <TileGridSkeleton />
      )}

      {/* Error State */}
      {error && !isLoading && (
        error === 'ACCESS_DENIED' ? (
          /* Permission Error - User-friendly access denied message */
          <div className="p-8 rounded-xl border text-center" style={{
            background: isDark ? 'rgba(234, 179, 8, 0.1)' : 'rgba(254, 243, 199, 1)',
            borderColor: isDark ? 'rgba(234, 179, 8, 0.3)' : 'rgba(234, 179, 8, 0.4)',
          }}>
            <Shield className="w-16 h-16 mx-auto mb-4" style={{ color: '#d97706' }} />
            <h3 className="text-xl font-semibold mb-2" style={{ color: isDark ? '#fbbf24' : '#92400e' }}>
              Access Restricted
            </h3>
            <p className="text-sm mb-4" style={{ color: isDark ? '#fcd34d' : '#b45309' }}>
              Access logs are only available to users with auditor privileges.
              <br />
              If you believe you should have access, please contact your administrator.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={onClose}
            >
              Go Back
            </Button>
          </div>
        ) : (
          /* Regular Error */
          <div className="p-6 rounded-xl border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200">Error Loading Logs</h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={fetchAccessLogs}
                  >
                    Retry
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                  >
                    Go Back
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Tile View */}
      {viewMode === "tile" && !isLoading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedLogs.map((log) => (
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
                      {log.fullName}
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

      {viewMode === "tile" && !isLoading && !error && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredLogs.length}
          pageSize={ITEMS_PER_PAGE}
          isDark={isDark}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Table View */}
      {viewMode === "table" && !isLoading && !error && (
        <div className="overflow-x-auto rounded-xl border pb-6" style={{
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
              {paginatedLogs.map((log, index) => (
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
                          {log.fullName}
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

      {viewMode === "table" && !isLoading && !error && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredLogs.length}
          pageSize={ITEMS_PER_PAGE}
          isDark={isDark}
          onPageChange={setCurrentPage}
        />
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
            zIndex: 299,
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
              zIndex: 300,
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
                    {selectedProfilePic ? (
                      <img
                        src={selectedProfilePic}
                        alt={`${selectedLog.fullName} profile`}
                        className="w-full h-full rounded-full object-cover"
                        onError={() => setSelectedProfilePic(null)}
                      />
                    ) : (
                      <User className="w-8 h-8" />
                    )}
                  </div>
                  <div>
                    <div
                      className="text-lg mb-1"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      }}
                    >
                      {selectedLog.fullName}
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

      {/* Clear Logs Modal - Elegant Centered Design */}
      {showClearLogsModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => !isClearing && setShowClearLogsModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 fade-in duration-200"
            style={{
              background: isDark ? "#1f2937" : "#ffffff",
              border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
              boxShadow: isDark 
                ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)"
                : "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0"
              style={{
                borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                background: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center"
                  style={{ background: "rgba(239, 68, 68, 0.15)", color: "#ef4444" }}
                >
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    className="text-base"
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: isDark ? "#f3f4f6" : "#1f2937",
                    }}
                  >
                    Clear Access Logs
                  </h3>
                  <p className="text-xs" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                    Select how you want to clear the logs
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isClearing && setShowClearLogsModal(false)}
                disabled={isClearing}
                className="p-1.5 rounded-lg transition-colors hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <X className="w-4 h-4" style={{ color: isDark ? "#9ca3af" : "#6b7280" }} />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
              {/* Clear Mode Selection */}
              <div className="space-y-2.5">
                <label
                  className="text-xs"
                  style={{
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                    color: isDark ? "#e5e7eb" : "#374151",
                  }}
                >
                  Clear Mode
                </label>

                {/* Clear All Option */}
                <button
                  onClick={() => setClearMode('all')}
                  disabled={isClearing}
                  className={`w-full p-2.5 rounded-xl border transition-all text-left flex items-start gap-2.5 ${
                    clearMode === 'all' ? 'ring-2 ring-red-500' : ''
                  }`}
                  style={{
                    background: clearMode === 'all'
                      ? (isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)")
                      : (isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)"),
                    borderColor: clearMode === 'all'
                      ? "#ef4444"
                      : (isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"),
                  }}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      clearMode === 'all' ? 'border-red-500 bg-red-500' : 'border-gray-400'
                    }`}
                  >
                    {clearMode === 'all' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: isDark ? "#f3f4f6" : "#1f2937",
                      }}
                    >
                      Clear All Logs
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                      Remove all {logs.length} access logs from the system
                    </div>
                  </div>
                </button>

                {/* Clear by Date Range Option */}
                <button
                  onClick={() => setClearMode('dateRange')}
                  disabled={isClearing}
                  className={`w-full p-2.5 rounded-xl border transition-all text-left flex items-start gap-2.5 ${
                    clearMode === 'dateRange' ? 'ring-2 ring-red-500' : ''
                  }`}
                  style={{
                    background: clearMode === 'dateRange'
                      ? (isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)")
                      : (isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)"),
                    borderColor: clearMode === 'dateRange'
                      ? "#ef4444"
                      : (isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"),
                  }}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      clearMode === 'dateRange' ? 'border-red-500 bg-red-500' : 'border-gray-400'
                    }`}
                  >
                    {clearMode === 'dateRange' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: isDark ? "#f3f4f6" : "#1f2937",
                      }}
                    >
                      Clear by Date Range
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                      Remove logs within a specific date range
                    </div>
                  </div>
                </button>

                {/* Date Range Inputs (shown when dateRange mode is selected) */}
                {clearMode === 'dateRange' && (
                  <div className="ml-6 space-y-2 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label
                          className="block text-[10px] mb-1"
                          style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
                        >
                          Start Date
                        </label>
                        <input
                          type="date"
                          value={clearStartDate}
                          onChange={(e) => setClearStartDate(e.target.value)}
                          disabled={isClearing}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs"
                          style={{
                            background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                            color: isDark ? "#e5e7eb" : "#374151",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          className="block text-[10px] mb-1"
                          style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
                        >
                          End Date
                        </label>
                        <input
                          type="date"
                          value={clearEndDate}
                          onChange={(e) => setClearEndDate(e.target.value)}
                          disabled={isClearing}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs"
                          style={{
                            background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                            border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                            color: isDark ? "#e5e7eb" : "#374151",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Clear Selected Option */}
                <button
                  onClick={() => setClearMode('selected')}
                  disabled={isClearing}
                  className={`w-full p-2.5 rounded-xl border transition-all text-left flex items-start gap-2.5 ${
                    clearMode === 'selected' ? 'ring-2 ring-red-500' : ''
                  }`}
                  style={{
                    background: clearMode === 'selected'
                      ? (isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)")
                      : (isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)"),
                    borderColor: clearMode === 'selected'
                      ? "#ef4444"
                      : (isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"),
                  }}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                      clearMode === 'selected' ? 'border-red-500 bg-red-500' : 'border-gray-400'
                    }`}
                  >
                    {clearMode === 'selected' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: isDark ? "#f3f4f6" : "#1f2937",
                      }}
                    >
                      Clear Selected Logs
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                      {selectedLogIds.length > 0
                        ? `${selectedLogIds.length} log(s) selected for deletion`
                        : "Select specific logs from the list below"}
                    </div>
                  </div>
                </button>

                {/* Selection Controls (shown when selected mode is active) */}
                {clearMode === 'selected' && (
                  <div className="ml-6 space-y-2 animate-in slide-in-from-top-2">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={toggleSelectAll}
                        disabled={isClearing}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] transition-colors"
                        style={{
                          background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                          color: isDark ? "#e5e7eb" : "#374151",
                        }}
                      >
                        <CheckSquare className="w-3 h-3" />
                        {selectedLogIds.length === filteredLogs.length ? "Deselect All" : "Select All"}
                      </button>
                      <span className="text-[10px]" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                        {selectedLogIds.length} / {filteredLogs.length}
                      </span>
                    </div>

                    {/* Scrollable list of logs to select */}
                    <div
                      className="max-h-28 overflow-y-auto rounded-lg border"
                      style={{
                        background: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.02)",
                        borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                      }}
                    >
                      {filteredLogs.slice(0, 50).map((log) => (
                        <label
                          key={log.id}
                          className="flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedLogIds.includes(log.id)}
                            onChange={() => toggleLogSelection(log.id)}
                            disabled={isClearing}
                            className="w-3 h-3 rounded border-gray-300 text-red-500 focus:ring-red-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-xs truncate"
                              style={{ color: isDark ? "#e5e7eb" : "#374151" }}
                            >
                              {log.fullName} - {log.action}
                            </div>
                            <div className="text-[10px]" style={{ color: isDark ? "#6b7280" : "#9ca3af" }}>
                              {new Date(log.timestamp).toLocaleString()}
                            </div>
                          </div>
                        </label>
                      ))}
                      {filteredLogs.length > 50 && (
                        <div
                          className="px-2 py-1.5 text-xs text-center"
                          style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
                        >
                          Showing first 50 of {filteredLogs.length} logs
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Warning Notice */}
              <div
                className="p-3 rounded-xl flex items-start gap-2"
                style={{
                  background: isDark ? "rgba(245, 158, 11, 0.1)" : "rgba(245, 158, 11, 0.08)",
                  border: `1px solid ${isDark ? "rgba(245, 158, 11, 0.3)" : "rgba(245, 158, 11, 0.2)"}`,
                }}
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                <div>
                  <div
                    className="text-[11px]"
                    style={{
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                      color: isDark ? "#10b981" : "#059669",
                    }}
                  >
                    Logs are archived before deletion
                  </div>
                  <div className="text-[10px] mt-0.5" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                    All logs will be saved to Google Drive before being removed from the system.
                  </div>
                </div>
              </div>

              {/* Auto-clear Info */}
              <div
                className="p-2 rounded-lg text-[10px]"
                style={{
                  background: isDark ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.05)",
                  color: isDark ? "#93c5fd" : "#3b82f6",
                }}
              >
                <Clock className="w-3 h-3 inline mr-1" />
                Auto-cleanup: Logs older than 1 month are archived and cleared on the 1st of each month
              </div>
            </div>

            {/* Modal Footer */}
            <div
              className="px-5 py-3 border-t flex items-center justify-end gap-2 flex-shrink-0"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => !isClearing && setShowClearLogsModal(false)}
                disabled={isClearing}
              >
                Cancel
              </Button>
              <button
                onClick={() => setShowConfirmClear(true)}
                disabled={
                  isClearing ||
                  (clearMode === 'dateRange' && (!clearStartDate || !clearEndDate)) ||
                  (clearMode === 'selected' && selectedLogIds.length === 0)
                }
                className="px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
                style={{
                  background: `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)`,
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  boxShadow: "0 2px 8px rgba(239, 68, 68, 0.25)",
                }}
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Logs
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog - Elegant Centered Design */}
      {showConfirmClear && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
          onClick={() => !isClearing && setShowConfirmClear(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 fade-in duration-200"
            style={{
              background: isDark ? "#1f2937" : "#ffffff",
              border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
              boxShadow: isDark 
                ? "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)"
                : "0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 text-center">
              <div
                className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ background: "rgba(239, 68, 68, 0.15)" }}
              >
                <AlertTriangle className="w-7 h-7" style={{ color: "#ef4444" }} />
              </div>
              <h4
                className="text-lg mb-1.5"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: isDark ? "#f3f4f6" : "#1f2937",
                }}
              >
                Confirm Deletion
              </h4>
              <p className="text-xs mb-5" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
                {clearMode === 'all' && `Are you sure you want to delete all ${logs.length} access logs?`}
                {clearMode === 'dateRange' && `Are you sure you want to delete logs from ${clearStartDate} to ${clearEndDate}?`}
                {clearMode === 'selected' && `Are you sure you want to delete ${selectedLogIds.length} selected log(s)?`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  disabled={isClearing}
                  className="flex-1 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 text-sm"
                  style={{
                    background: isDark ? "rgba(255, 255, 255, 0.06)" : "rgba(0, 0, 0, 0.04)",
                    color: isDark ? "#e5e7eb" : "#374151",
                    border: `1px solid ${isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"}`,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearLogs}
                  disabled={isClearing}
                  className="flex-1 px-3 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 text-sm"
                  style={{
                    background: `linear-gradient(135deg, #ef4444 0%, #dc2626 100%)`,
                    color: "#ffffff",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  {isClearing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Yes, Delete"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Preview Modal (matching AttendanceDashboard pattern) */}
      {showExportPreview && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={handleCloseExportModal}
        >
          <div
            className="rounded-xl w-full border flex flex-col overflow-hidden shadow-2xl"
            style={{
              maxWidth: exportFormat === 'pdf' ? 900 : 500,
              maxHeight: '90vh',
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              transition: 'max-width 0.3s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="shrink-0"
              style={{
                background: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  {exportFormat === 'pdf' ? <FileText className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                  Export {exportFormat === 'pdf' ? 'PDF' : 'Spreadsheet'}
                </h3>
                <button
                  onClick={handleCloseExportModal}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {exportFormat === 'pdf' ? (
                /* PDF Preview */
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Preview Toolbar */}
                  <div 
                    className="px-4 py-2 border-b flex items-center justify-between shrink-0"
                    style={{ 
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">
                        {filteredLogs.length} log{filteredLogs.length !== 1 ? 's' : ''} • {Object.keys(logsByType).length} types
                      </span>
                    </div>
                    <button
                      onClick={() => generatePDFPreview()}
                      disabled={isGeneratingPreview}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGeneratingPreview ? 'animate-spin' : ''}`} />
                      Refresh
                    </button>
                  </div>
                  
                  {/* PDF Iframe Viewer */}
                  <div className="flex-1 bg-gray-200 dark:bg-gray-900 overflow-hidden relative">
                    {isGeneratingPreview ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-[#f6421f]" />
                        <div className="text-center">
                          <p className="font-medium">Generating Preview...</p>
                          <p className="text-sm text-muted-foreground">This may take a moment</p>
                        </div>
                      </div>
                    ) : pdfPreviewUrl ? (
                      <iframe
                        src={pdfPreviewUrl}
                        className="w-full h-full"
                        style={{ minHeight: 450 }}
                        title="PDF Preview"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
                        <FileText className="w-16 h-16 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium">No Preview Available</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Click Refresh to generate preview
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Spreadsheet Export Info */
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <FileSpreadsheet className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">Export to Spreadsheet</h4>
                  <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                    Export {filteredLogs.length} access log{filteredLogs.length !== 1 ? 's' : ''} to a CSV file that can be opened in Excel or Google Sheets.
                  </p>
                  <div 
                    className="p-4 rounded-lg border text-left w-full max-w-sm"
                    style={{
                      background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }}
                  >
                    <p className="text-sm font-medium mb-2">Includes:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• User information</li>
                      <li>• Action details</li>
                      <li>• Timestamps</li>
                      <li>• IP addresses & devices</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div 
              className="px-5 py-4 border-t flex items-center justify-end gap-3 shrink-0"
              style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
            >
              <button
                onClick={handleCloseExportModal}
                className="px-4 py-2 rounded-lg transition-colors text-sm"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (exportFormat === 'pdf') {
                    handleExportPDF();
                  } else {
                    handleExportSpreadsheet();
                  }
                  handleCloseExportModal();
                }}
                className="px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors flex items-center gap-2 text-sm"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <Download className="w-4 h-4" />
                {exportFormat === 'pdf' ? 'Download PDF' : 'Download CSV'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
