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

import React, { useState, useEffect, useCallback } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker, Circle as LeafletCircle } from "leaflet";
import { Calendar, Clock, Search, User, LayoutGrid, Table as TableIcon, X, RefreshCw, FileText, AlertCircle, ChevronDown, ChevronUp, MapPin, Loader2, Timer, CheckCircle2, Archive } from "lucide-react";
import { PageLayout, StatusChip, DESIGN_TOKENS, getGlassStyle, Button } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { getMemberAttendanceHistory, type AttendanceRecord as BackendAttendanceRecord } from "../services/gasAttendanceService";
import { fetchEvents, fetchEventsForMember, type EventData, type MemberEventsResponse } from "../services/gasEventsService";
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
  // External attendee and late tracking
  isExternal?: boolean;
  lateTimeIn?: boolean;
  lateTimeOut?: boolean;
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
 * Check if someone has no logout time (present but didn't logout)
 */
function hasNoLogout(timeIn: string, timeOut: string): boolean {
  const hasTimeIn = timeIn && timeIn !== 'N/A' && timeIn !== '-';
  const hasTimeOut = timeOut && timeOut !== 'N/A' && timeOut !== '-';
  return hasTimeIn && !hasTimeOut;
}

/**
 * Calculate attendance duration between time in and time out
 */
function calculateDuration(timeIn: string, timeOut: string): string {
  if (!timeIn || !timeOut || timeIn === 'N/A' || timeOut === 'N/A' || 
      timeIn === '-' || timeOut === '-') {
    return '-';
  }
  
  // Parse times
  const parseTime = (timeStr: string): Date | null => {
    // Handle ISO format
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      return isNaN(date.getTime()) ? null : date;
    }
    
    // Handle formatted time like "2:30 PM"
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
  
  const inTime = parseTime(timeIn);
  const outTime = parseTime(timeOut);
  
  if (!inTime || !outTime) return '-';
  
  // Calculate difference
  let diffMs = outTime.getTime() - inTime.getTime();
  
  // Handle overnight (if out time is earlier than in time)
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
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
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`);
  
  return parts.length > 0 ? parts.join(' ') : '< 1m';
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

/**
 * Calculate countdown to event start/end
 * Handles various date formats including:
 * - yyyy-MM-dd (e.g., "2026-02-07")
 * - Date strings (e.g., "Feb 7, 2026")
 * - ISO date strings
 */
function getCountdown(targetDateStr: string, targetTimeStr: string): { text: string; isNegative: boolean; totalSeconds: number } {
  if (!targetDateStr) {
    return { text: 'N/A', isNegative: false, totalSeconds: 0 };
  }
  
  const now = new Date();
  
  try {
    let year: number, month: number, day: number;
    
    // Try to parse yyyy-MM-dd format first
    if (/^\d{4}-\d{2}-\d{2}/.test(targetDateStr)) {
      const parts = targetDateStr.split('-').map(Number);
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else {
      // Try to parse any date string using Date constructor
      const parsedDate = new Date(targetDateStr);
      if (isNaN(parsedDate.getTime())) {
        return { text: 'N/A', isNegative: false, totalSeconds: 0 };
      }
      year = parsedDate.getFullYear();
      month = parsedDate.getMonth() + 1;
      day = parsedDate.getDate();
    }
    
    let hours = 0, minutes = 0;
    
    if (targetTimeStr) {
      const timeParts = targetTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (timeParts) {
        hours = parseInt(timeParts[1]);
        minutes = parseInt(timeParts[2]);
        const period = timeParts[3]?.toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
      }
    }
    
    const target = new Date(year, month - 1, day, hours, minutes);
    
    // Safety check for valid date
    if (isNaN(target.getTime())) {
      return { text: 'N/A', isNegative: false, totalSeconds: 0 };
    }
    
    const diffMs = target.getTime() - now.getTime();
    const isNegative = diffMs < 0;
    const absDiffMs = Math.abs(diffMs);
    const totalSeconds = Math.floor(absDiffMs / 1000);
    
    const days = Math.floor(totalSeconds / 86400);
    const hrs = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    let text = '';
    if (days > 0) {
      text = `${days}d ${hrs}h ${mins}m`;
    } else if (hrs > 0) {
      text = `${hrs}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      text = `${mins}m ${secs}s`;
    } else {
      text = `${secs}s`;
    }
    
    return { text, isNegative, totalSeconds };
  } catch {
    return { text: 'N/A', isNegative: false, totalSeconds: 0 };
  }
}

/**
 * Get event status color and label
 */
function getEventStatusStyle(status: string): { bg: string; color: string; label: string } {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'ongoing':
      return { bg: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', label: '● Live Now' };
    case 'scheduled':
      return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'Scheduled' };
    case 'completed':
      return { bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280', label: 'Completed' };
    case 'cancelled':
      return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: 'Cancelled' };
    default:
      return { bg: 'rgba(107, 114, 128, 0.15)', color: '#6b7280', label: status || 'Unknown' };
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
    ? "bg-linear-to-r from-gray-700 via-gray-600 to-gray-700" 
    : "bg-linear-to-r from-gray-200 via-gray-100 to-gray-200";
  
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
    ? "bg-linear-to-r from-gray-700 via-gray-600 to-gray-700" 
    : "bg-linear-to-r from-gray-200 via-gray-100 to-gray-200";
  
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
    ? "bg-linear-to-r from-gray-700 via-gray-600 to-gray-700" 
    : "bg-linear-to-r from-gray-200 via-gray-100 to-gray-200";
  
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
// EVENT DETAIL MODAL
// =====================================================

/**
 * Format time window value - handles ISO date strings from Google Sheets
 * Google Sheets stores time-only values as 1899-12-30T{time}Z
 */
function formatTimeWindowValue(timeValue: string | undefined): string {
  if (!timeValue) return '';
  
  // If it looks like an ISO date string with the 1899 date (Google Sheets time format)
  if (timeValue.includes('1899-12-30') || timeValue.includes('T')) {
    try {
      const date = new Date(timeValue);
      if (!isNaN(date.getTime())) {
        // Extract hours and minutes from the ISO string directly
        // The time is stored in UTC, so we need to get the UTC values
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const period = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }
    } catch {
      // Fall through
    }
  }
  
  // If already formatted like "8:00 AM", return as is
  if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(timeValue.trim())) {
    return timeValue.trim();
  }
  
  return timeValue;
}

interface EventDetailModalProps {
  event: EventData;
  isDark: boolean;
  onClose: () => void;
}

/**
 * Leaflet Map Component for Event Geofence with Real-time Location
 */
function EventGeofenceMap({ 
  eventLat, 
  eventLng, 
  radius, 
  locationName,
  isDark 
}: { 
  eventLat: number; 
  eventLng: number; 
  radius: number; 
  locationName?: string;
  isDark: boolean;
}) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<LeafletMap | null>(null);
  const userMarkerRef = React.useRef<LeafletMarker | null>(null);
  const userAccuracyCircleRef = React.useRef<LeafletCircle | null>(null);
  const [userLocation, setUserLocation] = React.useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [isLocating, setIsLocating] = React.useState(true);
  const watchIdRef = React.useRef<number | null>(null);

  // Start watching user location
  React.useEffect(() => {
    if (!navigator.geolocation) {
      setIsLocating(false);
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Initialize Leaflet map
  React.useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      if (!isMounted) return;

      // Custom icons
      const eventIcon = L.divIcon({
        html: `
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#EF4444" stroke="#991B1B" stroke-width="1.5"/>
            <circle cx="12" cy="10" r="3" fill="white"/>
          </svg>
        `,
        className: 'event-marker',
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36],
      });

      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: [eventLat, eventLng],
        zoom: 17,
        zoomControl: true,
      });

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // Add geofence circle
      L.circle([eventLat, eventLng], {
        radius: radius,
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.2,
        weight: 3,
        dashArray: '10, 5',
      }).addTo(map);

      // Add event marker
      const eventMarker = L.marker([eventLat, eventLng], { icon: eventIcon }).addTo(map);
      eventMarker.bindPopup(`
        <div style="text-align: center; padding: 4px;">
          <strong style="color: #EF4444;">${locationName || 'Event Location'}</strong><br/>
          <span style="font-size: 11px; color: #666;">Geofence: ${radius}m radius</span>
        </div>
      `);

      mapInstanceRef.current = map;

      // Invalidate size after render
      setTimeout(() => map.invalidateSize(), 200);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [eventLat, eventLng, radius, locationName]);

  // Update user location on map
  React.useEffect(() => {
    const updateUserMarker = async () => {
      if (!mapInstanceRef.current || !userLocation) return;

      const L = (await import('leaflet')).default;

      const userIcon = L.divIcon({
        html: `
          <div style="position: relative;">
            <div style="width: 18px; height: 18px; background: #22c55e; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
          </div>
        `,
        className: 'user-marker-live',
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        if (userAccuracyCircleRef.current) {
          userAccuracyCircleRef.current.setLatLng([userLocation.lat, userLocation.lng]);
          userAccuracyCircleRef.current.setRadius(userLocation.accuracy);
        }
      } else {
        // Create accuracy circle
        userAccuracyCircleRef.current = L.circle([userLocation.lat, userLocation.lng], {
          radius: userLocation.accuracy,
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(mapInstanceRef.current);

        // Create user marker
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon: userIcon }).addTo(mapInstanceRef.current);
        userMarkerRef.current.bindPopup(`
          <div style="text-align: center; padding: 4px;">
            <strong style="color: #22c55e;">Your Location</strong><br/>
            <span style="font-size: 11px; color: #666;">Accuracy: ±${Math.round(userLocation.accuracy)}m</span>
          </div>
        `);
      }
    };

    updateUserMarker();
  }, [userLocation]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 font-medium">
          <MapPin className="w-4 h-4 text-[#f6421f]" />
          Geofence Location
          <span className="text-xs text-muted-foreground font-normal">
            ({radius}m radius)
          </span>
        </div>
        {isLocating && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Locating...
          </div>
        )}
        {userLocation && !isLocating && (
          <div className="flex items-center gap-1.5 text-xs text-green-600">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live
          </div>
        )}
      </div>
      
      <div 
        className="rounded-xl overflow-hidden border relative z-0"
        style={{ 
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          height: '220px',
        }}
      >
        <style>{`
          @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
          .event-marker, .user-marker-live { background: none; border: none; }
          .leaflet-container { z-index: 0; }
          .leaflet-pane { z-index: 0; }
          .leaflet-top, .leaflet-bottom { z-index: 1; }
          .leaflet-control-zoom { border-radius: 8px !important; overflow: hidden; }
          .leaflet-control-zoom a { 
            background: ${isDark ? '#1f2937' : '#fff'} !important; 
            color: ${isDark ? '#fff' : '#000'} !important; 
          }
        `}</style>
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }} />
      </div>
      
      {userLocation && (
        <div className="text-xs text-muted-foreground text-center">
          📍 Your location: {userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)} (±{Math.round(userLocation.accuracy)}m)
        </div>
      )}
    </div>
  );
}

function EventDetailModal({ event, isDark, onClose }: EventDetailModalProps) {
  const glassStyle = getGlassStyle(isDark);
  const statusStyle = getEventStatusStyle(event.Status);
  
  // Parse geofence data
  const hasGeofence = event.GeofenceEnabled === true || event.GeofenceEnabled === 'true' || event.GeofenceEnabled === 'TRUE';
  const lat = typeof event.Latitude === 'string' ? parseFloat(event.Latitude) : event.Latitude;
  const lng = typeof event.Longitude === 'string' ? parseFloat(event.Longitude) : event.Longitude;
  const radius = typeof event.Radius === 'string' ? parseFloat(event.Radius) : event.Radius;
  const hasValidCoords = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  
  // Parse recipients if available
  let recipientInfo: { type: string; names?: string[]; ids?: string[]; committees?: string[] } | null = null;
  if (event.Recipients) {
    try {
      recipientInfo = JSON.parse(event.Recipients);
    } catch {
      // Ignore parse errors
    }
  }
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl"
        style={{
          ...glassStyle,
          background: isDark 
            ? 'rgba(30, 30, 40, 0.95)' 
            : 'rgba(255, 255, 255, 0.98)',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 p-4 pb-3 border-b z-20"
          style={{ 
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            background: isDark ? 'rgba(30, 30, 40, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span 
                  className="px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0"
                  style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                >
                  {statusStyle.label}
                </span>
              </div>
              <h2 
                className="text-lg font-semibold truncate"
                style={{ fontFamily: DESIGN_TOKENS.typography.fontFamily.headings }}
              >
                {event.Title}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Description */}
          {event.Description && (
            <div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {event.Description}
              </p>
            </div>
          )}
          
          {/* Date & Time */}
          <div 
            className="p-3 rounded-xl space-y-2"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
            }}
          >
            <div className="flex items-center gap-3">
              <Calendar className="w-4 h-4 text-[#f6421f] shrink-0" />
              <div className="text-sm">
                <span className="font-medium">Date: </span>
                <span className="text-muted-foreground">
                  {formatDisplayDate(event.StartDate)}
                  {event.EndDate && event.EndDate !== event.StartDate && (
                    <> – {formatDisplayDate(event.EndDate)}</>
                  )}
                </span>
              </div>
            </div>
            
            {(event.StartTime || event.EndTime) && (
              <div className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-[#f6421f] shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Time: </span>
                  <span className="text-muted-foreground">
                    {event.StartTime || 'TBD'}
                    {event.EndTime && <> – {event.EndTime}</>}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          {/* Location */}
          {event.LocationName && (
            <div 
              className="p-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-[#f6421f] shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Location: </span>
                  <span className="text-muted-foreground">{event.LocationName}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Geofence Map - Using Leaflet with real-time location */}
          {hasGeofence && hasValidCoords && (
            <EventGeofenceMap
              eventLat={lat}
              eventLng={lng}
              radius={radius || 50}
              locationName={event.LocationName}
              isDark={isDark}
            />
          )}
          
          {/* Time Windows */}
          {(event.TimeInStart || event.TimeOutStart) && (
            <div 
              className="p-3 rounded-xl space-y-2"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <div className="text-sm font-medium flex items-center gap-2">
                <Timer className="w-4 h-4 text-[#f6421f]" />
                Attendance Windows
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {event.TimeInStart && (
                  <div>
                    <span className="text-muted-foreground">Check-in: </span>
                    <span className="font-medium">{formatTimeWindowValue(event.TimeInStart)}</span>
                    {event.TimeInEnd && <span className="text-muted-foreground"> – {formatTimeWindowValue(event.TimeInEnd)}</span>}
                  </div>
                )}
                {event.TimeOutStart && (
                  <div>
                    <span className="text-muted-foreground">Check-out: </span>
                    <span className="font-medium">{formatTimeWindowValue(event.TimeOutStart)}</span>
                    {event.TimeOutEnd && <span className="text-muted-foreground"> – {formatTimeWindowValue(event.TimeOutEnd)}</span>}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Recipients */}
          {recipientInfo && (
            <div 
              className="p-3 rounded-xl space-y-2"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="w-4 h-4 text-[#f6421f] shrink-0" />
                Recipients
              </div>
              
              {recipientInfo.type === 'All' ? (
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    All Members
                  </span>
                </div>
              ) : recipientInfo.type === 'Committee' ? (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">
                    {recipientInfo.committees?.length || recipientInfo.names?.length || 0} Committee(s)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(recipientInfo.committees || recipientInfo.names || []).map((name, idx) => (
                      <span 
                        key={idx}
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{
                          background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                          color: isDark ? '#93c5fd' : '#2563eb',
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground">
                    {recipientInfo.names?.length || 0} Member(s)
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {(recipientInfo.names || []).map((name, idx) => (
                      <span 
                        key={idx}
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{
                          background: isDark ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.1)',
                          color: isDark ? '#d1d5db' : '#4b5563',
                        }}
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Notes */}
          {event.Notes && (
            <div 
              className="p-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
              }}
            >
              <div className="flex items-start gap-2 text-sm">
                <FileText className="w-4 h-4 text-[#f6421f] shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Notes: </span>
                  <span className="text-muted-foreground whitespace-pre-wrap">{event.Notes}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div 
          className="sticky bottom-0 p-4 pt-3 border-t"
          style={{ 
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            background: isDark ? 'rgba(30, 30, 40, 0.98)' : 'rgba(255, 255, 255, 0.98)',
          }}
        >
          <Button
            onClick={onClose}
            variant="primary"
            className="w-full"
          >
            Close
          </Button>
        </div>
      </div>
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

  // Member events state (scheduled/active events for this member)
  const [memberEvents, setMemberEvents] = useState<MemberEventsResponse | null>(null);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [showArchive, setShowArchive] = useState(false);
  const [, forceUpdate] = useState(0); // For countdown re-renders
  
  // Event detail modal state
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  // =====================================================
  // DATA FETCHING
  // =====================================================

  // Fetch member-specific events
  const fetchMemberEvents = useCallback(async () => {
    if (!memberId) return;
    
    setIsLoadingEvents(true);
    try {
      // Pass includeArchived=true to get completed events for archive section
      const events = await fetchEventsForMember(memberId, true);
      setMemberEvents(events);
    } catch (err) {
      console.error("Failed to fetch member events:", err);
      // Don't show error toast - events section is optional
    } finally {
      setIsLoadingEvents(false);
    }
  }, [memberId]);

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
          // External attendee and late tracking
          isExternal: record.isExternal || false,
          lateTimeIn: record.lateTimeIn || false,
          lateTimeOut: record.lateTimeOut || false,
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
    fetchMemberEvents();
  }, [fetchAttendanceData, fetchMemberEvents]);

  // Countdown timer - update every second
  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate(n => n + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Notify App to hide chatbot when modals are open
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isModalOpen = showEventModal || showDetailModal;
    window.dispatchEvent(new CustomEvent("attendance-transparency-modal", { detail: { open: isModalOpen } }));
    return () => {
      window.dispatchEvent(new CustomEvent("attendance-transparency-modal", { detail: { open: false } }));
    };
  }, [showEventModal, showDetailModal]);

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
            onClick={() => { fetchAttendanceData(); fetchMemberEvents(); }} 
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" 
            title="Refresh data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* =====================================================
          YOUR EVENTS SECTION
          ===================================================== */}
      <div className="mb-6">
        {/* Section Header */}
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-[#f6421f]" />
          <h2 
            className="text-lg"
            style={{ 
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
            }}
          >
            Your Events
          </h2>
        </div>

        {/* Loading State */}
        {isLoadingEvents && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div 
                key={i}
                className="rounded-xl p-4 animate-pulse"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                }}
              >
                <div className="h-5 w-3/4 rounded bg-gray-300 dark:bg-gray-700 mb-3" />
                <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-800 mb-2" />
                <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
              </div>
            ))}
          </div>
        )}

        {/* Events Loaded */}
        {!isLoadingEvents && memberEvents && (
          <>
            {/* Active & Scheduled Events */}
            {((memberEvents.active?.length || 0) + (memberEvents.scheduled?.length || 0)) > 0 ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Active Events First */}
                {memberEvents.active?.map((event) => {
                  const statusStyle = getEventStatusStyle('active');
                  const countdown = getCountdown(event.EndDate, event.EndTime);
                  
                  return (
                    <div
                      key={event.EventID}
                      className="rounded-xl p-4 overflow-hidden cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                      onClick={() => { setSelectedEvent(event); setShowEventModal(true); }}
                      style={{
                        background: isDark 
                          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(255, 255, 255, 0.05) 100%)' 
                          : 'linear-gradient(135deg, rgba(34, 197, 94, 0.08) 0%, rgba(255, 255, 255, 0.9) 100%)',
                        border: '1px solid rgba(34, 197, 94, 0.3)',
                        boxShadow: '0 0 20px rgba(34, 197, 94, 0.1)',
                      }}
                    >
                      {/* Header with Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 
                          className="flex-1 min-w-0 line-clamp-2"
                          style={{ 
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                            fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                          }}
                        >
                          {event.Title}
                        </h3>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold shrink-0"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                          Live
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>{formatDisplayDate(event.StartDate)}</span>
                          {event.StartTime && <span>• {event.StartTime}</span>}
                        </div>
                        {event.LocationName && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate">{event.LocationName}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(34, 197, 94, 0.2)' }}>
                        <div className="flex items-center gap-2 text-sm">
                          <Timer className="w-4 h-4 text-green-500" />
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            Ends in {countdown.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Scheduled Events */}
                {memberEvents.scheduled?.map((event) => {
                  const statusStyle = getEventStatusStyle('scheduled');
                  const countdown = getCountdown(event.StartDate, event.StartTime);
                  const isStartingSoon = countdown.totalSeconds < 3600 && !countdown.isNegative; // Less than 1 hour
                  
                  return (
                    <div
                      key={event.EventID}
                      className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
                      onClick={() => { setSelectedEvent(event); setShowEventModal(true); }}
                      style={{
                        background: isDark 
                          ? 'rgba(255, 255, 255, 0.05)' 
                          : 'rgba(255, 255, 255, 0.9)',
                        border: isStartingSoon 
                          ? '1px solid rgba(246, 66, 31, 0.4)' 
                          : `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                        boxShadow: isStartingSoon ? '0 0 15px rgba(246, 66, 31, 0.15)' : undefined,
                      }}
                    >
                      {/* Header with Badge */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 
                          className="flex-1 min-w-0 line-clamp-2"
                          style={{ 
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                            fontSize: `${DESIGN_TOKENS.typography.fontSize.h4}px`,
                          }}
                        >
                          {event.Title}
                        </h3>
                        <div 
                          className="px-2 py-1 rounded-full text-xs font-semibold shrink-0"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                        >
                          {isStartingSoon ? '⏰ Soon' : statusStyle.label}
                        </div>
                      </div>
                      
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 shrink-0" />
                          <span>{formatDisplayDate(event.StartDate)}</span>
                          {event.StartTime && <span>• {event.StartTime}</span>}
                        </div>
                        {event.LocationName && (
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 shrink-0" />
                            <span className="truncate">{event.LocationName}</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span className={isStartingSoon ? 'text-[#f6421f] font-medium' : 'text-muted-foreground'}>
                            Starts in {countdown.text}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div 
                className="rounded-xl p-6 text-center"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                }}
              >
                <Calendar className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-muted-foreground">No upcoming events scheduled for you</p>
              </div>
            )}

            {/* Archive Section - Completed Events */}
            {(memberEvents.completed?.length || 0) > 0 && (
              <div className="mt-4">
                <button
                  onClick={() => setShowArchive(!showArchive)}
                  className="w-full flex items-center justify-between p-3 rounded-xl transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Archive className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Past Events ({memberEvents.completed?.length || 0})
                    </span>
                  </div>
                  {showArchive ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                
                {showArchive && (
                  <div className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {memberEvents.completed?.slice(0, 6).map((event) => {
                      const statusStyle = getEventStatusStyle('completed');
                      
                      return (
                        <div
                          key={event.EventID}
                          className="rounded-xl p-3 opacity-75 cursor-pointer transition-all hover:opacity-100 hover:shadow-md"
                          onClick={() => { setSelectedEvent(event); setShowEventModal(true); }}
                          style={{
                            background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-medium truncate flex-1">{event.Title}</h4>
                            <div 
                              className="px-2 py-0.5 rounded-full text-xs shrink-0"
                              style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                            >
                              <CheckCircle2 className="w-3 h-3 inline mr-1" />
                              Done
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDisplayDate(event.StartDate)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* No events at all */}
        {!isLoadingEvents && !memberEvents && (
          <div 
            className="rounded-xl p-6 text-center"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
            }}
          >
            <Calendar className="w-10 h-10 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-muted-foreground">No events available</p>
          </div>
        )}
      </div>

      {/* =====================================================
          ATTENDANCE HISTORY SECTION
          ===================================================== */}
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-5 h-5 text-[#f6421f]" />
        <h2 
          className="text-lg"
          style={{ 
            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
          }}
        >
          Attendance History
        </h2>
      </div>

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
          className="border rounded-lg mb-6"
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
                      color: hasNoLogout(record.timeIn, record.timeOut) ? '#f59e0b' : undefined,
                    }}
                  >
                    {hasNoLogout(record.timeIn, record.timeOut) ? 'No Logout ⚠️' : record.timeOut}
                  </span>
                </div>
                {/* Duration */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                      Duration:
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                      color: DESIGN_TOKENS.colors.brand.orange,
                    }}
                  >
                    {calculateDuration(record.timeIn, record.timeOut)}
                  </span>
                </div>
              </div>

              {/* Status with External/Late indicators */}
              <div className="flex flex-wrap justify-end items-center gap-1.5">
                <StatusChip status={record.status} size="sm" />
                {record.isExternal && (
                  <span 
                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                    style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed' }}
                  >
                    EXT
                  </span>
                )}
                {record.lateTimeIn && (
                  <span 
                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                    style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}
                  >
                    LATE-IN
                  </span>
                )}
                {record.lateTimeOut && (
                  <span 
                    className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                    style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}
                  >
                    LATE-OUT
                  </span>
                )}
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
                  <th className="text-left px-6 py-4" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Duration</th>
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
                    Duration
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
                {paginatedRecords.map((record) => {
                  const noLogout = hasNoLogout(record.timeIn, record.timeOut);
                  const duration = calculateDuration(record.timeIn, record.timeOut);
                  return (
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
                      // Highlight row if no logout
                      background: noLogout 
                        ? (isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255, 243, 205, 0.8)')
                        : undefined,
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
                      className="px-6 py-4"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                        color: noLogout ? '#f59e0b' : undefined,
                        fontWeight: noLogout ? DESIGN_TOKENS.typography.fontWeight.bold : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" style={{ color: noLogout ? '#f59e0b' : undefined }} />
                        {noLogout ? 'No Logout ⚠️' : record.timeOut}
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
                    <td
                      className="px-6 py-4"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: DESIGN_TOKENS.colors.brand.orange,
                      }}
                    >
                      {duration}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusChip status={record.status} size="sm" />
                        {record.isExternal && (
                          <span 
                            className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                            style={{ background: 'rgba(124, 58, 237, 0.15)', color: '#7c3aed' }}
                          >
                            EXT
                          </span>
                        )}
                        {record.lateTimeIn && (
                          <span 
                            className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                            style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#d97706' }}
                          >
                            LATE-IN
                          </span>
                        )}
                        {record.lateTimeOut && (
                          <span 
                            className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
                            style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}
                          >
                            LATE-OUT
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
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
                  color: hasNoLogout(selectedRecord.timeIn, selectedRecord.timeOut) ? '#f59e0b' : DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Time Out {hasNoLogout(selectedRecord.timeIn, selectedRecord.timeOut) && '⚠️ NO LOGOUT'}
              </label>
              {hasNoLogout(selectedRecord.timeIn, selectedRecord.timeOut) && (
                <div 
                  className="mb-3 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                  }}
                >
                  ⚠️ This member did not log out from this event
                </div>
              )}
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
                      color: hasNoLogout(selectedRecord.timeIn, selectedRecord.timeOut) ? '#f59e0b' : undefined,
                    }}
                  >
                    {hasNoLogout(selectedRecord.timeIn, selectedRecord.timeOut) ? 'N/A' : selectedRecord.timeOut}
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

            {/* Duration Section */}
            <div className="mb-6">
              <label
                className="block mb-3"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Attendance Duration
              </label>
              <div 
                className="px-4 py-3 rounded-lg"
                style={{
                  background: isDark ? 'rgba(246, 66, 31, 0.15)' : 'rgba(246, 66, 31, 0.08)',
                  border: `1px solid ${DESIGN_TOKENS.colors.brand.orange}30`,
                }}
              >
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                  <span
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                      color: DESIGN_TOKENS.colors.brand.orange,
                    }}
                  >
                    {calculateDuration(selectedRecord.timeIn, selectedRecord.timeOut)}
                  </span>
                  {hasNoLogout(selectedRecord.timeIn, selectedRecord.timeOut) && (
                    <span className="text-sm text-muted-foreground">(incomplete - no logout)</span>
                  )}
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
      
      {/* Event Detail Modal */}
      {showEventModal && selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          isDark={isDark}
          onClose={() => { setShowEventModal(false); setSelectedEvent(null); }}
        />
      )}
    </>
  );
}
