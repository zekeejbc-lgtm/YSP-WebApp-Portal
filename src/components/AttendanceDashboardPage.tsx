import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS } from "./design-system";
import CustomDropdown from "./CustomDropdown";
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
import { Loader2 } from "lucide-react";
import { fetchEventsSafe, EventData } from "../services/gasEventsService";
import { getEventAttendanceRecords, AttendanceRecord, getMembersForAttendance, MemberForAttendance } from "../services/gasAttendanceService";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

// Organization Logo URL
const ORG_LOGO_URL = "https://i.imgur.com/J4wddTW.png";
const ORG_NAME = "Youth Service Philippines";
const ORG_CHAPTER = "Tagum Chapter";

// Helper function to format time values properly (converts UTC to Manila time)
function formatTimeValue(timeValue: any): string {
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
  if (timeValue instanceof Date || (typeof timeValue === 'object' && timeValue?.getTime)) {
    try {
      const date = timeValue instanceof Date ? timeValue : new Date(timeValue);
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

// Helper function to format date values from backend
function formatDateValue(dateValue: any): string {
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
}

// Committee filter options
const COMMITTEES = [
  "All",
  "Executive Board (only heads/Officers)",
  "Only Members",
  "Only Volunteers",
  "Membership and Internal Affairs Committee",
  "External Relations Committee",
  "Secretariat and Documentation Committee",
  "Finance and Treasury Committee",
  "Program Development Committee",
  "Communications and Marketing Committee",
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
function ChartSkeleton({ isDark }: { isDark: boolean }) {
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
function ControlsSkeleton({ isDark }: { isDark: boolean }) {
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
}: AttendanceDashboardPageProps) {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedCommittee, setSelectedCommittee] = useState("All");
  const [chartType, setChartType] = useState<"pie" | "donut" | "bar" | "line" | "heatmap">("pie");
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{ status: string; members: MemberForAttendance[] } | null>(null);
  const [exportType, setExportType] = useState("");

  // Loading states
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  // Data states
  const [events, setEvents] = useState<EventData[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [allMembers, setAllMembers] = useState<MemberForAttendance[]>([]);

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

  // Fetch attendance records when event is selected
  useEffect(() => {
    const loadAttendance = async () => {
      if (!selectedEvent) {
        setAttendanceRecords([]);
        return;
      }

      setIsLoadingAttendance(true);
      try {
        const records = await getEventAttendanceRecords(selectedEvent);
        setAttendanceRecords(records);
      } catch (error) {
        console.error('Error fetching attendance records:', error);
        toast.error('Failed to load attendance records');
        setAttendanceRecords([]);
      } finally {
        setIsLoadingAttendance(false);
      }
    };

    loadAttendance();
  }, [selectedEvent]);

  // Filter attendance by committee
  const getFilteredAttendance = useCallback(() => {
    if (selectedCommittee === "All") {
      return attendanceRecords;
    }

    // Map committee filter to actual member data
    return attendanceRecords.filter((record) => {
      const member = allMembers.find((m) => m.id === record.memberId);
      if (!member) return false;

      switch (selectedCommittee) {
        case "Executive Board (only heads/Officers)":
          return member.position?.toLowerCase().includes('head') || 
                 member.position?.toLowerCase().includes('officer') ||
                 member.position?.toLowerCase().includes('president') ||
                 member.position?.toLowerCase().includes('vice') ||
                 member.position?.toLowerCase().includes('secretary') ||
                 member.position?.toLowerCase().includes('treasurer');
        case "Only Members":
          return member.position?.toLowerCase() === 'member' || 
                 member.position?.toLowerCase().includes('member');
        case "Only Volunteers":
          return member.position?.toLowerCase().includes('volunteer');
        default:
          // Committee-based filter
          return member.committee === selectedCommittee;
      }
    });
  }, [attendanceRecords, allMembers, selectedCommittee]);

  // Calculate attendance data for charts
  const getAttendanceData = useCallback(() => {
    const filtered = getFilteredAttendance();
    const present = filtered.filter((r) => r.status === 'Present' || r.status === 'CheckedIn' || r.status === 'CheckedOut').length;
    const late = filtered.filter((r) => r.status === 'Late').length;
    const excused = filtered.filter((r) => r.status === 'Excused').length;
    const absent = filtered.filter((r) => r.status === 'Absent').length;

    return [
      { name: "Present", value: present, color: "#10b981" },
      { name: "Late", value: late, color: "#f59e0b" },
      { name: "Excused", value: excused, color: "#3b82f6" },
      { name: "Absent", value: absent, color: "#ef4444" },
    ].filter((item) => item.value > 0); // Only show categories with values
  }, [getFilteredAttendance]);

  // Calculate bar chart data by committee
  const getBarChartData = useCallback(() => {
    const committeeData: Record<string, { Present: number; Late: number; Excused: number; Absent: number }> = {};

    attendanceRecords.forEach((record) => {
      const member = allMembers.find((m) => m.id === record.memberId);
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
  }, [attendanceRecords, allMembers]);

  // Get members by status for modal
  const getMembersByStatus = useCallback((status: string): MemberForAttendance[] => {
    const filtered = getFilteredAttendance();
    const statusMembers = filtered.filter((r) => {
      if (status === 'Present') {
        return r.status === 'Present' || r.status === 'CheckedIn' || r.status === 'CheckedOut';
      }
      return r.status === status;
    });

    return statusMembers.map((r) => {
      const member = allMembers.find((m) => m.id === r.memberId);
      return member || { id: r.memberId, name: r.memberName, committee: '', position: '' };
    });
  }, [getFilteredAttendance, allMembers]);

  const handleChartClick = (data: any) => {
    const status = data.name || data.status;
    const members = getMembersByStatus(status);
    setModalData({ status, members });
    setShowModal(true);
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

      const doc = new jsPDF('portrait', 'mm', 'a4');
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
      } catch (error) {
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

      const currentEvent = events.find(e => e.EventID === selectedEvent);
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
        { name: 'General Committee', short: 'GEN' },
      ];

      const filteredRecords = getFilteredAttendance();
      const totalMembers = allMembers.length;
      
      // Only count Present and Late as "attended" (not Excused or Absent)
      const actualAttendees = filteredRecords.filter(r => r.status === 'Present' || r.status === 'Late');
      const totalAttendees = actualAttendees.length;
      
      // Calculate committee stats - only count Present/Late as attended
      const committeeStats = committeeList.map(comm => {
        const isGeneral = comm.name === 'General Committee';
        const committeeMembersCount = allMembers.filter(m => {
          if (isGeneral) {
            return !m.committee || m.committee === '' || m.committee === 'None' || m.committee === 'General Committee';
          }
          return m.committee === comm.name;
        }).length;
        
        // Only count Present and Late status as "attended"
        const committeeAttendeesCount = filteredRecords.filter(r => {
          // Must be Present or Late to count as attended
          if (r.status !== 'Present' && r.status !== 'Late') return false;
          
          const member = allMembers.find(m => m.id === r.memberId);
          if (isGeneral) {
            return !member?.committee || member.committee === '' || member.committee === 'None' || member.committee === 'General Committee';
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

      // Helper function to create table data for a set of records
      const createTableData = (records: typeof filteredRecords, startIndex: number = 1) => {
        return records.map((record, index) => {
          const member = allMembers.find(m => m.id === record.memberId);
          return [
            String(startIndex + index),
            record.memberName || member?.name || 'Unknown',
            member?.committee || '-',
            member?.position || '-',
            record.status,
            formatTimeValue(record.timeIn),
            formatTimeValue(record.timeOut),
            record.recordedByTimeIn || '-',
            record.recordedByTimeOut || '-',
          ];
        });
      };

      // Group records by status
      const presentRecords = filteredRecords.filter(r => r.status === 'Present');
      const lateRecords = filteredRecords.filter(r => r.status === 'Late');
      const excusedRecords = filteredRecords.filter(r => r.status === 'Excused');
      const absentRecords = filteredRecords.filter(r => r.status === 'Absent');

      // Define table configurations for each status
      const tableConfigs = [
        {
          title: 'ALL ATTENDEES',
          records: filteredRecords,
          color: [246, 66, 31] as [number, number, number],
          altRowColor: [254, 249, 244] as [number, number, number],
        },
        {
          title: 'PRESENT',
          records: presentRecords,
          color: [16, 185, 129] as [number, number, number],
          altRowColor: [236, 253, 245] as [number, number, number],
        },
        {
          title: 'LATE',
          records: lateRecords,
          color: [245, 158, 11] as [number, number, number],
          altRowColor: [255, 251, 235] as [number, number, number],
        },
        {
          title: 'EXCUSED',
          records: excusedRecords,
          color: [59, 130, 246] as [number, number, number],
          altRowColor: [239, 246, 255] as [number, number, number],
        },
        {
          title: 'ABSENT',
          records: absentRecords,
          color: [239, 68, 68] as [number, number, number],
          altRowColor: [254, 242, 242] as [number, number, number],
        },
      ];

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

        // Create table with autoTable
        autoTable(doc, {
          startY: yPosition,
          head: [['#', 'Name', 'Committee', 'Position', 'Status', 'Time In', 'Time Out', 'Rec. By (In)', 'Rec. By (Out)']],
          body: tableData.length > 0 ? tableData : [['-', 'No records', '-', '-', '-', '-', '-', '-', '-']],
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
            1: { cellWidth: 28 },
            2: { cellWidth: 28 },
            3: { cellWidth: 18 },
            4: { cellWidth: 14, halign: 'center' },
            5: { cellWidth: 16, halign: 'center' },
            6: { cellWidth: 16, halign: 'center' },
            7: { cellWidth: 22 },
            8: { cellWidth: 22 },
          },
          styles: {
            lineColor: [220, 220, 220],
            lineWidth: 0.1,
          },
          margin: { left: margin, right: margin },
        });

        // Get the final Y position after the table
        yPosition = (doc as any).lastAutoTable.finalY + 12;

        // Check if we need a new page for the next table
        if (yPosition > pageHeight - 50 && configIndex < tableConfigs.length - 1) {
          doc.addPage();
          yPosition = 20;
        }
      }

      // ============================================
      // LAST PAGE: Charts
      // ============================================
      
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

      const currentEvent = events.find(e => e.EventID === selectedEvent);
      const filteredRecords = getFilteredAttendance();

      // Step 2: Prepare data (50%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Preparing attendance data...', progress: 50 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();

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
        ['#', 'Full Name', 'Committee', 'Position', 'Status', 'Time In', 'Time Out', 'Recorded By (In)', 'Recorded By (Out)', 'Notes'],
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
        headerData.push([
          index + 1,
          record.memberName || member?.name || 'Unknown',
          member?.committee || '-',
          member?.position || '-',
          record.status,
          formatTimeValue(record.timeIn),
          formatTimeValue(record.timeOut),
          record.recordedByTimeIn || '-',
          record.recordedByTimeOut || '-',
          record.notes || '-',
        ]);
      });

      // Step 4: Create worksheet (85%)
      if (updateUploadToast) {
        updateUploadToast(toastId, { message: 'Creating spreadsheet...', progress: 85 });
      }
      await new Promise(resolve => setTimeout(resolve, 100));
      if (cancelled) return;

      const worksheet = XLSX.utils.aoa_to_sheet(headerData);

      // Set column widths
      worksheet['!cols'] = [
        { wch: 5 },   // #
        { wch: 25 },  // Name
        { wch: 30 },  // Committee
        { wch: 20 },  // Position
        { wch: 12 },  // Status
        { wch: 12 },  // Time In
        { wch: 12 },  // Time Out
        { wch: 20 },  // Recorded By (In)
        { wch: 20 },  // Recorded By (Out)
        { wch: 25 },  // Notes
      ];

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Report');

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

      XLSX.writeFile(workbook, filename);

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

  useEffect(() => {
    if (exportType === "pdf") handleExportPDF();
    if (exportType === "spreadsheet") handleExportSpreadsheet();
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

  const attendanceData = getAttendanceData();
  const barChartData = getBarChartData();
  const totalRecords = getFilteredAttendance().length;

  const renderChart = () => {
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

      case "bar":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="committee" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Present" fill="#10b981" />
              <Bar dataKey="Late" fill="#f59e0b" />
              <Bar dataKey="Excused" fill="#3b82f6" />
              <Bar dataKey="Absent" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={barChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="committee" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Present" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="Late" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="Excused" stroke="#3b82f6" strokeWidth={2} />
              <Line type="monotone" dataKey="Absent" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <PageLayout
      title="Attendance Dashboard"
      subtitle="Track and visualize attendance metrics across events and committees"
      onClose={onClose}
      isDark={isDark}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Dashboard & Directory", onClick: undefined },
        { label: "Attendance Dashboard", onClick: undefined },
      ]}
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
          <div className="grid md:grid-cols-2 gap-6" style={{ overflow: 'visible' }}>
            {/* Event Selector */}
            <div>
              <label
                className="block mb-2"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Select Event
              </label>
              <CustomDropdown
                value={selectedEvent}
                onChange={setSelectedEvent}
                options={[
                  { value: "", label: events.length === 0 ? "No events available" : "Choose an event..." },
                  ...events.map((event) => ({
                    value: event.EventID,
                    label: `${event.Title} (${event.Status})`,
                  }))
                ]}
                isDark={isDark}
                size="md"
              />
            </div>

            {/* Committee Selector */}
            <div>
              <label
                className="block mb-2"
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
        )}
      </div>

      {/* Stats Cards */}
      {selectedEvent && (
        isLoadingAttendance ? (
          <StatsCardSkeleton isDark={isDark} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div
              className="rounded-xl p-4 border"
              style={{
                background: isDark ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                borderColor: '#10b981',
              }}
            >
              <p className="text-sm text-muted-foreground mb-1">Present</p>
              <p className="text-2xl font-bold" style={{ color: '#10b981' }}>
                {attendanceData.find(d => d.name === 'Present')?.value || 0}
              </p>
            </div>
            <div
              className="rounded-xl p-4 border"
              style={{
                background: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                borderColor: '#f59e0b',
              }}
            >
              <p className="text-sm text-muted-foreground mb-1">Late</p>
              <p className="text-2xl font-bold" style={{ color: '#f59e0b' }}>
                {attendanceData.find(d => d.name === 'Late')?.value || 0}
              </p>
            </div>
            <div
              className="rounded-xl p-4 border"
              style={{
                background: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                borderColor: '#3b82f6',
              }}
            >
              <p className="text-sm text-muted-foreground mb-1">Excused</p>
              <p className="text-2xl font-bold" style={{ color: '#3b82f6' }}>
                {attendanceData.find(d => d.name === 'Excused')?.value || 0}
              </p>
            </div>
            <div
              className="rounded-xl p-4 border"
              style={{
                background: isDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                borderColor: '#ef4444',
              }}
            >
              <p className="text-sm text-muted-foreground mb-1">Absent</p>
              <p className="text-2xl font-bold" style={{ color: '#ef4444' }}>
                {attendanceData.find(d => d.name === 'Absent')?.value || 0}
              </p>
            </div>
          </div>
        )
      )}

      {/* Chart Type Selector */}
      {selectedEvent && (
        <div
          className="rounded-xl p-6 mb-6 border"
          style={{
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <label
            className="block mb-3"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.orange,
            }}
          >
            Chart Type
          </label>
          <div className="flex flex-wrap gap-3">
            {["pie", "donut", "bar", "line"].map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type as any)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  chartType === type
                    ? "bg-[#f6421f] text-white"
                    : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                }`}
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold, textTransform: "capitalize" }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart Display */}
      {selectedEvent && (
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
                  {selectedCommittee !== "All" && ` (filtered by ${selectedCommittee})`}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="min-w-[180px]">
                <CustomDropdown
                  value={exportType}
                  onChange={setExportType}
                  options={[
                    { value: "pdf", label: "Export as PDF" },
                    { value: "spreadsheet", label: "Export as Spreadsheet" },
                  ]}
                  placeholder="Export"
                  isDark={isDark}
                  size="sm"
                  disabled={isLoadingAttendance || attendanceRecords.length === 0}
                />
              </div>
            </div>
          </div>
          {renderChart()}
        </div>
      )}

      {/* Loading Empty State */}
      {!selectedEvent && isLoadingEvents && (
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
      {!selectedEvent && !isLoadingEvents && (
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
                Select an Event
              </h3>
              <p className="text-muted-foreground">
                Choose an event from the dropdown above to view attendance analytics
              </p>
            </>
          )}
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
                             : 'rgba(128, 128, 128, 0.15)',
                    color: modalData.status === 'Present' ? '#10b981' 
                         : modalData.status === 'Late' ? '#f59e0b'
                         : modalData.status === 'Excused' ? '#3b82f6'
                         : modalData.status === 'Absent' ? '#ef4444'
                         : '#888',
                  }}
                >
                  {modalData.members.length} member{modalData.members.length !== 1 ? 's' : ''}
                </div>
                {totalRecords > 0 && (
                  <span className="text-muted-foreground">
                    {Math.round((modalData.members.length / totalRecords) * 100)}% of total
                  </span>
                )}
              </div>
              
              {/* Event Info */}
              {selectedEvent && events.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  Event: {events.find(e => e.EventID === selectedEvent)?.Title || selectedEvent}
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
                        <p className="font-semibold truncate">{member.name || 'Unknown'}</p>
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
    </PageLayout>
  );
}
