import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Building2,
  CalendarClock,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  User,
  Users,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageLayout } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { toast } from "sonner";
import { getStoredUser } from "../services/gasLoginService";
import type { UploadToastMessage } from "./UploadToast";
import {
  createMeetSession,
  getMeetCommittees,
  getMeetMembers,
  getMeetAttendance,
  getMeetDashboard,
  markMeetSessionComplete,
  type MeetCommittee as Committee,
  type MeetAttendanceDetail,
  type MeetAttendanceMeeting,
  type MeetDashboardCard,
} from "../services/gasMeetService";

// PDF Constants
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const ORG_NAME = "Youth Service Philippines";
const ORG_CHAPTER = "Tagum Chapter";

interface KaagapAIMeetPageProps {
  onClose: () => void;
  isDark: boolean;
  addUploadToast?: (message: UploadToastMessage) => void;
  updateUploadToast?: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast?: (id: string) => void;
}

type StatusFilter = "all" | "ongoing" | "completed" | "manual";
type RecipientOption = {
  id?: string;
  name: string;
  email?: string;
  committee?: string;
  type?: "Member" | "External";
  source?: string;
  hasEmail?: boolean;
};
type RecipientCommand = "@Person" | "@Committee" | "@All" | "@External";
const RECIPIENT_COMMANDS: Array<{ command: RecipientCommand; label: string; icon: LucideIcon; color: string }> = [
  { command: "@Person", label: "Search individual members", icon: User, color: "#3b82f6" },
  { command: "@Committee", label: "Load members by committee", icon: Building2, color: "#10b981" },
  { command: "@All", label: "Load all directory members", icon: Users, color: "#f59e0b" },
  { command: "@External", label: "Add external recipient", icon: Globe, color: "#ec4899" },
];
const MEET_MEMBERS_CACHE_KEY = "ysp_meet_members_cache_v1";

function formatDateTime(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

// Format date for PDF in Philippine 12-hour format
function formatDateTimePdf(value?: string): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Manila",
  });
}

function formatDuration(totalSeconds?: number): string {
  const sec = Math.max(0, Number(totalSeconds || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatElapsedSince(value?: string): string {
  if (!value) return "-";
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return "-";
  const diffSec = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
  return formatDuration(diffSec);
}

function isLikelyParticipantDisplayName(value?: string): boolean {
  const text = String(value || "").trim();
  if (!text) return false;
  const lowered = text.toLowerCase();
  const blocked = [
    "more options for",
    "more_vert",
    "frame_person",
    "reframe",
    "visual effects",
    "backgrounds and effects",
    "others might still see your full video",
    "meeting details",
    "present now",
    "raise hand",
    "camera off",
    "microphone off",
  ];
  return !blocked.some((b) => lowered.includes(b));
}

function getNameInitials(value?: string): string {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

function getAvatarBorderColor(isDark: boolean): string {
  return isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(255, 255, 255, 0.9)";
}

function normalizeCommitteeLabel(value?: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/committee/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCommitteeValues(value?: string): string[] {
  return String(value || "")
    .split(/[;,/|]+/)
    .map((v) => normalizeCommitteeLabel(v))
    .filter(Boolean);
}

function mapMembersToRecipients(rows: Array<{ name: string; email: string; committee?: string }>): RecipientOption[] {
  return (rows || []).map((r, idx) => ({
    id: `member-${idx}-${String(r.email || r.name)}`,
    name: r.name,
    email: r.email,
    committee: r.committee,
    type: "Member",
    source: "Directory",
    hasEmail: !!r.email,
  }));
}

function loadMeetMembersFromCache(): RecipientOption[] | null {
  try {
    const raw = localStorage.getItem(MEET_MEMBERS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as RecipientOption[];
  } catch {
    return null;
  }
}

function saveMeetMembersToCache(items: RecipientOption[]) {
  try {
    if (!Array.isArray(items) || !items.length) return;
    localStorage.setItem(MEET_MEMBERS_CACHE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage errors (quota/private mode).
  }
}

function getCardTitle(card: MeetDashboardCard): string {
  return String(card.title || "").trim() || card.meetingId;
}

function getCardDate(card: MeetDashboardCard): string {
  return card.createdAt || card.meetingDate || card.attendance?.lastSyncedAt || "";
}

export default function KaagapAIMeetPage({
  onClose,
  isDark,
  addUploadToast,
  updateUploadToast,
  removeUploadToast,
}: KaagapAIMeetPageProps) {
  const [createdMeetings, setCreatedMeetings] = useState<MeetDashboardCard[]>([]);
  const [completedMeetings, setCompletedMeetings] = useState<MeetDashboardCard[]>([]);
  const [manualMeetings, setManualMeetings] = useState<MeetDashboardCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    mode: "instant" as "instant" | "scheduled",
    scheduledStart: "",
    scheduledEnd: "",
    notes: "",
  });
  const [recipientQuery, setRecipientQuery] = useState("");
  const [commandSearchQuery, setCommandSearchQuery] = useState("");
  const [activeRecipientCommand, setActiveRecipientCommand] = useState<RecipientCommand | null>(null);
  const [externalName, setExternalName] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  const [recipientPool, setRecipientPool] = useState<RecipientOption[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingRecipients] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState<RecipientOption[]>([]);
  const [isRecipientOpen, setIsRecipientOpen] = useState(false);
  const [recipientDropdownStyle, setRecipientDropdownStyle] = useState<CSSProperties | null>(null);
  const [meetingAgeTick, setMeetingAgeTick] = useState(0);
  const recipientSearchRef = useRef<HTMLDivElement | null>(null);
  const recipientInputRef = useRef<HTMLInputElement | null>(null);
  const recipientInputWrapperRef = useRef<HTMLDivElement | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<MeetDashboardCard | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetAttendanceMeeting | null>(null);

  // Export functionality states
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [exportDropdownPosition, setExportDropdownPosition] = useState<"above" | "below">("above");
  const exportDropdownRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const user = getStoredUser();
  const canComplete = useMemo(() => {
    const role = String(user?.role || "").toLowerCase();
    return role.includes("head") || role.includes("admin") || role.includes("auditor") || role.includes("president");
  }, [user?.role]);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const res = await getMeetDashboard();
      setCreatedMeetings(res.createdMeetings || []);
      setCompletedMeetings(res.completedMeetings || []);
      setManualMeetings(res.manualMeetings || []);
    } catch (error) {
      toast.error((error as Error).message || "Failed to load meetings");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (!isCreateOpen) return;
    setMembersError(null);
    const cachedMembers = loadMeetMembersFromCache();
    if (cachedMembers && cachedMembers.length) {
      setRecipientPool(cachedMembers);
      setIsLoadingMembers(false);
    } else {
      setIsLoadingMembers(true);
      getMeetMembers("", 5000)
        .then((rows) => {
          const mapped = mapMembersToRecipients(rows || []);
          setRecipientPool(mapped);
          saveMeetMembersToCache(mapped);
          setIsLoadingMembers(false);
        })
        .catch(() => {
          setRecipientPool([]);
          setIsLoadingMembers(false);
          setMembersError("Failed to load members");
        });
    }

    getMeetCommittees()
      .then((rows) => setCommittees(rows || []))
      .catch(() => setCommittees([]));
  }, [isCreateOpen]);

  useEffect(() => {
    if (!isCreateOpen) return;
    const onDocClick = (event: MouseEvent) => {
      if (!recipientSearchRef.current) return;
      if (!recipientSearchRef.current.contains(event.target as Node)) {
        setIsRecipientOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isCreateOpen]);

  useEffect(() => {
    if (!isCreateOpen || !isRecipientOpen) {
      setRecipientDropdownStyle(null);
      return;
    }

    const updateRecipientDropdownPosition = () => {
      if (!recipientInputWrapperRef.current) return;
      const rect = recipientInputWrapperRef.current.getBoundingClientRect();
      const viewportPadding = 12;
      const gutter = 6;
      const spaceAbove = rect.top - viewportPadding;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const openUpward = spaceAbove >= spaceBelow;
      const availableSpace = Math.max(170, Math.min(360, (openUpward ? spaceAbove : spaceBelow) - gutter));

      const nextStyle: CSSProperties = {
        position: "fixed",
        left: Math.max(viewportPadding, rect.left),
        width: rect.width,
        maxHeight: availableSpace,
        zIndex: 9999999,
      };

      if (openUpward) {
        nextStyle.bottom = window.innerHeight - rect.top + gutter;
      } else {
        nextStyle.top = rect.bottom + gutter;
      }

      setRecipientDropdownStyle(nextStyle);
    };

    updateRecipientDropdownPosition();
    window.addEventListener("resize", updateRecipientDropdownPosition);
    window.addEventListener("scroll", updateRecipientDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateRecipientDropdownPosition);
      window.removeEventListener("scroll", updateRecipientDropdownPosition, true);
    };
  }, [isCreateOpen, isRecipientOpen, activeRecipientCommand, commandSearchQuery, recipientQuery]);

  const openDetail = async (card: MeetDashboardCard) => {
    setSelectedCard(card);
    setSelectedMeeting(null);
    setIsDetailOpen(true);
    try {
      const detail = await getMeetAttendance(card.meetingId);
      setSelectedMeeting(detail);
    } catch {
      setSelectedMeeting(null);
    }
  };

  useEffect(() => {
    if (!isDetailOpen || !selectedCard?.meetingId) return;
    const timer = window.setInterval(() => {
      getMeetAttendance(selectedCard.meetingId)
        .then((detail) => setSelectedMeeting(detail))
        .catch(() => undefined);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [isDetailOpen, selectedCard?.meetingId]);

  useEffect(() => {
    if (!isDetailOpen || !selectedCard?.createdAt) return;
    const timer = window.setInterval(() => setMeetingAgeTick((prev) => prev + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isDetailOpen, selectedCard?.createdAt]);

  const onCreateMeeting = async () => {
    if (!form.title.trim()) {
      toast.error("Meeting title is required");
      return;
    }
    if (form.mode === "scheduled" && (!form.scheduledStart || !form.scheduledEnd)) {
      toast.error("Scheduled start and end are required");
      return;
    }
    try {
      setIsCreating(true);
      const toastId = `meet-create-${Date.now()}`;
      if (addUploadToast) {
        addUploadToast({
          id: toastId,
          title: "Creating Google Meet",
          message: "Preparing meeting details...",
          status: "loading",
          progress: 15,
        });
      }
      if (updateUploadToast) {
        updateUploadToast(toastId, { progress: 45, message: "Generating Meet link..." });
      }
      const result = await createMeetSession({
        ...form,
        expectedAttendees: selectedRecipients,
      });
      if (updateUploadToast) {
        updateUploadToast(toastId, {
          progress: 100,
          status: "success",
          message: `Meeting created. ${result.meta?.emailSentCount || 0} invite emails sent.`,
        });
      }
      if (removeUploadToast) {
        setTimeout(() => removeUploadToast(toastId), 3500);
      }
      toast.success("Meeting created");
      setIsCreateOpen(false);
      setForm({ title: "", mode: "instant", scheduledStart: "", scheduledEnd: "", notes: "" });
      setSelectedRecipients([]);
      setRecipientQuery("");
      setCommandSearchQuery("");
      setActiveRecipientCommand(null);
      setExternalName("");
      setExternalEmail("");
      await loadDashboard();
    } catch (error) {
      const toastId = `meet-create-fail-${Date.now()}`;
      if (addUploadToast) {
        addUploadToast({
          id: toastId,
          title: "Creating Google Meet",
          message: (error as Error).message || "Failed to create meeting",
          status: "error",
        });
      }
      if (removeUploadToast) {
        setTimeout(() => removeUploadToast(toastId), 5000);
      }
      toast.error((error as Error).message || "Failed to create meeting");
    } finally {
      setIsCreating(false);
    }
  };

  const onComplete = async () => {
    if (!selectedCard) return;
    try {
      await markMeetSessionComplete(selectedCard.meetingId);
      toast.success("Meeting marked complete");
      await loadDashboard();
      setSelectedCard((prev) => (prev ? { ...prev, status: "completed" } : prev));
    } catch (error) {
      toast.error((error as Error).message || "Failed to mark complete");
    }
  };

  // Close export dropdown when clicking outside
  useEffect(() => {
    if (!showExportDropdown) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedButton = exportDropdownRef.current?.contains(target);
      const clickedMenu = exportMenuRef.current?.contains(target);
      if (!clickedButton && !clickedMenu) {
        setShowExportDropdown(false);
      }
    };
    
    // Defer adding listener to avoid catching the same click that opened dropdown
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportDropdown]);

  // Helper: Load image for PDF
  const loadImageForPdf = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  // Generate Meet Attendance PDF Document
  const generateMeetAttendancePDF = async () => {
    if (!selectedMeeting || !selectedCard) throw new Error("No meeting selected");

    const doc = new jsPDF("portrait", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const generatedTimestamp = new Date().toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Manila",
    });
    const orgMotto = "Shaping the Future to a Greater Society";
    const attendees = selectedMeeting.attendees || [];

    // Helper: Draw page footer
    const drawFooter = (pageNum: number, totalPages: number) => {
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.text("Youth Service Philippines - Tagum Chapter", margin, pageHeight - 10);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
      doc.setFont("helvetica", "italic");
      doc.text(`"${orgMotto}"`, pageWidth / 2, pageHeight - 10, { align: "center" });
    };

    // Header with logo
    let logoLoaded = false;
    try {
      const logoImg = await loadImageForPdf(ORG_LOGO_URL);
      doc.setFillColor(246, 66, 31);
      doc.rect(0, 0, pageWidth, 45, "F");
      const logoSize = 30;
      const logoX = margin;
      const logoY = 7.5;
      doc.setFillColor(255, 255, 255);
      doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2, "F");
      doc.addImage(logoImg, "PNG", logoX, logoY, logoSize, logoSize);
      logoLoaded = true;
    } catch {
      doc.setFillColor(246, 66, 31);
      doc.rect(0, 0, pageWidth, 45, "F");
    }

    // Organization name and report title
    doc.setTextColor(255, 255, 255);
    const orgNameX = logoLoaded ? margin + 35 : margin;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(ORG_NAME, orgNameX, 18);
    doc.setFontSize(12);
    doc.text(ORG_CHAPTER, orgNameX, 26);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("MEET ATTENDANCE REPORT", orgNameX, 35);
    doc.setFontSize(8);
    doc.text(`Generated: ${generatedTimestamp}`, pageWidth - margin, 35, { align: "right" });

    let yPosition = 52;

    // Divider
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Meeting Info Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 35, 3, 3, "FD");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(246, 66, 31);
    doc.text("MEETING DETAILS", margin + 6, yPosition + 8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    const meetingTitle = selectedCard.title || selectedCard.meetingId || "Untitled Meeting";
    const meetingDateFormatted = formatDateTimePdf(selectedMeeting.meetingDate || selectedCard.scheduledStart);
    doc.text(`Title: ${meetingTitle}`, margin + 6, yPosition + 16);
    doc.text(`Meeting ID: ${selectedCard.meetingId}`, margin + 6, yPosition + 22);
    doc.text(`Date: ${meetingDateFormatted}`, margin + 6, yPosition + 28);
    doc.text(`Total Attendees: ${attendees.length}`, pageWidth / 2, yPosition + 16);
    doc.text(`Duration: ${formatDuration(selectedMeeting.totalDurationSeconds)}`, pageWidth / 2, yPosition + 22);
    doc.text(`Status: ${selectedCard.status || "Unknown"}`, pageWidth / 2, yPosition + 28);
    yPosition += 45;

    // Summary Stats Boxes
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("ATTENDANCE SUMMARY", margin, yPosition);
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition + 2, margin + 50, yPosition + 2);
    yPosition += 8;

    const internalCount = attendees.filter((a) => !a.isExternalParticipant).length;
    const externalCount = attendees.filter((a) => a.isExternalParticipant).length;
    const matchedCount = attendees.filter((a) => a.directoryName).length;

    const statBoxWidth = (pageWidth - 2 * margin - 9) / 4;
    const statBoxHeight = 22;
    const stats = [
      { name: "TOTAL", color: [246, 66, 31], count: attendees.length },
      { name: "INTERNAL", color: [34, 197, 94], count: internalCount },
      { name: "EXTERNAL", color: [59, 130, 246], count: externalCount },
      { name: "MATCHED", color: [168, 85, 247], count: matchedCount },
    ];

    stats.forEach((stat, index) => {
      const boxX = margin + index * (statBoxWidth + 3);
      doc.setFillColor(stat.color[0], stat.color[1], stat.color[2]);
      doc.roundedRect(boxX, yPosition, statBoxWidth, statBoxHeight, 2, 2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(String(stat.count), boxX + statBoxWidth / 2, yPosition + 10, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.text(stat.name, boxX + statBoxWidth / 2, yPosition + 17, { align: "center" });
    });
    yPosition += statBoxHeight + 12;

    // Attendees Table
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 41, 59);
    doc.text("ATTENDEE LIST", margin, yPosition);
    doc.setDrawColor(246, 66, 31);
    doc.line(margin, yPosition + 2, margin + 35, yPosition + 2);
    yPosition += 5;

    const tableData = attendees.map((a, index) => [
      String(index + 1),
      a.name || "Unknown",
      a.directoryName || "-",
      a.directoryIdCode || "-",
      a.committee || "-",
      a.position || "-",
      formatDuration(a.totalDurationSeconds),
    ]);

    autoTable(doc, {
      startY: yPosition,
      head: [["#", "Display Name", "Directory Name", "ID Code", "Committee", "Position", "Duration"]],
      body: tableData.length > 0 ? tableData : [["-", "No attendees recorded", "-", "-", "-", "-", "-"]],
      theme: "grid",
      headStyles: {
        fillColor: [246, 66, 31],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50] },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 35 },
        2: { cellWidth: 35 },
        3: { cellWidth: 20 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 20, halign: "center" },
      },
      margin: { left: margin, right: margin },
      styles: { overflow: "linebreak", cellPadding: 2 },
    });

    // Update footers on all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(i, totalPages);
    }

    return doc;
  };

  const handleExportPDF = async () => {
    if (!selectedCard || !selectedMeeting) return;
    setShowExportDropdown(false);
    setIsExporting(true);
    setIsGeneratingPdf(true);
    const toastId = `export_pdf_${Date.now()}`;
    addUploadToast?.({
      id: toastId,
      title: "Exporting PDF",
      message: "Generating attendance report...",
      status: "loading",
      progress: 20,
    });
    try {
      // Revoke previous URL if exists
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(null);
      }
      updateUploadToast?.(toastId, { progress: 50, message: "Creating PDF document..." });
      const doc = await generateMeetAttendancePDF();
      updateUploadToast?.(toastId, { progress: 80, message: "Preparing preview..." });
      const pdfBlob = doc.output("blob");
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
      setShowExportModal(true);
      updateUploadToast?.(toastId, { progress: 100, status: "success", message: "PDF generated!" });
      setTimeout(() => removeUploadToast?.(toastId), 2000);
    } catch (error) {
      console.error("PDF generation error:", error);
      updateUploadToast?.(toastId, { status: "error", message: (error as Error).message || "Failed to generate PDF" });
      setTimeout(() => removeUploadToast?.(toastId), 4000);
    } finally {
      setIsGeneratingPdf(false);
      setIsExporting(false);
    }
  };

  const handleExportCSV = () => {
    if (!selectedMeeting || !selectedCard) return;
    setShowExportDropdown(false);
    try {
      const attendees = selectedMeeting.attendees || [];
      const headers = ["Name", "Directory Name", "ID Code", "Committee", "Position", "First Join", "Last Leave", "Duration (sec)"];
      const rows = attendees.map((a) => [
        a.name || "Unknown",
        a.directoryName || "",
        a.directoryIdCode || "",
        a.committee || "",
        a.position || "",
        a.firstJoinTime || "",
        a.lastLeaveTime || "",
        String(a.totalDurationSeconds || 0),
      ]);
      const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `meet_attendance_${selectedCard.meetingId}_${new Date().toISOString().split("T")[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported successfully");
    } catch (error) {
      toast.error((error as Error).message || "Failed to export CSV");
    }
  };

  const handleDownloadPDF = () => {
    if (!pdfPreviewUrl || !selectedCard) return;
    const link = document.createElement("a");
    link.href = pdfPreviewUrl;
    link.download = `meet_attendance_${selectedCard.meetingId}_${new Date().toISOString().split("T")[0]}.pdf`;
    link.click();
    toast.success("PDF downloaded");
    setShowExportModal(false);
    URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl(null);
  };

  const statusOptions = [
    { value: "all", label: "All Status" },
    { value: "ongoing", label: "Ongoing" },
    { value: "completed", label: "Completed" },
    { value: "manual", label: "Manual" },
  ];

  const matchesQuery = (item: MeetDashboardCard) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      String(item.meetingId || "").toLowerCase().includes(q) ||
      String(item.title || "").toLowerCase().includes(q) ||
      String(item.meetUrl || "").toLowerCase().includes(q)
    );
  };

  const matchesStatus = (expected: StatusFilter) => {
    if (statusFilter === "all") return true;
    return statusFilter === expected;
  };

  const filteredCreated = createdMeetings.filter((m) => matchesQuery(m) && matchesStatus("ongoing"));
  const filteredManual = manualMeetings.filter((m) => matchesQuery(m) && matchesStatus("manual"));
  const filteredCompleted = completedMeetings.filter((m) => matchesQuery(m) && matchesStatus("completed"));

  const getRecipientKey = (r: RecipientOption) => String(r.email || `${r.id || ""}-${r.name}`);

  const handleAddRecipient = (r: RecipientOption) => {
    const key = getRecipientKey(r);
    if (!key) return;
    if (selectedRecipients.some((x) => getRecipientKey(x) === key)) return;
    setSelectedRecipients((prev) => [...prev, r]);
  };

  const handleRemoveRecipient = (recipientKey: string) => {
    setSelectedRecipients((prev) => prev.filter((r) => getRecipientKey(r) !== recipientKey));
  };

  const handleLoadAllDirectory = () => {
    if (!recipientPool.length) return;
    const existing = new Set(selectedRecipients.map(getRecipientKey));
    const toAdd = recipientPool.filter((r) => !existing.has(getRecipientKey(r)));
    setSelectedRecipients((prev) => [...prev, ...toAdd]);
    toast.success(`Added ${toAdd.length} members from directory`);
  };

  const handleClearCommand = () => {
    setActiveRecipientCommand(null);
    setCommandSearchQuery("");
    setRecipientQuery("");
    setExternalName("");
    setExternalEmail("");
  };

  const universalSearchSuggestions = useMemo(() => {
    const query = commandSearchQuery.toLowerCase().trim();
    if (!activeRecipientCommand) {
      if (!recipientQuery.startsWith("@")) return [];
      const cmdQuery = recipientQuery.toLowerCase();
      return RECIPIENT_COMMANDS.filter(
        (c) => c.command.toLowerCase().startsWith(cmdQuery) || c.label.toLowerCase().includes(cmdQuery.replace("@", ""))
      );
    }

    switch (activeRecipientCommand) {
      case "@Person":
        if (!query) return recipientPool.slice(0, 8);
        return recipientPool
          .filter((m) => m.name.toLowerCase().includes(query) || String(m.email || "").toLowerCase().includes(query))
          .slice(0, 8);
      case "@Committee":
        if (!query) return committees.slice(0, 8);
        return committees.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 8);
      case "@All":
      case "@External":
      default:
        return [];
    }
  }, [activeRecipientCommand, commandSearchQuery, recipientQuery, recipientPool, committees]);

  const handleUniversalSearchInput = (value: string) => {
    setRecipientQuery(value);
    setIsRecipientOpen(true);
    if (value.startsWith("@") && !activeRecipientCommand) return;
    if (activeRecipientCommand) setCommandSearchQuery(value);
  };

  const handleSelectCommand = (command: RecipientCommand) => {
    setActiveRecipientCommand(command);
    setRecipientQuery("");
    setCommandSearchQuery("");
    setIsRecipientOpen(true);
    if (command === "@All") {
      handleLoadAllDirectory();
      setActiveRecipientCommand(null);
      setIsRecipientOpen(false);
    }
  };

  const handleSelectSuggestion = async (item: RecipientOption | Committee) => {
    if (!activeRecipientCommand) return;
    switch (activeRecipientCommand) {
      case "@Person": {
        const member = item as RecipientOption;
        if (member.email) {
          handleAddRecipient({
            id: member.id,
            name: member.name,
            email: member.email,
            committee: member.committee,
            type: "Member",
            source: "Directory",
            hasEmail: true,
          });
        } else {
          toast.error("Member has no email address");
        }
        break;
      }
      case "@Committee": {
        const committee = item as Committee;
        const target = normalizeCommitteeLabel(committee.name);
        const incoming = recipientPool.filter((r) => {
          const normalizedCommittee = normalizeCommitteeLabel(r.committee);
          if (normalizedCommittee === target) return true;
          const committeeParts = splitCommitteeValues(r.committee);
          return committeeParts.includes(target);
        });
        const existing = new Set(selectedRecipients.map(getRecipientKey));
        const toAdd = incoming.filter((r) => !existing.has(getRecipientKey(r)));
        setSelectedRecipients((prev) => [...prev, ...toAdd]);
        toast.success(`Added ${toAdd.length} members from ${committee.name}`);
        break;
      }
      default:
        break;
    }
  };

  const handleAddExternalRecipient = () => {
    if (!externalName.trim() || !externalEmail.trim()) {
      toast.error("Name and email are required");
      return;
    }
    handleAddRecipient({
      id: `external-${Date.now()}`,
      name: externalName.trim(),
      email: externalEmail.trim(),
      type: "External",
      source: "External",
      hasEmail: !!externalEmail.trim(),
    });
    setExternalName("");
    setExternalEmail("");
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!activeRecipientCommand && universalSearchSuggestions.length > 0 && recipientQuery.startsWith("@")) {
        const firstCmd = universalSearchSuggestions[0] as (typeof RECIPIENT_COMMANDS)[number];
        if (firstCmd?.command) handleSelectCommand(firstCmd.command);
      } else if (activeRecipientCommand === "@Person" && universalSearchSuggestions.length > 0) {
        handleSelectSuggestion(universalSearchSuggestions[0] as RecipientOption);
      } else if (activeRecipientCommand === "@External" && commandSearchQuery.trim()) {
        const match = commandSearchQuery.match(/^(.+?)\s*<(.+@.+)>$/);
        if (match) {
          setExternalName(match[1].trim());
          setExternalEmail(match[2].trim());
        } else {
          setExternalName(commandSearchQuery.trim());
        }
      }
      return;
    }
    if (e.key === "Escape") {
      if (activeRecipientCommand) {
        handleClearCommand();
      } else {
        setIsRecipientOpen(false);
      }
    }
    if (e.key === "Backspace" && activeRecipientCommand && !commandSearchQuery) {
      handleClearCommand();
    }
  };

  const panelStyle = {
    background: isDark ? "rgba(15,23,42,0.58)" : "rgba(255,255,255,0.92)",
    borderColor: isDark ? "rgba(148,163,184,0.28)" : "rgba(15,23,42,0.12)",
  };

  const sectionMap: Array<{
    title: string;
    subtitle: string;
    items: MeetDashboardCard[];
    status: "ongoing" | "manual" | "completed";
    emptyLabel: string;
  }> = [
    {
      title: "Created Meetings",
      subtitle: "Scheduled and instant meetings made from KaagapAI Meet.",
      items: filteredCreated,
      status: "ongoing",
      emptyLabel: "No active created meetings.",
    },
    {
      title: "Manual Meetings",
      subtitle: "Attendance captured by extension sync without a created schedule.",
      items: filteredManual,
      status: "manual",
      emptyLabel: "No manual meetings from extension sync.",
    },
    {
      title: "Archive",
      subtitle: "Completed meetings are view-only and kept here for records.",
      items: filteredCompleted,
      status: "completed",
      emptyLabel: "No completed meetings in archive.",
    },
  ];

  const floatingOverlayStyle = {
    position: "fixed" as const,
    inset: 0,
    background: isDark ? "rgba(0,0,0,0.64)" : "rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
    zIndex: 9999992,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "clamp(24px, 5vw, 48px) clamp(24px, 5vw, 64px)",
  };

  const attendance = (selectedMeeting?.attendees || []).filter((item) => isLikelyParticipantDisplayName(item.name));

  return (
    <PageLayout onClose={onClose} isDark={isDark} title="KaagapAI Meet" subtitle="Google Meet attendance tracker">
      <div className="rounded-2xl border p-4 md:p-5 mb-5" style={panelStyle}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Video className="w-5 h-5 text-orange-500" />
          <p className="text-sm opacity-90">Live meeting tracking with created, manual, and archive sections.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-65 pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by meeting id, title, or link"
              className="w-full pl-9 pr-3 py-2 rounded-lg border bg-transparent text-sm"
              style={{
                borderColor: isDark ? "rgba(148,163,184,0.3)" : "rgba(15,23,42,0.15)",
                paddingLeft: "2.25rem",
              }}
            />
          </div>
          <button
            type="button"
            onClick={loadDashboard}
            className="w-10 h-10 rounded-lg border flex items-center justify-center"
            title="Refresh"
            style={{ borderColor: isDark ? "rgba(148,163,184,0.3)" : "rgba(15,23,42,0.15)" }}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => {
              handleClearCommand();
              setIsCreateOpen(true);
            }}
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-xs font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)" }}
          >
            Create
          </button>
        </div>

        <div className="mt-2 w-full md:w-[220px]">
          <CustomDropdown
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={statusOptions}
            isDark={isDark}
          />
        </div>
      </div>

      <div className="space-y-4">
        {sectionMap.map((section) => (
          <section key={section.title} className="rounded-2xl border p-4 md:p-5" style={panelStyle}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-lg font-semibold">{section.title}</h3>
                <p className="text-xs opacity-75">{section.subtitle}</p>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-orange-500/15">{section.items.length}</span>
            </div>

            {!section.items.length && <div className="text-sm opacity-75 py-2">{section.emptyLabel}</div>}

            {!!section.items.length && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {section.items.map((item) => (
                  <button
                    key={`${section.status}-${item.meetingId}`}
                    type="button"
                    onClick={() => openDetail(item)}
                    className="w-full text-left rounded-xl border p-3 transition-all hover:shadow-lg"
                    style={{
                      background: isDark ? "rgba(2,6,23,0.42)" : "rgba(248,250,252,0.92)",
                      borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.12)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="font-semibold text-sm truncate">{getCardTitle(item)}</div>
                      <span className="text-xs px-2 py-1 rounded-full bg-slate-500/15">{section.status}</span>
                    </div>
                    <div className="text-xs opacity-70 mb-2">{item.meetingId}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs opacity-85">
                      <span className="flex items-center gap-1">
                        <UsersRound className="w-3.5 h-3.5" />
                        {item.attendance?.totalAttendees || 0} attendees
                      </span>
                      <span>Live: {item.attendance?.currentlyInMeeting || 0}</span>
                      <span>External: {item.attendance?.externalParticipants || 0}</span>
                      <span className="truncate">{formatDateTime(getCardDate(item))}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {isCreateOpen &&
        createPortal(
          <div style={floatingOverlayStyle} onClick={() => setIsCreateOpen(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-2xl border overflow-visible"
              style={{
                maxWidth: "min(640px, calc(100vw - clamp(48px, 10vw, 128px)))",
                maxHeight: "min(85vh, calc(100vh - clamp(48px, 10vh, 96px)))",
                background: isDark ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.97)",
                borderColor: isDark ? "rgba(148,163,184,0.24)" : "rgba(15,23,42,0.1)",
                boxShadow: isDark ? "0 20px 60px rgba(0,0,0,0.4)" : "0 20px 60px rgba(0,0,0,0.2)",
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)" }}
              >
                <div className="font-semibold">
                  <CalendarClock className="inline w-4 h-4 mr-2" />
                  Create Meeting
                </div>
                <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded hover:bg-black/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Meeting title"
                  className="px-3 py-2 rounded-lg border bg-transparent text-sm md:col-span-2"
                />

                <CustomDropdown
                  value={form.mode}
                  onChange={(v) => setForm((p) => ({ ...p, mode: v as "instant" | "scheduled" }))}
                  options={[
                    { value: "instant", label: "Instant" },
                    { value: "scheduled", label: "Scheduled" },
                  ]}
                  isDark={isDark}
                />

                <input
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Notes (optional)"
                  className="px-3 py-2 rounded-lg border bg-transparent text-sm"
                />

                {form.mode === "scheduled" && (
                  <>
                    <input
                      type="datetime-local"
                      value={form.scheduledStart}
                      onChange={(e) => setForm((p) => ({ ...p, scheduledStart: e.target.value }))}
                      className="px-3 py-2 rounded-lg border bg-transparent text-sm"
                    />
                    <input
                      type="datetime-local"
                      value={form.scheduledEnd}
                      onChange={(e) => setForm((p) => ({ ...p, scheduledEnd: e.target.value }))}
                      className="px-3 py-2 rounded-lg border bg-transparent text-sm"
                    />
                  </>
                )}

                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold mb-2 text-[#f6421f]">Add Recipients</label>

                  {selectedRecipients.length > 0 && (
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs opacity-75">
                          {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? "s" : ""} selected
                        </span>
                        <div className="flex items-center gap-2">
                          {selectedRecipients.length > 8 && (
                            <button
                              onClick={() => setShowAllRecipients(!showAllRecipients)}
                              className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                            >
                              {showAllRecipients ? "Show less" : `Show all ${selectedRecipients.length}`}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedRecipients([]);
                              setShowAllRecipients(false);
                            }}
                            className="text-xs text-red-500 hover:text-red-600"
                          >
                            Clear all
                          </button>
                        </div>
                      </div>
                      <div
                        className={`flex flex-wrap gap-2 p-2 rounded-lg overflow-hidden transition-all ${showAllRecipients ? "max-h-48 overflow-y-auto" : "max-h-16"}`}
                        style={{ background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)" }}
                      >
                        {(showAllRecipients ? selectedRecipients : selectedRecipients.slice(0, 8)).map((recipient) => {
                          const hasEmail = recipient.hasEmail !== false && !!recipient.email;
                          const recipientKey = getRecipientKey(recipient);
                          return (
                            <div
                              key={recipientKey}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                              style={{
                                background: hasEmail
                                  ? (isDark ? "rgba(246, 66, 31, 0.2)" : "rgba(246, 66, 31, 0.1)")
                                  : (isDark ? "rgba(239, 68, 68, 0.2)" : "rgba(239, 68, 68, 0.1)"),
                                border: hasEmail
                                  ? "1px solid rgba(246,66,31,0.25)"
                                  : "1px solid rgba(239, 68, 68, 0.5)",
                              }}
                            >
                              <span className="font-medium" style={{ color: hasEmail ? "#f6421f" : "#ef4444" }}>
                                {recipient.name}
                              </span>
                              {!hasEmail && <span className="text-[10px] text-red-500 font-normal">(no email)</span>}
                              {recipient.type === "External" && <Globe className="w-3 h-3 text-pink-500" />}
                              <button
                                onClick={() => handleRemoveRecipient(recipientKey)}
                                className="p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
                              >
                                <X className="w-3 h-3 text-red-500" />
                              </button>
                            </div>
                          );
                        })}
                        {!showAllRecipients && selectedRecipients.length > 8 && (
                          <div
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                            style={{ background: isDark ? "rgba(100,100,100,0.3)" : "rgba(0,0,0,0.1)" }}
                            onClick={() => setShowAllRecipients(true)}
                          >
                            +{selectedRecipients.length - 8} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-3" ref={recipientSearchRef}>
                    <div className="relative">
                      <div className="relative" ref={recipientInputWrapperRef}>
                        {activeRecipientCommand && (() => {
                          const cmd = RECIPIENT_COMMANDS.find((c) => c.command === activeRecipientCommand);
                          return cmd ? <cmd.icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: cmd.color }} /> : null;
                        })()}
                        {!activeRecipientCommand && (
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        )}
                        <input
                          ref={recipientInputRef}
                          type="text"
                          value={activeRecipientCommand ? commandSearchQuery : recipientQuery}
                          onChange={(e) => handleUniversalSearchInput(e.target.value)}
                          onFocus={() => setIsRecipientOpen(true)}
                          onKeyDown={handleRecipientKeyDown}
                          placeholder={
                            activeRecipientCommand === "@Person" ? "Search by name or email..." :
                            activeRecipientCommand === "@Committee" ? "Search committees..." :
                            activeRecipientCommand === "@External" ? "Enter: Name <email@example.com>" :
                            "Type @ to see commands"
                          }
                          className="w-full py-3 pl-12 pr-4 rounded-xl border-2 transition-all focus:outline-none"
                          style={{
                            background: activeRecipientCommand
                              ? (isDark ? `${RECIPIENT_COMMANDS.find((c) => c.command === activeRecipientCommand)?.color}15` : `${RECIPIENT_COMMANDS.find((c) => c.command === activeRecipientCommand)?.color}08`)
                              : (isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)"),
                            borderColor: activeRecipientCommand
                              ? `${RECIPIENT_COMMANDS.find((c) => c.command === activeRecipientCommand)?.color}50`
                              : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"),
                            color: isDark ? "#fff" : "#000",
                          }}
                        />
                      </div>

                      {isRecipientOpen && (
                        <div
                          className="rounded-xl border shadow-xl overflow-y-auto"
                          style={{
                            background: isDark ? "rgba(17, 24, 39, 0.98)" : "rgba(255, 255, 255, 0.98)",
                            borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                            ...(recipientDropdownStyle || {}),
                          }}
                        >
                          {!activeRecipientCommand && recipientQuery.startsWith("@") && universalSearchSuggestions.length > 0 && (
                            <>
                              <div className="px-3 py-2 text-xs font-semibold opacity-75 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                                Commands
                              </div>
                              {(universalSearchSuggestions as typeof RECIPIENT_COMMANDS).map((cmd) => (
                                <button
                                  key={cmd.command}
                                  onClick={() => handleSelectCommand(cmd.command)}
                                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                                >
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${cmd.color}20` }}>
                                    <cmd.icon className="w-4 h-4" style={{ color: cmd.color }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold" style={{ color: cmd.color }}>{cmd.command}</p>
                                    <p className="text-xs opacity-70">{cmd.label}</p>
                                  </div>
                                </button>
                              ))}
                            </>
                          )}

                          {!activeRecipientCommand && !recipientQuery.startsWith("@") && !recipientQuery && (
                            <div className="p-4 text-center">
                              <p className="text-sm opacity-75 mb-3">
                                Type <span className="font-mono text-[#f6421f]">@</span> to see available commands
                              </p>
                              <div className="flex flex-wrap justify-center gap-2">
                                {RECIPIENT_COMMANDS.map((cmd) => (
                                  <button
                                    key={cmd.command}
                                    onClick={() => handleSelectCommand(cmd.command)}
                                    className="px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105"
                                    style={{ background: `${cmd.color}15`, color: cmd.color, border: `1px solid ${cmd.color}30` }}
                                  >
                                    {cmd.command}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {activeRecipientCommand === "@Person" && isLoadingMembers && (
                            <div className="p-6 text-center">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: "#3b82f6" }} />
                              <p className="text-sm opacity-75">Loading members...</p>
                            </div>
                          )}

                          {activeRecipientCommand === "@Person" && !isLoadingMembers && membersError && (
                            <div className="p-4 text-center">
                              <p className="text-sm text-red-500 mb-2">{membersError}</p>
                            </div>
                          )}

                          {activeRecipientCommand === "@Person" && !isLoadingMembers && !membersError && universalSearchSuggestions.length > 0 && (
                            <>
                              <div className="px-3 py-2 text-xs font-semibold opacity-75 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                                Members ({recipientPool.length} total)
                              </div>
                              {(universalSearchSuggestions as RecipientOption[]).map((member) => (
                                <button
                                  key={member.id || member.email || member.name}
                                  onClick={() => handleSelectSuggestion(member)}
                                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                                  disabled={!member.email}
                                >
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)" }}>
                                    {String(member.name || "?").slice(0, 1).toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: isDark ? "#fff" : "#000" }}>{member.name}</p>
                                    <p className="text-xs opacity-70 truncate">{member.email || "No email"}</p>
                                  </div>
                                  {selectedRecipients.some((r) => getRecipientKey(r) === getRecipientKey(member)) && (
                                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                                  )}
                                </button>
                              ))}
                            </>
                          )}

                          {activeRecipientCommand === "@Committee" && universalSearchSuggestions.length > 0 && (
                            <>
                              <div className="px-3 py-2 text-xs font-semibold opacity-75 border-b" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                                Committees - Click to load members
                              </div>
                              {(universalSearchSuggestions as Committee[]).map((committee) => (
                                <button
                                  key={committee.id}
                                  onClick={() => handleSelectSuggestion(committee)}
                                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                                  disabled={isLoadingRecipients}
                                >
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#10b98120" }}>
                                    <Building2 className="w-4 h-4" style={{ color: "#10b981" }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate" style={{ color: isDark ? "#fff" : "#000" }}>{committee.name}</p>
                                  </div>
                                </button>
                              ))}
                            </>
                          )}

                          {activeRecipientCommand === "@External" && (
                            <div className="p-4 space-y-3">
                              <div className="text-xs font-semibold opacity-75 mb-2">Add External Recipient</div>
                              <input
                                type="text"
                                value={externalName}
                                onChange={(e) => setExternalName(e.target.value)}
                                placeholder="Full Name"
                                className="w-full p-2.5 rounded-lg border transition-all focus:outline-none"
                                style={{
                                  background: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)",
                                  borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                                  color: isDark ? "#fff" : "#000",
                                }}
                              />
                              <input
                                type="email"
                                value={externalEmail}
                                onChange={(e) => setExternalEmail(e.target.value)}
                                placeholder="email@example.com"
                                className="w-full p-2.5 rounded-lg border transition-all focus:outline-none"
                                style={{
                                  background: isDark ? "rgba(30, 41, 59, 0.8)" : "rgba(255, 255, 255, 0.9)",
                                  borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)",
                                  color: isDark ? "#fff" : "#000",
                                }}
                              />
                              <button
                                onClick={handleAddExternalRecipient}
                                className="w-full py-2.5 rounded-lg text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
                                style={{ background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)" }}
                              >
                                <Plus className="w-4 h-4" />
                                Add External Recipient
                              </button>
                            </div>
                          )}

                          {activeRecipientCommand && activeRecipientCommand !== "@External" && activeRecipientCommand !== "@All" && universalSearchSuggestions.length === 0 && commandSearchQuery && (
                            <div className="p-4 text-center opacity-75 text-sm">
                              No results found for "{commandSearchQuery}"
                            </div>
                          )}

                          {activeRecipientCommand && activeRecipientCommand !== "@External" && (
                            <div className="border-t px-3 py-2" style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" }}>
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs opacity-75">Combine with other sources:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {RECIPIENT_COMMANDS.filter((c) => c.command !== activeRecipientCommand).map((cmd) => (
                                  <button
                                    key={cmd.command}
                                    onClick={() => handleSelectCommand(cmd.command)}
                                    className="px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 flex items-center gap-1"
                                    style={{ background: `${cmd.color}15`, color: cmd.color, border: `1px solid ${cmd.color}30` }}
                                  >
                                    {cmd.command.replace("@", "")}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div
                className="px-5 py-4 border-t flex items-center justify-end gap-2"
                style={{ borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)" }}
              >
                <button onClick={() => setIsCreateOpen(false)} className="px-3 py-2 rounded-lg border text-xs font-semibold">
                  Cancel
                </button>
                <button
                  onClick={onCreateMeeting}
                  disabled={isCreating}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)" }}
                >
                  {isCreating ? "Creating..." : "Create"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {isDetailOpen &&
        selectedCard &&
        createPortal(
          <div style={floatingOverlayStyle} onClick={() => setIsDetailOpen(false)}>
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded-2xl border flex flex-col"
              style={{
                maxWidth: "min(960px, calc(100vw - clamp(48px, 10vw, 128px)))",
                maxHeight: "min(85vh, calc(100vh - clamp(48px, 10vh, 96px)))",
                background: isDark ? "rgba(15,23,42,0.96)" : "rgba(255,255,255,0.97)",
                borderColor: isDark ? "rgba(148,163,184,0.24)" : "rgba(15,23,42,0.1)",
                boxShadow: isDark ? "0 20px 60px rgba(0,0,0,0.4)" : "0 20px 60px rgba(0,0,0,0.2)",
                overflow: "visible",
              }}
            >
              <div
                className="px-5 py-4 border-b flex items-center justify-between"
                style={{ borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)" }}
              >
                <div>
                  <div className="font-semibold">{getCardTitle(selectedCard)}</div>
                  <div className="text-xs opacity-75">{selectedCard.meetingId}</div>
                </div>
                <button onClick={() => setIsDetailOpen(false)} className="p-1 rounded hover:bg-black/10">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto min-h-0">
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  <span className="px-2 py-1 rounded-lg border">Realtime refresh every 8s</span>
                  <span className="px-2 py-1 rounded-lg border">Meeting ID: {selectedCard.meetingId}</span>
                  <span className="px-2 py-1 rounded-lg border">Last Sync: {formatDateTime(selectedMeeting?.lastSyncedAt)}</span>
                  <span className="px-2 py-1 rounded-lg border" data-tick={meetingAgeTick}>
                    Duration Since Created: {formatElapsedSince(selectedCard.createdAt)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="rounded-lg border p-2">
                    <div className="opacity-70">Meet Link</div>
                    <a
                      href={selectedCard.meetUrl || "https://meet.google.com/"}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-orange-600 hover:underline break-all"
                    >
                      {selectedCard.meetUrl || "https://meet.google.com/"}
                    </a>
                  </div>
                  <div className="rounded-lg border p-2">
                    <div className="opacity-70">Initiated By</div>
                    <div className="font-medium">{selectedCard.createdBy || "-"}</div>
                  </div>
                </div>

                {!!selectedCard.expectedAttendees?.length && (
                  <div className="rounded-lg border p-2 mb-3 text-xs">
                    <div className="font-medium mb-1">Expected Attendees ({selectedCard.expectedAttendees.length})</div>
                    <div className="max-h-24 overflow-auto flex flex-wrap gap-1.5">
                      {selectedCard.expectedAttendees.map((r) => (
                        <span key={`${r.email || ""}-${r.name}`} className="px-2 py-1 rounded-full bg-slate-500/15">
                          {r.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {!selectedMeeting && <div className="text-sm opacity-80">No attendance data yet.</div>}

                {!!selectedMeeting && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3 text-xs">
                      <div className="rounded-lg border p-2">Total: {attendance.length}</div>
                      <div className="rounded-lg border p-2">Live: {attendance.filter((a) => a.isPresent).length}</div>
                      <div className="rounded-lg border p-2">External: {attendance.filter((a) => a.isExternalParticipant).length}</div>
                      <div className="rounded-lg border p-2">Duration: {formatDuration(attendance.reduce((acc, a) => acc + Number(a.totalDurationSeconds || 0), 0))}</div>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                      <div className="overflow-auto" style={{ maxHeight: "min(45vh, 360px)" }}>
                        <table className="w-full text-xs" style={{ minWidth: "640px" }}>
                          <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                          <tr>
                            <th className="p-2 text-left">Name</th>
                            <th className="p-2 text-left">Live</th>
                            <th className="p-2 text-left">Join Count</th>
                            <th className="p-2 text-left">Exit Count</th>
                            <th className="p-2 text-left">Join</th>
                            <th className="p-2 text-left">Leave</th>
                            <th className="p-2 text-left">Duration</th>
                          </tr>
                          </thead>
                          <tbody>
                            {attendance.map((a: MeetAttendanceDetail) => (
                              <tr key={a.participantKey} className="border-t">
                              <td className="p-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="relative w-7 h-7 shrink-0">
                                    <span
                                      className="absolute inset-0 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                                      style={{
                                        background: "linear-gradient(135deg, #ee8724 0%, #f6421f 100%)",
                                        border: `1px solid ${getAvatarBorderColor(isDark)}`,
                                      }}
                                    >
                                      {getNameInitials(a.name)}
                                    </span>
                                    {a.profilePictureURL ? (
                                      <img
                                        src={a.profilePictureURL}
                                        alt={a.name}
                                        className="relative w-7 h-7 rounded-full object-cover"
                                        style={{ border: `1px solid ${getAvatarBorderColor(isDark)}` }}
                                        onError={(e) => {
                                          e.currentTarget.style.display = "none";
                                        }}
                                      />
                                    ) : null}
                                  </div>
                                  <span className="truncate">{a.name}</span>
                                </div>
                              </td>
                                <td className="p-2">{a.isPresent ? "In meeting" : "Left"}</td>
                                <td className="p-2">{a.joinCount}</td>
                                <td className="p-2">{a.exitCount}</td>
                                <td className="p-2">{formatDateTime(a.firstJoinTime)}</td>
                                <td className="p-2">{formatDateTime(a.lastLeaveTime)}</td>
                                <td className="p-2">{formatDuration(a.totalDurationSeconds)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div
                className="px-5 py-4 border-t flex items-center justify-between gap-2 overflow-visible"
                style={{ borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)" }}
              >
                <a
                  href={selectedCard.meetUrl || "https://meet.google.com/"}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border"
                >
                  Open Meet <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex items-center gap-2">
                  {/* Export Dropdown */}
                  <div className="relative" ref={exportDropdownRef}>
                    <button
                      onClick={() => {
                        if (!showExportDropdown && exportDropdownRef.current) {
                          const rect = exportDropdownRef.current.getBoundingClientRect();
                          const dropdownHeight = 90; // Approximate height of dropdown
                          const spaceBelow = window.innerHeight - rect.bottom;
                          const spaceAbove = rect.top;
                          setExportDropdownPosition(spaceBelow < dropdownHeight && spaceAbove > dropdownHeight ? "above" : "below");
                        }
                        setShowExportDropdown(!showExportDropdown);
                      }}
                      disabled={isExporting}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50"
                      style={{
                        borderColor: isDark ? "rgba(148,163,184,0.3)" : "rgba(15,23,42,0.2)",
                        background: isDark ? "rgba(30,41,59,0.8)" : "rgba(255,255,255,0.9)",
                      }}
                    >
                      {isExporting ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          Exporting...
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          Export
                          <ChevronDown className="w-3 h-3" />
                        </>
                      )}
                    </button>
                    {showExportDropdown && (
                      <div
                        ref={exportMenuRef}
                        className={`absolute right-0 w-40 rounded-lg shadow-2xl border overflow-hidden ${
                          exportDropdownPosition === "above" ? "bottom-full mb-2" : "top-full mt-2"
                        }`}
                        style={{
                          background: isDark ? "#1e293b" : "#ffffff",
                          borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)",
                          zIndex: 99999,
                          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
                        }}
                      >
                        <button
                          onClick={handleExportPDF}
                          className="w-full px-3 py-2.5 text-left text-xs font-medium flex items-center gap-2 hover:bg-orange-500/10"
                        >
                          <FileText className="w-3.5 h-3.5 text-orange-500" />
                          Export as PDF
                        </button>
                        <button
                          onClick={handleExportCSV}
                          className="w-full px-3 py-2.5 text-left text-xs font-medium flex items-center gap-2 hover:bg-green-500/10"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-green-500" />
                          Export as CSV
                        </button>
                      </div>
                    )}
                  </div>

                  {canComplete && selectedCard.status !== "completed" && selectedCard.status !== "manual" && (
                    <button
                      onClick={onComplete}
                      className="px-3 py-2 rounded-lg text-xs font-semibold text-white"
                      style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}
                    >
                      <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" />
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* PDF Export Preview Modal */}
      {showExportModal &&
        pdfPreviewUrl &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            style={{ background: "rgba(0, 0, 0, 0.9)", zIndex: 99999999 }}
            onClick={() => {
              setShowExportModal(false);
              if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
              setPdfPreviewUrl(null);
            }}
          >
            <div
              className="relative w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              style={{
                background: isDark
                  ? "linear-gradient(145deg, #1e293b, #0f172a)"
                  : "linear-gradient(145deg, #ffffff, #f8fafc)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div
                className="flex items-center justify-between px-5 py-4 border-b"
                style={{ borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)" }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}
                  >
                    <FileText className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">PDF Preview</h3>
                    <p className="text-xs opacity-70">Meet Attendance Report</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
                    setPdfPreviewUrl(null);
                  }}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* PDF Preview */}
              <div className="flex-1 p-4 overflow-hidden">
                <iframe
                  src={pdfPreviewUrl}
                  className="w-full h-full rounded-lg border"
                  style={{ borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)" }}
                  title="PDF Preview"
                />
              </div>

              {/* Modal Footer */}
              <div
                className="px-5 py-4 border-t flex items-center justify-end gap-3"
                style={{ borderColor: isDark ? "rgba(148,163,184,0.2)" : "rgba(15,23,42,0.1)" }}
              >
                <button
                  onClick={() => {
                    setShowExportModal(false);
                    if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
                    setPdfPreviewUrl(null);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold border"
                  style={{
                    borderColor: isDark ? "rgba(148,163,184,0.3)" : "rgba(15,23,42,0.2)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-white flex items-center gap-2"
                  style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}
                >
                  <Download className="w-4 h-4" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </PageLayout>
  );
}



