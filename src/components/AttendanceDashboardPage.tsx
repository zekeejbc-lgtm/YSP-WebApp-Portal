import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { PageLayout, DESIGN_TOKENS } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import SmartEventSearch from "./SmartEventSearch";
import { useIsMobile } from "./ui/use-mobile";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Loader2, TrendingUp, PieChartIcon, BarChart3, LineChartIcon, Eye, Settings, FileText, Download, RefreshCw, Users, FileSpreadsheet, ChevronDown, ExternalLink, Smartphone, Search, User, Calendar, Clock, CheckCircle2, AlertCircle, X, ChevronUp, Timer, ToggleLeft, ToggleRight, Trophy, Medal, Award, Sparkles } from "lucide-react";
import { fetchEventsSafe, EventData } from "../services/gasEventsService";
import { getEventAttendanceRecords, AttendanceRecord, getMembersForAttendance, MemberForAttendance, getMemberAttendanceHistory } from "../services/gasAttendanceService";
import type jsPDF from "jspdf";
import type { CellHookData } from "jspdf-autotable";
import { YSP_COMMITTEE_NAMES } from "../constants/committees";
import { loadExcelJS, loadPdfTools } from "../utils/exportLoaders";

// Organization Logo URL
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const ORG_NAME = "Youth Service Philippines";
const ORG_CHAPTER = "Tagum Chapter";
const ORG_MOTTO = "Shaping the Future to a Greater Society";
const PRESENT_STATUSES = new Set(['Present', 'CheckedIn', 'CheckedOut']);

// Extended member type that includes attendance flags for modal display
interface ModalMemberData extends MemberForAttendance {
  isExternal?: boolean;
  lateTimeIn?: boolean;
  lateTimeOut?: boolean;
}

// Helper function to format time values properly (converts UTC to Manila time)
function formatTimeValue(timeValue: string | Date | null | undefined): string {
  if (!timeValue) return '-';
  
  const timeStr = String(timeValue).trim();
  if (!timeStr || timeStr === '-' || timeStr === 'undefined' || timeStr === 'null') return '-';
  
  // Check if it looks like a time already (e.g., "2:30 PM", "02:30 PM", "14:30")
  if (/^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM|am|pm)?$/i.test(timeStr)) {
    return timeStr;
  }
  
  // Check if it's an ISO date string (contains T) - these are in UTC and need timezone conversion
  if (timeStr.includes('T')) {
    try {
      // Parse the ISO string as a Date object (this creates a UTC date)
      const utcDate = new Date(timeStr);
      if (!isNaN(utcDate.getTime())) {
        // Convert to Manila time (UTC+8) using toLocaleTimeString
        return utcDate.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true,
          timeZone: 'Asia/Manila'
        });
      }
    } catch {
      // Fall through
    }
  }
  
  // Try parsing as a Date object (for Date objects from Google Sheets)
  if (timeValue instanceof Date) {
    try {
      const date = timeValue;
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit', 
          hour12: true,
          timeZone: 'Asia/Manila'
        });
      }
    } catch {
      // Fall through
    }
  }
  
  return timeStr || '-';
}

// Helper function to check if someone has no logout time (present but didn't logout)
function hasNoLogout(timeIn: string | Date | null | undefined, timeOut: string | Date | null | undefined, status: string): boolean {
  const isPresent = status === 'Present' || status === 'CheckedIn' || status === 'CheckedOut' || status === 'Late';
  if (!isPresent) return false;
  
  const timeInStr = String(timeIn || '').trim();
  const timeOutStr = String(timeOut || '').trim();
  
  // Has time in but no time out
  const hasTimeIn = Boolean(timeInStr && timeInStr !== '-' && timeInStr !== 'N/A' && timeInStr !== 'undefined' && timeInStr !== 'null');
  const hasTimeOut = Boolean(timeOutStr && timeOutStr !== '-' && timeOutStr !== 'N/A' && timeOutStr !== 'undefined' && timeOutStr !== 'null');
  
  return hasTimeIn && !hasTimeOut;
}

// Helper function to calculate attendance duration between time in and time out
function calculateAttendanceDuration(timeIn: string | Date | null | undefined, timeOut: string | Date | null | undefined): string {
  if (!timeIn || !timeOut) return '-';
  
  const timeInStr = String(timeIn).trim();
  const timeOutStr = String(timeOut).trim();
  
  if (!timeInStr || timeInStr === '-' || timeInStr === 'N/A' ||
      !timeOutStr || timeOutStr === '-' || timeOutStr === 'N/A') {
    return '-';
  }
  
  // Try to parse times
  let inDate: Date | null = null;
  let outDate: Date | null = null;
  
  // Parse time in
  if (timeInStr.includes('T')) {
    inDate = new Date(timeInStr);
  } else {
    // Parse formatted time like "2:30 PM"
    const inMatch = timeInStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (inMatch) {
      let hours = parseInt(inMatch[1]);
      const minutes = parseInt(inMatch[2]);
      const period = inMatch[3]?.toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      inDate = new Date();
      inDate.setHours(hours, minutes, 0, 0);
    }
  }
  
  // Parse time out
  if (timeOutStr.includes('T')) {
    outDate = new Date(timeOutStr);
  } else {
    // Parse formatted time like "5:45 PM"
    const outMatch = timeOutStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (outMatch) {
      let hours = parseInt(outMatch[1]);
      const minutes = parseInt(outMatch[2]);
      const period = outMatch[3]?.toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      outDate = new Date();
      outDate.setHours(hours, minutes, 0, 0);
    }
  }
  
  if (!inDate || !outDate || isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
    return '-';
  }
  
  // Calculate difference in milliseconds
  let diffMs = outDate.getTime() - inDate.getTime();
  
  // Handle overnight (if out time is earlier than in time, assume next day)
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000; // Add 24 hours
  }
  
  // Convert to hours, minutes, seconds
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  // Format output
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`); // Only show seconds if less than an hour
  
  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

// Helper function to calculate duration in minutes between two time strings
function calculateDurationMinutes(timeIn: string | Date | null | undefined, timeOut: string | Date | null | undefined): number {
  if (!timeIn || !timeOut) return 0;
  
  const timeInStr = String(timeIn).trim();
  const timeOutStr = String(timeOut).trim();
  
  if (!timeInStr || timeInStr === '-' || timeInStr === 'N/A' ||
      !timeOutStr || timeOutStr === '-' || timeOutStr === 'N/A') {
    return 0;
  }
  
  const parseTime = (timeStr: string): Date | null => {
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      return isNaN(date.getTime()) ? null : date;
    }
    
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?/i);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const period = match[3]?.toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      return date;
    }
    return null;
  };
  
  const inTime = parseTime(timeInStr);
  const outTime = parseTime(timeOutStr);
  
  if (!inTime || !outTime) return 0;
  
  let diffMs = outTime.getTime() - inTime.getTime();
  if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
  
  return Math.floor(diffMs / (1000 * 60));
}

// Helper function to format minutes into human-readable duration
function formatMinutesToDuration(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  
  return parts.join(' ') || '0m';
}

// Helper function to format date values from backend
function formatDateValue(dateValue: string | Date | null | undefined): string {
  if (!dateValue) return '-';
  
  const dateStr = String(dateValue).trim();
  if (!dateStr || dateStr === '-' || dateStr === 'undefined' || dateStr === 'null') return '-';
  
  // Check if it's already a formatted date (e.g., "January 11, 2026")
  if (/^[A-Za-z]+ \d{1,2}, \d{4}$/.test(dateStr)) {
    return dateStr;
  }
  
  // Check if it's in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        });
      }
    } catch {
      // Fall through
    }
  }
  
  // Check if it's an ISO date string (contains T)
  if (dateStr.includes('T')) {
    try {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        });
      }
    } catch {
      // Fall through
    }
  }
  
  return dateStr;
}

interface AttendanceDashboardPageProps {
  onClose: () => void;
  isDark: boolean;
  addUploadToast?: (message: { id: string; title: string; message: string; status: 'loading' | 'success' | 'error' | 'info'; progress?: number; onCancel?: () => void }) => void;
  updateUploadToast?: (id: string, updates: Partial<{ title?: string; message: string; status: 'loading' | 'success' | 'error' | 'info'; progress?: number }>) => void;
  removeUploadToast?: (id: string) => void;
  onDashboardContextUpdate?: (context: AttendanceDashboardContext | null) => void;
  onModalStateChange?: (isOpen: boolean) => void; // Callback when any modal opens/closes (to hide chatbot)
}

// Event selection mode types
type EventSelectionMode = 'single' | 'multiple' | 'dateRange' | 'all';

// Export options interface
interface ExportOptions {
  includeNotRecorded: boolean;
  includeSummaryTable: boolean;
  includeDetailedTables: boolean;
  includeCharts: boolean;
  selectedTables: ('present' | 'late' | 'excused' | 'absent' | 'notRecorded' | 'all')[];
}

type ExportTableKey = ExportOptions["selectedTables"][number];
type ChartRelevance = "high" | "medium" | "low";

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

// Dashboard context for chatbot integration
export interface AttendanceDashboardContext {
  mode: EventSelectionMode;
  selectedEvents: string[];
  dateRange: { from: string; to: string } | null;
  totalEvents: number;
  statistics: {
    totalRecords: number;
    present: number;
    late: number;
    excused: number;
    absent: number;
    notRecorded: number;
    attendanceRate: number;
  };
  eventDetails: Array<{
    id: string;
    title: string;
    date: string;
    status: string;
    present: number;
    late: number;
    excused: number;
    absent: number;
  }>;
  recommendedChartType: 'pie' | 'donut' | 'bar' | 'line' | 'column';
}

// Committee filter options
const COMMITTEES = [
  "All",
  ...YSP_COMMITTEE_NAMES,
];

// Skeleton component for loading states
function Skeleton({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{
        background: 'linear-gradient(90deg, rgba(128,128,128,0.1) 25%, rgba(128,128,128,0.2) 50%, rgba(128,128,128,0.1) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
    />
  );
}

// Chart skeleton for loading
function ChartSkeleton({ isDark: _isDark }: { isDark: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-[400px] w-full">
      <div className="relative">
        {/* Circular skeleton for pie chart */}
        <Skeleton 
          className="rounded-full"
          style={{ width: 240, height: 240 }}
        />
        <div 
          className="absolute inset-0 flex items-center justify-center"
        >
          <Loader2 
            className="w-8 h-8 animate-spin" 
            style={{ color: DESIGN_TOKENS.colors.brand.orange }}
          />
        </div>
      </div>
      <div className="flex gap-4 mt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton style={{ width: 12, height: 12, borderRadius: 2 }} />
            <Skeleton style={{ width: 50, height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Controls skeleton
function ControlsSkeleton({ isDark: _isDark }: { isDark: boolean }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <Skeleton style={{ width: 100, height: 20, marginBottom: 8 }} />
        <Skeleton style={{ width: '100%', height: 44, borderRadius: 8 }} />
      </div>
      <div>
        <Skeleton style={{ width: 120, height: 20, marginBottom: 8 }} />
        <Skeleton style={{ width: '100%', height: 44, borderRadius: 8 }} />
      </div>
    </div>
  );
}

// Stats card skeleton
function StatsCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl p-4 border"
          style={{
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <Skeleton style={{ width: 60, height: 14, marginBottom: 8 }} />
          <Skeleton style={{ width: 40, height: 28 }} />
        </div>
      ))}
    </div>
  );
}

export default function AttendanceDashboardPage({ 
  onClose, 
  isDark,
  addUploadToast,
  updateUploadToast,
  removeUploadToast,
  onDashboardContextUpdate,
  onModalStateChange,
}: AttendanceDashboardPageProps) {
  // Mobile detection for PDF preview fallback
  const isMobile = useIsMobile();
  
  // Smart search event selection (unified - replaces mode-based selection)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  
  const [selectedCommittee, setSelectedCommittee] = useState("All");
  const [chartType, setChartType] = useState<"pie" | "donut" | "bar" | "line" | "column">("pie");
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{ status: string; members: ModalMemberData[] } | null>(null);
  const [exportType, setExportType] = useState("");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportPdfHandlerRef = useRef<(() => Promise<void>) | null>(null);
  const exportSpreadsheetHandlerRef = useRef<(() => Promise<void>) | null>(null);

  // Export Preview Modal
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [exportFormat, setExportFormat] = useState<'pdf' | 'spreadsheet'>('pdf');
  const [exportModalTab, setExportModalTab] = useState<'preview' | 'settings'>('preview');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeNotRecorded: true,
    includeSummaryTable: true,
    includeDetailedTables: true,
    includeCharts: true,
    selectedTables: ['all', 'present', 'late', 'excused', 'absent', 'notRecorded'],
  });

  // Loading states
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Data states
  const [events, setEvents] = useState<EventData[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [multiEventRecords, setMultiEventRecords] = useState<Map<string, AttendanceRecord[]>>(new Map());
  const [allMembers, setAllMembers] = useState<MemberForAttendance[]>([]);

  // ============= PERSON SEARCH STATES =============
  const [personSearchQuery, setPersonSearchQuery] = useState("");
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<MemberForAttendance | null>(null);
  const [personAttendanceRecords, setPersonAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoadingPersonAttendance, setIsLoadingPersonAttendance] = useState(false);
  const [showPersonAttendanceModal, setShowPersonAttendanceModal] = useState(false);
  const [selectedPersonRecord, setSelectedPersonRecord] = useState<AttendanceRecord | null>(null);
  const personSearchRef = useRef<HTMLDivElement>(null);
  
  // Excluded events for person participation time calculation
  const [personExcludedEventIds, setPersonExcludedEventIds] = useState<Set<string>>(new Set());
  
  // Leaderboard/gamification state
  const [showRankingsModal, setShowRankingsModal] = useState(false);
  const [rankingsFilterType, setRankingsFilterType] = useState<'all' | 'events' | 'committee'>('all');
  const [rankingsSelectedEventIds, setRankingsSelectedEventIds] = useState<string[]>([]);
  const [rankingsSelectedCommittee, setRankingsSelectedCommittee] = useState('All');
  const [rankingsAttendanceRecords, setRankingsAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoadingRankingsData, setIsLoadingRankingsData] = useState(false);
  const [rankingsPage, setRankingsPage] = useState(1);
  const [rankingsVisibleRows, setRankingsVisibleRows] = useState(5);
  const attendanceCacheRef = useRef<Map<string, AttendanceRecord[]>>(new Map());
  const attendanceRequestCacheRef = useRef<Map<string, Promise<AttendanceRecord[]>>>(new Map());
  
  // Toggle event inclusion for person participation time
  const togglePersonEventInclusion = useCallback((eventId: string) => {
    setPersonExcludedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  }, []);

  const fetchAttendanceRecordsDeduped = useCallback(async (eventId: string) => {
    const cachedRecords = attendanceCacheRef.current.get(eventId);
    if (cachedRecords) {
      return cachedRecords;
    }

    const existingRequest = attendanceRequestCacheRef.current.get(eventId);
    if (existingRequest) {
      return existingRequest;
    }

    const request = getEventAttendanceRecords(eventId)
      .then((records) => {
        attendanceCacheRef.current.set(eventId, records);
        return records;
      })
      .finally(() => {
        attendanceRequestCacheRef.current.delete(eventId);
      });

    attendanceRequestCacheRef.current.set(eventId, request);
    return request;
  }, []);

  const summarizeAttendanceRecords = useCallback((records: AttendanceRecord[]) => {
    const summary = { present: 0, late: 0, excused: 0, absent: 0 };

    for (const record of records) {
      if (PRESENT_STATUSES.has(record.status)) {
        summary.present++;
      } else if (record.status === 'Late') {
        summary.late++;
      } else if (record.status === 'Excused') {
        summary.excused++;
      } else if (record.status === 'Absent') {
        summary.absent++;
      }
    }

    return summary;
  }, []);

  // Calculate person volunteering time stats
  const personVolunteeringTimeStats = useMemo(() => {
    let totalTimeSpentMinutes = 0;
    let totalExpectedMinutes = 0;
    let eventsWithTime = 0;
    let eventsWithExpectedTime = 0;

    personAttendanceRecords.forEach((record) => {
      // Skip excluded events
      if (personExcludedEventIds.has(record.eventId)) return;
      
      // Skip absent records
      if (record.status === 'Absent') return;

      // Calculate time spent
      const timeSpent = calculateDurationMinutes(record.timeIn, record.timeOut);
      if (timeSpent > 0) {
        totalTimeSpentMinutes += timeSpent;
        eventsWithTime++;
      }

      // Calculate expected time from event StartTime to EndTime
      const eventData = events.find(e => e.EventID === record.eventId);
      if (eventData?.StartTime && eventData?.EndTime) {
        const expectedTime = calculateDurationMinutes(eventData.StartTime, eventData.EndTime);
        if (expectedTime > 0) {
          totalExpectedMinutes += expectedTime;
          eventsWithExpectedTime++;
        }
      }
    });

    const completionRate = totalExpectedMinutes > 0 
      ? (totalTimeSpentMinutes / totalExpectedMinutes) * 100 
      : 0;

    return {
      timeSpent: totalTimeSpentMinutes,
      timeSpentFormatted: formatMinutesToDuration(totalTimeSpentMinutes),
      expectedTime: totalExpectedMinutes,
      expectedTimeFormatted: formatMinutesToDuration(totalExpectedMinutes),
      completionRate: Math.min(completionRate, 999),
      eventsWithTime,
      eventsWithExpectedTime,
    };
  }, [personAttendanceRecords, personExcludedEventIds, events]);

  // ============= MODAL STATE TRACKING FOR CHATBOT VISIBILITY =============
  // Track when any modal is open and notify parent to hide chatbot
  const isAnyDashboardModalOpen =
    showModal ||
    showExportPreview ||
    showPersonAttendanceModal ||
    showRankingsModal;

  useEffect(() => {
    onModalStateChange?.(isAnyDashboardModalOpen);
  }, [isAnyDashboardModalOpen, onModalStateChange]);

  // Close person search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (personSearchRef.current && !personSearchRef.current.contains(e.target as Node)) {
        setShowPersonDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch person attendance records when a person is selected
  useEffect(() => {
    const loadPersonAttendance = async () => {
      if (!selectedPerson) {
        setPersonAttendanceRecords([]);
        setPersonExcludedEventIds(new Set()); // Clear excluded events when person changes
        return;
      }

      setIsLoadingPersonAttendance(true);
      setPersonExcludedEventIds(new Set()); // Clear excluded events for new person
      try {
        const records = await getMemberAttendanceHistory(selectedPerson.id, 100);
        setPersonAttendanceRecords(records);
      } catch (error) {
        console.error('Error fetching person attendance:', error);
        toast.error('Failed to load attendance records');
        setPersonAttendanceRecords([]);
      } finally {
        setIsLoadingPersonAttendance(false);
      }
    };

    loadPersonAttendance();
  }, [selectedPerson]);

  // Fetch events on mount
  useEffect(() => {
    const loadEvents = async () => {
      setIsLoadingEvents(true);
      try {
        const fetchedEvents = await fetchEventsSafe();
        // Filter to only show Active or Scheduled events
        const activeEvents = fetchedEvents.filter(
          (e) => e.Status === 'Active' || e.Status === 'Scheduled' || e.Status === 'Completed'
        );
        setEvents(activeEvents);
      } catch (error) {
        console.error('Error fetching events:', error);
        toast.error('Failed to load events');
      } finally {
        setIsLoadingEvents(false);
      }
    };

    const loadMembers = async () => {
      setIsLoadingMembers(true);
      try {
        const members = await getMembersForAttendance('', 500);
        setAllMembers(members);
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    loadEvents();
    loadMembers();
  }, []);

  // Get effective selected events - now simply returns selectedEventIds
  const getEffectiveSelectedEvents = useCallback(() => {
    return selectedEventIds;
  }, [selectedEventIds]);

  // Fetch attendance records based on selection
  useEffect(() => {
    const loadAttendance = async () => {
      const effectiveEvents = selectedEventIds;
      
      if (effectiveEvents.length === 0) {
        setAttendanceRecords([]);
        setMultiEventRecords(new Map());
        return;
      }

        setIsLoadingAttendance(true);
        try {
          if (effectiveEvents.length === 1) {
          const records = await fetchAttendanceRecordsDeduped(effectiveEvents[0]);
           setAttendanceRecords(records);
           setMultiEventRecords(new Map([[effectiveEvents[0], records]]));
         } else {
           // Load attendance for multiple events in PARALLEL for better performance
           const recordsPromises = effectiveEvents.map(eventId => 
            fetchAttendanceRecordsDeduped(eventId).then(records => ({ eventId, records }))
           );
          
          const results = await Promise.all(recordsPromises);
          
          const recordsMap = new Map<string, AttendanceRecord[]>();
          const allRecords: AttendanceRecord[] = [];
          
          for (const { eventId, records } of results) {
            recordsMap.set(eventId, records);
            allRecords.push(...records);
          }
          
          setMultiEventRecords(recordsMap);
          setAttendanceRecords(allRecords);
        }
      } catch (error) {
        console.error('Error fetching attendance records:', error);
        toast.error('Failed to load attendance records');
        setAttendanceRecords([]);
        setMultiEventRecords(new Map());
      } finally {
        setIsLoadingAttendance(false);
      }
    };

    loadAttendance();
  }, [fetchAttendanceRecordsDeduped, selectedEventIds]);

  // Fetch attendance records for rankings modal (loads ALL events data)
  useEffect(() => {
    const loadRankingsAttendance = async () => {
      if (!showRankingsModal || events.length === 0) return;
      
      setIsLoadingRankingsData(true);
      try {
        // Load attendance for all events (limit to first 50 events for performance)
        const eventsToLoad = events.slice(0, 50);
        const cachedRecords = eventsToLoad.flatMap((event) => attendanceCacheRef.current.get(event.EventID) || []);
        const missingEvents = eventsToLoad.filter((event) => !attendanceCacheRef.current.has(event.EventID));
        const recordsPromises = missingEvents.map((event) =>
          fetchAttendanceRecordsDeduped(event.EventID).catch(() => [] as AttendanceRecord[])
        );
        
        const allResults = await Promise.all(recordsPromises);
        const allRecords: AttendanceRecord[] = [...cachedRecords];
        allResults.forEach(records => {
          allRecords.push(...records);
        });
        
        setRankingsAttendanceRecords(allRecords);
      } catch (error) {
        console.error('Error fetching rankings attendance records:', error);
      } finally {
        setIsLoadingRankingsData(false);
      }
    };

    loadRankingsAttendance();
  }, [events, fetchAttendanceRecordsDeduped, showRankingsModal]);

  // Determine recommended chart type based on selection
  const getRecommendedChartType = useCallback((): "pie" | "donut" | "bar" | "line" | "column" => {
    const effectiveEvents = getEffectiveSelectedEvents();
    
    if (effectiveEvents.length === 0) return 'pie';
    if (effectiveEvents.length === 1) return 'column'; // Single event: column chart recommended
    if (effectiveEvents.length <= 5) return 'bar'; // Few events: bar chart
    return 'line'; // Many events: line chart for trends
  }, [getEffectiveSelectedEvents]);

  // Update chatbot context when data changes - debounced for performance
  useEffect(() => {
    if (!onDashboardContextUpdate) return;
    
    // Debounce context updates to prevent excessive re-renders
    const timeoutId = setTimeout(() => {
      const currentEffectiveEvents = getEffectiveSelectedEvents();
      if (currentEffectiveEvents.length === 0) {
        onDashboardContextUpdate(null);
        return;
      }

      const filtered = getFilteredAttendance();
      const currentNotRecordedMembers = getNotRecordedMembers();
      const { present, late, excused, absent } = summarizeAttendanceRecords(filtered);
      const totalRecorded = present + late + excused + absent;

      const context: AttendanceDashboardContext = {
        mode: selectedEventIds.length <= 1 ? 'single' : 'multiple',
        selectedEvents: currentEffectiveEvents,
        dateRange: null,
        totalEvents: events.length,
        statistics: {
          totalRecords: totalRecorded,
          present,
          late,
          excused,
          absent,
          notRecorded: currentNotRecordedMembers.length,
          attendanceRate: allMembers.length > 0 ? Math.round(((present + late) / allMembers.length) * 100) : 0,
        },
        eventDetails: currentEffectiveEvents.map(eventId => {
          const event = events.find(e => e.EventID === eventId);
          const eventRecords = multiEventRecords.get(eventId) || [];
          return {
            id: eventId,
            title: event?.Title || 'Unknown',
            date: event?.StartDate ? formatDateValue(event.StartDate) : '-',
            status: event?.Status || '-',
            present: eventRecords.filter(r => r.status === 'Present' || r.status === 'CheckedIn' || r.status === 'CheckedOut').length,
            late: eventRecords.filter(r => r.status === 'Late').length,
            excused: eventRecords.filter(r => r.status === 'Excused').length,
            absent: eventRecords.filter(r => r.status === 'Absent').length,
          };
        }),
        recommendedChartType: getRecommendedChartType(),
      };

      onDashboardContextUpdate(context);
    }, 150); // 150ms debounce

    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventIds, events, attendanceRecords, multiEventRecords, allMembers, onDashboardContextUpdate, getEffectiveSelectedEvents, getRecommendedChartType]);

  // Create a Map for O(1) member lookups instead of O(n) find() calls
  const memberLookupMap = useMemo(() => {
    const map = new Map<string, MemberForAttendance>();
    allMembers.forEach(member => map.set(member.id, member));
    return map;
  }, [allMembers]);

  const eventsLookupMap = useMemo(() => {
    const map = new Map<string, EventData>();
    events.forEach((event) => map.set(event.EventID, event));
    return map;
  }, [events]);

  // ============= PERSON SEARCH HELPERS =============
  // Filtered members for person search dropdown
  const filteredMembersForSearch = useMemo(() => {
    if (!personSearchQuery.trim()) return allMembers.slice(0, 8);
    const query = personSearchQuery.toLowerCase().trim();
    return allMembers.filter(m =>
      m.name.toLowerCase().includes(query) ||
      m.committee?.toLowerCase().includes(query) ||
      m.position?.toLowerCase().includes(query)
    ).slice(0, 10);
  }, [personSearchQuery, allMembers]);

  // Handle selecting a person from search
  const handleSelectPerson = useCallback((member: MemberForAttendance) => {
    setSelectedPerson(member);
    setPersonSearchQuery(member.name);
    setShowPersonDropdown(false);
  }, []);

  // Clear selected person
  const handleClearPerson = useCallback(() => {
    setSelectedPerson(null);
    setPersonSearchQuery("");
    setPersonAttendanceRecords([]);
  }, []);

  // Get initials for avatar
  const getInitials = useCallback((name: string) => {
    if (!name) return '?';
    const words = name.split(' ').filter(p => p.length > 0);
    if (words.length === 0) return '?';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }, []);

  // Get status color
  const getStatusColor = useCallback((status: string) => {
    const normalized = status?.toLowerCase() || 'absent';
    switch (normalized) {
      case 'present':
      case 'checkedin':
      case 'checkedout':
        return '#10b981';
      case 'late':
        return '#f59e0b';
      case 'excused':
        return '#3b82f6';
      case 'absent':
      default:
        return '#ef4444';
    }
  }, []);

  // Get status label
  const getStatusLabel = useCallback((status: string) => {
    const normalized = status?.toLowerCase() || 'absent';
    switch (normalized) {
      case 'present':
      case 'checkedin':
      case 'checkedout':
        return 'Present';
      case 'late':
        return 'Late';
      case 'excused':
        return 'Excused';
      case 'absent':
      default:
        return 'Absent';
    }
  }, []);

  // Calculate person attendance stats
  const personAttendanceStats = useMemo(() => {
    const present = personAttendanceRecords.filter(r => 
      r.status === 'Present' || r.status === 'CheckedIn' || r.status === 'CheckedOut'
    ).length;
    const late = personAttendanceRecords.filter(r => r.status === 'Late').length;
    const excused = personAttendanceRecords.filter(r => r.status === 'Excused').length;
    const absent = personAttendanceRecords.filter(r => r.status === 'Absent').length;
    const total = personAttendanceRecords.length;
    const attendanceRate = total > 0 ? ((present + late) / total) * 100 : 0;
    return { present, late, excused, absent, total, attendanceRate };
  }, [personAttendanceRecords]);

  // Helper to check if member matches committee filter - memoized for reuse
  const matchesCommitteeFilter = useCallback((member: MemberForAttendance | undefined): boolean => {
    if (!member) return false;
    if (selectedCommittee === "All") return true;

    const normalizedMemberCommittee = (member.committee || "").toLowerCase().trim();
    const normalizedSelectedCommittee = selectedCommittee.toLowerCase().trim();

    if (normalizedSelectedCommittee === "general members") {
      return !normalizedMemberCommittee || normalizedMemberCommittee.includes("general");
    }

    return normalizedMemberCommittee === normalizedSelectedCommittee;
  }, [selectedCommittee]);

  // ============= PERCENTAGE-BASED RANKINGS FOR RANKINGS MODAL =============
  interface PercentageRankedMember {
    member: MemberForAttendance;
    completionRate: number; // 0-100 (time-based completion rate)
    eventsAttended: number;
    totalEvents: number;
    rank: number;
    totalParticipationMinutes: number;
    totalExpectedMinutes: number;
    totalParticipationFormatted: string;
  }

  const percentageRankings = useMemo((): PercentageRankedMember[] => {
    // Determine which events to consider based on filter type
    let eventsToConsider: EventData[] = [];
    
    if (rankingsFilterType === 'all') {
      eventsToConsider = events;
    } else if (rankingsFilterType === 'events') {
      eventsToConsider = events.filter(e => rankingsSelectedEventIds.includes(e.EventID));
    } else {
      eventsToConsider = events; // Will filter members by committee instead
    }
    
    if (eventsToConsider.length === 0) return [];
    
    const eventIds = new Set(eventsToConsider.map(e => e.EventID));
    
    // Calculate expected duration for each event
    const eventExpectedMinutesMap = new Map<string, number>();
    eventsToConsider.forEach(event => {
      if (event.StartTime && event.EndTime) {
        const expectedMins = calculateDurationMinutes(event.StartTime, event.EndTime);
        eventExpectedMinutesMap.set(event.EventID, expectedMins > 0 ? expectedMins : 0);
      }
    });
    
    // Calculate total expected minutes across all events
    const totalExpectedMinutesAll = Array.from(eventExpectedMinutesMap.values()).reduce((sum, mins) => sum + mins, 0);
    
    // Build attendance records map filtered by selected events
    const memberStatsMap = new Map<string, { 
      attended: number; 
      totalMinutes: number;
      expectedMinutes: number;
      member: MemberForAttendance;
    }>();
    
    // Use rankings-specific attendance records if available, otherwise fall back to main attendance records
    const sourceRecords = rankingsAttendanceRecords.length > 0 ? rankingsAttendanceRecords : attendanceRecords;
    
    // Filter attendance records by selected events
    const relevantRecords = sourceRecords.filter(r => eventIds.has(r.eventId));
    
    relevantRecords.forEach(record => {
      // Skip absent records for attendance count
      const isAttended = record.status !== 'Absent';
      const timeSpent = isAttended ? calculateDurationMinutes(record.timeIn, record.timeOut) : 0;
      const eventExpected = eventExpectedMinutesMap.get(record.eventId) || 0;
      
      const member = memberLookupMap.get(record.memberId);
      if (!member) return;
      
      // Apply committee filter if needed
      if (rankingsFilterType === 'committee' && rankingsSelectedCommittee !== 'All') {
        const memberCommittee = (member.committee || '').toLowerCase().trim();
        const selectedComm = rankingsSelectedCommittee.toLowerCase().trim();
        if (selectedComm === 'general members') {
          if (memberCommittee && !memberCommittee.includes('general')) return;
        } else if (memberCommittee !== selectedComm) {
          return;
        }
      }
      
      const existing = memberStatsMap.get(record.memberId);
      if (existing) {
        if (isAttended) {
          existing.attended += 1;
          existing.totalMinutes += timeSpent > 0 ? timeSpent : 0;
          existing.expectedMinutes += eventExpected;
        }
      } else {
        memberStatsMap.set(record.memberId, {
          attended: isAttended ? 1 : 0,
          totalMinutes: timeSpent > 0 ? timeSpent : 0,
          expectedMinutes: isAttended ? eventExpected : 0,
          member,
        });
      }
    });
    
    // Also include members with 0 attendance if showing all
    if (rankingsFilterType === 'all' || rankingsFilterType === 'committee') {
      allMembers.forEach(member => {
        if (!memberStatsMap.has(member.id)) {
          // Apply committee filter
          if (rankingsFilterType === 'committee' && rankingsSelectedCommittee !== 'All') {
            const memberCommittee = (member.committee || '').toLowerCase().trim();
            const selectedComm = rankingsSelectedCommittee.toLowerCase().trim();
            if (selectedComm === 'general members') {
              if (memberCommittee && !memberCommittee.includes('general')) return;
            } else if (memberCommittee !== selectedComm) {
              return;
            }
          }
          memberStatsMap.set(member.id, {
            attended: 0,
            totalMinutes: 0,
            expectedMinutes: 0,
            member,
          });
        }
      });
    }
    
    // Convert to rankings array
    const totalEvents = eventsToConsider.length;
    const rankings: PercentageRankedMember[] = [];
    
    memberStatsMap.forEach((data) => {
      // Calculate completion rate based on time spent vs TOTAL expected time from ALL events
      // This ensures members who attend more events rank higher (e.g., 4/4 events > 2/4 events)
      const completionRate = totalExpectedMinutesAll > 0 
        ? Math.min((data.totalMinutes / totalExpectedMinutesAll) * 100, 100) // Cap at 100%
        : 0;
      
      rankings.push({
        member: data.member,
        completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
        eventsAttended: data.attended,
        totalEvents,
        rank: 0,
        totalParticipationMinutes: data.totalMinutes,
        totalExpectedMinutes: totalExpectedMinutesAll,
        totalParticipationFormatted: formatMinutesToDuration(data.totalMinutes),
      });
    });
    
    // Sort by total participation time descending (this naturally ranks by actual contribution)
    // Since completionRate is now based on totalExpectedMinutesAll, sorting by time is equivalent
    rankings.sort((a, b) => {
      // Primary: Sort by total participation time (more time = higher rank)
      if (b.totalParticipationMinutes !== a.totalParticipationMinutes) {
        return b.totalParticipationMinutes - a.totalParticipationMinutes;
      }
      // Secondary: By events attended as tiebreaker
      return b.eventsAttended - a.eventsAttended;
    });
    
    // Assign ranks (handle ties - same participation time = same rank)
    let currentRank = 1;
    rankings.forEach((item, index) => {
      if (index > 0 && item.totalParticipationMinutes < rankings[index - 1].totalParticipationMinutes) {
        currentRank = index + 1;
      }
      item.rank = currentRank;
    });
    
    return rankings;
  }, [rankingsFilterType, rankingsSelectedEventIds, rankingsSelectedCommittee, events, attendanceRecords, rankingsAttendanceRecords, memberLookupMap, allMembers]);

  const RANKINGS_PAGE_SIZE = 10;
  const rankingsTotalPages = Math.max(1, Math.ceil(percentageRankings.length / RANKINGS_PAGE_SIZE));
  const paginatedRankings = useMemo(() => {
    const startIndex = (rankingsPage - 1) * RANKINGS_PAGE_SIZE;
    return percentageRankings.slice(startIndex, startIndex + rankingsVisibleRows);
  }, [percentageRankings, rankingsPage, rankingsVisibleRows]);

  useEffect(() => {
    setRankingsPage(1);
    setRankingsVisibleRows(Math.min(5, RANKINGS_PAGE_SIZE));
  }, [showRankingsModal, rankingsFilterType, rankingsSelectedCommittee, rankingsSelectedEventIds, percentageRankings.length]);

  useEffect(() => {
    if (rankingsPage > rankingsTotalPages) {
      setRankingsPage(rankingsTotalPages);
    }
  }, [rankingsPage, rankingsTotalPages]);

  // Export rankings to PDF - Universal format with header and footer
  const exportRankingsToPDF = useCallback(async () => {
    if (percentageRankings.length === 0) {
      toast.error('No rankings to export');
      return;
    }

    const { JsPDF, autoTable } = await loadPdfTools();
    
    const doc = new JsPDF('portrait', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const generatedTimestamp = new Date().toLocaleString();

    // Helper function to draw page footer
    const drawFooter = (pageNum: number, totalPages: number) => {
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.5);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
      
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`${ORG_NAME} - ${ORG_CHAPTER}`, margin, pageHeight - 10);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text(`"${ORG_MOTTO}"`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    };

    // Load logo and draw header
    let logoLoaded = false;
    try {
      const logoImg = await loadImage(ORG_LOGO_URL);
      // Orange header bar
      doc.setFillColor(246, 66, 31);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      // Logo with white circular background
      const logoSize = 30;
      const logoX = margin;
      const logoY = 7.5;
      doc.setFillColor(255, 255, 255);
      doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2, 'F');
      doc.addImage(logoImg, 'PNG', logoX, logoY, logoSize, logoSize);
      logoLoaded = true;
    } catch {
      // Draw header without logo
      doc.setFillColor(246, 66, 31);
      doc.rect(0, 0, pageWidth, 45, 'F');
    }

    // Organization name and title in header
    doc.setTextColor(255, 255, 255);
    const orgNameX = logoLoaded ? margin + 35 : margin;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(ORG_NAME, orgNameX, 18);
    doc.setFontSize(12);
    doc.text(ORG_CHAPTER, orgNameX, 26);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('ATTENDANCE RANKINGS REPORT', orgNameX, 35);
    doc.setFontSize(8);
    doc.text(`Generated: ${generatedTimestamp}`, pageWidth - margin, 35, { align: 'right' });

    let yPosition = 52;

    // Divider line
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;

    // Filter information section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('FILTER DETAILS', margin, yPosition);
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition + 2, margin + 35, yPosition + 2);
    yPosition += 10;

    // Filter details card
    doc.setDrawColor(230, 230, 230);
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 22, 3, 3, 'FD');
    
    let filterDesc = '';
    if (rankingsFilterType === 'all') {
      filterDesc = `All Events (${events.length} total)`;
    } else if (rankingsFilterType === 'events') {
      filterDesc = `Selected Events (${rankingsSelectedEventIds.length} of ${events.length})`;
    } else {
      filterDesc = `Committee: ${rankingsSelectedCommittee}`;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('Filter Type:', margin + 8, yPosition + 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(filterDesc, margin + 35, yPosition + 8);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 100);
    doc.text('Total Ranked:', margin + 8, yPosition + 16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(`${percentageRankings.length} members`, margin + 35, yPosition + 16);

    yPosition += 30;

    // ===== COMMITTEE RANKINGS SECTION =====
    // Calculate committee statistics
    const committeeStatsMap = new Map<string, { totalMinutes: number; memberCount: number }>();
    percentageRankings.forEach((r) => {
      const committee = r.member.committee || 'General';
      const existing = committeeStatsMap.get(committee);
      if (existing) {
        existing.totalMinutes += r.totalParticipationMinutes;
        existing.memberCount += 1;
      } else {
        committeeStatsMap.set(committee, { 
          totalMinutes: r.totalParticipationMinutes, 
          memberCount: 1 
        });
      }
    });

    // Calculate average completion rate per committee
    interface CommitteeRanking {
      name: string;
      avgCompletionRate: number;
      totalMinutes: number;
      memberCount: number;
      rank: number;
    }

    const totalExpectedAll = percentageRankings.length > 0 ? percentageRankings[0].totalExpectedMinutes : 0;
    const committeeRankings: CommitteeRanking[] = [];
    
    committeeStatsMap.forEach((stats, committeeName) => {
      // Average completion rate = (total minutes of all members / (expected * member count)) * 100
      const avgCompletionRate = totalExpectedAll > 0 && stats.memberCount > 0
        ? Math.min((stats.totalMinutes / (totalExpectedAll * stats.memberCount)) * 100, 100)
        : 0;
      
      committeeRankings.push({
        name: committeeName,
        avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
        totalMinutes: stats.totalMinutes,
        memberCount: stats.memberCount,
        rank: 0,
      });
    });

    // Sort by average completion rate descending
    committeeRankings.sort((a, b) => {
      if (b.avgCompletionRate !== a.avgCompletionRate) {
        return b.avgCompletionRate - a.avgCompletionRate;
      }
      return b.totalMinutes - a.totalMinutes;
    });

    // Assign ranks (handle ties - same rate = same rank)
    let committeeRank = 1;
    committeeRankings.forEach((item, index) => {
      if (index > 0 && item.avgCompletionRate < committeeRankings[index - 1].avgCompletionRate) {
        committeeRank = index + 1;
      }
      item.rank = committeeRank;
    });

    // Draw Committee Rankings Section
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('COMMITTEE RANKINGS', margin, yPosition);
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition + 2, margin + 50, yPosition + 2);
    yPosition += 8;

    // Committee rankings table - use average time per member
    const committeeTableData = committeeRankings.map(c => [
      c.rank.toString(),
      c.name,
      `${c.avgCompletionRate.toFixed(2)}%`,
      c.memberCount.toString(),
      formatMinutesToDuration(Math.round(c.totalMinutes / c.memberCount)), // Average per member
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Rank', 'Committee', 'Avg Completion', 'Members', 'Avg Time/Member']],
      body: committeeTableData,
      theme: 'striped',
      margin: { left: margin, right: margin, bottom: 25 },
      headStyles: {
        fillColor: [59, 130, 246], // Blue for committees
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 30, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 30, halign: 'center' },
      },
      didParseCell: (data) => {
        // Highlight top 3 committees
        if (data.section === 'body' && data.row.index < committeeRankings.length) {
          const rank = committeeRankings[data.row.index].rank;
          if (rank === 1) {
            data.cell.styles.fillColor = [255, 215, 0]; // Gold
            data.cell.styles.textColor = [0, 0, 0];
            data.cell.styles.fontStyle = 'bold';
          } else if (rank === 2) {
            data.cell.styles.fillColor = [192, 192, 192]; // Silver
            data.cell.styles.textColor = [0, 0, 0];
          } else if (rank === 3) {
            data.cell.styles.fillColor = [205, 127, 50]; // Bronze
            data.cell.styles.textColor = [255, 255, 255];
          }
        }
      },
    });

    yPosition = (((doc as JsPdfWithAutoTable).lastAutoTable?.finalY) ?? yPosition) + 10;

    // ===== NEW PAGE FOR MEMBER RANKINGS =====
    doc.addPage();
    yPosition = 20;

    // Member Rankings Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('MEMBER RANKINGS', margin, yPosition);
    doc.setDrawColor(246, 66, 31);
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition + 2, margin + 45, yPosition + 2);
    yPosition += 8;

    // Table data
    const tableData = percentageRankings.map(r => [
      r.rank.toString(),
      r.member.name,
      r.member.committee || 'General',
      `${r.completionRate.toFixed(2)}%`,
      `${r.eventsAttended} / ${r.totalEvents}`,
      r.totalParticipationFormatted || '-',
    ]);
    
    autoTable(doc, {
      startY: yPosition,
      head: [['Rank', 'Name', 'Committee', 'Completion', 'Attended', 'Time']],
      body: tableData,
      theme: 'striped',
      margin: { left: margin, right: margin, bottom: 25 },
      headStyles: {
        fillColor: [246, 66, 31], // Brand orange
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 50 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25, halign: 'center' },
        4: { cellWidth: 25, halign: 'center' },
        5: { cellWidth: 25, halign: 'center' },
      },
      didParseCell: (data) => {
        // Highlight top 3
        if (data.section === 'body' && data.row.index < 3) {
          const rank = parseInt(tableData[data.row.index][0]);
          if (rank === 1) {
            data.cell.styles.fillColor = [255, 215, 0]; // Gold
            data.cell.styles.textColor = [0, 0, 0];
            data.cell.styles.fontStyle = 'bold';
          } else if (rank === 2) {
            data.cell.styles.fillColor = [192, 192, 192]; // Silver
            data.cell.styles.textColor = [0, 0, 0];
          } else if (rank === 3) {
            data.cell.styles.fillColor = [205, 127, 50]; // Bronze
            data.cell.styles.textColor = [255, 255, 255];
          }
        }
      },
    });

    // Add footer to all pages
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      drawFooter(i, totalPages);
    }
    
    // Save
    const filename = `Attendance_Rankings_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    toast.success('Rankings exported to PDF');
  }, [percentageRankings, rankingsFilterType, rankingsSelectedEventIds, rankingsSelectedCommittee, events]);

  // Get members who were not recorded in attendance
  const notRecordedMembersMemo = useMemo((): MemberForAttendance[] => {
    const recordedMemberIds = new Set(attendanceRecords.map(r => r.memberId));
    
    return allMembers.filter(member => 
      !recordedMemberIds.has(member.id) && matchesCommitteeFilter(member)
    );
  }, [attendanceRecords, allMembers, matchesCommitteeFilter]);

  // Filter attendance by committee - optimized with Map lookup
  const filteredAttendanceMemo = useMemo(() => {
    if (selectedCommittee === "All") {
      return attendanceRecords;
    }

    return attendanceRecords.filter((record) => {
      const member = memberLookupMap.get(record.memberId);
      return matchesCommitteeFilter(member);
    });
  }, [attendanceRecords, memberLookupMap, selectedCommittee, matchesCommitteeFilter]);

  const filteredAttendanceSummary = useMemo(
    () => summarizeAttendanceRecords(filteredAttendanceMemo),
    [filteredAttendanceMemo, summarizeAttendanceRecords]
  );

  const attendanceDataMemo = useMemo(() => {
    return [
      { name: "Present", value: filteredAttendanceSummary.present, color: "#10b981" },
      { name: "Late", value: filteredAttendanceSummary.late, color: "#f59e0b" },
      { name: "Excused", value: filteredAttendanceSummary.excused, color: "#3b82f6" },
      { name: "Absent", value: filteredAttendanceSummary.absent, color: "#ef4444" },
    ].filter((item) => item.value > 0);
  }, [filteredAttendanceSummary]);

  const multiEventChartDataMemo = useMemo(() => {
    return selectedEventIds.map(eventId => {
      const event = eventsLookupMap.get(eventId);
      const eventRecords = multiEventRecords.get(eventId) || [];
      const summary = summarizeAttendanceRecords(eventRecords);
      
      return {
        event: event?.Title?.substring(0, 15) || 'Unknown',
        fullTitle: event?.Title || 'Unknown',
        date: event?.StartDate ? formatDateValue(event.StartDate) : '-',
        Present: summary.present,
        Late: summary.late,
        Excused: summary.excused,
        Absent: summary.absent,
        Total: summary.present + summary.late + summary.excused + summary.absent,
      };
    });
  }, [eventsLookupMap, multiEventRecords, selectedEventIds, summarizeAttendanceRecords]);

  const columnChartDataMemo = useMemo(() => {
    return [
      { status: 'Present', count: filteredAttendanceSummary.present, color: '#10b981' },
      { status: 'Late', count: filteredAttendanceSummary.late, color: '#f59e0b' },
      { status: 'Excused', count: filteredAttendanceSummary.excused, color: '#3b82f6' },
      { status: 'Absent', count: filteredAttendanceSummary.absent, color: '#ef4444' },
    ];
  }, [filteredAttendanceSummary]);

  const getNotRecordedMembers = useCallback(() => notRecordedMembersMemo, [notRecordedMembersMemo]);

  const getFilteredAttendance = useCallback(() => filteredAttendanceMemo, [filteredAttendanceMemo]);

  // Calculate attendance data for charts
  const getAttendanceData = useCallback(() => attendanceDataMemo, [attendanceDataMemo]);

  // Calculate bar chart data by committee - optimized with Map lookup
  const getBarChartData = useCallback(() => {
    const committeeData: Record<string, { Present: number; Late: number; Excused: number; Absent: number }> = {};

    attendanceRecords.forEach((record) => {
      const member = memberLookupMap.get(record.memberId);
      const committee = member?.committee || 'Unknown';
      
      // Abbreviate committee name for chart
      const shortName = committee.split(' ').slice(0, 2).join(' ').substring(0, 15);

      if (!committeeData[shortName]) {
        committeeData[shortName] = { Present: 0, Late: 0, Excused: 0, Absent: 0 };
      }

      if (record.status === 'Present' || record.status === 'CheckedIn' || record.status === 'CheckedOut') {
        committeeData[shortName].Present++;
      } else if (record.status === 'Late') {
        committeeData[shortName].Late++;
      } else if (record.status === 'Excused') {
        committeeData[shortName].Excused++;
      } else if (record.status === 'Absent') {
        committeeData[shortName].Absent++;
      }
    });

    return Object.entries(committeeData).map(([committee, data]) => ({
      committee,
      ...data,
    }));
  }, [attendanceRecords, memberLookupMap]);

  // Calculate multi-event chart data (for line/bar across events)
  const getMultiEventChartData = useCallback(() => multiEventChartDataMemo, [multiEventChartDataMemo]);

  // Get column chart data for single event (status distribution)
  const getColumnChartData = useCallback(() => columnChartDataMemo, [columnChartDataMemo]);

  // Get members by status for modal - optimized with Map lookup, includes external/late flags
  const getMembersByStatus = useCallback((status: string): ModalMemberData[] => {
    if (status === 'Not Recorded') {
      return getNotRecordedMembers();
    }
    
    const filtered = getFilteredAttendance();
    const statusMembers = filtered.filter((r) => {
      if (status === 'Present') {
        return r.status === 'Present' || r.status === 'CheckedIn' || r.status === 'CheckedOut';
      }
      return r.status === status;
    });

    return statusMembers.map((r) => {
      const member = memberLookupMap.get(r.memberId);
      const baseMember = member || { id: r.memberId, name: r.memberName, committee: '', position: '' };
      return {
        ...baseMember,
        isExternal: r.isExternal,
        lateTimeIn: r.lateTimeIn,
        lateTimeOut: r.lateTimeOut,
      };
    });
  }, [getFilteredAttendance, memberLookupMap, getNotRecordedMembers]);

  // Memoized chart click handler
  const handleChartClick = useCallback((data: { name?: string; status?: string }) => {
    const status = data.name ?? data.status;
    if (!status) return;
    const members = getMembersByStatus(status);
    setModalData({ status, members });
    setShowModal(true);
  }, [getMembersByStatus]);

  // Memoized stat card click handlers for performance
  const handleStatCardClick = useCallback((status: string) => {
    const members = getMembersByStatus(status);
    setModalData({ status, members });
    setShowModal(true);
  }, [getMembersByStatus]);

  // Handle export with preview
  const handleExportWithPreview = (format: 'pdf' | 'spreadsheet') => {
    if (attendanceRecords.length === 0) {
      toast.error("No attendance data to export");
      return;
    }
    setExportFormat(format);
    setExportModalTab('preview');
    setShowExportPreview(true);
    
    // Auto-generate preview for PDF
    if (format === 'pdf') {
      generatePDFPreview();
    }
  };

  // Cleanup PDF preview URL when modal closes
  const handleCloseExportModal = () => {
    setShowExportPreview(false);
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
  };

  // Generate PDF preview (returns blob URL for iframe display)
  const generatePDFPreview = async () => {
    if (attendanceRecords.length === 0) return;
    
    setIsGeneratingPreview(true);
    
    // Revoke previous URL if exists
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    
    try {
      const { JsPDF, autoTable } = await loadPdfTools();
      const doc = new JsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const generatedTimestamp = new Date().toLocaleString();
      const orgMotto = "Shaping the Future to a Greater Society";

      // Helper function to draw page footer
      const drawFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(246, 66, 31);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('Youth Service Philippines - Tagum Chapter', margin, pageHeight - 10);
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text(`"${orgMotto}"`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      };

      // Load logo
      let logoLoaded = false;
      try {
        const logoImg = await loadImage(ORG_LOGO_URL);
        doc.setFillColor(246, 66, 31);
        doc.rect(0, 0, pageWidth, 45, 'F');
        
        const logoSize = 30;
        const logoX = margin;
        const logoY = 7.5;
        
        doc.setFillColor(255, 255, 255);
        doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2, 'F');
        doc.addImage(logoImg, 'PNG', logoX, logoY, logoSize, logoSize);
        logoLoaded = true;
      } catch {
        doc.setFillColor(246, 66, 31);
        doc.rect(0, 0, pageWidth, 45, 'F');
      }

      // Organization name
      doc.setTextColor(255, 255, 255);
      const orgNameX = logoLoaded ? margin + 35 : margin;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(ORG_NAME, orgNameX, 18);
      doc.setFontSize(12);
      doc.text(ORG_CHAPTER, orgNameX, 26);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('ATTENDANCE REPORT', orgNameX, 35);
      doc.setFontSize(8);
      doc.text(`Generated: ${generatedTimestamp}`, pageWidth - margin, 35, { align: 'right' });

      // Get current event info
      const currentEvent = effectiveEvents.length === 1 
        ? events.find(e => e.EventID === effectiveEvents[0]) 
        : null;
      
      let yPosition = 52;

      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // EVENT DETAILS Section
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('EVENT DETAILS', margin, yPosition);
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.3);
      doc.line(margin, yPosition + 2, margin + 35, yPosition + 2);
      yPosition += 10;

      // Event details card
      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(252, 252, 252);
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 32, 3, 3, 'FD');
      
      const cardContentY = yPosition + 6;
      const labelX = margin + 8;
      const valueX = margin + 40;
      const lineSpacing = 7;
      
      const drawField = (label: string, value: string, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`${label}:`, labelX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(value, valueX, y);
      };
      
      if (effectiveEvents.length === 1 && currentEvent) {
        drawField('Event Name', currentEvent.Title || 'N/A', cardContentY);
        drawField('Event Date', currentEvent.StartDate ? formatDateValue(currentEvent.StartDate) : '-', cardContentY + lineSpacing);
        const eventTimeValue = currentEvent.StartTime 
          ? `${formatTimeValue(currentEvent.StartTime)}${currentEvent.EndTime ? ' - ' + formatTimeValue(currentEvent.EndTime) : ''}`
          : '-';
        drawField('Event Time', eventTimeValue, cardContentY + lineSpacing * 2);
        drawField('Event Status', currentEvent.Status || 'N/A', cardContentY + lineSpacing * 3);
      } else {
        drawField('Selection', `${effectiveEvents.length} Events Selected`, cardContentY);
        drawField('Date Range', 'Multiple events', cardContentY + lineSpacing);
        drawField('Total Records', `${totalRecords} attendance records`, cardContentY + lineSpacing * 2);
        drawField('Filter', selectedCommittee, cardContentY + lineSpacing * 3);
      }
      
      yPosition += 40;

      // ATTENDANCE SUMMARY Section
      const filteredRecords = getFilteredAttendance();
      const actualAttendees = filteredRecords.filter(r => r.status === 'Present' || r.status === 'Late');
      const totalAttendees = actualAttendees.length;
      const totalMembers = allMembers.length;
      const overallPercentage = totalMembers > 0 ? Math.round((totalAttendees / totalMembers) * 100) : 0;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('ATTENDANCE SUMMARY', margin, yPosition);
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.3);
      doc.line(margin, yPosition + 2, margin + 45, yPosition + 2);
      yPosition += 10;

      // Total Attendees Box
      const totalBoxWidth = pageWidth - 2 * margin;
      doc.setFillColor(246, 66, 31);
      doc.roundedRect(margin, yPosition, totalBoxWidth, 22, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('TOTAL ATTENDEES', margin + 10, yPosition + 10);
      doc.setFontSize(20);
      doc.text(`${totalAttendees}/${totalMembers}`, totalBoxWidth - 10, yPosition + 14, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${overallPercentage}% attendance rate`, totalBoxWidth - 10, yPosition + 19, { align: 'right' });
      yPosition += 28;

      // Status boxes
      const statusBoxWidth = (pageWidth - 2 * margin - 9) / 4;
      const statusBoxHeight = 20;
      const presentCount = attendanceData.find(d => d.name === 'Present')?.value || 0;
      const lateCount = attendanceData.find(d => d.name === 'Late')?.value || 0;
      const excusedCount = attendanceData.find(d => d.name === 'Excused')?.value || 0;
      const absentCount = attendanceData.find(d => d.name === 'Absent')?.value || 0;
      
      const statuses = [
        { name: 'PRESENT', color: [16, 185, 129], count: presentCount },
        { name: 'LATE', color: [245, 158, 11], count: lateCount },
        { name: 'EXCUSED', color: [59, 130, 246], count: excusedCount },
        { name: 'ABSENT', color: [239, 68, 68], count: absentCount },
      ];

      statuses.forEach((status, index) => {
        const boxX = margin + index * (statusBoxWidth + 3);
        doc.setFillColor(status.color[0], status.color[1], status.color[2]);
        doc.roundedRect(boxX, yPosition, statusBoxWidth, statusBoxHeight, 2, 2, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(String(status.count), boxX + statusBoxWidth / 2, yPosition + 9, { align: 'center' });
        
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(status.name, boxX + statusBoxWidth / 2, yPosition + 15, { align: 'center' });
      });
      
      yPosition += statusBoxHeight + 10;

      // Add tables based on export options
      if (exportOptions.selectedTables.length > 0) {
        doc.addPage();
        yPosition = 20;

        const createPreviewTableData = (records: typeof filteredRecords, startIndex: number = 1) => {
          return records.map((record, index) => {
            const member = allMembers.find(m => m.id === record.memberId);
            const noLogout = hasNoLogout(record.timeIn, record.timeOut, record.status);
            const duration = calculateAttendanceDuration(record.timeIn, record.timeOut);
            
            // Build status with indicators
            let statusDisplay: string = record.status;
            const indicators: string[] = [];
            if (record.isExternal) indicators.push('EXT');
            if (record.lateTimeIn) indicators.push('LATE-IN');
            if (record.lateTimeOut) indicators.push('LATE-OUT');
            if (indicators.length > 0) {
              statusDisplay = `${record.status} [${indicators.join(', ')}]`;
            }
            
            return {
              data: [
                String(startIndex + index),
                record.memberName || member?.name || 'Unknown',
                member?.committee || '-',
                member?.position || '-',
                statusDisplay,
                formatTimeValue(record.timeIn),
                noLogout ? 'NO LOGOUT' : formatTimeValue(record.timeOut),
                duration,
              ],
              noLogout,
              isExternal: record.isExternal || false,
            };
          });
        };

        const presentRecords = filteredRecords.filter(r => r.status === 'Present');
        const lateRecords = filteredRecords.filter(r => r.status === 'Late');
        const excusedRecords = filteredRecords.filter(r => r.status === 'Excused');
        const absentRecords = filteredRecords.filter(r => r.status === 'Absent');
        const notRecordedMembersList = getNotRecordedMembers();

        const tableConfigs = ([
          { key: 'all', title: 'ALL ATTENDEES', records: filteredRecords, color: [246, 66, 31] as [number, number, number] },
          { key: 'present', title: 'PRESENT', records: presentRecords, color: [16, 185, 129] as [number, number, number] },
          { key: 'late', title: 'LATE', records: lateRecords, color: [245, 158, 11] as [number, number, number] },
          { key: 'excused', title: 'EXCUSED', records: excusedRecords, color: [59, 130, 246] as [number, number, number] },
          { key: 'absent', title: 'ABSENT', records: absentRecords, color: [239, 68, 68] as [number, number, number] },
        ] satisfies { key: ExportTableKey; title: string; records: AttendanceRecord[]; color: [number, number, number] }[]).filter((config) =>
          exportOptions.selectedTables.includes(config.key)
        );

        for (const config of tableConfigs) {
          if (config.records.length === 0 && config.key !== 'all') continue;
          
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(`${config.title} (${config.records.length})`, margin, yPosition);
          doc.setDrawColor(config.color[0], config.color[1], config.color[2]);
          doc.setLineWidth(0.3);
          doc.line(margin, yPosition + 2, margin + 45, yPosition + 2);
          yPosition += 8;

          const tableData = createPreviewTableData(config.records);
          const noLogoutRows = new Set(tableData.map((row, idx) => row.noLogout ? idx : -1).filter(idx => idx >= 0));
          const externalRows = new Set(tableData.map((row, idx) => row.isExternal ? idx : -1).filter(idx => idx >= 0));

          autoTable(doc, {
            startY: yPosition,
            head: [['#', 'Name', 'Committee', 'Position', 'Status', 'Time In', 'Time Out', 'Duration']],
            body: tableData.length > 0 ? tableData.map(row => row.data) : [['-', 'No records', '-', '-', '-', '-', '-', '-']],
            theme: 'grid',
            headStyles: {
              fillColor: config.color,
              textColor: 255,
              fontStyle: 'bold',
              fontSize: 7,
            },
            bodyStyles: { fontSize: 7, textColor: [50, 50, 50] },
            columnStyles: {
              0: { cellWidth: 8, halign: 'center' },
              1: { cellWidth: 30 },
              2: { cellWidth: 30 },
              3: { cellWidth: 20 },
              4: { cellWidth: 16, halign: 'center' },
              5: { cellWidth: 18, halign: 'center' },
              6: { cellWidth: 22, halign: 'center' },
              7: { cellWidth: 16, halign: 'center' },
            },
            margin: { left: margin, right: margin },
            didParseCell: (data: CellHookData) => {
              // Highlight rows with no logout in yellow/orange
              if (data.section === 'body' && noLogoutRows.has(data.row.index)) {
                data.cell.styles.fillColor = [255, 243, 205]; // Light yellow/amber background
                data.cell.styles.textColor = [180, 83, 9]; // Amber text for visibility
                if (data.column.index === 6) { // Time Out column
                  data.cell.styles.fontStyle = 'bold';
                }
              }
              // Highlight external attendee rows with light purple
              if (data.section === 'body' && externalRows.has(data.row.index)) {
                data.cell.styles.fillColor = [243, 232, 255]; // Light purple background
                data.cell.styles.textColor = [124, 58, 237]; // Purple text
                if (data.column.index === 4) { // Status column
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            },
          });

          yPosition = (((doc as JsPdfWithAutoTable).lastAutoTable?.finalY) ?? yPosition) + 15;
          
          if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = 20;
          }
        }

        // Not Recorded Members table
        if (exportOptions.selectedTables.includes('notRecorded') && notRecordedMembersList.length > 0) {
          if (yPosition > pageHeight - 60) {
            doc.addPage();
            yPosition = 20;
          }

          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(30, 41, 59);
          doc.text(`NOT RECORDED (${notRecordedMembersList.length})`, margin, yPosition);
          doc.setDrawColor(107, 114, 128);
          doc.setLineWidth(0.3);
          doc.line(margin, yPosition + 2, margin + 45, yPosition + 2);
          yPosition += 8;

          const notRecordedData = notRecordedMembersList.map((member, index) => [
            String(index + 1),
            member.name || 'Unknown',
            member.committee || '-',
            member.position || '-',
          ]);

          autoTable(doc, {
            startY: yPosition,
            head: [['#', 'Name', 'Committee', 'Position']],
            body: notRecordedData,
            theme: 'grid',
            headStyles: {
              fillColor: [107, 114, 128],
              textColor: 255,
              fontStyle: 'bold',
              fontSize: 7,
            },
            bodyStyles: { fontSize: 7, textColor: [50, 50, 50] },
            columnStyles: {
              0: { cellWidth: 10, halign: 'center' },
              1: { cellWidth: 50 },
              2: { cellWidth: 50 },
              3: { cellWidth: 30 },
            },
            margin: { left: margin, right: margin },
          });
        }
      }

      // Update footers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }

      // Generate blob URL for preview
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      setPdfPreviewUrl(url);
      
    } catch (error) {
      console.error('PDF Preview Generation Error:', error);
      toast.error('Failed to generate PDF preview');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Open PDF in new tab (for mobile devices that can't display iframe)
  const handleOpenPdfInNewTab = () => {
    if (pdfPreviewUrl) {
      // Create a temporary anchor element to force open
      const link = document.createElement('a');
      link.href = pdfPreviewUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      
      // Some mobile browsers need the click to happen on the document
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Download PDF directly (alternative for mobile)
  const handleDownloadPdfPreview = () => {
    if (pdfPreviewUrl) {
      const link = document.createElement('a');
      link.href = pdfPreviewUrl;
      link.download = `Attendance_Preview_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('PDF downloaded successfully');
    }
  };

  // Export to PDF with progress bar using existing UploadToast
  const handleExportPDF = async () => {
    if (attendanceRecords.length === 0) {
      toast.error("No attendance data to export");
      return;
    }

    // Generate unique toast ID
    const toastId = `pdf-export-${Date.now()}`;
    let cancelled = false;

    // Use existing upload toast system if available, otherwise fallback to regular toast
    if (addUploadToast && updateUploadToast) {
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
    } else {
      toast.loading('Preparing PDF export...', { id: toastId });
    }

    try {
      // Step 1: Initialize PDF (10%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Initializing document...', progress: 10 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      const { JsPDF, autoTable } = await loadPdfTools();
      const doc = new JsPDF('portrait', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const generatedTimestamp = new Date().toLocaleString();
      const orgMotto = "Shaping the Future to a Greater Society";

      // Helper function to draw page footer
      const drawFooter = (pageNum: number, totalPages: number) => {
        doc.setDrawColor(246, 66, 31);
        doc.setLineWidth(0.5);
        doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);
        
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont('helvetica', 'normal');
        doc.text('Youth Service Philippines - Tagum Chapter', margin, pageHeight - 10);
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        
        // Org motto in center
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.text(`"${orgMotto}"`, pageWidth / 2, pageHeight - 10, { align: 'center' });
      };

      // Step 2: Load logo (25%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Loading organization logo...', progress: 25 });
      }
      if (cancelled) return;

      // Load logo image
      let logoLoaded = false;
      try {
        const logoImg = await loadImage(ORG_LOGO_URL);
        // Draw orange header bar
        doc.setFillColor(246, 66, 31); // #f6421f
        doc.rect(0, 0, pageWidth, 45, 'F');
        
        // Add logo - circular with white background
        const logoSize = 30;
        const logoX = margin;
        const logoY = 7.5;
        
        // Draw white circle background for logo
        doc.setFillColor(255, 255, 255);
        doc.circle(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 2, 'F');
        
        // Add logo image
        doc.addImage(logoImg, 'PNG', logoX, logoY, logoSize, logoSize);
        logoLoaded = true;
      } catch {
        console.warn('Could not load logo, continuing without it');
        // Draw orange header bar without logo
        doc.setFillColor(246, 66, 31);
        doc.rect(0, 0, pageWidth, 45, 'F');
      }

      // Step 3: Add organization name with Lexend font styling (40%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Adding header and branding...', progress: 40 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      doc.setTextColor(255, 255, 255);
      const orgNameX = logoLoaded ? margin + 35 : margin;
      
      // Organization name (Lexend-style - bold, larger)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(ORG_NAME, orgNameX, 18);
      
      // Chapter name
      doc.setFontSize(12);
      doc.text(ORG_CHAPTER, orgNameX, 26);

      // Add report title
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('ATTENDANCE REPORT', orgNameX, 35);
      
      // Generated timestamp on the right side (moved from footer)
      doc.setFontSize(8);
      doc.text(`Generated: ${generatedTimestamp}`, pageWidth - margin, 35, { align: 'right' });

      // Step 4: Add event info (55%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Adding event information...', progress: 55 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Get current event - use first selected event for single event, or null for multi
      const effectiveEventsForPDF = getEffectiveSelectedEvents();
      const currentEvent = effectiveEventsForPDF.length === 1 
        ? events.find(e => e.EventID === effectiveEventsForPDF[0]) 
        : null;
      let yPosition = 52;

      // Add subtle divider line below header
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // EVENT DETAILS Section Title
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('EVENT DETAILS', margin, yPosition);
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.3);
      doc.line(margin, yPosition + 2, margin + 35, yPosition + 2);
      yPosition += 10;

      // Event details card with border
      doc.setDrawColor(230, 230, 230);
      doc.setFillColor(252, 252, 252);
      doc.roundedRect(margin, yPosition, pageWidth - 2 * margin, 32, 3, 3, 'FD');
      
      const cardContentY = yPosition + 6;
      const labelX = margin + 8;
      const valueX = margin + 40;
      const lineSpacing = 7;
      
      // Helper to draw label-value pairs
      const drawField = (label: string, value: string, y: number) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`${label}:`, labelX, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30, 41, 59);
        doc.text(value, valueX, y);
      };
      
      // Event Name
      drawField('Event Name', currentEvent?.Title || 'N/A', cardContentY);
      
      // Event Date
      const eventDateValue = currentEvent?.StartDate 
        ? formatDateValue(currentEvent.StartDate) 
        : '-';
      drawField('Event Date', eventDateValue, cardContentY + lineSpacing);
      
      // Event Time
      const eventTimeValue = currentEvent?.StartTime 
        ? `${formatTimeValue(currentEvent.StartTime)}${currentEvent?.EndTime ? ' - ' + formatTimeValue(currentEvent.EndTime) : ''}`
        : '-';
      drawField('Event Time', eventTimeValue, cardContentY + lineSpacing * 2);
      
      // Event Status
      drawField('Event Status', currentEvent?.Status || 'N/A', cardContentY + lineSpacing * 3);
      
      yPosition += 40;

      // Step 5: Add attendance summary (65%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Calculating attendance statistics...', progress: 65 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Calculate committee statistics
      const committeeList = [
        { name: 'Executive Board', short: 'EB' },
        { name: 'Membership and Internal Affairs Committee', short: 'MIAC' },
        { name: 'External Relations Committee', short: 'ERC' },
        { name: 'Secretariat and Documentation Committee', short: 'SDC' },
        { name: 'Finance and Treasury Committee', short: 'FTC' },
        { name: 'Program Development Committee', short: 'PDC' },
        { name: 'Communications and Marketing Committee', short: 'CMC' },
        { name: 'General Members', short: 'GEN' },
      ];

      const filteredRecords = getFilteredAttendance();
      const totalMembers = allMembers.length;
      
      // Only count Present and Late as "attended" (not Excused or Absent)
      const actualAttendees = filteredRecords.filter(r => r.status === 'Present' || r.status === 'Late');
      const totalAttendees = actualAttendees.length;
      
      // Calculate committee stats - only count Present/Late as attended
      const committeeStats = committeeList.map(comm => {
        const isGeneral = comm.name === 'General Members';
        const committeeMembersCount = allMembers.filter(m => {
          if (isGeneral) {
            return !m.committee || m.committee === '' || m.committee === 'None' || m.committee === 'General Members';
          }
          return m.committee === comm.name;
        }).length;
        
        // Only count Present and Late status as "attended"
        const committeeAttendeesCount = filteredRecords.filter(r => {
          // Must be Present or Late to count as attended
          if (r.status !== 'Present' && r.status !== 'Late') return false;
          
          const member = allMembers.find(m => m.id === r.memberId);
          if (isGeneral) {
            return !member?.committee || member.committee === '' || member.committee === 'None' || member.committee === 'General Members';
          }
          return member?.committee === comm.name;
        }).length;
        
        const percentage = committeeMembersCount > 0 
          ? Math.round((committeeAttendeesCount / committeeMembersCount) * 100) 
          : 0;
        
        return {
          ...comm,
          attendees: committeeAttendeesCount,
          total: committeeMembersCount,
          percentage,
        };
      });

      // Status statistics
      const presentCount = attendanceData.find(d => d.name === 'Present')?.value || 0;
      const lateCount = attendanceData.find(d => d.name === 'Late')?.value || 0;
      const excusedCount = attendanceData.find(d => d.name === 'Excused')?.value || 0;
      const absentCount = attendanceData.find(d => d.name === 'Absent')?.value || 0;
      
      const overallPercentage = totalMembers > 0 ? Math.round((totalAttendees / totalMembers) * 100) : 0;
      const presentPercentage = totalAttendees > 0 ? Math.round((presentCount / totalAttendees) * 100) : 0;
      const latePercentage = totalAttendees > 0 ? Math.round((lateCount / totalAttendees) * 100) : 0;
      const excusedPercentage = totalAttendees > 0 ? Math.round((excusedCount / totalAttendees) * 100) : 0;
      const absentPercentage = totalAttendees > 0 ? Math.round((absentCount / totalAttendees) * 100) : 0;

      // Section title: ATTENDANCE SUMMARY
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('ATTENDANCE SUMMARY', margin, yPosition);
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.3);
      doc.line(margin, yPosition + 2, margin + 45, yPosition + 2);
      yPosition += 10;

      // Total Attendees Box (large, prominent)
      const totalBoxWidth = pageWidth - 2 * margin;
      doc.setFillColor(246, 66, 31);
      doc.roundedRect(margin, yPosition, totalBoxWidth, 22, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('TOTAL ATTENDEES', margin + 10, yPosition + 10);
      doc.setFontSize(20);
      doc.text(`${totalAttendees}/${totalMembers}`, totalBoxWidth - 10, yPosition + 14, { align: 'right' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${overallPercentage}% attendance rate`, totalBoxWidth - 10, yPosition + 19, { align: 'right' });
      yPosition += 28;

      // Status boxes - 4 columns
      const statusBoxWidth = (pageWidth - 2 * margin - 9) / 4;
      const statusBoxHeight = 20;
      const statuses = [
        { name: 'PRESENT', color: [16, 185, 129], count: presentCount, pct: presentPercentage },
        { name: 'LATE', color: [245, 158, 11], count: lateCount, pct: latePercentage },
        { name: 'EXCUSED', color: [59, 130, 246], count: excusedCount, pct: excusedPercentage },
        { name: 'ABSENT', color: [239, 68, 68], count: absentCount, pct: absentPercentage },
      ];

      statuses.forEach((status, index) => {
        const boxX = margin + index * (statusBoxWidth + 3);
        doc.setFillColor(status.color[0], status.color[1], status.color[2]);
        doc.roundedRect(boxX, yPosition, statusBoxWidth, statusBoxHeight, 2, 2, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text(String(status.count), boxX + statusBoxWidth / 2, yPosition + 9, { align: 'center' });
        
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(`${status.name} (${status.pct}%)`, boxX + statusBoxWidth / 2, yPosition + 15, { align: 'center' });
      });
      yPosition += statusBoxHeight + 10;

      // COMMITTEE BREAKDOWN Section
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('COMMITTEE BREAKDOWN', margin, yPosition);
      doc.setDrawColor(246, 66, 31);
      doc.setLineWidth(0.3);
      doc.line(margin, yPosition + 2, margin + 50, yPosition + 2);
      yPosition += 8;

      // Committee boxes - 2 columns x 4 rows
      const commBoxWidth = (pageWidth - 2 * margin - 6) / 2;
      const commBoxHeight = 18;
      const commColors = [
        [246, 66, 31],   // Executive Board - Orange
        [139, 92, 246],  // MIAC - Purple
        [16, 185, 129],  // ERC - Green
        [59, 130, 246],  // SDC - Blue
        [245, 158, 11],  // FTC - Yellow
        [236, 72, 153],  // PDC - Pink
        [6, 182, 212],   // CMC - Cyan
        [107, 114, 128], // General - Gray
      ];

      committeeStats.forEach((comm, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const boxX = margin + col * (commBoxWidth + 6);
        const boxY = yPosition + row * (commBoxHeight + 4);
        
        // Progress bar background
        doc.setFillColor(240, 240, 240);
        doc.roundedRect(boxX, boxY, commBoxWidth, commBoxHeight, 2, 2, 'F');
        
        // Progress bar fill
        const fillWidth = comm.total > 0 ? (comm.attendees / comm.total) * commBoxWidth : 0;
        doc.setFillColor(commColors[index][0], commColors[index][1], commColors[index][2]);
        if (fillWidth > 0) {
          doc.roundedRect(boxX, boxY, Math.max(fillWidth, 4), commBoxHeight, 2, 2, 'F');
        }
        
        // Committee name
        doc.setTextColor(30, 41, 59);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(comm.short, boxX + 4, boxY + 7);
        
        // Full name (smaller)
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5);
        doc.setTextColor(80, 80, 80);
        const shortName = comm.name.length > 35 ? comm.name.substring(0, 35) + '...' : comm.name;
        doc.text(shortName, boxX + 4, boxY + 12);
        
        // Count and percentage on right
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59);
        doc.text(`${comm.attendees}/${comm.total}`, boxX + commBoxWidth - 4, boxY + 8, { align: 'right' });
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(`${comm.percentage}%`, boxX + commBoxWidth - 4, boxY + 14, { align: 'right' });
      });
      
      yPosition += Math.ceil(committeeStats.length / 2) * (commBoxHeight + 4) + 5;

      // Draw footer for summary page
      drawFooter(1, 0); // Will update total pages later

      // ============================================
      // PAGE 2+: Detailed Tables by Status
      // ============================================
      
      // Step 6: Prepare table data (75%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Preparing attendee tables...', progress: 75 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Helper function to create table data for a set of records (with no-logout and external marking)
      const createTableData = (records: typeof filteredRecords, startIndex: number = 1) => {
        return records.map((record, index) => {
          const member = allMembers.find(m => m.id === record.memberId);
          const noLogout = hasNoLogout(record.timeIn, record.timeOut, record.status);
          const duration = calculateAttendanceDuration(record.timeIn, record.timeOut);
          
          // Build status with indicators
          let statusDisplay: string = record.status;
          const indicators: string[] = [];
          if (record.isExternal) indicators.push('EXT');
          if (record.lateTimeIn) indicators.push('LATE-IN');
          if (record.lateTimeOut) indicators.push('LATE-OUT');
          if (indicators.length > 0) {
            statusDisplay = `${record.status} [${indicators.join(', ')}]`;
          }
          
          return {
            data: [
              String(startIndex + index),
              record.memberName || member?.name || 'Unknown',
              member?.committee || '-',
              member?.position || '-',
              statusDisplay,
              formatTimeValue(record.timeIn),
              noLogout ? 'NO LOGOUT' : formatTimeValue(record.timeOut),
              duration,
              record.recordedByTimeIn || '-',
              record.recordedByTimeOut || '-',
            ],
            noLogout,
            isExternal: record.isExternal || false,
          };
        });
      };

      // Group records by status
      const presentRecords = filteredRecords.filter(r => r.status === 'Present');
      const lateRecords = filteredRecords.filter(r => r.status === 'Late');
      const excusedRecords = filteredRecords.filter(r => r.status === 'Excused');
      const absentRecords = filteredRecords.filter(r => r.status === 'Absent');
      
      // Get not recorded members
      const notRecordedMembers = getNotRecordedMembers();

      // Define table configurations for each status - filter based on exportOptions
      const allTableConfigs = [
        {
          key: 'all' as const,
          title: 'ALL ATTENDEES',
          records: filteredRecords,
          color: [246, 66, 31] as [number, number, number],
          altRowColor: [254, 249, 244] as [number, number, number],
        },
        {
          key: 'present' as const,
          title: 'PRESENT',
          records: presentRecords,
          color: [16, 185, 129] as [number, number, number],
          altRowColor: [236, 253, 245] as [number, number, number],
        },
        {
          key: 'late' as const,
          title: 'LATE',
          records: lateRecords,
          color: [245, 158, 11] as [number, number, number],
          altRowColor: [255, 251, 235] as [number, number, number],
        },
        {
          key: 'excused' as const,
          title: 'EXCUSED',
          records: excusedRecords,
          color: [59, 130, 246] as [number, number, number],
          altRowColor: [239, 246, 255] as [number, number, number],
        },
        {
          key: 'absent' as const,
          title: 'ABSENT',
          records: absentRecords,
          color: [239, 68, 68] as [number, number, number],
          altRowColor: [254, 242, 242] as [number, number, number],
        },
      ];
      
      // Filter based on exportOptions.selectedTables array
      const tableConfigs = allTableConfigs.filter(config => {
        return exportOptions.selectedTables.includes(config.key);
      });

      // Step 7: Generate tables (85%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Generating tables...', progress: 85 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Start new page for tables
      doc.addPage();
      yPosition = 20;

      // Generate a table for each status group
      for (let configIndex = 0; configIndex < tableConfigs.length; configIndex++) {
        const config = tableConfigs[configIndex];
        
        // Skip empty tables (except for ALL ATTENDEES which should always show)
        if (config.records.length === 0 && config.title !== 'ALL ATTENDEES') continue;
        
        // Add section title
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`${config.title} (${config.records.length})`, margin, yPosition);
        doc.setDrawColor(config.color[0], config.color[1], config.color[2]);
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition + 2, margin + 45, yPosition + 2);
        yPosition += 8;

        const tableData = createTableData(config.records);
        const noLogoutRows = new Set(tableData.map((row, idx) => row.noLogout ? idx : -1).filter(idx => idx >= 0));
        const externalRows = new Set(tableData.map((row, idx) => row.isExternal ? idx : -1).filter(idx => idx >= 0));

        // Create table with autoTable - now includes Duration column, no-logout and external highlighting
        autoTable(doc, {
          startY: yPosition,
          head: [['#', 'Name', 'Committee', 'Position', 'Status', 'Time In', 'Time Out', 'Duration', 'Rec. By (In)', 'Rec. By (Out)']],
          body: tableData.length > 0 ? tableData.map(row => row.data) : [['-', 'No records', '-', '-', '-', '-', '-', '-', '-', '-']],
          theme: 'grid',
          headStyles: {
            fillColor: config.color,
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 7,
            cellPadding: 2,
            halign: 'center',
          },
          bodyStyles: {
            fontSize: 7,
            textColor: [50, 50, 50],
            cellPadding: 2,
          },
          alternateRowStyles: {
            fillColor: config.altRowColor,
          },
          columnStyles: {
            0: { cellWidth: 7, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 16 },
            4: { cellWidth: 12, halign: 'center' },
            5: { cellWidth: 14, halign: 'center' },
            6: { cellWidth: 18, halign: 'center' },
            7: { cellWidth: 14, halign: 'center' },
            8: { cellWidth: 20 },
            9: { cellWidth: 20 },
          },
          styles: {
            lineColor: [220, 220, 220],
            lineWidth: 0.1,
          },
          margin: { left: margin, right: margin },
          didParseCell: (data: CellHookData) => {
            // Highlight rows with no logout in yellow/orange
            if (data.section === 'body' && noLogoutRows.has(data.row.index)) {
              data.cell.styles.fillColor = [255, 243, 205]; // Light yellow/amber background
              data.cell.styles.textColor = [180, 83, 9]; // Amber text for visibility
              if (data.column.index === 6) { // Time Out column
                data.cell.styles.fontStyle = 'bold';
              }
            }
            // Highlight external attendee rows with light purple
            if (data.section === 'body' && externalRows.has(data.row.index)) {
              data.cell.styles.fillColor = [243, 232, 255]; // Light purple background
              data.cell.styles.textColor = [124, 58, 237]; // Purple text
              if (data.column.index === 4) { // Status column
                data.cell.styles.fontStyle = 'bold';
              }
            }
          },
        });

        // Get the final Y position after the table
        yPosition = (((doc as JsPdfWithAutoTable).lastAutoTable?.finalY) ?? yPosition) + 12;

        // Check if we need a new page for the next table
        if (yPosition > pageHeight - 50 && configIndex < tableConfigs.length - 1) {
          doc.addPage();
          yPosition = 20;
        }
      }

      // Add Not Recorded table if enabled in exportOptions
      if (exportOptions.selectedTables.includes('notRecorded') && notRecordedMembers.length > 0) {
        // Check if we need a new page
        if (yPosition > pageHeight - 80) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Section title
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text(`NOT RECORDED (${notRecordedMembers.length})`, margin, yPosition);
        doc.setDrawColor(156, 163, 175); // Gray
        doc.setLineWidth(0.3);
        doc.line(margin, yPosition + 2, margin + 45, yPosition + 2);
        yPosition += 8;

        // Create table data for not recorded members
        const notRecordedTableData = notRecordedMembers.map((member, index) => [
          String(index + 1),
          member.name || 'Unknown',
          member.committee || '-',
          member.position || '-',
          'Not Recorded',
          '-',
          '-',
          '-',
          '-',
          '-',
        ]);

        // Create table
        autoTable(doc, {
          startY: yPosition,
          head: [['#', 'Name', 'Committee', 'Position', 'Status', 'Time In', 'Time Out', 'Duration', 'Rec. By (In)', 'Rec. By (Out)']],
          body: notRecordedTableData,
          theme: 'grid',
          headStyles: {
            fillColor: [156, 163, 175], // Gray
            textColor: 255,
            fontStyle: 'bold',
            fontSize: 7,
            cellPadding: 2,
            halign: 'center',
          },
          bodyStyles: {
            fontSize: 7,
            textColor: [50, 50, 50],
            cellPadding: 2,
          },
          alternateRowStyles: {
            fillColor: [249, 250, 251], // Gray-50
          },
          columnStyles: {
            0: { cellWidth: 7, halign: 'center', fontStyle: 'bold' },
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 16 },
            4: { cellWidth: 12, halign: 'center' },
            5: { cellWidth: 14, halign: 'center' },
            6: { cellWidth: 18, halign: 'center' },
            7: { cellWidth: 14, halign: 'center' },
            8: { cellWidth: 20 },
            9: { cellWidth: 20 },
          },
          styles: {
            lineColor: [220, 220, 220],
            lineWidth: 0.1,
          },
          margin: { left: margin, right: margin },
        });

        yPosition = (((doc as JsPdfWithAutoTable).lastAutoTable?.finalY) ?? yPosition) + 12;
      }

      // ============================================
      // LAST PAGE: Charts (only if enabled)
      // ============================================
      
      if (exportOptions.includeCharts) {
        // Step 8: Generate charts (95%)
        if (updateUploadToast) {
          updateUploadToast(toastId, { message: 'Generating charts...', progress: 95 });
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        if (cancelled) return;

        // Add new page for charts
        doc.addPage();
        yPosition = 20;

        // Charts page title
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('ATTENDANCE ANALYTICS', margin, yPosition);
        doc.setDrawColor(246, 66, 31);
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition + 3, margin + 55, yPosition + 3);
        yPosition += 12;

        // ---- PIE CHART: Attendance Status Distribution ----
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Attendance Status Distribution', margin, yPosition);
      yPosition += 6;

      const pieChartCenterX = margin + 35;
      const pieChartCenterY = yPosition + 25;
      const pieRadius = 22;
      
      const pieData = [
        { name: 'Present', value: presentCount, color: [16, 185, 129] },
        { name: 'Late', value: lateCount, color: [245, 158, 11] },
        { name: 'Excused', value: excusedCount, color: [59, 130, 246] },
        { name: 'Absent', value: absentCount, color: [239, 68, 68] },
      ].filter(d => d.value > 0);

      const pieTotal = pieData.reduce((sum, d) => sum + d.value, 0);
      let startAngle = -Math.PI / 2; // Start from top

      if (pieTotal > 0) {
        pieData.forEach(slice => {
          const sliceAngle = (slice.value / pieTotal) * 2 * Math.PI;
          const endAngle = startAngle + sliceAngle;
          
          // Draw pie slice using lines (approximate)
          doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
          
          // Create path for pie slice
          const segments = 20;
          const points: [number, number][] = [[pieChartCenterX, pieChartCenterY]];
          
          for (let i = 0; i <= segments; i++) {
            const angle = startAngle + (sliceAngle * i / segments);
            points.push([
              pieChartCenterX + Math.cos(angle) * pieRadius,
              pieChartCenterY + Math.sin(angle) * pieRadius
            ]);
          }
          
          // Draw the slice using a polygon approximation
          doc.setFillColor(slice.color[0], slice.color[1], slice.color[2]);
          
          // Use triangle fan approach
          for (let i = 1; i < points.length - 1; i++) {
            doc.triangle(
              points[0][0], points[0][1],
              points[i][0], points[i][1],
              points[i + 1][0], points[i + 1][1],
              'F'
            );
          }
          
          startAngle = endAngle;
        });
      } else {
        // Draw empty circle
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.circle(pieChartCenterX, pieChartCenterY, pieRadius, 'S');
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('No Data', pieChartCenterX, pieChartCenterY, { align: 'center' });
      }

      // Pie chart legend - positioned to the right of the pie
      const legendX = margin + 75;
      let legendY = yPosition + 5;
      
      doc.setFontSize(7);
      pieData.forEach((item) => {
        const pct = pieTotal > 0 ? Math.round((item.value / pieTotal) * 100) : 0;
        
        // Color box
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.rect(legendX, legendY - 2, 6, 4, 'F');
        
        // Text
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.text(`${item.name}: ${item.value} (${pct}%)`, legendX + 9, legendY);
        
        legendY += 8;
      });

      yPosition += 55;

      // ---- BAR CHART: Committee Attendance ----
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Committee Attendance Breakdown', margin, yPosition);
      yPosition += 8;

      const barChartX = margin;
      const barChartWidth = pageWidth - 2 * margin;
      const barHeight = 10;
      const barSpacing = 2;

      committeeStats.forEach((comm, index) => {
        const barY = yPosition + index * (barHeight + barSpacing);
        
        // Background bar (total)
        doc.setFillColor(230, 230, 230);
        doc.roundedRect(barChartX + 22, barY, barChartWidth - 50, barHeight, 1, 1, 'F');
        
        // Progress bar (attendees)
        const fillWidth = comm.total > 0 
          ? ((comm.attendees / comm.total) * (barChartWidth - 50))
          : 0;
        
        if (fillWidth > 0) {
          doc.setFillColor(commColors[index][0], commColors[index][1], commColors[index][2]);
          doc.roundedRect(barChartX + 22, barY, Math.max(fillWidth, 2), barHeight, 1, 1, 'F');
        }
        
        // Committee short name on left
        doc.setFontSize(6);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(50, 50, 50);
        doc.text(comm.short, barChartX, barY + 7);
        
        // Value on right
        doc.setFontSize(6);
        doc.setFont('helvetica', 'normal');
        doc.text(`${comm.attendees}/${comm.total} (${comm.percentage}%)`, barChartX + barChartWidth - 2, barY + 7, { align: 'right' });
      });

      yPosition += committeeStats.length * (barHeight + barSpacing) + 8;

      // Bar chart legend - compact 2 columns
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text('Legend:', margin, yPosition);
      yPosition += 5;

      const legendColWidth = (pageWidth - 2 * margin) / 2;
      committeeStats.forEach((comm, index) => {
        const col = index % 2;
        const row = Math.floor(index / 2);
        const lx = margin + col * legendColWidth;
        const ly = yPosition + row * 7;
        
        // Color box
        doc.setFillColor(commColors[index][0], commColors[index][1], commColors[index][2]);
        doc.rect(lx, ly - 2, 5, 3, 'F');
        
        // Text
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(50, 50, 50);
        const displayName = comm.name.length > 38 ? comm.name.substring(0, 38) + '...' : comm.name;
        doc.text(`${comm.short} - ${displayName}`, lx + 7, ly);
      });
      } // End of includeCharts conditional

      // Update all pages with correct page numbers
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        drawFooter(i, totalPages);
      }

      // Step 9: Save file (100%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Saving PDF file...', progress: 100 });
      }
      await new Promise(resolve => setTimeout(resolve, 200));
      if (cancelled) return;

      // Generate filename
      const eventTitle = currentEvent?.Title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Event';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Attendance_${eventTitle}_${dateStr}.pdf`;

      doc.save(filename);

      // Success toast - update to success status
      if (updateUploadToast && removeUploadToast) {
        updateUploadToast(toastId, { 
          message: `File saved as "${filename}"`, 
          status: 'success', 
          progress: 100 
        });
        // Auto-remove after 3 seconds
        setTimeout(() => removeUploadToast(toastId), 3000);
      } else {
        toast.dismiss(toastId);
        toast.success('PDF exported successfully!', {
          description: `File saved as "${filename}"`,
        });
      }
    } catch (error) {
      if (cancelled) {
        return;
      }
      console.error('PDF Export Error:', error);
      if (updateUploadToast && removeUploadToast) {
        updateUploadToast(toastId, { 
          message: 'An error occurred while generating the PDF.', 
          status: 'error', 
          progress: 0 
        });
        setTimeout(() => removeUploadToast(toastId), 5000);
      } else {
        toast.dismiss(toastId);
        toast.error('Failed to export PDF', {
          description: 'An error occurred while generating the PDF. Please try again.',
        });
      }
    }
  };

  // Export to Spreadsheet with progress bar using existing UploadToast
  const handleExportSpreadsheet = async () => {
    if (attendanceRecords.length === 0) {
      toast.error("No attendance data to export");
      return;
    }

    // Generate unique toast ID
    const toastId = `spreadsheet-export-${Date.now()}`;
    let cancelled = false;

    // Use existing upload toast system if available
    if (addUploadToast && updateUploadToast) {
      addUploadToast({
        id: toastId,
        title: 'Exporting Spreadsheet',
        message: 'Preparing workbook...',
        status: 'loading',
        progress: 0,
        onCancel: () => {
          cancelled = true;
          updateUploadToast(toastId, {
            status: 'info',
            progress: 100,
            title: 'Cancelled',
            message: 'Spreadsheet export cancelled',
          });
        },
      });
    } else {
      toast.loading('Preparing spreadsheet export...', { id: toastId });
    }

    try {
      // Step 1: Initialize (20%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Initializing workbook...', progress: 20 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Get current event - use first selected event for single event, or null for multi
      const effectiveEventsForExport = getEffectiveSelectedEvents();
      const currentEvent = effectiveEventsForExport.length === 1 
        ? events.find(e => e.EventID === effectiveEventsForExport[0]) 
        : null;
      const filteredRecords = getFilteredAttendance();

      // Step 2: Prepare data (50%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Preparing attendance data...', progress: 50 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Create workbook and worksheet
      const ExcelJS = await loadExcelJS();
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Attendance Report');

      // Format event date and time for spreadsheet
      const eventDateValue = currentEvent?.StartDate 
        ? formatDateValue(currentEvent.StartDate) 
        : '-';
      const eventTimeValue = currentEvent?.StartTime 
        ? `${formatTimeValue(currentEvent.StartTime)}${currentEvent?.EndTime ? ' - ' + formatTimeValue(currentEvent.EndTime) : ''}`
        : '-';

      // Header information with proper Event Details
      const headerData: (string | number)[][] = [
        [`${ORG_NAME} - ${ORG_CHAPTER}`],
        ['Attendance Report'],
        [''],
        ['EVENT DETAILS'],
        ['Event Name:', currentEvent?.Title || 'Unknown Event'],
        ['Event Date:', eventDateValue],
        ['Event Time:', eventTimeValue],
        ['Event Status:', currentEvent?.Status || '-'],
        [''],
        ['Committee Filter:', selectedCommittee],
        ['Generated:', new Date().toLocaleString()],
        [''],
        ['ATTENDANCE SUMMARY'],
        ['Present:', attendanceData.find(d => d.name === 'Present')?.value || 0],
        ['Late:', attendanceData.find(d => d.name === 'Late')?.value || 0],
        ['Excused:', attendanceData.find(d => d.name === 'Excused')?.value || 0],
        ['Absent:', attendanceData.find(d => d.name === 'Absent')?.value || 0],
        ['Total:', totalRecords],
        [''],
        ['ATTENDEE LIST'],
        ['#', 'Full Name', 'Committee', 'Position', 'Status', 'Time In', 'Time Out', 'Duration', 'No Logout?', 'Recorded By (In)', 'Recorded By (Out)', 'Notes'],
      ];

      // Step 3: Process records (70%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Processing attendee records...', progress: 70 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Add attendee data
      filteredRecords.forEach((record, index) => {
        const member = allMembers.find(m => m.id === record.memberId);
        const noLogout = hasNoLogout(record.timeIn, record.timeOut, record.status);
        const duration = calculateAttendanceDuration(record.timeIn, record.timeOut);
        
        // Build status with indicators
        let statusDisplay: string = record.status;
        const indicators: string[] = [];
        if (record.isExternal) indicators.push('EXT');
        if (record.lateTimeIn) indicators.push('LATE-IN');
        if (record.lateTimeOut) indicators.push('LATE-OUT');
        if (indicators.length > 0) {
          statusDisplay = `${record.status} [${indicators.join(', ')}]`;
        }
        
        headerData.push([
          index + 1,
          record.memberName || member?.name || 'Unknown',
          member?.committee || '-',
          member?.position || '-',
          statusDisplay,
          formatTimeValue(record.timeIn),
          noLogout ? 'NO LOGOUT' : formatTimeValue(record.timeOut),
          duration,
          noLogout ? 'YES' : 'No',
          record.recordedByTimeIn || '-',
          record.recordedByTimeOut || '-',
          record.notes || '-',
        ] as (string | number)[]);
      });

      // Step 4: Create worksheet (85%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Creating spreadsheet...', progress: 85 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Add all rows to worksheet
      headerData.forEach(row => worksheet.addRow(row));

      // Set column widths
      worksheet.columns = [
        { width: 5 },    // #
        { width: 25 },   // Name
        { width: 30 },   // Committee
        { width: 20 },   // Position
        { width: 12 },   // Status
        { width: 12 },   // Time In
        { width: 14 },   // Time Out
        { width: 12 },   // Duration
        { width: 12 },   // No Logout?
        { width: 20 },   // Recorded By (In)
        { width: 20 },   // Recorded By (Out)
        { width: 25 },   // Notes
      ];

      // Step 5: Save file (100%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Saving spreadsheet file...', progress: 100 });
      }
      await new Promise(resolve => setTimeout(resolve, 200));
      if (cancelled) return;

      // Generate filename
      const eventTitle = currentEvent?.Title?.replace(/[^a-zA-Z0-9]/g, '_') || 'Event';
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `Attendance_${eventTitle}_${dateStr}.xlsx`;

      // Write to buffer and trigger download
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      // Success toast - update to success status
      if (updateUploadToast && removeUploadToast) {
        updateUploadToast(toastId, { 
          message: `File saved as "${filename}"`, 
          status: 'success', 
          progress: 100 
        });
        // Auto-remove after 3 seconds
        setTimeout(() => removeUploadToast(toastId), 3000);
      } else {
        toast.dismiss(toastId);
        toast.success('Spreadsheet exported successfully!', {
          description: `File saved as "${filename}"`,
        });
      }
    } catch (error) {
      if (cancelled) {
        return;
      }
      console.error('Spreadsheet Export Error:', error);
      if (updateUploadToast && removeUploadToast) {
        updateUploadToast(toastId, { 
          message: 'An error occurred while generating the spreadsheet.', 
          status: 'error', 
          progress: 0 
        });
        setTimeout(() => removeUploadToast(toastId), 5000);
      } else {
        toast.dismiss(toastId);
        toast.error('Failed to export spreadsheet', {
          description: 'An error occurred while generating the spreadsheet. Please try again.',
        });
      }
    }
  };

  exportPdfHandlerRef.current = handleExportPDF;
  exportSpreadsheetHandlerRef.current = handleExportSpreadsheet;

  useEffect(() => {
    if (exportType === "pdf") {
      exportPdfHandlerRef.current?.();
    }
    if (exportType === "spreadsheet") {
      exportSpreadsheetHandlerRef.current?.();
    }
    setExportType("");
  }, [exportType]);

  // Helper function to load image
  const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  };

  // Memoize expensive calculations to prevent recalculation on every render
  const attendanceData = useMemo(() => getAttendanceData(), [getAttendanceData]);
  const barChartData = useMemo(() => getBarChartData(), [getBarChartData]);
  const multiEventChartData = useMemo(() => getMultiEventChartData(), [getMultiEventChartData]);
  const columnChartData = useMemo(() => getColumnChartData(), [getColumnChartData]);
  const notRecordedMembers = useMemo(() => getNotRecordedMembers(), [getNotRecordedMembers]);
  const filteredAttendance = useMemo(() => getFilteredAttendance(), [getFilteredAttendance]);
  const totalRecords = filteredAttendance.length;
  const effectiveEvents = useMemo(() => getEffectiveSelectedEvents(), [getEffectiveSelectedEvents]);
  const recommendedChart = useMemo(() => getRecommendedChartType(), [getRecommendedChartType]);

  // Memoize whether to use multi-event data
  const useMultiEventData = effectiveEvents.length > 1;

  // Memoize tooltip styles to prevent recreation
  const tooltipStyle = useMemo(() => ({
    background: isDark ? '#1e293b' : '#fff',
    border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
    borderRadius: 8,
  }), [isDark]);

  // Memoized chart components to prevent unnecessary re-renders
  const chartContent = useMemo(() => {
    if (isLoadingAttendance) {
      return <ChartSkeleton isDark={isDark} />;
    }

    if (attendanceData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] text-center">
          <p className="text-muted-foreground text-lg mb-2">No attendance records found</p>
          <p className="text-muted-foreground text-sm">
            {selectedCommittee !== "All" 
              ? "Try selecting a different committee filter"
              : "No members have recorded attendance for this event yet"}
          </p>
        </div>
      );
    }

    switch (chartType) {
      case "pie":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={attendanceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                onClick={handleChartClick}
                isAnimationActive={false}
              >
                {attendanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} className="cursor-pointer hover:opacity-80" />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "donut":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={attendanceData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                innerRadius={80}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
                onClick={handleChartClick}
                isAnimationActive={false}
              >
                {attendanceData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} className="cursor-pointer hover:opacity-80" />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "column":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={columnChartData} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="status" />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [value, 'Count']}
                contentStyle={tooltipStyle}
              />
              <Bar 
                dataKey="count" 
                onClick={(data: { status?: string }) => handleChartClick({ name: data.status })}
                cursor="pointer"
                isAnimationActive={false}
              >
                {columnChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} className="hover:opacity-80" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={useMultiEventData ? multiEventChartData : barChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={useMultiEventData ? "event" : "committee"} />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="Present" fill="#10b981" isAnimationActive={false} />
              <Bar dataKey="Late" fill="#f59e0b" isAnimationActive={false} />
              <Bar dataKey="Excused" fill="#3b82f6" isAnimationActive={false} />
              <Bar dataKey="Absent" fill="#ef4444" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={useMultiEventData ? multiEventChartData : barChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={useMultiEventData ? "event" : "committee"} />
              <YAxis />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Line type="monotone" dataKey="Present" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="Late" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="Excused" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  }, [isLoadingAttendance, isDark, attendanceData, chartType, columnChartData, barChartData, multiEventChartData, useMultiEventData, tooltipStyle, selectedCommittee, handleChartClick]);

  // Keep renderChart as a function that returns memoized content for compatibility
  const renderChart = () => chartContent;

  return (
    <PageLayout
      title="Attendance Dashboard"
      subtitle="Track and visualize attendance metrics across events and committees"
      onClose={onClose}
      isDark={isDark}
      hideChrome={isAnyDashboardModalOpen}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Dashboard & Directory", onClick: undefined },
        { label: "Attendance Dashboard", onClick: undefined },
      ]}
    >
      <div
        aria-hidden={isAnyDashboardModalOpen}
        style={isAnyDashboardModalOpen ? { pointerEvents: 'none', userSelect: 'none' } : undefined}
      >
      {/* Controls Card */}
      <div
        className="rounded-xl p-6 mb-6 border"
        style={{
          background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          overflow: 'visible',
          position: 'relative',
          zIndex: 100,
        }}
      >
        {isLoadingEvents ? (
          <ControlsSkeleton isDark={isDark} />
        ) : (
          <>
          <div className="grid md:grid-cols-2 gap-6" style={{ overflow: 'visible' }}>
            {/* Smart Event Search */}
            <div>
              <label
                className="block mb-3"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Select Events
              </label>
              <SmartEventSearch
                events={events}
                selectedEventIds={selectedEventIds}
                onSelectionChange={setSelectedEventIds}
                isDark={isDark}
                placeholder="Search events by name or date..."
                disabled={isLoadingEvents}
              />
            </div>

            {/* Committee Selector */}
            <div>
              <label
                className="block mb-3"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Filter by Committee
              </label>
              <CustomDropdown
                value={selectedCommittee}
                onChange={setSelectedCommittee}
                options={COMMITTEES}
                isDark={isDark}
                size="md"
              />
            </div>
          </div>

          {/* ============= PERSON SEARCH SECTION ============= */}
          <div className="mt-6 pt-6 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
            <label
              className="block mb-3"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              <div className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Search Person's Attendance
              </div>
            </label>
            
            <div className="relative" ref={personSearchRef}>
              <div
                className="flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-all"
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                  borderColor: selectedPerson
                    ? DESIGN_TOKENS.colors.brand.orange
                    : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                }}
              >
                <Search className="w-5 h-5 shrink-0 text-gray-400" />
                <input
                  type="text"
                  value={personSearchQuery}
                  onChange={(e) => {
                    setPersonSearchQuery(e.target.value);
                    setShowPersonDropdown(true);
                    if (!e.target.value.trim()) {
                      setSelectedPerson(null);
                    }
                  }}
                  onFocus={() => setShowPersonDropdown(true)}
                  placeholder="Search by name, committee, or position..."
                  className="flex-1 min-w-0 bg-transparent border-none outline-none"
                  style={{
                    color: isDark ? '#fff' : '#000',
                  }}
                />
                {(personSearchQuery || selectedPerson) && (
                  <button
                    onClick={handleClearPerson}
                    className="shrink-0 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
              
              {/* Person Search Dropdown */}
              {showPersonDropdown && !selectedPerson && (
                <div
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl max-h-72 overflow-y-auto z-200"
                  style={{
                    background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(20px)',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }}
                >
                  {isLoadingMembers ? (
                    <div className="p-6 text-center">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                      <p className="text-sm text-muted-foreground">Loading members...</p>
                    </div>
                  ) : filteredMembersForSearch.length === 0 ? (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      {personSearchQuery ? `No members found for "${personSearchQuery}"` : 'No members available'}
                    </div>
                  ) : (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                        {personSearchQuery ? `Results (${filteredMembersForSearch.length})` : 'Recent Members'}
                      </div>
                      {filteredMembersForSearch.map((member) => (
                        <button
                          key={member.id}
                          onClick={() => handleSelectPerson(member)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                        >
                          {member.profilePicture ? (
                            <img
                              src={member.profilePicture}
                              alt={member.name}
                              className="w-10 h-10 rounded-full object-cover shrink-0"
                              style={{ border: `2px solid ${DESIGN_TOKENS.colors.brand.orange}40` }}
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                              style={{ background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)` }}
                            >
                              {getInitials(member.name)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{member.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {member.committee || 'No committee'} {member.position && `• ${member.position}`}
                            </p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          </>
        )}
      </div>

      {/* ============= PERSON ATTENDANCE RECORDS SECTION ============= */}
      {selectedPerson && (
        <div
          className="rounded-xl p-6 mb-6 border"
          style={{
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Person Header */}
          <div className="flex items-start gap-4 mb-6 pb-6 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
            {selectedPerson.profilePicture ? (
              <img
                src={selectedPerson.profilePicture}
                alt={selectedPerson.name}
                className="w-16 h-16 rounded-full object-cover shrink-0"
                style={{ border: `3px solid ${DESIGN_TOKENS.colors.brand.orange}` }}
              />
            ) : (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
                style={{ background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)` }}
              >
                {getInitials(selectedPerson.name)}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3
                className="truncate mb-1"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                {selectedPerson.name}
              </h3>
              <p className="text-sm text-muted-foreground">{selectedPerson.committee || 'No committee'}</p>
              {selectedPerson.position && (
                <p className="text-sm" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>{selectedPerson.position}</p>
              )}
            </div>
            <button
              onClick={handleClearPerson}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
              title="Clear selection"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Attendance Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
            >
              <p className="text-xs text-muted-foreground mb-1">Present</p>
              <p className="text-xl font-bold" style={{ color: '#10b981' }}>{personAttendanceStats.present}</p>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
            >
              <p className="text-xs text-muted-foreground mb-1">Late</p>
              <p className="text-xl font-bold" style={{ color: '#f59e0b' }}>{personAttendanceStats.late}</p>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)' }}
            >
              <p className="text-xs text-muted-foreground mb-1">Excused</p>
              <p className="text-xl font-bold" style={{ color: '#3b82f6' }}>{personAttendanceStats.excused}</p>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              <p className="text-xs text-muted-foreground mb-1">Absent</p>
              <p className="text-xl font-bold" style={{ color: '#ef4444' }}>{personAttendanceStats.absent}</p>
            </div>
            <div
              className="rounded-lg p-3 text-center"
              style={{ 
                background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}15 0%, ${DESIGN_TOKENS.colors.brand.orange}15 100%)`,
                border: `1px solid ${DESIGN_TOKENS.colors.brand.orange}30`,
              }}
            >
              <p className="text-xs text-muted-foreground mb-1">Rate</p>
              <p className="text-xl font-bold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>{personAttendanceStats.attendanceRate.toFixed(2)}%</p>
            </div>
          </div>

          {/* ============= PERSON PARTICIPATION TIME SUMMARY ============= */}
          {personAttendanceRecords.length > 0 && (
            <div
              className="rounded-xl p-4 mb-6 border"
              style={{
                background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}08 0%, ${DESIGN_TOKENS.colors.brand.orange}08 100%)`,
                borderColor: `${DESIGN_TOKENS.colors.brand.orange}30`,
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Timer className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                <h4
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  Participation Time
                </h4>
                {personExcludedEventIds.size > 0 && (
                  <span className="ml-auto text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    {personExcludedEventIds.size} excluded
                  </span>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Time Spent</p>
                  <p className="text-lg font-bold" style={{ color: '#10b981' }}>
                    {personVolunteeringTimeStats.timeSpentFormatted}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Expected</p>
                  <p className="text-lg font-bold" style={{ color: '#3b82f6' }}>
                    {personVolunteeringTimeStats.expectedTimeFormatted}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Completion</p>
                  <p 
                    className="text-lg font-bold"
                    style={{ 
                      color: personVolunteeringTimeStats.completionRate >= 100 
                        ? '#10b981' 
                        : (personVolunteeringTimeStats.completionRate >= 80 ? '#f59e0b' : '#ef4444')
                    }}
                  >
                    {personVolunteeringTimeStats.completionRate.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3 relative h-2 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(personVolunteeringTimeStats.completionRate, 100)}%`,
                    background: `linear-gradient(90deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Attendance Records Table */}
          <div>
            <h4
              className="mb-4 flex items-center gap-2"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              }}
            >
              <Calendar className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              Attendance History ({personAttendanceStats.total} records)
            </h4>

            {isLoadingPersonAttendance ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              </div>
            ) : personAttendanceRecords.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No attendance records found for this member</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {personAttendanceRecords.map((record, index) => {
                  const eventData = events.find(e => e.EventID === record.eventId);
                  const statusColor = getStatusColor(record.status);
                  const statusLabel = getStatusLabel(record.status);
                  const hasNoLogoutFlag = hasNoLogout(record.timeIn, record.timeOut, record.status);
                  const timeSpentMins = calculateDurationMinutes(record.timeIn, record.timeOut);
                  const expectedMins = eventData?.StartTime && eventData?.EndTime 
                    ? calculateDurationMinutes(eventData.StartTime, eventData.EndTime) 
                    : 0;
                  const isExcluded = personExcludedEventIds.has(record.eventId);
                  
                  return (
                    <div
                      key={record.attendanceId || index}
                      className={`p-4 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer ${isExcluded ? 'opacity-50' : ''}`}
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        borderColor: isExcluded 
                          ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')
                          : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                      }}
                      onClick={() => {
                        setSelectedPersonRecord(record);
                        setShowPersonAttendanceModal(true);
                      }}
                    >
                      {/* Include/Exclude Toggle */}
                      <div className="flex justify-end mb-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePersonEventInclusion(record.eventId);
                          }}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium transition-all ${
                            isExcluded 
                              ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' 
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          }`}
                          title={isExcluded ? 'Include in time totals' : 'Exclude from time totals'}
                        >
                          {isExcluded ? <ToggleLeft className="w-3.5 h-3.5" /> : <ToggleRight className="w-3.5 h-3.5" />}
                          {isExcluded ? 'Excluded' : 'Included'}
                        </button>
                      </div>

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold truncate">
                              {eventData?.Title || `Event ${record.eventId}`}
                            </p>
                            {/* Status Badge */}
                            <span
                              className="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                              style={{ background: `${statusColor}20`, color: statusColor }}
                            >
                              {statusLabel}
                            </span>
                            {hasNoLogoutFlag && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                                style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
                              >
                                No Logout
                              </span>
                            )}
                            {record.isExternal && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                                style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed' }}
                              >
                                External
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatDateValue(record.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              In: {formatTimeValue(record.timeIn)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              Out: {hasNoLogoutFlag ? '-' : formatTimeValue(record.timeOut)}
                            </span>
                          </div>
                          
                          {/* Time Spent vs Expected */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-2 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                            <span className="flex items-center gap-1">
                              <Timer className="w-3.5 h-3.5" style={{ color: '#10b981' }} />
                              <span className="text-muted-foreground">Spent:</span>
                              <span className="font-semibold" style={{ color: '#10b981' }}>
                                {timeSpentMins > 0 ? formatMinutesToDuration(timeSpentMins) : '-'}
                              </span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Timer className="w-3.5 h-3.5" style={{ color: '#3b82f6' }} />
                              <span className="text-muted-foreground">Expected:</span>
                              <span className="font-semibold" style={{ color: '#3b82f6' }}>
                                {expectedMins > 0 ? formatMinutesToDuration(expectedMins) : 'N/A'}
                              </span>
                            </span>
                            {timeSpentMins > 0 && expectedMins > 0 && (
                              <span 
                                className="px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ 
                                  background: timeSpentMins >= expectedMins 
                                    ? 'rgba(16, 185, 129, 0.15)' 
                                    : (timeSpentMins >= expectedMins * 0.8 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)'),
                                  color: timeSpentMins >= expectedMins 
                                    ? '#10b981' 
                                    : (timeSpentMins >= expectedMins * 0.8 ? '#f59e0b' : '#ef4444'),
                                }}
                              >
                                {((timeSpentMins / expectedMins) * 100).toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronUp className="w-5 h-5 text-muted-foreground shrink-0 rotate-90" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============= VIEW RANKINGS BUTTON ============= */}
      {events.length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowRankingsModal(true)}
            className="w-full rounded-xl border p-4 flex items-center justify-center gap-3 transition-all hover:scale-[1.01] group"
            style={{
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}10 0%, ${DESIGN_TOKENS.colors.brand.orange}10 100%)`,
              borderColor: DESIGN_TOKENS.colors.brand.orange + '40',
            }}
          >
            <Trophy className="w-6 h-6 transition-transform group-hover:scale-110" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
            <span
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              }}
            >
              View Attendance Rankings
            </span>
            <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {effectiveEvents.length > 0 && (
        isLoadingAttendance ? (
          <StatsCardSkeleton isDark={isDark} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                borderColor: '#10b981',
              }}
              onClick={() => handleStatCardClick('Present')}
            >
              <p className="text-sm text-muted-foreground mb-1">Present</p>
              <p className="text-2xl font-bold" style={{ color: '#10b981' }}>
                {attendanceData.find(d => d.name === 'Present')?.value || 0}
              </p>
            </div>
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                borderColor: '#f59e0b',
              }}
              onClick={() => handleStatCardClick('Late')}
            >
              <p className="text-sm text-muted-foreground mb-1">Late</p>
              <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
                {attendanceData.find(d => d.name === 'Late')?.value || 0}
              </p>
            </div>
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                borderColor: '#3b82f6',
              }}
              onClick={() => handleStatCardClick('Excused')}
            >
              <p className="text-sm text-muted-foreground mb-1">Excused</p>
              <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                {attendanceData.find(d => d.name === 'Excused')?.value || 0}
              </p>
            </div>
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                borderColor: '#ef4444',
              }}
              onClick={() => handleStatCardClick('Absent')}
            >
              <p className="text-sm text-muted-foreground mb-1">Absent</p>
              <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>
                {attendanceData.find(d => d.name === 'Absent')?.value || 0}
              </p>
            </div>
            {/* Not Recorded Card */}
            <div
              className="rounded-xl p-4 border cursor-pointer hover:scale-105 transition-transform"
              style={{
                background: isDark ? 'rgba(107, 114, 128, 0.15)' : 'rgba(107, 114, 128, 0.1)',
                borderColor: '#6b7280',
              }}
              onClick={() => handleStatCardClick('Not Recorded')}
            >
              <p className="text-sm text-muted-foreground mb-1">Not Recorded</p>
              <p className="text-2xl font-bold" style={{ color: '#6b7280' }}>
                {notRecordedMembers.length}
              </p>
            </div>
          </div>
        )
      )}

      {/* Chart Type Selector - Context-Aware */}
      {effectiveEvents.length > 0 && (
        <div
          className="rounded-xl p-5 mb-6 border"
          style={{
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Header with Recommendation */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: `${DESIGN_TOKENS.colors.brand.orange}15` }}
              >
                <TrendingUp className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    margin: 0,
                  }}
                >
                  Visualization Type
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {effectiveEvents.length === 1 
                    ? 'Single event analysis' 
                    : `Comparing ${effectiveEvents.length} events`}
                </p>
              </div>
            </div>
            
            {/* Smart Recommendation Badge */}
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
              style={{
                background: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)',
                color: '#10b981',
              }}
            >
              <Sparkles className="w-4 h-4" />
              <span className="font-medium" style={{ textTransform: 'capitalize' }}>
                {recommendedChart} recommended
              </span>
            </div>
          </div>
          
          {/* Chart Type Cards - Show contextually relevant options */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Distribution Charts (always relevant) */}
            {([
              { 
                type: 'pie' as const, 
                label: 'Pie', 
                icon: PieChartIcon,
                desc: 'Overall distribution',
                relevance: effectiveEvents.length === 1 ? 'high' : 'medium',
              },
              { 
                type: 'donut' as const, 
                label: 'Donut', 
                icon: PieChartIcon,
                desc: 'With center stats',
                relevance: effectiveEvents.length === 1 ? 'high' : 'medium',
              },
              { 
                type: 'column' as const, 
                label: 'Column', 
                icon: BarChart3,
                desc: 'Status counts',
                relevance: effectiveEvents.length === 1 ? 'high' : 'low',
              },
              { 
                type: 'bar' as const, 
                label: 'Bar', 
                icon: BarChart3,
                desc: effectiveEvents.length > 1 ? 'Compare events' : 'By committee',
                relevance: effectiveEvents.length > 1 ? 'high' : 'medium',
              },
              { 
                type: 'line' as const, 
                label: 'Line', 
                icon: LineChartIcon,
                desc: effectiveEvents.length > 1 ? 'Event trends' : 'Committee trends',
                relevance: effectiveEvents.length > 3 ? 'high' : 'low',
              },
            ] as Array<{
              type: "pie" | "donut" | "column" | "bar" | "line";
              label: string;
              icon: typeof PieChartIcon;
              desc: string;
              relevance: ChartRelevance;
            }>)
              // Sort by relevance (high first) when multiple events selected
              .sort((a, b) => {
                const order: Record<ChartRelevance, number> = { high: 0, medium: 1, low: 2 };
                return order[a.relevance] - order[b.relevance];
              })
              .map((item) => {
                const isSelected = chartType === item.type;
                const isRecommended = item.type === recommendedChart;
                const IconComponent = item.icon;
                
                return (
                  <button
                    key={item.type}
                    onClick={() => setChartType(item.type)}
                    className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                      isSelected
                        ? 'border-[#f6421f] shadow-lg scale-[1.02]'
                        : isRecommended
                          ? 'border-green-500/50 hover:border-green-500'
                          : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                    style={{
                      background: isSelected 
                        ? `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange}15, ${DESIGN_TOKENS.colors.brand.orange}05)`
                        : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Recommended indicator */}
                    {isRecommended && !isSelected && (
                      <div 
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                        style={{ background: '#10b981', color: 'white' }}
                      >
                        ✓
                      </div>
                    )}
                    
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{
                        background: isSelected 
                          ? DESIGN_TOKENS.colors.brand.orange 
                          : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                      }}
                    >
                      <IconComponent 
                        className="w-5 h-5" 
                        style={{ 
                          color: isSelected 
                            ? 'white' 
                            : isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)' 
                        }} 
                      />
                    </div>
                    
                    {/* Label */}
                    <span 
                      className="font-semibold text-sm"
                      style={{ 
                        color: isSelected 
                          ? DESIGN_TOKENS.colors.brand.orange 
                          : undefined 
                      }}
                    >
                      {item.label}
                    </span>
                    
                    {/* Description */}
                    <span className="text-xs text-muted-foreground text-center leading-tight">
                      {item.desc}
                    </span>
                    
                    {/* Relevance indicator */}
                    {item.relevance === 'low' && (
                      <span className="text-[10px] text-muted-foreground/50 italic">
                        Less relevant
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* Chart Display */}
      {effectiveEvents.length > 0 && (
        <div
          className="rounded-xl p-6 mb-6 border"
          style={{
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h2
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                Attendance Analytics
              </h2>
              {!isLoadingAttendance && (
                <p className="text-sm text-muted-foreground mt-1">
                  {totalRecords} total record{totalRecords !== 1 ? 's' : ''} 
                  {effectiveEvents.length > 1 && ` across ${effectiveEvents.length} events`}
                  {selectedCommittee !== "All" && ` (filtered by ${selectedCommittee})`}
                </p>
              )}
            </div>
            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={isLoadingAttendance || attendanceRecords.length === 0}
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
                      <div className="text-xs text-muted-foreground">Excel-compatible format</div>
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
          </div>
          {renderChart()}
        </div>
      )}

      {/* Loading Empty State */}
      {effectiveEvents.length === 0 && isLoadingEvents && (
        <div
          className="rounded-xl p-12 text-center border"
          style={{
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex flex-col items-center justify-center">
            <Loader2 
              className="w-10 h-10 animate-spin mb-4" 
              style={{ color: DESIGN_TOKENS.colors.brand.orange }}
            />
            <p className="text-muted-foreground">Loading events...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {effectiveEvents.length === 0 && !isLoadingEvents && (
        <div
          className="rounded-xl p-12 text-center border"
          style={{
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            position: 'relative',
            zIndex: 0,
          }}
        >
          {events.length === 0 ? (
            <>
              <h3
                className="mb-2"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                No Events Available
              </h3>
              <p className="text-muted-foreground">
                There are no active or scheduled events to display attendance for.
              </p>
            </>
          ) : (
            <>
              <h3
                className="mb-2"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Search for Events
              </h3>
              <p className="text-muted-foreground">
                Use the search bar above to find and select events. You can search by name or date.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Try: "January 2026", "last 7 days", "this month", or event names
              </p>
            </>
          )}
        </div>
      )}
      </div>

      {/* Export Preview Modal - Two Tab System */}
      {showExportPreview && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={handleCloseExportModal}
        >
          <div
            className="rounded-xl w-full border flex flex-col overflow-hidden shadow-2xl"
            style={{
              maxWidth: exportModalTab === 'preview' && exportFormat === 'pdf' ? 900 : 600,
              maxHeight: '90vh',
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              transition: 'max-width 0.3s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Tab Navigation */}
            <div 
              className="shrink-0"
              style={{
                background: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                  {exportFormat === 'pdf' ? <FileText className="w-5 h-5" /> : <Download className="w-5 h-5" />}
                  Export {exportFormat === 'pdf' ? 'PDF' : 'Spreadsheet'}
                </h3>
                <button
                  onClick={handleCloseExportModal}
                  className="p-1.5 rounded-lg hover:bg-white/20 transition-colors text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Tab Buttons */}
              {exportFormat === 'pdf' && (
                <div className="px-5 pb-2 flex gap-2">
                  <button
                    onClick={() => setExportModalTab('preview')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      exportModalTab === 'preview'
                        ? 'bg-white text-[#f6421f] shadow-lg'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    onClick={() => setExportModalTab('settings')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      exportModalTab === 'settings'
                        ? 'bg-white text-[#f6421f] shadow-lg'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                </div>
              )}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Tab 1: PDF Preview */}
              {exportModalTab === 'preview' && exportFormat === 'pdf' && (
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
                        {effectiveEvents.length} event{effectiveEvents.length !== 1 ? 's' : ''} • {totalRecords} records
                      </span>
                      {exportOptions.selectedTables.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#f6421f]/10 text-[#f6421f] font-medium">
                          {exportOptions.selectedTables.length} table{exportOptions.selectedTables.length !== 1 ? 's' : ''} included
                        </span>
                      )}
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
                      <>
                        {/* Mobile: Show buttons instead of iframe (mobile browsers can't display PDF in iframe) */}
                        {isMobile ? (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 text-center p-8">
                            <div className="w-20 h-20 rounded-full bg-[#f6421f]/10 flex items-center justify-center">
                              <FileText className="w-10 h-10 text-[#f6421f]" />
                            </div>
                            <div>
                              <p className="font-semibold text-lg">PDF Ready</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                Mobile browsers can't preview PDFs inline.<br />
                                Use the buttons below to view or download.
                              </p>
                            </div>
                            <div className="flex flex-col gap-3 w-full max-w-xs">
                              <button
                                onClick={handleOpenPdfInNewTab}
                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors font-medium"
                              >
                                <ExternalLink className="w-5 h-5" />
                                Open PDF in New Tab
                              </button>
                              <button
                                onClick={handleDownloadPdfPreview}
                                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-[#f6421f] text-[#f6421f] hover:bg-[#f6421f]/10 transition-colors font-medium"
                              >
                                <Download className="w-5 h-5" />
                                Download PDF
                              </button>
                            </div>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Smartphone className="w-3 h-3" />
                              Mobile device detected
                            </p>
                          </div>
                        ) : (
                          /* Desktop: Show iframe preview */
                          <iframe
                            src={pdfPreviewUrl}
                            className="w-full h-full"
                            style={{ minHeight: 450 }}
                            title="PDF Preview"
                          />
                        )}
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center p-8">
                        <FileText className="w-16 h-16 text-muted-foreground/50" />
                        <div>
                          <p className="font-medium">No Preview Available</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Select tables in Settings tab and click Refresh to generate preview
                          </p>
                        </div>
                        <button
                          onClick={() => setExportModalTab('settings')}
                          className="mt-2 px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors text-sm"
                        >
                          Go to Settings
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Settings / Spreadsheet Config */}
              {(exportModalTab === 'settings' || exportFormat === 'spreadsheet') && (
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {/* Export Summary */}
                  <div 
                    className="p-4 rounded-lg border"
                    style={{
                      background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }}
                  >
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#f6421f]" />
                      Export Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Events:</span>{' '}
                        <strong>{effectiveEvents.length}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Total Records:</span>{' '}
                        <strong>{totalRecords}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Not Recorded:</span>{' '}
                        <strong>{notRecordedMembers.length}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Committee:</span>{' '}
                        <strong>{selectedCommittee}</strong>
                      </div>
                    </div>
                    
                    {effectiveEvents.length > 1 && (
                      <p className="text-xs text-muted-foreground mt-2 pt-2 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                        📄 Multi-event export will generate {effectiveEvents.length + 1} pages (1 summary + {effectiveEvents.length} event details)
                      </p>
                    )}
                  </div>

                  {/* Table Selection */}
                  <div>
                    <h4 className="font-semibold mb-3">Include Tables</h4>
                    <div className="space-y-2">
                      {([
                        { key: 'all', label: 'All Attendees', desc: 'Complete list of all attendance records' },
                        { key: 'present', label: 'Present', desc: 'Members who attended on time', color: '#10b981' },
                        { key: 'late', label: 'Late', desc: 'Members who arrived late', color: '#f59e0b' },
                        { key: 'excused', label: 'Excused', desc: 'Members with excused absences', color: '#3b82f6' },
                        { key: 'absent', label: 'Absent', desc: 'Members who were absent', color: '#ef4444' },
                        { key: 'notRecorded', label: 'Not Recorded', desc: 'Members with no attendance record', color: '#6b7280' },
                      ] as { key: ExportTableKey; label: string; desc: string; color?: string }[]).map((table) => (
                        <label
                          key={table.key}
                          className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          style={{
                            background: exportOptions.selectedTables.includes(table.key) 
                              ? (isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)')
                              : 'transparent',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={exportOptions.selectedTables.includes(table.key)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setExportOptions({
                                  ...exportOptions,
                                  selectedTables: [...exportOptions.selectedTables, table.key],
                                });
                              } else {
                                setExportOptions({
                                  ...exportOptions,
                                  selectedTables: exportOptions.selectedTables.filter(t => t !== table.key),
                                });
                              }
                            }}
                            className="w-4 h-4 rounded accent-[#f6421f]"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {table.color && (
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ background: table.color }}
                                />
                              )}
                              <span className="font-medium">{table.label}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">{table.desc}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Additional Options */}
                  <div>
                    <h4 className="font-semibold mb-3">Additional Options</h4>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeSummaryTable}
                          onChange={(e) => setExportOptions({ ...exportOptions, includeSummaryTable: e.target.checked })}
                          className="w-4 h-4 rounded accent-[#f6421f]"
                        />
                        <div className="flex-1">
                          <span className="font-medium">Include Summary Page</span>
                          <p className="text-xs text-muted-foreground">Overview with statistics and committee breakdown</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={exportOptions.includeCharts}
                          onChange={(e) => setExportOptions({ ...exportOptions, includeCharts: e.target.checked })}
                          className="w-4 h-4 rounded accent-[#f6421f]"
                        />
                        <div className="flex-1">
                          <span className="font-medium">Include Charts</span>
                          <p className="text-xs text-muted-foreground">Visual charts in the export (PDF only)</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Events to Export (for multi-event) */}
                  {effectiveEvents.length > 1 && (
                    <div>
                      <h4 className="font-semibold mb-3">Events to Export</h4>
                      <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border p-2" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                        {effectiveEvents.map((eventId, index) => {
                          const event = events.find(e => e.EventID === eventId);
                          const eventRecords = multiEventRecords.get(eventId) || [];
                          return (
                            <div 
                              key={eventId}
                              className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <span className="truncate flex-1">{index + 1}. {event?.Title || 'Unknown'}</span>
                              <span className="text-muted-foreground ml-2">{eventRecords.length} records</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Preview Hint for PDF */}
                  {exportFormat === 'pdf' && (
                    <div 
                      className="p-3 rounded-lg border flex items-center gap-3"
                      style={{
                        background: isDark ? 'rgba(246,66,31,0.1)' : 'rgba(246,66,31,0.05)',
                        borderColor: isDark ? 'rgba(246,66,31,0.3)' : 'rgba(246,66,31,0.2)',
                      }}
                    >
                      <Eye className="w-5 h-5 text-[#f6421f] shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">Preview Available</p>
                        <p className="text-xs text-muted-foreground">Switch to the Preview tab to see exactly how your PDF will look before exporting.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div 
              className="px-5 py-4 border-t shrink-0 flex items-center justify-between gap-3"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <div className="text-sm text-muted-foreground">
                {exportOptions.selectedTables.length === 0 ? (
                  <span className="text-amber-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Select at least one table</span>
                ) : (
                  <span>{exportOptions.selectedTables.length} table{exportOptions.selectedTables.length !== 1 ? 's' : ''} selected</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCloseExportModal}
                  className="px-4 py-2 rounded-lg border hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleCloseExportModal();
                    if (exportFormat === 'pdf') {
                      handleExportPDF();
                    } else {
                      handleExportSpreadsheet();
                    }
                  }}
                  disabled={exportOptions.selectedTables.length === 0}
                  className="px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
                >
                  <Download className="w-4 h-4" />
                  Export {exportFormat === 'pdf' ? 'PDF' : 'Spreadsheet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Member List Modal */}
      {showModal && modalData && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="rounded-xl w-full border flex flex-col overflow-hidden shadow-2xl"
            style={{
              maxWidth: 480,
              maxHeight: 'min(600px, 80vh)',
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              zIndex: 10000,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fixed Header */}
            <div 
              className="px-5 py-4 border-b shrink-0"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <h3
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: modalData.status === 'Present' ? '#10b981' 
                         : modalData.status === 'Late' ? '#f59e0b'
                         : modalData.status === 'Excused' ? '#3b82f6'
                         : modalData.status === 'Absent' ? '#ef4444'
                         : modalData.status === 'Not Recorded' ? '#6b7280'
                         : DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  {modalData.status} Members
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Summary Stats */}
              <div className="flex items-center gap-4 text-sm">
                <div 
                  className="px-3 py-1.5 rounded-full font-semibold"
                  style={{
                    background: modalData.status === 'Present' ? 'rgba(16, 185, 129, 0.15)' 
                             : modalData.status === 'Late' ? 'rgba(245, 158, 11, 0.15)'
                             : modalData.status === 'Excused' ? 'rgba(59, 130, 246, 0.15)'
                             : modalData.status === 'Absent' ? 'rgba(239, 68, 68, 0.15)'
                             : modalData.status === 'Not Recorded' ? 'rgba(107, 114, 128, 0.15)'
                             : 'rgba(128, 128, 128, 0.15)',
                    color: modalData.status === 'Present' ? '#10b981' 
                         : modalData.status === 'Late' ? '#f59e0b'
                         : modalData.status === 'Excused' ? '#3b82f6'
                         : modalData.status === 'Absent' ? '#ef4444'
                         : modalData.status === 'Not Recorded' ? '#6b7280'
                         : '#888',
                  }}
                >
                  {modalData.members.length} member{modalData.members.length !== 1 ? 's' : ''}
                </div>
                {modalData.status !== 'Not Recorded' && totalRecords > 0 && (
                  <span className="text-muted-foreground">
                    {Math.round((modalData.members.length / totalRecords) * 100)}% of total recorded
                  </span>
                )}
                {modalData.status === 'Not Recorded' && allMembers.length > 0 && (
                  <span className="text-muted-foreground">
                    {Math.round((modalData.members.length / allMembers.length) * 100)}% of all members
                  </span>
                )}
              </div>
              
              {/* Event Info */}
              {effectiveEvents.length > 0 && events.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {effectiveEvents.length === 1 
                    ? `Event: ${events.find(e => e.EventID === effectiveEvents[0])?.Title || effectiveEvents[0]}`
                    : `${effectiveEvents.length} events selected`
                  }
                </p>
              )}
            </div>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 min-h-0">
              {modalData.members.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center mb-3 shrink-0"
                    style={{ 
                      background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' 
                    }}
                  >
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-muted-foreground font-medium">No members found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No members have this status for the selected filters
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {modalData.members.map((member, index) => (
                    <div
                      key={member.id || index}
                      className="p-3 rounded-lg flex items-center gap-3 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                      style={{
                        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                      }}
                    >
                      {/* Profile Picture */}
                      {member.profilePicture ? (
                        <img 
                          src={member.profilePicture} 
                          alt={member.name}
                          className="rounded-full object-cover shrink-0"
                          style={{
                            width: 44,
                            height: 44,
                            minWidth: 44,
                            minHeight: 44,
                            maxWidth: 44,
                            maxHeight: 44,
                            border: `2px solid ${
                              modalData.status === 'Present' ? 'rgba(16, 185, 129, 0.5)' 
                              : modalData.status === 'Late' ? 'rgba(245, 158, 11, 0.5)'
                              : modalData.status === 'Excused' ? 'rgba(59, 130, 246, 0.5)'
                              : modalData.status === 'Absent' ? 'rgba(239, 68, 68, 0.5)'
                              : 'rgba(128, 128, 128, 0.5)'
                            }`,
                          }}
                        />
                      ) : (
                        <div 
                          className="rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                          style={{ 
                            width: 44,
                            height: 44,
                            minWidth: 44,
                            minHeight: 44,
                            background: modalData.status === 'Present' ? '#10b981' 
                                      : modalData.status === 'Late' ? '#f59e0b'
                                      : modalData.status === 'Excused' ? '#3b82f6'
                                      : modalData.status === 'Absent' ? '#ef4444'
                                      : DESIGN_TOKENS.colors.brand.orange,
                          }}
                        >
                          {member.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      )}
                      
                      {/* Member Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold truncate">{member.name || 'Unknown'}</p>
                          {/* External/Late Badges */}
                          {member.isExternal && (
                            <span 
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded shrink-0"
                              style={{ 
                                background: 'rgba(124, 58, 237, 0.15)', 
                                color: '#7c3aed' 
                              }}
                            >
                              EXT
                            </span>
                          )}
                          {member.lateTimeIn && (
                            <span 
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded shrink-0"
                              style={{ 
                                background: 'rgba(245, 158, 11, 0.15)', 
                                color: '#d97706' 
                              }}
                            >
                              LATE-IN
                            </span>
                          )}
                          {member.lateTimeOut && (
                            <span 
                              className="px-1.5 py-0.5 text-[10px] font-semibold rounded shrink-0"
                              style={{ 
                                background: 'rgba(239, 68, 68, 0.15)', 
                                color: '#dc2626' 
                              }}
                            >
                              LATE-OUT
                            </span>
                          )}
                        </div>
                        {member.committee && (
                          <p className="text-xs text-muted-foreground truncate">
                            {member.committee}
                          </p>
                        )}
                        {member.position && (
                          <p className="text-xs truncate" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                            {member.position}
                          </p>
                        )}
                      </div>
                      
                      {/* Index Badge */}
                      <div 
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
                          color: isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)',
                        }}
                      >
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Fixed Footer */}
            <div 
              className="px-4 py-3 border-t shrink-0"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              }}
            >
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    // Copy member names to clipboard
                    const names = modalData.members.map(m => m.name).join('\n');
                    navigator.clipboard.writeText(names);
                    toast.success('Copied to clipboard!', {
                      description: `${modalData.members.length} member names copied`,
                    });
                  }}
                  disabled={modalData.members.length === 0}
                  className="flex-1 px-4 py-2 rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                  style={{ 
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
                  }}
                >
                  Copy Names
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors"
                  style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============= PERSON ATTENDANCE RECORD DETAIL MODAL ============= */}
      {showPersonAttendanceModal && selectedPersonRecord && selectedPerson && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 9999 }}
          onClick={() => {
            setShowPersonAttendanceModal(false);
            setSelectedPersonRecord(null);
          }}
        >
          <div
            className="rounded-2xl w-full border flex flex-col overflow-hidden shadow-2xl"
            style={{
              maxWidth: 500,
              maxHeight: 'min(85vh, 700px)',
              background: isDark 
                ? 'linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(31, 41, 55, 0.98) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              boxShadow: isDark 
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05)' 
                : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header with Status Banner */}
            <div
              className="shrink-0"
              style={{
                background: `linear-gradient(135deg, ${getStatusColor(selectedPersonRecord.status)} 0%, ${getStatusColor(selectedPersonRecord.status)}cc 100%)`,
              }}
            >
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-white/20">
                    {getStatusLabel(selectedPersonRecord.status) === 'Present' && <CheckCircle2 className="w-5 h-5 text-white" />}
                    {getStatusLabel(selectedPersonRecord.status) === 'Late' && <Clock className="w-5 h-5 text-white" />}
                    {getStatusLabel(selectedPersonRecord.status) === 'Excused' && <AlertCircle className="w-5 h-5 text-white" />}
                    {getStatusLabel(selectedPersonRecord.status) === 'Absent' && <X className="w-5 h-5 text-white" />}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-lg">{getStatusLabel(selectedPersonRecord.status)}</h3>
                    <p className="text-white/80 text-sm">Attendance Record</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowPersonAttendanceModal(false);
                    setSelectedPersonRecord(null);
                  }}
                  className="p-2 rounded-lg hover:bg-white/20 transition-colors text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Member Info Card */}
              <div
                className="p-4 rounded-xl flex items-center gap-4"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                }}
              >
                {selectedPerson.profilePicture ? (
                  <img
                    src={selectedPerson.profilePicture}
                    alt={selectedPerson.name}
                    className="w-14 h-14 rounded-full object-cover shrink-0"
                    style={{ border: `3px solid ${getStatusColor(selectedPersonRecord.status)}` }}
                  />
                ) : (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
                    style={{ background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)` }}
                  >
                    {getInitials(selectedPerson.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg truncate">{selectedPerson.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{selectedPerson.committee || 'No committee'}</p>
                  {selectedPerson.position && (
                    <p className="text-sm truncate" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>{selectedPerson.position}</p>
                  )}
                </div>
              </div>

              {/* Event Info */}
              <div
                className="p-4 rounded-xl space-y-3"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                }}
              >
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                  <Calendar className="w-4 h-4" />
                  Event Details
                </div>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-20 shrink-0">Event:</span>
                    <span className="text-sm font-medium">
                      {events.find(e => e.EventID === selectedPersonRecord.eventId)?.Title || selectedPersonRecord.eventId}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-20 shrink-0">Date:</span>
                    <span className="text-sm font-medium">{formatDateValue(selectedPersonRecord.date)}</span>
                  </div>
                </div>
              </div>

              {/* Time Details */}
              <div
                className="p-4 rounded-xl space-y-3"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                }}
              >
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                  <Clock className="w-4 h-4" />
                  Time Details
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    className="p-3 rounded-lg text-center"
                    style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}
                  >
                    <p className="text-xs text-muted-foreground mb-1">Time In</p>
                    <p className="text-lg font-bold" style={{ color: '#10b981' }}>
                      {formatTimeValue(selectedPersonRecord.timeIn)}
                    </p>
                    {selectedPersonRecord.lateTimeIn && (
                      <span className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#d97706' }}>
                        Late
                      </span>
                    )}
                  </div>
                  <div
                    className="p-3 rounded-lg text-center"
                    style={{ 
                      background: hasNoLogout(selectedPersonRecord.timeIn, selectedPersonRecord.timeOut, selectedPersonRecord.status) 
                        ? 'rgba(239, 68, 68, 0.1)' 
                        : 'rgba(239, 68, 68, 0.1)', 
                      border: hasNoLogout(selectedPersonRecord.timeIn, selectedPersonRecord.timeOut, selectedPersonRecord.status)
                        ? '1px solid rgba(239, 68, 68, 0.3)'
                        : '1px solid rgba(239, 68, 68, 0.2)' 
                    }}
                  >
                    <p className="text-xs text-muted-foreground mb-1">Time Out</p>
                    <p className="text-lg font-bold" style={{ color: '#ef4444' }}>
                      {hasNoLogout(selectedPersonRecord.timeIn, selectedPersonRecord.timeOut, selectedPersonRecord.status) 
                        ? 'N/A' 
                        : formatTimeValue(selectedPersonRecord.timeOut)}
                    </p>
                    {selectedPersonRecord.lateTimeOut && !hasNoLogout(selectedPersonRecord.timeIn, selectedPersonRecord.timeOut, selectedPersonRecord.status) && (
                      <span className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#d97706' }}>
                        Late
                      </span>
                    )}
                    {hasNoLogout(selectedPersonRecord.timeIn, selectedPersonRecord.timeOut, selectedPersonRecord.status) && (
                      <span className="text-xs px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                        No Logout
                      </span>
                    )}
                  </div>
                </div>
                {/* Duration */}
                {!hasNoLogout(selectedPersonRecord.timeIn, selectedPersonRecord.timeOut, selectedPersonRecord.status) && selectedPersonRecord.timeIn && selectedPersonRecord.timeOut && (
                  <div
                    className="p-3 rounded-lg text-center"
                    style={{ background: `${DESIGN_TOKENS.colors.brand.orange}10`, border: `1px solid ${DESIGN_TOKENS.colors.brand.orange}30` }}
                  >
                    <p className="text-xs text-muted-foreground mb-1">Duration</p>
                    <p className="text-lg font-bold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                      {calculateAttendanceDuration(selectedPersonRecord.timeIn, selectedPersonRecord.timeOut)}
                    </p>
                  </div>
                )}
              </div>

              {/* Recorded By */}
              {(selectedPersonRecord.recordedByTimeIn || selectedPersonRecord.recordedByTimeOut) && (
                <div
                  className="p-4 rounded-xl space-y-3"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                    <User className="w-4 h-4" />
                    Recorded By
                  </div>
                  <div className="space-y-2">
                    {selectedPersonRecord.recordedByTimeIn && (
                      <div className="flex items-start gap-3">
                        <span className="text-sm text-muted-foreground w-20 shrink-0">Time In:</span>
                        <span className="text-sm">{selectedPersonRecord.recordedByTimeIn}</span>
                      </div>
                    )}
                    {selectedPersonRecord.recordedByTimeOut && (
                      <div className="flex items-start gap-3">
                        <span className="text-sm text-muted-foreground w-20 shrink-0">Time Out:</span>
                        <span className="text-sm">{selectedPersonRecord.recordedByTimeOut}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedPersonRecord.notes && (
                <div
                  className="p-4 rounded-xl space-y-2"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
                  }}
                >
                  <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                    <FileText className="w-4 h-4" />
                    Notes
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedPersonRecord.notes}</p>
                </div>
              )}

              {/* Badges Row */}
              {(selectedPersonRecord.isExternal || selectedPersonRecord.lateTimeIn || selectedPersonRecord.lateTimeOut) && (
                <div className="flex flex-wrap gap-2">
                  {selectedPersonRecord.isExternal && (
                    <span
                      className="px-3 py-1.5 rounded-full text-sm font-semibold"
                      style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed' }}
                    >
                      External Attendee
                    </span>
                  )}
                  {selectedPersonRecord.lateTimeIn && (
                    <span
                      className="px-3 py-1.5 rounded-full text-sm font-semibold"
                      style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}
                    >
                      Late Time In
                    </span>
                  )}
                  {selectedPersonRecord.lateTimeOut && (
                    <span
                      className="px-3 py-1.5 rounded-full text-sm font-semibold"
                      style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}
                    >
                      Late Time Out
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="px-5 py-4 border-t shrink-0"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              }}
            >
              <button
                onClick={() => {
                  setShowPersonAttendanceModal(false);
                  setSelectedPersonRecord(null);
                }}
                className="w-full px-4 py-3 rounded-xl text-white transition-colors font-semibold"
                style={{ background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)` }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============= ATTENDANCE RANKINGS MODAL ============= */}
      {showRankingsModal && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 backdrop-blur-md"
          style={{ zIndex: 10001, background: 'rgba(15, 23, 42, 0.82)' }}
          onClick={() => setShowRankingsModal(false)}
        >
          {/* Modal Content */}
          <div 
            className="relative w-full max-w-4xl max-h-[90vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div 
              className="px-6 py-4 border-b flex items-center justify-between shrink-0"
              style={{
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}15 0%, ${DESIGN_TOKENS.colors.brand.orange}15 100%)`,
              }}
            >
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                <h2
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  Attendance Rankings
                </h2>
              </div>
              <button
                onClick={() => setShowRankingsModal(false)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 border-b flex flex-wrap items-center gap-4 shrink-0" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              {/* Filter Type Tabs */}
              <div className="flex rounded-lg border overflow-hidden" style={{ borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }}>
                {(['all', 'events', 'committee'] as const).map((filterType) => (
                  <button
                    key={filterType}
                    onClick={() => setRankingsFilterType(filterType)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      rankingsFilterType === filterType
                        ? 'text-white'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    style={{
                      background: rankingsFilterType === filterType
                        ? `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`
                        : undefined,
                    }}
                  >
                    {filterType === 'all' ? 'All Events' : filterType === 'events' ? 'Select Events' : 'By Committee'}
                  </button>
                ))}
              </div>

              {/* Events Multi-Select (shown when filter type is 'events') */}
              {rankingsFilterType === 'events' && (
                <div className="flex-1 min-w-[200px]">
                  <CustomDropdown
                    label=""
                    value={rankingsSelectedEventIds.length > 0 ? `${rankingsSelectedEventIds.length} event(s) selected` : 'Select events...'}
                    options={events.map(e => ({ value: e.EventID, label: e.Title }))}
                    onChange={(val) => {
                      const eventId = val;
                      setRankingsSelectedEventIds(prev => 
                        prev.includes(eventId) 
                          ? prev.filter(id => id !== eventId)
                          : [...prev, eventId]
                      );
                    }}
                    isDark={isDark}
                    selectedValues={rankingsSelectedEventIds}
                    multiSelect
                  />
                </div>
              )}

              {/* Committee Dropdown (shown when filter type is 'committee') */}
              {rankingsFilterType === 'committee' && (
                <div className="min-w-[200px]">
                  <CustomDropdown
                    label=""
                    value={rankingsSelectedCommittee}
                    options={[
                      { value: 'All', label: 'All Committees' },
                      ...YSP_COMMITTEE_NAMES.map(c => ({ value: c, label: c })),
                    ]}
                    onChange={setRankingsSelectedCommittee}
                    isDark={isDark}
                    dropdownMinWidth={320}
                    allowOptionWrap
                  />
                </div>
              )}

              {/* Export Button */}
              <button
                onClick={exportRankingsToPDF}
                disabled={percentageRankings.length === 0}
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)`,
                }}
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
            </div>

            {/* Rankings Info Bar */}
            <div className="px-6 py-2 border-b flex items-center gap-2 text-sm text-muted-foreground shrink-0" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}>
              <Users className="w-4 h-4" />
              <span>{percentageRankings.length} members ranked</span>
              <span className="mx-2">•</span>
              <span>
                {rankingsFilterType === 'all' 
                  ? `${events.length} total events` 
                  : rankingsFilterType === 'events' 
                    ? `${rankingsSelectedEventIds.length} selected event(s)`
                    : `Committee: ${rankingsSelectedCommittee}`
                }
              </span>
            </div>

            {/* Rankings List */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingRankingsData ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Loader2 className="w-10 h-10 animate-spin mb-3" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                  <p className="text-muted-foreground font-medium">Loading rankings data...</p>
                  <p className="text-sm text-muted-foreground mt-1">Fetching attendance from all events</p>
                </div>
              ) : percentageRankings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <AlertCircle className="w-12 h-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No rankings available</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {rankingsFilterType === 'events' && rankingsSelectedEventIds.length === 0
                      ? 'Please select at least one event'
                      : 'No attendance data found for the selected filter'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Top 3 Podium Display */}
                  {percentageRankings.length >= 3 && (() => {
                    // Helper function to get colors based on actual rank
                    const getRankColors = (rank: number) => {
                      if (rank === 1) return {
                        circleBg: 'linear-gradient(135deg, #ffd700 0%, #ffed4a 100%)',
                        circleBorder: '#d4a500',
                        boxShadow: '0 0 30px rgba(255, 215, 0, 0.5)',
                        podiumBg: 'linear-gradient(180deg, #ffd700 0%, #d4a500 100%)',
                        podiumText: '#92400e',
                        percentColor: DESIGN_TOKENS.colors.brand.orange,
                        iconColor: '#92400e',
                      };
                      if (rank === 2) return {
                        circleBg: 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)',
                        circleBorder: '#a0a0a0',
                        boxShadow: 'none',
                        podiumBg: 'linear-gradient(180deg, #c0c0c0 0%, #a0a0a0 100%)',
                        podiumText: '#3f3f46',
                        percentColor: '#71717a',
                        iconColor: '#3f3f46',
                      };
                      return {
                        circleBg: 'linear-gradient(135deg, #cd7f32 0%, #e5a055 100%)',
                        circleBorder: '#a66628',
                        boxShadow: 'none',
                        podiumBg: 'linear-gradient(180deg, #cd7f32 0%, #a66628 100%)',
                        podiumText: '#fffbeb',
                        percentColor: '#cd7f32',
                        iconColor: '#78350f',
                      };
                    };
                    
                    const getRankSuffix = (r: number) => r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
                    
                    const rank0 = percentageRankings[0]?.rank || 1;
                    const rank1 = percentageRankings[1]?.rank || 2;
                    const rank2 = percentageRankings[2]?.rank || 3;
                    
                    const colors0 = getRankColors(rank0);
                    const colors1 = getRankColors(rank1);
                    const colors2 = getRankColors(rank2);
                    
                    return (
                    <div className="flex items-end justify-center gap-2 sm:gap-4 mb-6 sm:mb-8 pt-4 px-2">
                      {/* 2nd Place Position (LEFT) */}
                      <div className="flex flex-col items-center flex-1 max-w-[120px]">
                        <div 
                          className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mb-1 sm:mb-2 overflow-hidden border-2"
                          style={{ 
                            background: colors1.circleBg,
                            borderColor: colors1.circleBorder,
                            boxShadow: colors1.boxShadow,
                          }}
                        >
                          {percentageRankings[1]?.member.profilePicture ? (
                            <img 
                              src={percentageRankings[1].member.profilePicture} 
                              alt={percentageRankings[1].member.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                          ) : null}
                          {rank1 === 1 ? (
                            <Trophy className={`w-6 h-6 sm:w-8 sm:h-8 ${percentageRankings[1]?.member.profilePicture ? 'hidden' : ''}`} style={{ color: colors1.iconColor }} />
                          ) : (
                            <Medal className={`w-6 h-6 sm:w-8 sm:h-8 ${percentageRankings[1]?.member.profilePicture ? 'hidden' : ''}`} style={{ color: colors1.iconColor }} />
                          )}
                        </div>
                        <p className="font-semibold text-xs sm:text-sm text-center w-full truncate px-1">
                          {percentageRankings[1]?.member.name}
                        </p>
                        <p className="text-sm sm:text-lg font-bold" style={{ color: colors1.percentColor }}>
                          {percentageRankings[1]?.completionRate.toFixed(2)}%
                        </p>
                        <div 
                          className="w-full max-w-[80px] h-14 sm:h-16 rounded-t-lg flex items-center justify-center text-xl sm:text-2xl font-bold mt-1"
                          style={{ background: colors1.podiumBg, color: colors1.podiumText }}
                        >
                          {rank1}{getRankSuffix(rank1)}
                        </div>
                      </div>

                      {/* 1st Place Position (CENTER) */}
                      <div className="flex flex-col items-center flex-1 max-w-[140px] -mt-4">
                        <div 
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mb-1 sm:mb-2 shadow-lg overflow-hidden border-3"
                          style={{ 
                            background: colors0.circleBg,
                            boxShadow: colors0.boxShadow,
                            borderColor: colors0.circleBorder,
                            borderWidth: '3px',
                          }}
                        >
                          {percentageRankings[0]?.member.profilePicture ? (
                            <img 
                              src={percentageRankings[0].member.profilePicture} 
                              alt={percentageRankings[0].member.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                          ) : null}
                          <Trophy className={`w-8 h-8 sm:w-10 sm:h-10 ${percentageRankings[0]?.member.profilePicture ? 'hidden' : ''}`} style={{ color: colors0.iconColor }} />
                        </div>
                        <p className="font-bold text-sm sm:text-base text-center w-full truncate px-1">
                          {percentageRankings[0]?.member.name}
                        </p>
                        <p className="text-base sm:text-xl font-bold" style={{ color: colors0.percentColor }}>
                          {percentageRankings[0]?.completionRate.toFixed(2)}%
                        </p>
                        <div 
                          className="w-full max-w-[100px] h-20 sm:h-24 rounded-t-lg flex items-center justify-center text-2xl sm:text-3xl font-bold mt-1"
                          style={{ background: colors0.podiumBg, color: colors0.podiumText }}
                        >
                          {rank0}{getRankSuffix(rank0)}
                        </div>
                      </div>

                      {/* 3rd Place Position (RIGHT) */}
                      <div className="flex flex-col items-center flex-1 max-w-[110px]">
                        <div 
                          className="w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-1 sm:mb-2 overflow-hidden border-2"
                          style={{ 
                            background: colors2.circleBg,
                            borderColor: colors2.circleBorder,
                            boxShadow: colors2.boxShadow,
                          }}
                        >
                          {percentageRankings[2]?.member.profilePicture ? (
                            <img 
                              src={percentageRankings[2].member.profilePicture} 
                              alt={percentageRankings[2].member.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }}
                            />
                          ) : null}
                          {rank2 === 1 ? (
                            <Trophy className={`w-5 h-5 sm:w-7 sm:h-7 ${percentageRankings[2]?.member.profilePicture ? 'hidden' : ''}`} style={{ color: colors2.iconColor }} />
                          ) : rank2 === 2 ? (
                            <Medal className={`w-5 h-5 sm:w-7 sm:h-7 ${percentageRankings[2]?.member.profilePicture ? 'hidden' : ''}`} style={{ color: colors2.iconColor }} />
                          ) : (
                            <Award className={`w-5 h-5 sm:w-7 sm:h-7 ${percentageRankings[2]?.member.profilePicture ? 'hidden' : ''}`} style={{ color: colors2.iconColor }} />
                          )}
                        </div>
                        <p className="font-semibold text-xs sm:text-sm text-center w-full truncate px-1">
                          {percentageRankings[2]?.member.name}
                        </p>
                        <p className="text-sm sm:text-lg font-bold" style={{ color: colors2.percentColor }}>
                          {percentageRankings[2]?.completionRate.toFixed(2)}%
                        </p>
                        <div 
                          className="w-full max-w-[70px] h-10 sm:h-12 rounded-t-lg flex items-center justify-center text-lg sm:text-xl font-bold mt-1"
                          style={{ background: colors2.podiumBg, color: colors2.podiumText }}
                        >
                          {rank2}{getRankSuffix(rank2)}
                        </div>
                      </div>
                    </div>
                    );
                  })()}

                  {/* Full Rankings Table */}
                  <div
                    className="rounded-xl border overflow-hidden"
                    style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                  >
                    <div
                      className="border-b px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                      style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }}
                    >
                      <div className="text-sm text-muted-foreground">
                        Showing {percentageRankings.length === 0 ? 0 : ((rankingsPage - 1) * RANKINGS_PAGE_SIZE) + 1}
                        {' '}-{' '}
                        {Math.min(rankingsPage * RANKINGS_PAGE_SIZE, percentageRankings.length)} of {percentageRankings.length}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">Rows per page</span>
                        <div
                          className="px-3 py-1 rounded-md border font-semibold"
                          style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }}
                        >
                          {RANKINGS_PAGE_SIZE}
                        </div>
                      </div>
                    </div>

                    <div
                      className="overflow-auto"
                      style={{ maxHeight: '360px' }}
                      onScroll={(event) => {
                        const target = event.currentTarget;
                        const reachedBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 24;
                        if (reachedBottom) {
                          setRankingsVisibleRows((current) => Math.min(RANKINGS_PAGE_SIZE, current + 5));
                        }
                      }}
                    >
                      <table className="min-w-[760px] w-full table-fixed">
                        <thead className="sticky top-0 z-10">
                          <tr style={{ background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)' }}>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Rank</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[220px]">Member</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[180px]">Committee</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[140px]">Completion</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[120px]">Attended</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[140px]">Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}>
                          {paginatedRankings.map((ranked) => {
                            const isTop3 = ranked.rank <= 3;
                            let rowBg = '';
                            let rowBorder = '';
                            if (ranked.rank === 1) {
                              rowBg = 'rgba(255, 215, 0, 0.15)';
                              rowBorder = '#ffd700';
                            } else if (ranked.rank === 2) {
                              rowBg = 'rgba(192, 192, 192, 0.15)';
                              rowBorder = '#c0c0c0';
                            } else if (ranked.rank === 3) {
                              rowBg = 'rgba(205, 127, 50, 0.15)';
                              rowBorder = '#cd7f32';
                            }

                            return (
                              <tr
                                key={ranked.member.id}
                                className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                                style={{
                                  background: isTop3 ? rowBg : undefined,
                                  borderLeft: isTop3 ? `4px solid ${rowBorder}` : undefined,
                                }}
                              >
                                <td className="px-4 py-3 align-middle">
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                                    style={{
                                      background: isTop3
                                        ? (ranked.rank === 1 ? 'linear-gradient(135deg, #ffd700 0%, #ffed4a 100%)' : ranked.rank === 2 ? 'linear-gradient(135deg, #c0c0c0 0%, #e8e8e8 100%)' : 'linear-gradient(135deg, #cd7f32 0%, #e5a055 100%)')
                                        : (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'),
                                      color: isTop3
                                        ? (ranked.rank === 1 ? '#92400e' : ranked.rank === 2 ? '#3f3f46' : '#78350f')
                                        : undefined,
                                    }}
                                  >
                                    {ranked.rank}
                                  </div>
                                </td>
                                <td className="px-4 py-3 align-middle">
                                  <p className={isTop3 ? 'font-semibold truncate' : 'font-medium truncate'}>{ranked.member.name}</p>
                                </td>
                                <td className="px-4 py-3 text-sm text-muted-foreground align-middle truncate">
                                  {ranked.member.committee || 'General'}
                                </td>
                                <td className="px-4 py-3 text-center align-middle">
                                  <span
                                    className={`font-bold ${isTop3 ? 'text-lg' : ''}`}
                                    style={{ color: isTop3 ? DESIGN_TOKENS.colors.brand.orange : undefined }}
                                  >
                                    {ranked.completionRate.toFixed(2)}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-muted-foreground align-middle">
                                  {ranked.eventsAttended} / {ranked.totalEvents}
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-muted-foreground align-middle">
                                  {ranked.totalParticipationFormatted || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div
                      className="border-t px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }}
                    >
                      <div className="text-sm text-muted-foreground">
                        Page {rankingsPage} of {rankingsTotalPages}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setRankingsPage((current) => Math.max(1, current - 1));
                            setRankingsVisibleRows(Math.min(5, RANKINGS_PAGE_SIZE));
                          }}
                          disabled={rankingsPage === 1}
                          className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => {
                            setRankingsPage((current) => Math.min(rankingsTotalPages, current + 1));
                            setRankingsVisibleRows(Math.min(5, RANKINGS_PAGE_SIZE));
                          }}
                          disabled={rankingsPage === rankingsTotalPages}
                          className="px-3 py-2 rounded-lg border text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div 
              className="px-6 py-4 border-t shrink-0"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            >
              <button
                onClick={() => setShowRankingsModal(false)}
                className="w-full px-4 py-3 rounded-xl text-white transition-colors font-semibold hover:opacity-90"
                style={{ background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red} 0%, ${DESIGN_TOKENS.colors.brand.orange} 100%)` }}
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  );
}
