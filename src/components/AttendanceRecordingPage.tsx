/**
 * =============================================================================
 * UNIFIED ATTENDANCE RECORDING PAGE
 * =============================================================================
 * 
 * 3-Step Flow:
 * 1. Select Event (Active Events Cards)
 * 2. Choose Mode (QR Scanner or Manual Entry)
 * 3. Record Attendance (Event locked, mode selected)
 * 
 * Backend Connected: Uses gasEventsService for real event data
 * Features: Skeleton loading, progress toast, event prioritization
 * 
 * =============================================================================
 * 
 * CACHING & DATA CONSISTENCY (QR vs Manual):
 * -------------------------------------------
 * Both QR Scanner and Manual Entry modes share the SAME mechanisms:
 * 
 * 1. MEMBER CACHING:
 *    - Both use loadMembersFromCache() and saveMembersToCache() 
 *    - Members are cached in localStorage with keys: MEMBERS_CACHE_KEY, MEMBERS_CACHE_TS_KEY
 *    - memberCacheRef (in-memory Map) is used for quick lookups in both modes
 *    - Cache is refreshed on background when online, persisted for offline use
 * 
 * 2. TIME FORMATTING:
 *    - Both modes use the same timestamp format via toLocaleTimeString("en-PH")
 *    - Timezone: Asia/Manila
 *    - Format: "h:mm A" (e.g., "2:30 PM")
 * 
 * 3. BACKEND CALLS:
 *    - QR: Uses recordTimeIn() / recordTimeOut() directly
 *    - Manual: Uses recordTimeIn() / recordTimeOut() for Present/Late,
 *              Uses recordManualAttendance() for Absent/Excused status
 * 
 * 4. OVERWRITE BEHAVIOR:
 *    ⚠️ IMPORTANT: When overwriting an existing record, the backend uses
 *    the CURRENT timestamp, NOT the original timestamp!
 *    
 *    - Backend function: recordManualAttendance() with overwrite=true
 *    - Time is generated fresh: Utilities.formatDate(now, 'Asia/Manila', 'hh:mm a')
 *    - This means overwriting will UPDATE the time to the current time
 *    
 *    Example: If original TimeIn was "9:00 AM" and you overwrite at "10:30 AM",
 *    the new TimeIn will be "10:30 AM" (not the original "9:00 AM")
 * 
 * 5. OFFLINE SUPPORT:
 *    - Both modes queue records locally when offline
 *    - pendingAttendanceQueue manages offline records
 *    - Records sync automatically when coming back online
 * 
 * =============================================================================
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import { UploadToastContainer, type UploadToastMessage } from "./UploadToast";
import CustomDropdown from "./CustomDropdown";
import { Camera, QrCode, CheckCircle, Save, AlertCircle, FileEdit, MapPin, Calendar, ArrowLeft, Clock, Navigation, RefreshCw, Loader2, PlayCircle, AlertTriangle, CheckCircle2, XCircle, Crosshair, X, ChevronDown, ChevronUp, Archive, StopCircle, Search, User } from "lucide-react";
import {
  fetchEvents,
  clearEventsCache,
  type EventData,
} from "../services/gasEventsService";
import {
  recordTimeIn,
  recordTimeOut,
  recordManualAttendance,
  checkExistingAttendance,
  getMembersForAttendance,
  clearMembersCache,
  AttendanceErrorCodes,
  AttendanceAPIError,
  type MemberForAttendance,
  type AttendanceRecord,
} from "../services/gasAttendanceService";
import { getStoredUser } from "../services/gasLoginService";

interface AttendanceRecordingPageProps {
  onClose: () => void;
  isDark: boolean;
}

type Step = "event-selection" | "mode-selection" | "recording";
type Mode = "qr" | "manual" | null;
type EventStatus = "happening" | "starting-soon" | "upcoming" | "completed" | "cancelled";

interface UserLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

// Check if coordinates are plausible (in Philippines region)
function isLocationPlausible(lat: number, lng: number): boolean {
  // Philippines bounding box (rough)
  // Lat: 4.5 to 21.5, Lng: 116 to 127
  // Tagum area: roughly lat 7.4-7.5, lng 125.7-125.9
  const isInPhilippines = lat >= 4.5 && lat <= 21.5 && lng >= 116 && lng <= 127;
  return isInPhilippines;
}

// Check if location seems like cached/wrong data based on extreme distance from expected
function isLocationSuspicious(userLat: number, userLng: number, eventLat: number, eventLng: number): boolean {
  // If user is more than 50km from event, something might be wrong
  const distance = calculateDistance(userLat, userLng, eventLat, eventLng);
  return distance > 50000; // 50km threshold
}

interface Event {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  locationName?: string;
  location: { lat: number; lng: number };
  radius: number;
  geofenceEnabled: boolean;
  status: EventStatus;
  backendStatus: string;
  currentAttendees?: number;
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Convert backend EventData to frontend Event format with calculated status
function convertToFrontendEvent(backendEvent: EventData): Event {
  const lat = typeof backendEvent.Latitude === 'string' ? parseFloat(backendEvent.Latitude) : backendEvent.Latitude;
  const lng = typeof backendEvent.Longitude === 'string' ? parseFloat(backendEvent.Longitude) : backendEvent.Longitude;
  const radius = typeof backendEvent.Radius === 'string' ? parseFloat(backendEvent.Radius) : backendEvent.Radius;
  
  // Calculate event status based on dates and times
  const now = new Date();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const startDate = new Date(backendEvent.StartDate);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(backendEvent.EndDate || backendEvent.StartDate);
  endDate.setHours(23, 59, 59, 999);
  
  // Helper to parse time string (handles "7:13 PM", "19:13", or ISO date strings)
  const parseTimeToHoursMinutes = (timeStr: string): { hours: number; minutes: number } | null => {
    if (!timeStr) return null;
    
    // Handle ISO date string (1899-12-30T11:13:00.000Z from Google Sheets)
    if (timeStr.includes('T') && timeStr.includes('1899')) {
      try {
        const date = new Date(timeStr);
        if (!isNaN(date.getTime())) {
          return { hours: date.getHours(), minutes: date.getMinutes() };
        }
      } catch {
        // Fall through to other parsing
      }
    }
    
    // Handle 12-hour format (7:13 PM or 7:13 AM)
    if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
      const isPM = timeStr.toUpperCase().includes('PM');
      const timePart = timeStr.replace(/\s*(AM|PM)\s*/gi, '').trim();
      const [h, m] = timePart.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return null;
      
      let hours = h;
      if (isPM && h !== 12) hours = h + 12;
      else if (!isPM && h === 12) hours = 0;
      
      return { hours, minutes: m };
    }
    
    // Handle 24-hour format (19:13)
    const [h, m] = timeStr.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return { hours: h, minutes: m };
  };
  
  // Parse times if available
  let eventStatus: EventStatus = "upcoming";
  
  // Handle backend dynamic status values (Cancelled, Disabled, Completed, Active, Scheduled)
  const backendStatus = backendEvent.Status?.toString() || '';
  
  if (backendStatus === 'Cancelled' || backendStatus === 'Disabled') {
    eventStatus = "cancelled";
  } else if (backendStatus === 'Completed') {
    eventStatus = "completed";
  } else if (backendStatus === 'Active') {
    // Backend says it's active, but let's refine for starting-soon vs happening
    const startTime = parseTimeToHoursMinutes(backendEvent.StartTime);
    const endTime = parseTimeToHoursMinutes(backendEvent.EndTime);
    
    if (startTime && endTime) {
      const eventStart = new Date(now);
      eventStart.setHours(startTime.hours, startTime.minutes, 0, 0);
      
      const eventEnd = new Date(now);
      eventEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
      
      if (now >= eventStart && now <= eventEnd) {
        eventStatus = "happening";
      } else if (now < eventStart) {
        eventStatus = "starting-soon";
      } else {
        eventStatus = "completed";
      }
    } else {
      eventStatus = "happening";
    }
  } else if (now > endDate) {
    // Fallback: if past end date, mark as completed
    eventStatus = "completed";
  } else if (now >= startDate && now <= endDate) {
    // Check if we're within the event time range
    const startTime = parseTimeToHoursMinutes(backendEvent.StartTime);
    const endTime = parseTimeToHoursMinutes(backendEvent.EndTime);
    
    if (startTime && endTime) {
      const eventStart = new Date(now);
      eventStart.setHours(startTime.hours, startTime.minutes, 0, 0);
      
      const eventEnd = new Date(now);
      eventEnd.setHours(endTime.hours, endTime.minutes, 0, 0);
      
      if (now >= eventStart && now <= eventEnd) {
        eventStatus = "happening";
      } else if (now < eventStart && (eventStart.getTime() - now.getTime()) < 60 * 60 * 1000) {
        // Starting within 1 hour
        eventStatus = "starting-soon";
      } else if (now > eventEnd) {
        eventStatus = "completed";
      } else {
        eventStatus = "upcoming";
      }
    } else {
      // No specific time, treat the whole day as happening
      eventStatus = "happening";
    }
  } else if (startDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
    // Starting within 24 hours
    eventStatus = "starting-soon";
  } else {
    eventStatus = "upcoming";
  }
  
  // Parse geofenceEnabled - backend stores as 'TRUE' or 'FALSE' string
  const geofenceEnabled = backendEvent.GeofenceEnabled === true || 
    backendEvent.GeofenceEnabled === 'TRUE' || 
    backendEvent.GeofenceEnabled === 'true' ||
    backendEvent.GeofenceEnabled === undefined; // Default to true if not set
  
  return {
    id: backendEvent.EventID,
    name: backendEvent.Title,
    description: backendEvent.Description || '',
    startDate: backendEvent.StartDate,
    endDate: backendEvent.EndDate || backendEvent.StartDate,
    startTime: backendEvent.StartTime,
    endTime: backendEvent.EndTime,
    locationName: backendEvent.LocationName,
    location: {
      lat: lat || 7.4500,
      lng: lng || 125.8078,
    },
    radius: radius || 100,
    geofenceEnabled,
    status: eventStatus,
    backendStatus: backendEvent.Status,
    currentAttendees: backendEvent.CurrentAttendees || 0,
  };
}

// Sort events by priority: happening > starting-soon > upcoming > completed
function sortEventsByPriority(events: Event[]): Event[] {
  const priorityOrder: Record<EventStatus, number> = {
    "happening": 0,
    "starting-soon": 1,
    "upcoming": 2,
    "completed": 3,
    "cancelled": 4,
  };
  
  return [...events].sort((a, b) => {
    // First by status priority
    const priorityDiff = priorityOrder[a.status] - priorityOrder[b.status];
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by start date (soonest first)
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
}

// Get status badge info
function getEventStatusInfo(status: EventStatus): { label: string; color: string; bgColor: string; icon: React.ReactNode } {
  switch (status) {
    case "happening":
      return {
        label: "Ongoing",
        color: "#10b981",
        bgColor: "#10b98120",
        icon: <PlayCircle className="w-3 h-3" />,
      };
    case "starting-soon":
      return {
        label: "Starting Soon",
        color: "#f59e0b",
        bgColor: "#f59e0b20",
        icon: <AlertTriangle className="w-3 h-3" />,
      };
    case "upcoming":
      return {
        label: "Upcoming",
        color: "#3b82f6",
        bgColor: "#3b82f620",
        icon: <Clock className="w-3 h-3" />,
      };
    case "completed":
      return {
        label: "Completed",
        color: "#6b7280",
        bgColor: "#6b728020",
        icon: <CheckCircle2 className="w-3 h-3" />,
      };
    case "cancelled":
      return {
        label: "Cancelled",
        color: "#ef4444",
        bgColor: "#ef444420",
        icon: <XCircle className="w-3 h-3" />,
      };
    default:
      return {
        label: "Unknown",
        color: "#6b7280",
        bgColor: "#6b728020",
        icon: <Clock className="w-3 h-3" />,
      };
  }
}

// Helper function to format time string properly
function formatEventTime(timeStr: string | undefined): string {
  if (!timeStr) return '';
  
  // Check if it's an ISO date string (like "1899-12-30T11:13:00.000Z")
  // This happens when Google Sheets stores time as a Date value
  if (timeStr.includes('T') && timeStr.includes('1899')) {
    // Google Sheets stores the time in the spreadsheet as-is but when read via API,
    // it returns as UTC. We need to parse as Date and use LOCAL time (which converts UTC to local)
    try {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        // Use local time - this correctly converts UTC to Manila time (UTC+8)
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      }
    } catch {
      // Fallback
    }
    return timeStr;
  }
  
  // Check if it's already in a good format (HH:MM or H:MM AM/PM)
  if (timeStr.match(/^\d{1,2}:\d{2}(\s?(AM|PM|am|pm))?$/)) {
    return timeStr;
  }
  
  // Try to parse as time
  try {
    // Handle "HH:MM:SS" format
    if (timeStr.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    }
    
    // Handle ISO date-time string
    if (timeStr.includes('T')) {
      const date = new Date(timeStr);
      if (!isNaN(date.getTime())) {
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
      }
    }
  } catch {
    // Return original if parsing fails
  }
  
  return timeStr;
}

// =====================================================
// COUNTDOWN TIMER COMPONENT - Realtime countdown to event
// =====================================================
interface CountdownTimerProps {
  targetDate: Date;
  status: EventStatus;
}

function CountdownTimer({ targetDate, status }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('Starting now!');
        return;
      }

      setIsExpired(false);
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (days > 0) {
        setTimeLeft(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    // Calculate immediately
    calculateTimeLeft();
    
    // Update every second
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  // Only show countdown for upcoming and starting-soon events
  if (status === 'happening' || status === 'completed' || status === 'cancelled') {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <Clock className="w-3 h-3 text-[#f59e0b]" />
      <span 
        className={`font-mono font-semibold ${
          isExpired ? 'text-green-500' : 'text-[#f59e0b]'
        }`}
      >
        {timeLeft}
      </span>
    </div>
  );
}

// Helper to get event start datetime
function getEventStartDateTime(event: Event): Date {
  const startDate = new Date(event.startDate);
  
  if (event.startTime) {
    // Parse time - could be "7:13 PM" or "19:13" format
    const timeStr = event.startTime;
    let hours = 0;
    let minutes = 0;
    
    if (timeStr.toUpperCase().includes('AM') || timeStr.toUpperCase().includes('PM')) {
      const isPM = timeStr.toUpperCase().includes('PM');
      const timePart = timeStr.replace(/\s*(AM|PM)\s*/i, '').trim();
      const [h, m] = timePart.split(':').map(Number);
      hours = isPM && h !== 12 ? h + 12 : (!isPM && h === 12 ? 0 : h);
      minutes = m || 0;
    } else {
      // 24-hour format
      const [h, m] = timeStr.split(':').map(Number);
      hours = h || 0;
      minutes = m || 0;
    }
    
    startDate.setHours(hours, minutes, 0, 0);
  }
  
  return startDate;
}

// =====================================================
// GEOFENCE MAP COMPONENT - Leaflet-based interactive map
// =====================================================
interface GeofenceMapProps {
  eventLat: number;
  eventLng: number;
  radius: number;
  userLocation: UserLocation | null;
  isWithinGeofence: boolean | null;
  isDark: boolean;
  locationName?: string;
  onRecenterUser?: () => void;
}

function GeofenceMap({ eventLat, eventLng, radius, userLocation, isWithinGeofence, isDark, locationName, onRecenterUser }: GeofenceMapProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const eventMarkerRef = useRef<any>(null);
  const geofenceCircleRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const userAccuracyCircleRef = useRef<any>(null);
  const mapId = useRef(`geofence-map-${Date.now()}`);

  useEffect(() => {
    const initMap = async () => {
      if (mapInstanceRef.current) return; // Already initialized
      
      const L = (await import('leaflet')).default;
      
      // Wait for the container to be in DOM
      const container = document.getElementById(mapId.current);
      if (!container) {
        setTimeout(initMap, 100);
        return;
      }

      // Create custom icons
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

      const userIcon = L.divIcon({
        html: `
          <div style="position: relative;">
            <div style="width: 20px; height: 20px; background: #22c55e; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
          </div>
        `,
        className: 'user-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      // Initialize map centered on event location
      const mapInstance = L.map(mapId.current, {
        center: [eventLat, eventLng],
        zoom: 18, // High zoom for geofence visibility
        zoomControl: true,
      });

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 20,
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapInstance);

      // Add geofence circle FIRST (so it's behind the marker)
      const geofenceCircle = L.circle([eventLat, eventLng], {
        radius: radius,
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.2,
        weight: 3,
        dashArray: '10, 5',
      }).addTo(mapInstance);
      geofenceCircleRef.current = geofenceCircle;

      // Add event location marker with popup
      const eventMarker = L.marker([eventLat, eventLng], {
        icon: eventIcon,
      }).addTo(mapInstance);
      eventMarker.bindPopup(`
        <div style="text-align: center; padding: 4px;">
          <strong style="color: #EF4444;">${locationName || 'Event Location'}</strong><br/>
          <span style="font-size: 11px; color: #666;">Geofence: ${radius}m radius</span>
        </div>
      `);
      eventMarkerRef.current = eventMarker;

      // Add user location if available
      if (userLocation) {
        // User accuracy circle
        const accuracyCircle = L.circle([userLocation.lat, userLocation.lng], {
          radius: userLocation.accuracy,
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(mapInstance);
        userAccuracyCircleRef.current = accuracyCircle;

        // User marker
        const userMarker = L.marker([userLocation.lat, userLocation.lng], {
          icon: userIcon,
        }).addTo(mapInstance);
        userMarker.bindPopup(`
          <div style="text-align: center; padding: 4px;">
            <strong style="color: #22c55e;">Your Location</strong><br/>
            <span style="font-size: 11px; color: #666;">Accuracy: ±${Math.round(userLocation.accuracy)}m</span>
          </div>
        `);
        userMarkerRef.current = userMarker;

        // Fit bounds to show both markers
        const group = L.featureGroup([eventMarker, userMarker, geofenceCircle]);
        mapInstance.fitBounds(group.getBounds().pad(0.2));
      }

      mapInstanceRef.current = mapInstance;
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update user location marker when it changes
  useEffect(() => {
    const updateUserLocation = async () => {
      if (!mapInstanceRef.current || !userLocation) return;
      
      const L = (await import('leaflet')).default;

      const userIcon = L.divIcon({
        html: `
          <div style="position: relative;">
            <div style="width: 20px; height: 20px; background: #22c55e; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3); animation: pulse 2s infinite;"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
          </div>
        `,
        className: 'user-marker-live',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      if (userMarkerRef.current) {
        // Update existing marker position
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        if (userAccuracyCircleRef.current) {
          userAccuracyCircleRef.current.setLatLng([userLocation.lat, userLocation.lng]);
          userAccuracyCircleRef.current.setRadius(userLocation.accuracy);
        }
      } else {
        // Create new marker
        const accuracyCircle = L.circle([userLocation.lat, userLocation.lng], {
          radius: userLocation.accuracy,
          color: '#22c55e',
          fillColor: '#22c55e',
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(mapInstanceRef.current);
        userAccuracyCircleRef.current = accuracyCircle;

        const userMarker = L.marker([userLocation.lat, userLocation.lng], {
          icon: userIcon,
        }).addTo(mapInstanceRef.current);
        userMarker.bindPopup(`
          <div style="text-align: center; padding: 4px;">
            <strong style="color: #22c55e;">Your Location</strong><br/>
            <span style="font-size: 11px; color: #666;">Accuracy: ±${Math.round(userLocation.accuracy)}m</span>
          </div>
        `);
        userMarkerRef.current = userMarker;

        // Fit bounds to show both markers
        if (eventMarkerRef.current && geofenceCircleRef.current) {
          const group = L.featureGroup([eventMarkerRef.current, userMarker, geofenceCircleRef.current]);
          mapInstanceRef.current.fitBounds(group.getBounds().pad(0.2));
        }
      }
    };

    updateUserLocation();
  }, [userLocation]);

  // Calculate distance for display
  const distance = userLocation 
    ? Math.round(calculateDistance(userLocation.lat, userLocation.lng, eventLat, eventLng))
    : null;

  return (
    <div className="rounded-xl overflow-hidden border-2" style={{ borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)' }}>
      {/* Leaflet CSS */}
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        
        #${mapId.current} {
          height: 300px;
          width: 100%;
          z-index: 1;
        }
        
        .event-marker, .user-marker, .user-marker-live {
          background: none !important;
          border: none !important;
        }
        
        .leaflet-control-zoom {
          border: 2px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 8px !important;
          overflow: hidden;
        }
        
        .leaflet-control-zoom a {
          background: ${isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)'} !important;
          color: ${isDark ? '#fff' : '#000'} !important;
          border: none !important;
        }
        
        .leaflet-control-zoom a:hover {
          background: ${isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(243, 244, 246, 0.9)'} !important;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>
      
      <div id={mapId.current} />
      
      {/* Map Legend & Info Bar */}
      <div 
        className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs border-t"
        style={{
          background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Legend */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" />
            <span className="text-muted-foreground">Event</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-blue-500 bg-blue-500/30" />
            <span className="text-muted-foreground">{radius}m fence</span>
          </div>
          {userLocation && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow" />
              <span className="text-muted-foreground">You</span>
            </div>
          )}
        </div>
        
        {/* Status & Actions */}
        <div className="flex items-center gap-2">
          {/* Recenter Button */}
          {userLocation && (
            <button
              onClick={() => {
                if (mapInstanceRef.current && userMarkerRef.current) {
                  mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], 18);
                }
              }}
              className="p-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
              title="Center on my location"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
          )}
          {userLocation && distance !== null && (
            <span className={`font-medium ${isWithinGeofence ? 'text-green-500' : 'text-red-500'}`}>
              {isWithinGeofence ? '✓ Inside' : `${distance}m away`}
            </span>
          )}
          {userLocation && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Live tracking" />
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton Loading Component for Event Cards
function EventCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div 
      className="rounded-xl p-4 md:p-6 border animate-pulse"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Header */}
      <div className="mb-3 md:mb-4">
        <div 
          className="h-6 rounded-lg mb-2 w-3/4"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
        />
        <div 
          className="h-4 rounded w-full"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
        />
        <div 
          className="h-4 rounded w-2/3 mt-1"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
        />
      </div>

      {/* Details */}
      <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
          />
          <div 
            className="h-4 rounded flex-1"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
          />
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
          />
          <div 
            className="h-4 rounded w-2/3"
            style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
          />
        </div>
      </div>

      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div 
          className="h-6 w-24 rounded-full"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
        />
        <div 
          className="h-4 w-20 rounded hidden sm:block"
          style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }}
        />
      </div>
    </div>
  );
}

export default function AttendanceRecordingPage({ onClose, isDark }: AttendanceRecordingPageProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>("event-selection");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode>(null);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);

  // Backend data state
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Archive section state
  const [showArchive, setShowArchive] = useState(false);

  // Upload toast state for progress tracking
  const [uploadToastMessages, setUploadToastMessages] = useState<UploadToastMessage[]>([]);

  // Attendance recording state
  const [timeType, setTimeType] = useState<"in" | "out">("in");

  // User location state for geofence validation
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [locationPermission, setLocationPermission] = useState<"granted" | "denied" | "prompt" | "loading">("prompt");
  const [isWithinGeofence, setIsWithinGeofence] = useState<boolean | null>(null);
  const [distanceFromEvent, setDistanceFromEvent] = useState<number | null>(null);
  const [showDebugCoords, setShowDebugCoords] = useState<boolean>(false);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [isForceRefreshing, setIsForceRefreshing] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  // QR Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "prompt">("prompt");
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const qrScannerContainerId = "qr-reader-container";

  // Manual attendance state
  const [selectedMember, setSelectedMember] = useState("");
  const [memberSearchInput, setMemberSearchInput] = useState("");
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const memberSearchRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"Present" | "Late" | "Excused" | "Absent">("Present");
  
  // Batch recording state - smart detection via comma in input
  const [selectedMembers, setSelectedMembers] = useState<MemberForAttendance[]>([]);
  const [batchResults, setBatchResults] = useState<Array<{ name: string; status: "success" | "error" | "pending"; message: string }>>([]);
  const [isBatchRecording, setIsBatchRecording] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [previousRecord, setPreviousRecord] = useState<any>(null);
  const [pendingRecord, setPendingRecord] = useState<any>(null);
  const memberCacheRef = useRef<Map<string, MemberForAttendance>>(new Map());
  const isProcessingScanRef = useRef(false);
  const isStartingScannerRef = useRef(false);
  const scanPauseRef = useRef(false);
  const lastScanRef = useRef<{ id: string; at: number } | null>(null);
  const skipNextMemberReloadRef = useRef(false);
  const manuallyStoppedRef = useRef(false); // Track if scanner was manually stopped after successful scan
  const qrScanCooldownMs = 800;
  const hasPrefetchedMembersRef = useRef(false);
  const currentUser = getStoredUser();
  const isScannerPriorityUser = currentUser?.role === "head" || currentUser?.role === "admin" || currentUser?.role === "auditor";
  const MEMBERS_CACHE_KEY = "ysp_attendance_members_cache_v2";
  const MEMBERS_CACHE_TS_KEY = "ysp_attendance_members_cache_ts_v2";
  const PENDING_ATTENDANCE_KEY = "ysp_pending_attendance_queue_v1";
  const navEntries = performance.getEntriesByType("navigation");
  const isReload = navEntries.length > 0 && (navEntries[0] as PerformanceNavigationTiming).type === "reload";

  // Pending attendance queue for offline support
  interface PendingAttendanceRecord {
    id: string;
    eventId: string;
    eventName: string;
    memberId: string;
    memberName: string;
    memberData: MemberForAttendance;
    status: 'Present' | 'Late' | 'Absent' | 'Excused';
    timeType: 'in' | 'out';
    timestamp: string;
    fullDate: string;
    location?: { lat: number; lng: number };
    recordedBy: string;
    createdAt: number;
    synced: boolean;
    syncError?: string;
  }

  const [pendingAttendanceQueue, setPendingAttendanceQueue] = useState<PendingAttendanceRecord[]>([]);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load pending queue from localStorage on mount
  const loadPendingQueue = useCallback((): PendingAttendanceRecord[] => {
    try {
      const raw = localStorage.getItem(PENDING_ATTENDANCE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((r: PendingAttendanceRecord) => !r.synced);
    } catch {
      return [];
    }
  }, []);

  // Save pending queue to localStorage
  const savePendingQueue = useCallback((queue: PendingAttendanceRecord[]) => {
    try {
      localStorage.setItem(PENDING_ATTENDANCE_KEY, JSON.stringify(queue));
    } catch {
      console.error('Failed to save pending attendance queue');
    }
  }, []);

  // Add record to pending queue
  const addToPendingQueue = useCallback((record: Omit<PendingAttendanceRecord, 'id' | 'createdAt' | 'synced'>) => {
    const newRecord: PendingAttendanceRecord = {
      ...record,
      id: `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      synced: false,
    };
    setPendingAttendanceQueue(prev => {
      const updated = [...prev, newRecord];
      savePendingQueue(updated);
      return updated;
    });
    return newRecord;
  }, [savePendingQueue]);

  // Mark record as synced
  const markAsSynced = useCallback((id: string) => {
    setPendingAttendanceQueue(prev => {
      const updated = prev.filter(r => r.id !== id);
      savePendingQueue(updated);
      return updated;
    });
  }, [savePendingQueue]);

  // Mark record as failed
  const markAsFailed = useCallback((id: string, error: string) => {
    setPendingAttendanceQueue(prev => {
      const updated = prev.map(r => r.id === id ? { ...r, syncError: error } : r);
      savePendingQueue(updated);
      return updated;
    });
  }, [savePendingQueue]);

  // Member cache is now permanent (no TTL expiry)
  const loadMembersFromCache = (): MemberForAttendance[] | null => {
    try {
      // No TTL check - cache is permanent until manually cleared
      const raw = localStorage.getItem(MEMBERS_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed as MemberForAttendance[];
    } catch {
      return null;
    }
  };

  const saveMembersToCache = (membersToCache: MemberForAttendance[]) => {
    try {
      // Merge with existing cache - update existing members and add new ones
      const existing = loadMembersFromCache() || [];
      const existingMap = new Map(existing.map(m => [m.id, m]));
      
      // Update or add members from the new list
      for (const member of membersToCache) {
        existingMap.set(member.id, member); // Update if exists, add if new
      }
      
      const merged = Array.from(existingMap.values());
      localStorage.setItem(MEMBERS_CACHE_KEY, JSON.stringify(merged));
      localStorage.setItem(MEMBERS_CACHE_TS_KEY, String(Date.now()));
      console.log(`📦 Saved ${merged.length} members to cache (${membersToCache.length} updated/added)`);
    } catch (error) {
      console.warn("Cache write failed:", error);
      // Ignore cache write failures (e.g., storage full or disabled).
    }
  };

  const normalizeMemberId = (value: string): string =>
    value.trim().toLowerCase().replace(/\s+/g, "");

  const extractMemberIdFromQr = (raw: string): string => {
    const trimmed = raw.trim();

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        const jsonId = parsed?.memberId || parsed?.id || parsed?.member_id;
        if (typeof jsonId === "string" && jsonId.trim()) {
          return jsonId.trim();
        }
      } catch {
        // Fall back to string parsing
      }
    }

    const keyMatch = trimmed.match(/(?:memberId|member_id|id)\s*[:=]\s*([A-Za-z0-9-]+)/i);
    if (keyMatch?.[1]) {
      return keyMatch[1];
    }

    return trimmed;
  };

  const cacheMember = (member: MemberForAttendance) => {
    const normalizedId = normalizeMemberId(member.id);
    memberCacheRef.current.set(member.id, member);
    memberCacheRef.current.set(normalizedId, member);
  };

  // Toast management functions
  const addUploadToast = (message: UploadToastMessage) => {
    setUploadToastMessages(prev => [...prev.filter(m => m.id !== message.id), message]);
  };

  const updateUploadToast = (id: string, updates: Partial<UploadToastMessage>) => {
    setUploadToastMessages(prev => 
      prev.map(m => m.id === id ? { ...m, ...updates } : m)
    );
  };

  const dismissUploadToast = (id: string) => {
    setUploadToastMessages(prev => prev.filter(m => m.id !== id));
  };

  // Load events from backend
  const loadEvents = useCallback(async (showToast: boolean = false) => {
    const toastId = `load-events-${Date.now()}`;
    const controller = new AbortController();
    const signal = showToast ? controller.signal : undefined;
    
    if (showToast) {
      addUploadToast({
        id: toastId,
        title: 'Loading Events',
        message: 'Fetching available events...',
        status: 'loading',
        progress: 10,
        onCancel: () => {
          controller.abort();
          updateUploadToast(toastId, {
            status: 'info',
            progress: 100,
            title: 'Cancelled',
            message: 'Event load cancelled',
          });
        },
      });
    }
    
    try {
      if (showToast) {
        updateUploadToast(toastId, { progress: 30, message: 'Connecting to server...' });
      }
      
      // Always clear cache to get fresh status calculation from backend
      clearEventsCache();
      
      // Fetch events from backend - only active/scheduled events for recording
      const backendEvents = await fetchEvents(undefined, signal);
      if (signal?.aborted) {
        return;
      }
      
      if (showToast) {
        updateUploadToast(toastId, { progress: 70, message: 'Processing event data...' });
      }
      
      // Filter only events that should be shown for attendance recording
      // Show: Active, Scheduled
      // Archive (hide): Completed, Cancelled
      const relevantEvents = backendEvents.filter(event => {
        const status = event.Status;
        return status === 'Active' || status === 'Scheduled';
      });
      
      // Convert to frontend format and sort by priority
      const frontendEvents = relevantEvents.map(convertToFrontendEvent);
      const sortedEvents = sortEventsByPriority(frontendEvents);
      
      setEvents(sortedEvents);
      
      if (showToast) {
        updateUploadToast(toastId, {
          status: 'success',
          progress: 100,
          title: 'Events Loaded',
          message: `Found ${sortedEvents.length} event${sortedEvents.length !== 1 ? 's' : ''} for attendance`,
        });
      }
    } catch (error) {
      if (signal?.aborted) {
        return;
      }
      console.error("Failed to load events:", error);
      
      if (showToast) {
        updateUploadToast(toastId, {
          status: 'error',
          progress: 100,
          title: 'Loading Failed',
          message: error instanceof Error ? error.message : 'Failed to fetch events',
        });
      } else {
        toast.error("Failed to load events", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }, []);

  // Initial load
  useEffect(() => {
    const initLoad = async () => {
      setIsLoading(true);
      await loadEvents(true);
      setIsLoading(false);
    };
    initLoad();
  }, [loadEvents]);

  // Watch user location when event details modal is shown
  useEffect(() => {
    if (showEventDetailsModal && selectedEvent) {
      requestLocationPermission();
    } else {
      // Stop watching when modal is closed
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [showEventDetailsModal, selectedEvent]);

  // Update geofence status when user location changes
  // Uses smart detection: considers GPS accuracy in the calculation
  useEffect(() => {
    if (userLocation && selectedEvent) {
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        selectedEvent.location.lat,
        selectedEvent.location.lng
      );
      setDistanceFromEvent(Math.round(distance));
      
      // Check if location seems wrong (very far from event)
      if (isLocationSuspicious(userLocation.lat, userLocation.lng, selectedEvent.location.lat, selectedEvent.location.lng)) {
        setLocationWarning(`⚠️ Your GPS shows you're ${Math.round(distance / 1000)}km away. This may be incorrect. Try: 1) Go outside, 2) Wait 30 seconds, 3) Click "Force GPS Refresh"`);
      } else if (!isLocationPlausible(userLocation.lat, userLocation.lng)) {
        setLocationWarning('⚠️ Location seems outside Philippines. GPS may be returning cached data.');
      } else if (userLocation.accuracy > 100) {
        setLocationWarning('⚠️ Low accuracy. Move to open area for better GPS signal.');
      } else {
        setLocationWarning(null);
      }
      
      // Smart geofence detection:
      // You're considered "inside" if:
      // 1. Your exact position is within the geofence, OR
      // 2. Your position + accuracy could put you inside (accuracy circle overlaps geofence)
      // This prevents false "outside" readings when GPS is slightly inaccurate
      const effectiveDistance = Math.max(0, distance - userLocation.accuracy);
      const isDefinitelyInside = distance <= selectedEvent.radius;
      const couldBeInside = effectiveDistance <= selectedEvent.radius;
      
      // If accuracy is good (< 30m), use strict check; otherwise use lenient check
      if (userLocation.accuracy < 30) {
        setIsWithinGeofence(isDefinitelyInside);
      } else {
        // With poor accuracy, give benefit of the doubt if they could be inside
        setIsWithinGeofence(couldBeInside);
      }
    }
  }, [userLocation, selectedEvent]);

  // Request location permission and start watching
  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      setLocationPermission("denied");
      toast.error("Geolocation not supported", {
        description: "Your browser doesn't support location services.",
      });
      return;
    }

    setLocationPermission("loading");

    // Start watching position for real-time updates
    // Using aggressive settings for maximum accuracy
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setLocationPermission("granted");
        
        // Log for debugging
        console.log(`📍 Location update: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} (±${Math.round(position.coords.accuracy)}m)`);
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationPermission("denied");
        if (error.code === error.PERMISSION_DENIED) {
          toast.error("Location access denied", {
            description: "Please enable location services to verify your position.",
          });
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          toast.error("Location unavailable", {
            description: "Unable to determine your current location.",
          });
        } else if (error.code === error.TIMEOUT) {
          toast.error("Location timeout", {
            description: "Taking too long to get your location. Please try again.",
          });
        }
      },
      {
        // Maximum accuracy settings
        enableHighAccuracy: true,  // Use GPS if available (more accurate but slower)
        timeout: 10000,            // Wait up to 10 seconds for a position
        maximumAge: 0,             // Always get fresh position, don't use cached
      }
    );
  };

  // Function to manually refresh location
  const refreshLocation = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setLocationPermission("loading");
    requestLocationPermission();
    toast.info("Refreshing location...", { duration: 2000 });
  };

  // Force GPS refresh - gets completely fresh position, no cache
  const forceGPSRefresh = () => {
    setIsForceRefreshing(true);
    setLocationWarning(null);
    
    // Clear existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    // Clear current location to force fresh state
    setUserLocation(null);
    setLocationPermission("loading");
    
    toast.info("📡 Force refreshing GPS... Please wait", { duration: 5000 });
    
    // First, get a single fresh position to verify GPS is working
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log(`🔄 Force GPS result: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)} (±${Math.round(position.coords.accuracy)}m)`);
        
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        });
        setLocationPermission("granted");
        setIsForceRefreshing(false);
        
        // Then start continuous watch
        requestLocationPermission();
        
        toast.success("GPS location updated!", { duration: 3000 });
      },
      (error) => {
        console.error("Force GPS error:", error);
        setIsForceRefreshing(false);
        setLocationPermission("denied");
        toast.error("GPS failed", {
          description: "Could not get fresh GPS position. Make sure you're outside with clear sky view.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 30000,  // Wait longer for fresh GPS
        maximumAge: 0,   // No cached data
      }
    );
  };

  // Refresh events
  const handleRefresh = async () => {
    setIsRefreshing(true);
    clearEventsCache();
    clearMembersCache();
    localStorage.removeItem(MEMBERS_CACHE_KEY);
    localStorage.removeItem(MEMBERS_CACHE_TS_KEY);
    await loadEvents(true);
    await loadMembers(undefined, 100, true, false);
    setIsRefreshing(false);
  };

  // Members state (loaded from backend)
  const [members, setMembers] = useState<MemberForAttendance[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isRecordingAttendance, setIsRecordingAttendance] = useState(false);

  // Online/Offline detection and pending queue sync
  useEffect(() => {
    // Load pending queue on mount
    const queue = loadPendingQueue();
    setPendingAttendanceQueue(queue);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Back online!", {
        description: pendingAttendanceQueue.length > 0 
          ? `Syncing ${pendingAttendanceQueue.length} pending record(s)...` 
          : "Network connection restored.",
      });
      // Trigger sync
      syncPendingRecords();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("You're offline", {
        description: "Attendance will be saved locally and synced when online.",
        duration: 5000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadPendingQueue]);

  // Sync pending records when coming online
  const syncPendingRecords = useCallback(async () => {
    const queue = loadPendingQueue();
    if (queue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    for (const record of queue) {
      try {
        if (record.timeType === 'in') {
          await recordTimeIn({
            eventId: record.eventId,
            memberId: record.memberId,
            memberName: record.memberName,
            status: record.status as 'Present' | 'Late',
            location: record.location,
            recordedBy: record.recordedBy,
          });
        } else {
          await recordTimeOut({
            eventId: record.eventId,
            memberId: record.memberId,
            location: record.location,
            recordedBy: record.recordedBy,
          });
        }
        markAsSynced(record.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to sync record ${record.id}:`, error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        // Don't mark as failed for network errors - will retry
        if (error instanceof AttendanceAPIError && error.code !== AttendanceErrorCodes.NETWORK_ERROR) {
          markAsFailed(record.id, errorMsg);
          failCount++;
        }
      }
    }

    setIsSyncing(false);

    if (successCount > 0) {
      toast.success(`Synced ${successCount} attendance record(s)`, {
        description: failCount > 0 ? `${failCount} record(s) had errors.` : undefined,
      });
    }
  }, [loadPendingQueue, markAsSynced, markAsFailed, isSyncing]);

  // Try to sync when online status changes
  useEffect(() => {
    if (isOnline && pendingAttendanceQueue.length > 0) {
      syncPendingRecords();
    }
  }, [isOnline, syncPendingRecords, pendingAttendanceQueue.length]);

  // Load members from backend
  const loadMembers = useCallback(async (search?: string, limit: number = 100, showLoading: boolean = true, useCache: boolean = true) => {
    if (showLoading) {
      setIsLoadingMembers(true);
    }
    try {
      if (!search && isReload) {
        localStorage.removeItem(MEMBERS_CACHE_KEY);
        localStorage.removeItem(MEMBERS_CACHE_TS_KEY);
      }
      if (!search && useCache) {
        const cachedMembers = loadMembersFromCache();
        if (cachedMembers && cachedMembers.length > 0) {
          cachedMembers.forEach(cacheMember);
          setMembers(cachedMembers);
          // If online, also fetch fresh data in background to update cache
          if (isOnline) {
            getMembersForAttendance(search, limit).then(fetchedMembers => {
              fetchedMembers.forEach(cacheMember);
              saveMembersToCache(fetchedMembers);
            }).catch(() => {/* ignore background fetch errors */});
          }
          return;
        }
      }
      const fetchedMembers = await getMembersForAttendance(search, limit);
      fetchedMembers.forEach(cacheMember);
      setMembers(fetchedMembers);
      if (!search) {
        saveMembersToCache(fetchedMembers);
      }
    } catch (error) {
      console.error("Failed to load members:", error);
      // If offline, try to use cached members even if stale
      if (!isOnline) {
        const cachedMembers = loadMembersFromCache();
        if (cachedMembers && cachedMembers.length > 0) {
          cachedMembers.forEach(cacheMember);
          setMembers(cachedMembers);
          toast.info("Using cached members (offline)", { duration: 3000 });
          return;
        }
      }
      toast.error("Failed to load members", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      if (showLoading) {
        setIsLoadingMembers(false);
      }
    }
  }, [isOnline]);

  // Load members when entering recording step
  useEffect(() => {
    if (currentStep === "recording" && selectedMode === "manual") {
      loadMembers();
    }
  }, [currentStep, selectedMode, loadMembers]);

  // Warm members cache for faster QR lookups
  useEffect(() => {
    if (currentStep === "recording" && selectedMode === "qr" && !hasPrefetchedMembersRef.current) {
      hasPrefetchedMembersRef.current = true;
      loadMembers(undefined, 500, false);
    }
  }, [currentStep, selectedMode, loadMembers]);

  // Prefetch members early for heads/admins to reduce scan latency
  useEffect(() => {
    if (isScannerPriorityUser && !hasPrefetchedMembersRef.current) {
      hasPrefetchedMembersRef.current = true;
      loadMembers(undefined, 500, false);
    }
  }, [isScannerPriorityUser, loadMembers]);

  // Debounced member search from backend
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (skipNextMemberReloadRef.current) {
        skipNextMemberReloadRef.current = false;
        return;
      }

      // If we already have members loaded, just filter locally - no need to fetch from backend
      if (memberSearchInput && memberSearchInput.length >= 2) {
        // Only fetch from backend if we don't have members loaded yet
        if (members.length === 0) {
          loadMembers(memberSearchInput, 100, true, false);
        }
        // Otherwise, filteredMembers will handle local filtering automatically
      } else if (currentStep === "recording" && selectedMode === "manual" && !memberSearchInput) {
        // Only load members if we don't have them yet
        if (members.length === 0) {
          loadMembers();
        }
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [memberSearchInput, currentStep, selectedMode, loadMembers, members.length]);

  // Navigation handlers
  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setShowEventDetailsModal(true);
  };

  const handleProceedToModeSelection = () => {
    // Skip geofence check if geofencing is disabled for this event
    if (selectedEvent?.geofenceEnabled === false) {
      setShowEventDetailsModal(false);
      setCurrentStep("mode-selection");
      // Pre-cache all members when event is selected
      prefetchAndCacheAllMembers();
      return;
    }
    
    // Block if user is not within geofence
    if (!isWithinGeofence) {
      toast.error("You must be at the event location", {
        description: `You are ${distanceFromEvent}m away. Move within ${selectedEvent?.radius}m of the event to record attendance.`,
      });
      return;
    }
    
    setShowEventDetailsModal(false);
    setCurrentStep("mode-selection");
    // Pre-cache all members when event is selected
    prefetchAndCacheAllMembers();
  };
  
  // Prefetch and permanently cache all members when an event is selected
  const prefetchAndCacheAllMembers = async () => {
    try {
      console.log("📦 Pre-caching all members for attendance...");
      
      // First, load from localStorage cache
      const cachedMembers = loadMembersFromCache();
      if (cachedMembers && cachedMembers.length > 0) {
        console.log(`📦 Found ${cachedMembers.length} members in localStorage cache`);
        cachedMembers.forEach(cacheMember);
        setMembers(cachedMembers);
      }
      
      // Then fetch from backend to get any new members (in background)
      if (isOnline) {
        const fetchedMembers = await getMembersForAttendance(undefined, 1000); // Get all members
        console.log(`📦 Fetched ${fetchedMembers.length} members from backend`);
        
        // Cache each member in memory
        fetchedMembers.forEach(cacheMember);
        
        // Merge with existing cache and save to localStorage
        saveMembersToCache(fetchedMembers);
        
        // Update state with merged list
        const merged = loadMembersFromCache() || fetchedMembers;
        setMembers(merged);
        
        console.log(`📦 Total cached members: ${merged.length}`);
      }
    } catch (error) {
      console.error("Failed to prefetch members:", error);
      // Still use cached data if available
      const cachedMembers = loadMembersFromCache();
      if (cachedMembers && cachedMembers.length > 0) {
        cachedMembers.forEach(cacheMember);
        setMembers(cachedMembers);
      }
    }
  };

  const handleModeSelect = (mode: Mode) => {
    setSelectedMode(mode);
    setCurrentStep("recording");
    manuallyStoppedRef.current = false; // Reset when entering recording mode
  };

  const handleGoBack = () => {
    if (currentStep === "recording") {
      setCurrentStep("mode-selection");
      setIsScanning(false);
      scanPauseRef.current = false;
      manuallyStoppedRef.current = false; // Reset when leaving recording
      setSelectedMember("");
      setMemberSearchInput("");
      setShowMemberDropdown(false);
      setStatus("Present");
    } else if (currentStep === "mode-selection") {
      setCurrentStep("event-selection");
      setSelectedEvent(null);
      setSelectedMode(null);
    }
  };

  const navigateToEventSelection = () => {
    setCurrentStep("event-selection");
    setSelectedEvent(null);
    setSelectedMode(null);
    setIsScanning(false);
    manuallyStoppedRef.current = false; // Reset when going back to event selection
    scanPauseRef.current = false;
    setSelectedMember("");
    setMemberSearchInput("");
    setShowMemberDropdown(false);
    setStatus("Present");
  };

  const navigateToModeSelection = () => {
    setCurrentStep("mode-selection");
    setSelectedMode(null);
    setIsScanning(false);
    scanPauseRef.current = false;
    setSelectedMember("");
    setMemberSearchInput("");
    setShowMemberDropdown(false);
    setStatus("Present");
  };

  // Get current user for recording
  const getCurrentUserName = (): string => {
    const user = getStoredUser();
    return user?.name || user?.username || 'System';
  };

  // Format time from various formats (handles Google Sheets date serialization)
  const formatTimeDisplay = (timeValue: string | undefined): string => {
    if (!timeValue) return 'N/A';
    
    // If it's already a formatted time like "10:30 AM" or "10:30 pm", return as-is
    if (/^\d{1,2}:\d{2}\s?(AM|PM|am|pm)$/i.test(timeValue.trim())) {
      return timeValue.trim();
    }
    
    // If it's an ISO date string or Google Sheets serialized date
    try {
      const date = new Date(timeValue);
      if (!isNaN(date.getTime())) {
        // Check if it's a valid date (not 1899 which is Google Sheets epoch)
        if (date.getFullYear() < 1900) {
          // Google Sheets stores time-only values as 1899-12-30 dates
          // The time is stored in Manila timezone but returned as UTC
          // So we need to convert UTC to Manila time (+8 hours)
          const utcHours = date.getUTCHours();
          const utcMinutes = date.getUTCMinutes();
          
          // Add 8 hours for Manila timezone (UTC+8)
          let manilaHours = utcHours + 8;
          if (manilaHours >= 24) manilaHours -= 24;
          
          const ampm = manilaHours >= 12 ? 'PM' : 'AM';
          const displayHours = manilaHours % 12 || 12;
          return `${displayHours}:${utcMinutes.toString().padStart(2, '0')} ${ampm}`;
        }
        // For regular dates, use locale formatting
        return date.toLocaleTimeString('en-PH', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    } catch (e) {
      // Fall through to return original value
    }
    
    return timeValue;
  };

  // Generate initials from a name
  const getInitials = (name: string): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    // Get first letter of first name and first letter of last name
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  // Render avatar with image or initials fallback
  const renderAvatar = (profilePicture: string | undefined, name: string, size: 'sm' | 'md' | 'lg' = 'md') => {
    const sizeClasses = {
      sm: 'w-10 h-10 text-sm',
      md: 'w-16 h-16 md:w-20 md:h-20 text-xl md:text-2xl',
      lg: 'w-20 h-20 md:w-24 md:h-24 text-2xl md:text-3xl',
    };
    
    if (profilePicture) {
      return (
        <img 
          src={profilePicture}
          alt={name}
          className={`${sizeClasses[size].split(' ').slice(0, 2).join(' ')} rounded-full object-cover border-4 shadow-lg`}
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)',
          }}
          onError={(e) => {
            // If image fails to load, replace with initials
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            target.nextElementSibling?.classList.remove('hidden');
          }}
        />
      );
    }
    
    // Initials fallback
    return (
      <div 
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white border-4 shadow-lg`}
        style={{
          background: 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)',
        }}
      >
        {getInitials(name)}
      </div>
    );
  };

  // Close member dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (memberSearchRef.current && !memberSearchRef.current.contains(event.target as Node)) {
        setShowMemberDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle member selection
  const handleMemberSelect = (member: MemberForAttendance) => {
    // Skip the debounced search that would be triggered by setting the search input
    skipNextMemberReloadRef.current = true;
    setSelectedMember(member.id);
    setMemberSearchInput(member.name);
    setShowMemberDropdown(false);
    // Reset loading state immediately since we already have the member
    setIsLoadingMembers(false);
  };

  // Filter members based on search input
  const filteredMembers = members.filter(member => 
    member.name.toLowerCase().includes(memberSearchInput.toLowerCase()) ||
    member.committee.toLowerCase().includes(memberSearchInput.toLowerCase()) ||
    member.id.toLowerCase().includes(memberSearchInput.toLowerCase())
  );

  // Process QR code scan result - with offline support
  const processQRScan = async (scannedData: string) => {
    if (!selectedEvent) {
      isProcessingScanRef.current = false;
      return;
    }
    if (scanPauseRef.current) {
      isProcessingScanRef.current = false;
      return;
    }

    const rawMemberId = extractMemberIdFromQr(scannedData);
    const normalizedMemberId = normalizeMemberId(rawMemberId);
    const now = Date.now();

    if (lastScanRef.current?.id === normalizedMemberId && now - lastScanRef.current.at < qrScanCooldownMs) {
      isProcessingScanRef.current = false;
      return;
    }
    lastScanRef.current = { id: normalizedMemberId, at: now };

    setIsRecordingAttendance(true);
    
    try {
      // Parse QR data - expected format: "ID_CODE" or "MEM-XXX" or member ID
      const memberId = rawMemberId;
      
      // Find member in our loaded list or cache first
      let member = memberCacheRef.current.get(normalizedMemberId) ||
        memberCacheRef.current.get(memberId) ||
        members.find(m => m.id === memberId || m.id.includes(memberId) || normalizeMemberId(m.id) === normalizedMemberId);
      
      // Also check localStorage cache
      if (!member) {
        const cachedMembers = loadMembersFromCache();
        if (cachedMembers) {
          member = cachedMembers.find(m => m.id === memberId || m.id.includes(memberId) || normalizeMemberId(m.id) === normalizedMemberId);
          if (member) {
            cacheMember(member);
          }
        }
      }
      
      // Only fetch from backend if online and not found in cache
      if (!member && isOnline) {
        try {
          const fetchedMembers = await getMembersForAttendance(memberId, 1);
          if (fetchedMembers.length > 0) {
            member = fetchedMembers[0];
            cacheMember(member);
            saveMembersToCache([member]);
            setMembers(prev => prev.some(m => m.id === member?.id) ? prev : [...prev, member!]);
          }
        } catch {
          // Continue with cached data if fetch fails
        }
      }

      if (!member) {
        toast.error("Member not found", {
          description: isOnline 
            ? `No member found with ID: ${memberId}` 
            : `Member not in offline cache. ID: ${memberId}`,
        });
        setIsRecordingAttendance(false);
        isProcessingScanRef.current = false;
        return;
      }

      const currentDate = new Date();
      const timestamp = currentDate.toLocaleTimeString("en-PH", {
        timeZone: "Asia/Manila",
        hour: "2-digit",
        minute: "2-digit",
      });
      const fullDate = currentDate.toLocaleDateString("en-PH", {
        timeZone: "Asia/Manila",
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Show verification modal FIRST - record only after user confirms
      // This allows user to verify the person's identity before recording
      setPendingRecord({
        memberData: member,
        member: member!.name,
        event: selectedEvent.name,
        eventId: selectedEvent.id,
        timeType: timeType === "in" ? "Time In" : "Time Out",
        status: "Present",
        timestamp: timestamp,
        date: fullDate,
        needsConfirmation: true, // Flag to indicate recording hasn't happened yet
        isOffline: !isOnline,
      });
      scanPauseRef.current = true;
      setShowVerificationModal(true);
      setIsRecordingAttendance(false);
      isProcessingScanRef.current = false;
      
    } catch (error) {
      console.error("QR scan processing error:", error);
      toast.error("Failed to process QR code", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setIsRecordingAttendance(false);
      isProcessingScanRef.current = false;
    }
  };

  // Confirm and record attendance after user verifies identity
  const confirmAndRecordAttendance = async () => {
    if (!pendingRecord?.memberData || !selectedEvent) {
      toast.error("Missing member or event data");
      return;
    }

    const member = pendingRecord.memberData;
    const timestamp = pendingRecord.timestamp;
    const fullDate = pendingRecord.date;
    
    setIsRecordingAttendance(true);

    // Helper to queue offline record
    const queueOfflineRecord = () => {
      addToPendingQueue({
        eventId: selectedEvent.id,
        eventName: selectedEvent.name,
        memberId: member.id,
        memberName: member.name,
        memberData: member,
        status: pendingRecord.status || 'Present',
        timeType: timeType,
        timestamp: timestamp,
        fullDate: fullDate,
        location: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
        recordedBy: getCurrentUserName(),
      });
      
      // Update pending record to show it's queued
      setPendingRecord({
        ...pendingRecord,
        needsConfirmation: false,
        isOffline: true,
      });
      
      toast.success(`${pendingRecord.status} - ${member.name}`, {
        description: `${pendingRecord.timeType} queued for sync`,
      });
      
      // Close modal and reset
      setShowVerificationModal(false);
      scanPauseRef.current = false;
      setPendingRecord(null);
      setIsRecordingAttendance(false);
      
      // STOP scanning after successful queue - user must manually restart
      if (selectedMode === "qr") {
        manuallyStoppedRef.current = true; // Prevent auto-restart
        handleStopScanning();
        toast.info("Press Start Camera to scan next member", { duration: 3000 });
      }
    };

    // If offline, queue the record
    if (!isOnline) {
      queueOfflineRecord();
      return;
    }

    // Online flow - record to backend
    try {
      if (timeType === "in") {
        const response = await recordTimeIn({
          eventId: selectedEvent.id,
          memberId: member.id,
          memberName: member.name,
          status: pendingRecord.status as 'Present' | 'Late' || 'Present',
          location: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
          recordedBy: getCurrentUserName(),
        });

        // Success!
        toast.success(`${pendingRecord.status} - ${member.name}`, {
          description: `${pendingRecord.timeType} recorded at ${formatTimeDisplay(response.timeIn) || timestamp}`,
        });
        
      } else {
        // Time Out
        const response = await recordTimeOut({
          eventId: selectedEvent.id,
          memberId: member.id,
          location: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
          recordedBy: getCurrentUserName(),
        });

        // Success!
        toast.success(`${pendingRecord.status} - ${member.name}`, {
          description: `${pendingRecord.timeType} recorded at ${formatTimeDisplay(response.timeOut) || timestamp}`,
        });
      }

      // Close modal and reset
      setShowVerificationModal(false);
      scanPauseRef.current = false;
      setPendingRecord(null);
      
      // STOP scanning after successful record - user must manually restart
      // This prevents accidental double scans and overloading
      if (selectedMode === "qr") {
        manuallyStoppedRef.current = true; // Prevent auto-restart
        await handleStopScanning();
        toast.info("Press Start Camera to scan next member", { duration: 3000 });
      }
      
    } catch (error) {
      if (error instanceof AttendanceAPIError) {
        if (error.code === AttendanceErrorCodes.EXISTING_RECORD) {
          // Show overwrite warning
          const existingRecord = error.existingRecord;
          setShowVerificationModal(false);
          setPreviousRecord({
            memberData: member,
            member: member.name,
            event: selectedEvent.name,
            timeType: pendingRecord.timeType,
            status: existingRecord?.status || "Present",
            timestamp: formatTimeDisplay(existingRecord?.timeIn || existingRecord?.timeOut) || "",
            date: fullDate,
          });
          setPendingRecord({
            ...pendingRecord,
            needsConfirmation: false, // For overwrite flow
          });
          setShowOverwriteWarning(true);
        } else if (error.code === AttendanceErrorCodes.NO_TIME_IN) {
          toast.error("No Time In Record", {
            description: `${member.name} hasn't timed in yet. Please record Time In first.`,
          });
          setShowVerificationModal(false);
          scanPauseRef.current = false;
          setPendingRecord(null);
        } else if (error.code === AttendanceErrorCodes.ALREADY_TIMED_OUT) {
          toast.error("Already Timed Out", {
            description: `${member.name} has already timed out for this event today.`,
          });
          setShowVerificationModal(false);
          scanPauseRef.current = false;
          setPendingRecord(null);
        } else if (error.code === AttendanceErrorCodes.NETWORK_ERROR || error.code === AttendanceErrorCodes.TIMEOUT) {
          // Network error - queue for offline sync
          queueOfflineRecord();
          return;
        } else {
          throw error;
        }
      } else {
        // Unknown error - try to queue offline
        queueOfflineRecord();
        return;
      }
    } finally {
      setIsRecordingAttendance(false);
    }
  };

  // QR Scanner handlers - using html5-qrcode for real QR scanning
  const handleStartScanning = async () => {
    if (isScanning || isStartingScannerRef.current) {
      return;
    }

    isStartingScannerRef.current = true;
    manuallyStoppedRef.current = false; // User wants to scan again
    try {
      isProcessingScanRef.current = false;
      scanPauseRef.current = false;

      // Clean up any existing scanner instance
      if (qrScannerRef.current) {
        try {
          const state = qrScannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING) {
            await qrScannerRef.current.stop();
          }
        } catch {
          // Ignore cleanup errors
        }
        qrScannerRef.current = null;
      }

      setIsScanning(true);
      setCameraPermission("granted");

      // Wait for the container to be in the DOM
      await new Promise(resolve => setTimeout(resolve, 100));

      const html5QrCode = new Html5Qrcode(qrScannerContainerId);
      qrScannerRef.current = html5QrCode;

      const qrCodeSuccessCallback = async (decodedText: string) => {
        if (scanPauseRef.current || isProcessingScanRef.current) return;
        isProcessingScanRef.current = true;

        console.log("QR Code scanned:", decodedText);

        // Process the scanned QR code (member ID)
        await processQRScan(decodedText.trim());
      };

      const config = { 
        fps: 20, 
        qrbox: { width: 280, height: 280 },
        aspectRatio: 1.0,
        disableFlip: true,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      };

      // Start scanning with back camera
      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        (errorMessage) => {
          // QR code parse error - this is called frequently, just ignore
          // console.log("QR parse error:", errorMessage);
        }
      );

    } catch (error) {
      console.error("Camera access error:", error);
      setCameraPermission("denied");
      toast.error("Camera access denied", {
        description: "Please enable camera permissions in your browser settings.",
      });
      setIsScanning(false);
    } finally {
      isStartingScannerRef.current = false;
    }
  };

  // Stop QR scanning - with improved mobile handling
  const handleStopScanning = async () => {
    console.log("🛑 Stop scanning requested, current state:", {
      hasScanner: !!qrScannerRef.current,
      isScanning,
    });
    
    // Track if scanner was actually running to show toast only when needed
    const wasScanning = isScanning || !!qrScannerRef.current;
    
    // Immediately update UI state to provide feedback
    setIsScanning(false);
    isProcessingScanRef.current = false;
    scanPauseRef.current = false;
    
    // Then clean up the scanner
    if (qrScannerRef.current) {
      try {
        const state = qrScannerRef.current.getState();
        console.log("🛑 Scanner state:", state);
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await qrScannerRef.current.stop();
          console.log("🛑 Scanner stopped successfully");
        }
      } catch (error) {
        console.error("Error stopping scanner:", error);
        // Force cleanup even if stop() fails
        try {
          await qrScannerRef.current.clear();
        } catch {
          // Ignore clear errors
        }
      }
      qrScannerRef.current = null;
    }
    
    // Clear the scanner container
    const container = document.getElementById(qrScannerContainerId);
    if (container) {
      container.innerHTML = '';
    }
    
    // Only show toast if scanner was actually running
    if (wasScanning) {
      toast.info("Camera stopped", { duration: 2000 });
    }
  };

  // Cleanup scanner on unmount or when leaving QR mode
  useEffect(() => {
    return () => {
      if (qrScannerRef.current) {
        try {
          qrScannerRef.current.stop().catch(() => {});
        } catch {
          // Ignore cleanup errors
        }
        qrScannerRef.current = null;
      }
    };
  }, []);

  // Stop scanner when changing modes or steps
  useEffect(() => {
    if (currentStep !== "recording" || selectedMode !== "qr") {
      handleStopScanning();
    }
  }, [currentStep, selectedMode]);

  // Auto-start scanning when entering QR mode (only on initial entry, not after manual stop)
  useEffect(() => {
    if (
      currentStep === "recording" &&
      selectedMode === "qr" &&
      cameraPermission !== "denied" &&
      !isScanning &&
      !showVerificationModal &&
      !showOverwriteWarning &&
      !manuallyStoppedRef.current // Don't auto-start if manually stopped after successful scan
    ) {
      handleStartScanning();
    }
  }, [currentStep, selectedMode, cameraPermission, isScanning, showVerificationModal, showOverwriteWarning]);

  // Manual attendance handlers - with real backend
  const handleRecordAttendance = async () => {
    if (!selectedMember) {
      toast.error("Please select a member");
      return;
    }

    if (!selectedEvent) {
      toast.error("No event selected");
      return;
    }

    if ((status === "Absent" || status === "Excused") && timeType === "out") {
      toast.error("Cannot record Time Out for Absent or Excused status");
      return;
    }

    const member = members.find(m => m.id === selectedMember);
    if (!member) {
      toast.error("Member not found");
      return;
    }

    setIsRecordingAttendance(true);

    const currentDate = new Date();
    const timestamp = currentDate.toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
    });
    const fullDate = currentDate.toLocaleDateString("en-PH", {
      timeZone: "Asia/Manila",
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    try {
      // First check if there's an existing record
      const existingCheck = await checkExistingAttendance(selectedEvent.id, member.id);
      
      if (existingCheck.exists && existingCheck.record) {
        // Show overwrite modal - format the timestamp properly
        const rawTime = existingCheck.record.timeIn || existingCheck.record.timeOut;
        setPreviousRecord({
          memberData: member,
          member: member.name,
          event: selectedEvent.name,
          timeType: existingCheck.record.timeIn ? "Time In" : "Time Out",
          status: existingCheck.record.status,
          timestamp: formatTimeDisplay(rawTime),
          date: fullDate,
        });
        setPendingRecord({
          memberData: member,
          member: member.name,
          event: selectedEvent.name,
          timeType: timeType === "in" ? "Time In" : "Time Out",
          status: status,
          timestamp: timestamp,
          date: fullDate,
        });
        setShowOverwriteWarning(true);
      } else {
        // No existing record - record directly
        await submitAttendanceRecord(member, timestamp, fullDate, false);
      }
    } catch (error) {
      console.error("Attendance recording error:", error);
      toast.error("Failed to record attendance", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsRecordingAttendance(false);
    }
  };

  // Submit attendance record to backend
  const submitAttendanceRecord = async (
    member: MemberForAttendance, 
    timestamp: string, 
    fullDate: string, 
    overwrite: boolean
  ) => {
    if (!selectedEvent) return;

    try {
      if (timeType === "in") {
        if (status === "Absent" || status === "Excused") {
          // Use manual attendance for Absent/Excused
          const response = await recordManualAttendance({
            eventId: selectedEvent.id,
            memberId: member.id,
            memberName: member.name,
            status: status,
            timeType: 'in',
            notes: `Manually marked as ${status}`,
            recordedBy: getCurrentUserName(),
            overwrite: overwrite,
          });

          setPendingRecord({
            memberData: member,
            member: member.name,
            event: selectedEvent.name,
            timeType: "Manual Entry",
            status: status,
            timestamp: timestamp,
            date: fullDate,
            attendanceId: response.attendanceId,
          });
        } else {
          // Regular Time In
          const response = await recordTimeIn({
            eventId: selectedEvent.id,
            memberId: member.id,
            memberName: member.name,
            status: status as 'Present' | 'Late',
            location: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
            recordedBy: getCurrentUserName(),
          });

          setPendingRecord({
            memberData: member,
            member: member.name,
            event: selectedEvent.name,
            timeType: "Time In",
            status: status,
            timestamp: formatTimeDisplay(response.timeIn) || timestamp,
            date: fullDate,
            attendanceId: response.attendanceId,
          });
        }
      } else {
        // Time Out
        const response = await recordTimeOut({
          eventId: selectedEvent.id,
          memberId: member.id,
          location: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
          recordedBy: getCurrentUserName(),
        });

        setPendingRecord({
          memberData: member,
          member: member.name,
          event: selectedEvent.name,
          timeType: "Time Out",
          status: "Present",
          timestamp: formatTimeDisplay(response.timeOut) || timestamp,
          date: fullDate,
          attendanceId: response.attendanceId,
          timeIn: formatTimeDisplay(response.timeIn),
        });
      }

      setShowVerificationModal(true);
      
      // Reset form
      skipNextMemberReloadRef.current = true;
      setSelectedMember("");
      setMemberSearchInput("");
      setShowMemberDropdown(false);
      setStatus("Present");
    } catch (error) {
      if (error instanceof AttendanceAPIError) {
        if (error.code === AttendanceErrorCodes.NO_TIME_IN) {
          toast.error("No Time In Record", {
            description: `${member.name} hasn't timed in yet. Please record Time In first.`,
          });
        } else if (error.code === AttendanceErrorCodes.ALREADY_TIMED_OUT) {
          toast.error("Already Timed Out", {
            description: `${member.name} has already timed out for this event today.`,
          });
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }
  };

  const confirmOverwrite = async () => {
    if (!pendingRecord?.memberData || !selectedEvent) {
      setShowOverwriteWarning(false);
      scanPauseRef.current = false;
      return;
    }

    setIsRecordingAttendance(true);
    setShowOverwriteWarning(false);

    try {
      // Use manual attendance with overwrite flag
      const response = await recordManualAttendance({
        eventId: selectedEvent.id,
        memberId: pendingRecord.memberData.id,
        memberName: pendingRecord.memberData.name,
        status: pendingRecord.status as 'Present' | 'Late' | 'Absent' | 'Excused',
        timeType: timeType,
        notes: `Overwritten previous record`,
        recordedBy: getCurrentUserName(),
        overwrite: true,
      });

      // Update pending record with response
      setPendingRecord({
        ...pendingRecord,
        attendanceId: response.attendanceId,
      });

      setShowVerificationModal(true);
      
      // Reset form for manual mode
      if (selectedMode === "manual") {
        skipNextMemberReloadRef.current = true;
        setSelectedMember("");
        setMemberSearchInput("");
        setShowMemberDropdown(false);
        setStatus("Present");
      }
    } catch (error) {
      console.error("Failed to overwrite attendance:", error);
      toast.error("Failed to update attendance", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      scanPauseRef.current = false;
    } finally {
      setIsRecordingAttendance(false);
    }
  };

  // Smart batch recording handler - uses selectedMembers array
  const handleBatchRecordAttendance = async () => {
    if (selectedMembers.length === 0) {
      toast.error("Please select at least one member");
      return;
    }

    if (!selectedEvent) {
      toast.error("No event selected");
      return;
    }

    if ((status === "Absent" || status === "Excused") && timeType === "out") {
      toast.error("Cannot record Time Out for Absent or Excused status");
      return;
    }

    setIsBatchRecording(true);
    setBatchResults([]);

    // Initialize batch results with pending status
    const initialResults = selectedMembers.map(member => ({ 
      name: member.name, 
      status: "pending" as const, 
      message: "Processing..." 
    }));
    setBatchResults(initialResults);

    let successCount = 0;
    let errorCount = 0;

    // Process each selected member
    for (let i = 0; i < selectedMembers.length; i++) {
      const member = selectedMembers[i];

      try {
        // Record attendance based on timeType and status
        if (timeType === "in") {
          if (status === "Absent" || status === "Excused") {
            await recordManualAttendance({
              eventId: selectedEvent.id,
              memberId: member.id,
              memberName: member.name,
              status: status,
              timeType: 'in',
              notes: `Batch: Manually marked as ${status}`,
              recordedBy: getCurrentUserName(),
              overwrite: false,
            });
          } else {
            await recordTimeIn({
              eventId: selectedEvent.id,
              memberId: member.id,
              memberName: member.name,
              status: status as 'Present' | 'Late',
              location: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
              recordedBy: getCurrentUserName(),
            });
          }
        } else {
          await recordTimeOut({
            eventId: selectedEvent.id,
            memberId: member.id,
            location: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : undefined,
            recordedBy: getCurrentUserName(),
          });
        }

        setBatchResults(prev => {
          const updated = [...prev];
          updated[i] = { name: member.name, status: "success", message: `${timeType === "in" ? "Time In" : "Time Out"} recorded` };
          return updated;
        });
        successCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to record";
        setBatchResults(prev => {
          const updated = [...prev];
          updated[i] = { name: member.name, status: "error", message: errorMessage };
          return updated;
        });
        errorCount++;
      }
    }

    setIsBatchRecording(false);
    
    // Show summary toast and clear on success
    if (successCount > 0 && errorCount === 0) {
      toast.success(`Batch recording complete`, {
        description: `Successfully recorded ${successCount} ${successCount === 1 ? 'member' : 'members'}`,
      });
      // Clear selections on full success
      setSelectedMembers([]);
      setMemberSearchInput("");
      setBatchResults([]);
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`Batch recording completed with errors`, {
        description: `${successCount} successful, ${errorCount} failed`,
      });
    } else {
      toast.error(`Batch recording failed`, {
        description: `All ${errorCount} records failed`,
      });
    }
  };

  const handleSuccessModalClose = (showToast: boolean = true) => {
    // If record still needs confirmation, this is a cancellation - don't record
    if (pendingRecord?.needsConfirmation) {
      toast.info("Attendance not recorded", {
        description: "Verification was cancelled",
        duration: 2000,
      });
      // Stop scanner on cancellation too and set manuallyStoppedRef
      if (selectedMode === "qr") {
        manuallyStoppedRef.current = true;
        handleStopScanning();
      }
    }
    
    setShowVerificationModal(false);
    scanPauseRef.current = false;
    setPendingRecord(null);
    
    // Don't auto-restart scanner - user must manually press Start Camera
  };
  
  // Dismiss modal without recording (for backdrop click or X button)
  const handleDismissVerificationModal = () => {
    handleSuccessModalClose(false);
  };

  const glassStyle = getGlassStyle(isDark);

  // Build functional breadcrumbs based on current step
  const getBreadcrumbs = () => {
    if (currentStep === "event-selection") {
      return [
        { label: "Home", onClick: onClose },
        { label: "Attendance Management", onClick: undefined },
        { label: "Select Event", onClick: undefined },
      ];
    } else if (currentStep === "mode-selection") {
      return [
        { label: "Home", onClick: onClose },
        { label: "Attendance Management", onClick: navigateToEventSelection },
        { label: "Choose Mode", onClick: undefined },
      ];
    } else {
      return [
        { label: "Home", onClick: onClose },
        { label: "Attendance Management", onClick: navigateToEventSelection },
        { label: selectedEvent?.name || "Event", onClick: navigateToModeSelection },
        { label: selectedMode === "qr" ? "QR Scanner" : "Manual Entry", onClick: undefined },
      ];
    }
  };

  return (
    <PageLayout
      title={
        currentStep === "event-selection" 
          ? "Select Event" 
          : currentStep === "mode-selection"
          ? "Choose Recording Mode"
          : "Record Attendance"
      }
      subtitle={
        currentStep === "event-selection"
          ? "Choose an active event to record attendance"
          : currentStep === "mode-selection"
          ? `Recording for: ${selectedEvent?.name}`
          : `${selectedEvent?.name} - ${selectedMode === "qr" ? "QR Scanner" : "Manual Entry"}`
      }
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={getBreadcrumbs()}
    >
      {/* Back Button - Only show on steps 2 & 3 */}
      {currentStep !== "event-selection" && (
        <div className="mb-6">
          <button
            onClick={handleGoBack}
            className="px-4 py-2.5 rounded-lg text-white transition-all hover:shadow-lg flex items-center gap-2"
            style={{
              background: "linear-gradient(135deg, #ee8724 0%, #f6421f 100%)",
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.button}px`,
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Undo</span>
          </button>
        </div>
      )}

      {/* STEP 1: Event Selection */}
      {currentStep === "event-selection" && (
        <>
          {/* Refresh Button */}
          <div className="flex justify-end mb-4">
            <button
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Refresh events"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="text-sm hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Loading State */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <EventCardSkeleton key={i} isDark={isDark} />
              ))}
            </div>
          ) : (
            /* Event Cards - Active and Archived */
            <>
              {/* Filter events into active and archived */}
              {(() => {
                const activeEvents = events.filter(e => e.status !== 'completed' && e.status !== 'cancelled');
                const archivedEvents = events.filter(e => e.status === 'completed' || e.status === 'cancelled');
                
                return (
                  <>
                    {/* Active Events Section */}
                    {activeEvents.length === 0 && archivedEvents.length === 0 ? (
                      <div
                        className="border rounded-xl p-8 md:p-12 text-center"
                        style={{
                          background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                          backdropFilter: 'blur(20px)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <Calendar className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                        <h3
                          className="mb-2"
                          style={{
                            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                            fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                            color: DESIGN_TOKENS.colors.brand.orange,
                          }}
                        >
                          No Events Available
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          There are no events for attendance recording at the moment.
                        </p>
                      </div>
                    ) : activeEvents.length === 0 ? (
                      <div
                        className="border rounded-xl p-6 md:p-8 text-center mb-6"
                        style={{
                          background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                          backdropFilter: 'blur(20px)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                        }}
                      >
                        <Calendar className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                        <p className="text-muted-foreground">
                          No active events at the moment. Check the archive below for past events.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6">
                        {activeEvents.map((event) => {
                          const statusInfo = getEventStatusInfo(event.status);
                          const eventStartDateTime = getEventStartDateTime(event);
                          
                          return (
                            <div
                              key={event.id}
                              className="border rounded-xl p-4 md:p-6 transition-all cursor-pointer hover:scale-105 hover:shadow-xl"
                              style={{
                                background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                                backdropFilter: 'blur(20px)',
                                borderColor: event.status === "happening" 
                                  ? '#10b981' 
                                  : event.status === "starting-soon"
                                  ? '#f59e0b'
                                  : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                                borderWidth: event.status === "happening" || event.status === "starting-soon" ? '2px' : '1px',
                              }}
                              onClick={() => handleEventSelect(event)}
                            >
                              {/* Status Badge - Top Right */}
                              <div className="flex items-start justify-between mb-3 md:mb-4">
                                <div className="flex-1 min-w-0 pr-2">
                                  <h3
                                    className="mb-2 line-clamp-2"
                                    style={{
                                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                                      color: DESIGN_TOKENS.colors.brand.red,
                                    }}
                                  >
                                    {event.name}
                                  </h3>
                                </div>
                                <div
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs flex-shrink-0"
                                  style={{
                                    backgroundColor: statusInfo.bgColor,
                                    color: statusInfo.color,
                                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                                  }}
                                >
                                  {statusInfo.icon}
                                  <span className="hidden sm:inline">{statusInfo.label}</span>
                                </div>
                              </div>
                              
                              <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-3 md:mb-4">{event.description}</p>

                              {/* Event Details */}
                              <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
                                <div className="flex items-center gap-2 text-xs md:text-sm">
                                  <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#ee8724] flex-shrink-0" />
                                  <span className="text-muted-foreground truncate">
                                    {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                                    {event.startDate !== event.endDate && ` - ${new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                  </span>
                                </div>
                                {event.startTime && (
                                  <div className="flex items-center gap-2 text-xs md:text-sm">
                                    <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#ee8724] flex-shrink-0" />
                                    <span className="text-muted-foreground truncate">
                                      {formatEventTime(event.startTime)}{event.endTime && ` - ${formatEventTime(event.endTime)}`}
                                    </span>
                                  </div>
                                )}
                                {event.locationName && (
                                  <div className="flex items-center gap-2 text-xs md:text-sm">
                                    <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#ee8724] flex-shrink-0" />
                                    <span className="text-muted-foreground truncate">{event.locationName}</span>
                                  </div>
                                )}
                                
                                {/* Countdown Timer for upcoming/starting-soon events */}
                                {(event.status === 'upcoming' || event.status === 'starting-soon') && (
                                  <div className="pt-1">
                                    <CountdownTimer 
                                      targetDate={eventStartDateTime} 
                                      status={event.status} 
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Footer */}
                              <div className="flex items-center justify-between">
                                {event.currentAttendees !== undefined && event.currentAttendees > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {event.currentAttendees} attendee{event.currentAttendees !== 1 ? 's' : ''}
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground hidden sm:inline ml-auto">Click to select →</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Archive Section - Collapsible */}
                    {archivedEvents.length > 0 && (
                      <div className="mt-6">
                        <button
                          onClick={() => setShowArchive(!showArchive)}
                          className="w-full flex items-center justify-between p-4 rounded-xl transition-all hover:bg-opacity-80"
                          style={{
                            background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(0, 0, 0, 0.05)',
                            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Archive className="w-5 h-5 text-muted-foreground" />
                            <span 
                              className="font-semibold"
                              style={{ color: isDark ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)' }}
                            >
                              Archive ({archivedEvents.length} event{archivedEvents.length !== 1 ? 's' : ''})
                            </span>
                          </div>
                          {showArchive ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </button>
                        
                        {showArchive && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mt-4">
                            {archivedEvents.map((event) => {
                              const statusInfo = getEventStatusInfo(event.status);
                              
                              return (
                                <div
                                  key={event.id}
                                  className="border rounded-xl p-4 md:p-6 transition-all opacity-60"
                                  style={{
                                    background: isDark ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                                    backdropFilter: 'blur(20px)',
                                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                                  }}
                                >
                                  {/* Status Badge - Top Right */}
                                  <div className="flex items-start justify-between mb-3 md:mb-4">
                                    <div className="flex-1 min-w-0 pr-2">
                                      <h3
                                        className="mb-2 line-clamp-2"
                                        style={{
                                          fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                                          fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                                          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                                          color: DESIGN_TOKENS.colors.brand.red,
                                        }}
                                      >
                                        {event.name}
                                      </h3>
                                    </div>
                                    <div
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs flex-shrink-0"
                                      style={{
                                        backgroundColor: statusInfo.bgColor,
                                        color: statusInfo.color,
                                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                                      }}
                                    >
                                      {statusInfo.icon}
                                      <span className="hidden sm:inline">{statusInfo.label}</span>
                                    </div>
                                  </div>
                                  
                                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2 mb-3 md:mb-4">{event.description}</p>

                                  {/* Event Details */}
                                  <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
                                    <div className="flex items-center gap-2 text-xs md:text-sm">
                                      <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#ee8724] flex-shrink-0" />
                                      <span className="text-muted-foreground truncate">
                                        {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                                        {event.startDate !== event.endDate && ` - ${new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                                      </span>
                                    </div>
                                    {event.startTime && (
                                      <div className="flex items-center gap-2 text-xs md:text-sm">
                                        <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#ee8724] flex-shrink-0" />
                                        <span className="text-muted-foreground truncate">
                                          {formatEventTime(event.startTime)}{event.endTime && ` - ${formatEventTime(event.endTime)}`}
                                        </span>
                                      </div>
                                    )}
                                    {event.locationName && (
                                      <div className="flex items-center gap-2 text-xs md:text-sm">
                                        <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#ee8724] flex-shrink-0" />
                                        <span className="text-muted-foreground truncate">{event.locationName}</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Footer */}
                                  <div className="flex items-center justify-between">
                                    {event.currentAttendees !== undefined && event.currentAttendees > 0 && (
                                      <span className="text-xs text-muted-foreground">
                                        {event.currentAttendees} attendee{event.currentAttendees !== 1 ? 's' : ''}
                                      </span>
                                    )}
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {event.status === 'completed' ? 'Event ended' : 'Event cancelled'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </>
      )}

      {/* STEP 2: Mode Selection */}
      {currentStep === "mode-selection" && (
        <div className="max-w-3xl mx-auto">
          <div
            className="border rounded-xl p-4 md:p-8 mb-6"
            style={{
              background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <h3
              className="mb-2 text-center"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              Choose Recording Mode
            </h3>
            <p className="text-center text-muted-foreground mb-6 md:mb-8 text-sm md:text-base">
              Select how you want to record attendance for this event
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              {/* QR Scanner Option */}
              <div
                className="border rounded-xl p-4 md:p-6 cursor-pointer transition-all hover:scale-105 hover:shadow-xl text-center"
                style={{
                  background: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
                  borderWidth: '2px',
                }}
                onClick={() => handleModeSelect("qr")}
              >
                <div className="flex justify-center mb-3 md:mb-4">
                  <div
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                    }}
                  >
                    <QrCode className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>
                </div>
                <h4
                  className="mb-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  QR Scanner
                </h4>
                <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">
                  Scan member QR codes for quick attendance recording
                </p>
                <div className="text-xs text-muted-foreground bg-white/50 dark:bg-black/30 rounded-lg py-2 px-3">
                  ✓ Fast & Efficient<br/>
                  ✓ Camera Required<br/>
                  ✓ Automatic Capture
                </div>
              </div>

              {/* Manual Entry Option */}
              <div
                className="border rounded-xl p-4 md:p-6 cursor-pointer transition-all hover:scale-105 hover:shadow-xl text-center"
                style={{
                  background: isDark ? 'rgba(246, 66, 31, 0.1)' : 'rgba(246, 66, 31, 0.05)',
                  borderColor: isDark ? 'rgba(246, 66, 31, 0.3)' : 'rgba(246, 66, 31, 0.2)',
                  borderWidth: '2px',
                }}
                onClick={() => handleModeSelect("manual")}
              >
                <div className="flex justify-center mb-3 md:mb-4">
                  <div
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                    }}
                  >
                    <FileEdit className="w-8 h-8 md:w-10 md:h-10 text-white" />
                  </div>
                </div>
                <h4
                  className="mb-2"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  Manual Entry
                </h4>
                <p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">
                  Manually select members and record their attendance
                </p>
                <div className="text-xs text-muted-foreground bg-white/50 dark:bg-black/30 rounded-lg py-2 px-3">
                  ✓ Flexible Options<br/>
                  ✓ Detailed Control<br/>
                  ✓ Status Selection
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Recording Interface - QR Scanner */}
      {currentStep === "recording" && selectedMode === "qr" && (
        <div className="max-w-4xl mx-auto">
          {/* Offline/Pending Status Bar */}
          {(!isOnline || pendingAttendanceQueue.length > 0) && (
            <div 
              className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
                !isOnline 
                  ? 'bg-amber-500/20 border border-amber-500/30' 
                  : 'bg-blue-500/20 border border-blue-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${!isOnline ? 'bg-amber-500' : 'bg-blue-500'} animate-pulse`} />
                <span className={`text-sm font-medium ${!isOnline ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {!isOnline ? 'Offline Mode' : `${pendingAttendanceQueue.length} pending sync`}
                </span>
              </div>
              {isOnline && pendingAttendanceQueue.length > 0 && (
                <button
                  onClick={syncPendingRecords}
                  disabled={isSyncing}
                  className="text-xs px-3 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                >
                  {isSyncing ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Syncing...</>
                  ) : (
                    <><RefreshCw className="w-3 h-3" /> Sync Now</>
                  )}
                </button>
              )}
            </div>
          )}
          
          {/* QR Scanner Controls */}
          <div
            className="border rounded-lg mb-4 md:mb-6"
            style={{
              borderRadius: `${DESIGN_TOKENS.radius.card}px`,
              padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              ...glassStyle,
            }}
          >
            {/* Event Info (Locked) */}
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs md:text-sm text-blue-800 dark:text-blue-300">
                <strong>Event:</strong> {selectedEvent?.name}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Location: {selectedEvent?.locationName || "Not specified"}
              </p>
            </div>

            {/* Time Type Toggle */}
            <div className="mb-4 md:mb-6">
              <label
                className="block mb-2"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.orange,
                }}
              >
                Time Type
              </label>
              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <button
                  onClick={() => setTimeType("in")}
                  className={`px-4 py-2.5 md:py-3 rounded-lg transition-all ${
                    timeType === "in" ? "text-white" : "border-2 hover:bg-white/30 dark:hover:bg-white/5"
                  }`}
                  style={{
                    backgroundColor: timeType === "in" ? DESIGN_TOKENS.colors.status.present : "transparent",
                    borderColor: timeType === "in" ? "transparent" : isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                    borderRadius: `${DESIGN_TOKENS.radius.button}px`,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.button}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  Time In
                </button>
                <button
                  onClick={() => setTimeType("out")}
                  className={`px-4 py-2.5 md:py-3 rounded-lg transition-all ${
                    timeType === "out" ? "text-white" : "border-2 hover:bg-white/30 dark:hover:bg-white/5"
                  }`}
                  style={{
                    backgroundColor: timeType === "out" ? DESIGN_TOKENS.colors.status.late : "transparent",
                    borderColor: timeType === "out" ? "transparent" : isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                    borderRadius: `${DESIGN_TOKENS.radius.button}px`,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.button}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  Time Out
                </button>
              </div>
            </div>

            {/* Start/Stop Scanning Buttons */}
            <div className="flex gap-3 relative" style={{ zIndex: 100 }}>
              <Button
                variant="primary"
                onClick={handleStartScanning}
                disabled={isScanning || isRecordingAttendance}
                icon={isRecordingAttendance ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Camera className="w-4 h-4 md:w-5 md:h-5" />}
                fullWidth
              >
                {isRecordingAttendance ? "Recording..." : "Start Camera"}
              </Button>
              {isScanning && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStopScanning();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStopScanning();
                  }}
                  className="px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all active:scale-95 touch-manipulation"
                  style={{
                    background: isDark ? 'rgba(239, 68, 68, 0.9)' : 'rgba(239, 68, 68, 1)',
                    color: 'white',
                    border: '2px solid rgba(239, 68, 68, 0.3)',
                    minWidth: '100px',
                    zIndex: 100,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <StopCircle className="w-5 h-5" />
                  Stop
                </button>
              )}
            </div>
          </div>

          {/* Camera Preview / QR Scanner */}
          <div
            className="border rounded-lg overflow-hidden w-full"
            style={{
              borderRadius: `${DESIGN_TOKENS.radius.card}px`,
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              ...glassStyle,
              minHeight: "300px",
              maxWidth: "100%",
            }}
          >
            {isScanning ? (
              <div className="w-full h-full bg-black relative">
                {/* QR Scanner Container - html5-qrcode will render the camera here */}
                <div 
                  id={qrScannerContainerId} 
                  style={{ 
                    width: '100%', 
                    minHeight: '300px',
                  }}
                />
                {/* Floating Stop Button - More prominent for mobile */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStopScanning();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleStopScanning();
                  }}
                  className="absolute top-3 right-3 p-3 rounded-full flex items-center justify-center transition-all active:scale-90 touch-manipulation"
                  style={{
                    background: 'rgba(239, 68, 68, 0.95)',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                    zIndex: 1000,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  title="Stop Camera"
                >
                  <X className="w-6 h-6" />
                </button>
                {/* Scanning indicator overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 text-center pointer-events-none">
                  <p className="text-white text-sm font-medium flex items-center justify-center gap-2">
                    <QrCode className="w-4 h-4 animate-pulse" />
                    Scanning for QR Code...
                  </p>
                  <p className="text-gray-300 text-xs mt-1">
                    Position the member's QR code within the frame
                  </p>
                </div>
              </div>
            ) : cameraPermission === "denied" ? (
              <div className="w-full h-full flex items-center justify-center bg-red-500/10" style={{ minHeight: '300px' }}>
                <div className="text-center px-4">
                  <Camera className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 text-red-500" />
                  <p
                    className="text-red-500"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Camera Access Denied
                  </p>
                  <p className="text-muted-foreground mt-2 text-xs md:text-sm">
                    Please enable camera permissions in your browser settings
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCameraPermission("prompt");
                      handleStartScanning();
                    }}
                    className="mt-4"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ minHeight: '300px' }}>
                <div className="text-center px-4">
                  <QrCode className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 text-muted-foreground" />
                  <p
                    className="text-muted-foreground"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Click Start Camera to begin scanning
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div
            className="border rounded-lg mt-4 md:mt-6"
            style={{
              borderRadius: `${DESIGN_TOKENS.radius.card}px`,
              padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              ...glassStyle,
            }}
          >
            <div className="flex items-start gap-2 md:gap-3">
              <CheckCircle
                className="flex-shrink-0 mt-0.5 md:mt-1"
                style={{ width: "18px", height: "18px", color: DESIGN_TOKENS.colors.status.present }}
              />
              <div>
                <p className="text-xs md:text-sm">
                  <strong>How to use:</strong> Choose Time In or Time Out, then click Start Camera. Position the member's QR ID within the frame for automatic scanning.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Recording Interface - Manual Entry */}
      {currentStep === "recording" && selectedMode === "manual" && (
        <div className="max-w-3xl mx-auto">
          {/* Offline/Pending Status Bar */}
          {(!isOnline || pendingAttendanceQueue.length > 0) && (
            <div 
              className={`mb-4 p-3 rounded-lg flex items-center justify-between ${
                !isOnline 
                  ? 'bg-amber-500/20 border border-amber-500/30' 
                  : 'bg-blue-500/20 border border-blue-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${!isOnline ? 'bg-amber-500' : 'bg-blue-500'} animate-pulse`} />
                <span className={`text-sm font-medium ${!isOnline ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`}>
                  {!isOnline ? 'Offline Mode' : `${pendingAttendanceQueue.length} pending sync`}
                </span>
              </div>
              {isOnline && pendingAttendanceQueue.length > 0 && (
                <button
                  onClick={syncPendingRecords}
                  disabled={isSyncing}
                  className="text-xs px-3 py-1 rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                >
                  {isSyncing ? (
                    <><Loader2 className="w-3 h-3 animate-spin" /> Syncing...</>
                  ) : (
                    <><RefreshCw className="w-3 h-3" /> Sync Now</>
                  )}
                </button>
              )}
            </div>
          )}
          
          <div 
            className="rounded-xl p-4 md:p-6 border"
            style={{
              background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Event Info (Locked) */}
            <div className="mb-4 md:mb-6 p-3 md:p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-xs md:text-sm text-blue-800 dark:text-blue-300">
                <strong>Event:</strong> {selectedEvent?.name}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Location: {selectedEvent?.locationName || "Not specified"}
            </p>
          </div>

          {/* Smart Member Search - supports single and batch (comma-separated) */}
          <div className="mb-4 md:mb-6" ref={memberSearchRef}>
            <label
              className="block mb-2"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              Search Member{selectedMembers.length > 0 ? 's' : ''} *
              {selectedMembers.length > 1 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (Batch mode: {selectedMembers.length} selected)
                </span>
              )}
            </label>
            
            {/* Selected Members Chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedMembers.map((member) => (
                  <div 
                    key={member.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
                    style={{
                      background: isDark ? 'rgba(246, 66, 31, 0.2)' : 'rgba(246, 66, 31, 0.1)',
                      border: `1px solid ${DESIGN_TOKENS.colors.brand.orange}`,
                    }}
                  >
                    {member.profilePicture ? (
                      <img 
                        src={member.profilePicture}
                        alt={member.name}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div 
                        className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-white text-[10px]"
                        style={{ background: 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)' }}
                      >
                        {getInitials(member.name)}
                      </div>
                    )}
                    <span className="font-medium" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                      {member.name}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedMembers(prev => prev.filter(m => m.id !== member.id));
                      }}
                      className="p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <X className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                ))}
                {selectedMembers.length > 1 && (
                  <button
                    onClick={() => {
                      setSelectedMembers([]);
                      setMemberSearchInput("");
                    }}
                    className="text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
            )}

            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={memberSearchInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    setMemberSearchInput(value);
                    setShowMemberDropdown(true);
                    
                    // Check if user typed a comma - try to add the previous term as a member
                    if (value.endsWith(',')) {
                      const searchTerm = value.slice(0, -1).trim();
                      if (searchTerm) {
                        // Find member by the search term
                        const foundMember = members.find(m => 
                          m.name.toLowerCase() === searchTerm.toLowerCase() ||
                          m.id.toLowerCase() === searchTerm.toLowerCase() ||
                          m.name.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        if (foundMember && !selectedMembers.find(sm => sm.id === foundMember.id)) {
                          setSelectedMembers(prev => [...prev, foundMember]);
                          setMemberSearchInput('');
                          toast.success(`Added: ${foundMember.name}`, { duration: 1500 });
                        } else if (!foundMember) {
                          toast.error(`Member not found: "${searchTerm}"`, { duration: 2000 });
                          setMemberSearchInput(searchTerm + ', ');
                        } else {
                          // Already selected
                          setMemberSearchInput('');
                        }
                      } else {
                        setMemberSearchInput('');
                      }
                    }
                    
                    // Clear single selection mode if we have batch
                    if (selectedMember && selectedMembers.length === 0) {
                      const selectedMemberData = members.find(m => m.id === selectedMember);
                      if (selectedMemberData && value !== selectedMemberData.name) {
                        setSelectedMember("");
                      }
                    }
                  }}
                  onFocus={() => setShowMemberDropdown(true)}
                  onKeyDown={(e) => {
                    // Handle Enter key to add member
                    if (e.key === 'Enter' && memberSearchInput.trim()) {
                      e.preventDefault();
                      const searchTerm = memberSearchInput.trim();
                      const foundMember = members.find(m => 
                        m.name.toLowerCase() === searchTerm.toLowerCase() ||
                        m.id.toLowerCase() === searchTerm.toLowerCase() ||
                        m.name.toLowerCase().includes(searchTerm.toLowerCase())
                      );
                      if (foundMember && !selectedMembers.find(sm => sm.id === foundMember.id)) {
                        setSelectedMembers(prev => [...prev, foundMember]);
                        setMemberSearchInput('');
                        setShowMemberDropdown(false);
                        toast.success(`Added: ${foundMember.name}`, { duration: 1500 });
                      }
                    }
                    // Handle Backspace to remove last chip when input is empty
                    if (e.key === 'Backspace' && !memberSearchInput && selectedMembers.length > 0) {
                      const lastMember = selectedMembers[selectedMembers.length - 1];
                      setSelectedMembers(prev => prev.slice(0, -1));
                      toast.info(`Removed: ${lastMember.name}`, { duration: 1500 });
                    }
                  }}
                  placeholder={selectedMembers.length > 0 
                    ? "Add more members (type and press Enter or comma)..." 
                    : "Type to search members (use comma for batch)..."}
                  className="w-full pl-10 pr-10 py-3 rounded-xl border-2 transition-all focus:outline-none"
                  style={{
                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                    borderColor: (selectedMember || selectedMembers.length > 0)
                      ? DESIGN_TOKENS.colors.brand.orange 
                      : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    color: isDark ? '#ffffff' : '#000000',
                  }}
                />
                {memberSearchInput && (
                  <button
                    onClick={() => {
                      setMemberSearchInput("");
                      setShowMemberDropdown(true);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>

              {/* Hint text */}
              <p className="text-xs text-muted-foreground mt-1">
                💡 Tip: Type a name and press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs">Enter</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-xs">,</kbd> to add multiple members for batch recording
              </p>

              {/* Batch Results - show during/after batch recording */}
              {batchResults.length > 0 && (
                <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
                  {batchResults.map((result, idx) => (
                    <div 
                      key={idx}
                      className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                        result.status === 'success' 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : result.status === 'error'
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span className="font-medium truncate flex-1">{result.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {result.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                        {result.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                        {result.status === 'pending' && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
                        <span className="text-xs">{result.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Autosuggest Dropdown - shows when no single selection and members.length === 0 or searching */}
              {showMemberDropdown && selectedMembers.length === 0 && !selectedMember && (
                <div 
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 max-h-64 overflow-y-auto"
                  style={{
                    background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(20px)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {isLoadingMembers ? (
                    <div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading members...
                    </div>
                  ) : filteredMembers.length > 0 ? (
                    filteredMembers.slice(0, 10).map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          // Single select mode - for backward compatibility
                          handleMemberSelect(member);
                        }}
                        className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left border-b last:border-b-0"
                        style={{
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        {member.profilePicture ? (
                          <img 
                            src={member.profilePicture}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)' }}
                          >
                            {getInitials(member.name)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p 
                            className="font-medium truncate"
                            style={{ color: isDark ? '#fff' : '#000' }}
                          >
                            {member.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.position} • {member.committee}
                          </p>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No members found</p>
                      <p className="text-xs mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              )}

              {/* Autosuggest Dropdown - shows when batch mode (selectedMembers > 0) */}
              {showMemberDropdown && selectedMembers.length > 0 && memberSearchInput && (
                <div 
                  className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 max-h-64 overflow-y-auto"
                  style={{
                    background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                    backdropFilter: 'blur(20px)',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {isLoadingMembers ? (
                    <div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading members...
                    </div>
                  ) : filteredMembers.filter(m => !selectedMembers.find(sm => sm.id === m.id)).length > 0 ? (
                    filteredMembers.filter(m => !selectedMembers.find(sm => sm.id === m.id)).slice(0, 10).map((member) => (
                      <button
                        key={member.id}
                        onClick={() => {
                          setSelectedMembers(prev => [...prev, member]);
                          setMemberSearchInput('');
                          setShowMemberDropdown(false);
                          toast.success(`Added: ${member.name}`, { duration: 1500 });
                        }}
                        className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left border-b last:border-b-0"
                        style={{
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        {member.profilePicture ? (
                          <img 
                            src={member.profilePicture}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)' }}
                          >
                            {getInitials(member.name)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p 
                            className="font-medium truncate"
                            style={{ color: isDark ? '#fff' : '#000' }}
                          >
                            {member.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.position} • {member.committee}
                          </p>
                        </div>
                        <span className="text-xs text-orange-500 flex-shrink-0">+ Add</span>
                      </button>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No more members found</p>
                      <p className="text-xs mt-1">All matching members already selected</p>
                    </div>
                  )}
                </div>
              )}

              {/* Selected Single Member Preview - for backward compatibility */}
              {selectedMember && selectedMembers.length === 0 && (
                <div 
                  className="mt-2 p-3 rounded-lg border flex items-center gap-3"
                  style={{
                    background: isDark ? 'rgba(246, 66, 31, 0.1)' : 'rgba(246, 66, 31, 0.05)',
                    borderColor: DESIGN_TOKENS.colors.brand.orange,
                  }}
                >
                  {(() => {
                    const member = members.find(m => m.id === selectedMember);
                    return member ? (
                      <>
                        {member.profilePicture ? (
                          <img 
                            src={member.profilePicture}
                            alt={member.name}
                            className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                            style={{ background: 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)' }}
                          >
                            {getInitials(member.name)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                            {member.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.position} • {member.committee}
                          </p>
                        </div>
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      </>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Time Type */}
          <div className="mb-4 md:mb-6">
            <label
              className="block mb-2"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              Time Type *
            </label>
            <div className="flex gap-3 md:gap-4">
              <button
                onClick={() => setTimeType("in")}
                className={`flex-1 px-4 py-2.5 md:py-3 rounded-xl transition-all ${
                  timeType === "in" ? "bg-[#f6421f] text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                Time In
              </button>
              <button
                onClick={() => setTimeType("out")}
                disabled={status === "Absent" || status === "Excused"}
                className={`flex-1 px-4 py-2.5 md:py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  timeType === "out" ? "bg-[#f6421f] text-white" : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                }`}
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                Time Out
              </button>
            </div>
          </div>

          {/* Status */}
          <div className="mb-4 md:mb-6">
            <label
              className="block mb-2"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              Status *
            </label>
            <CustomDropdown
              value={status}
              onChange={(value) => setStatus(value as any)}
              options={[
                { value: "Present", label: "Present" },
                { value: "Late", label: "Late" },
                { value: "Excused", label: "Excused" },
                { value: "Absent", label: "Absent" },
              ]}
              isDark={isDark}
              size="md"
            />
          </div>

          {/* Business Rule Notice */}
          {(status === "Absent" || status === "Excused") && (
            <div className="mb-4 md:mb-6 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertCircle className="w-4 h-4 md:w-5 md:h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <span className="text-xs md:text-sm text-amber-800 dark:text-amber-300">
                <strong>Note:</strong> Time Out cannot be recorded for Absent or Excused status
              </span>
            </div>
          )}

          {/* Loading Members Indicator */}
          {isLoadingMembers && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading members...</span>
            </div>
          )}

          {/* Record Button - Single Mode (when only selectedMember is set) */}
          {selectedMember && selectedMembers.length === 0 && (
            <Button 
              onClick={handleRecordAttendance} 
              icon={isRecordingAttendance ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Save className="w-4 h-4 md:w-5 md:h-5" />} 
              fullWidth
              disabled={isRecordingAttendance || isLoadingMembers}
            >
              {isRecordingAttendance ? "Recording..." : "Record Attendance"}
            </Button>
          )}

          {/* Record Button - Batch Mode (when selectedMembers array has items) */}
          {selectedMembers.length > 0 && (
            <Button 
              onClick={handleBatchRecordAttendance} 
              icon={isBatchRecording ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : <Save className="w-4 h-4 md:w-5 md:h-5" />} 
              fullWidth
              disabled={isBatchRecording || isLoadingMembers}
            >
              {isBatchRecording ? "Recording Batch..." : `Record ${selectedMembers.length} Member${selectedMembers.length > 1 ? 's' : ''}`}
            </Button>
          )}

          {/* No selection placeholder */}
          {!selectedMember && selectedMembers.length === 0 && (
            <Button 
              icon={<Save className="w-4 h-4 md:w-5 md:h-5" />} 
              fullWidth
              disabled
            >
              Record Attendance
            </Button>
          )}
          </div>
        </div>
      )}

      {/* Overwrite Confirmation Modal */}
      {showOverwriteWarning && previousRecord && pendingRecord && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-8"
          onClick={() => {
            setShowOverwriteWarning(false);
            scanPauseRef.current = false;
          }}
        >
          <div
            className="rounded-xl w-full max-w-md md:max-w-lg border max-h-[85vh] flex flex-col overflow-hidden"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              boxShadow: isDark 
                ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
                : '0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 md:p-7">
              {/* Warning Icon Header */}
              <div className="text-center mb-5">
                <div 
                  className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full mb-3"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    boxShadow: '0 8px 16px rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <AlertCircle className="w-9 h-9 md:w-11 md:h-11 text-white" />
                </div>
                <h3
                  className="mb-1"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: '#d97706',
                  }}
                >
                  Overwrite Existing Record?
                </h3>
                <p className="text-sm text-muted-foreground">This member already has a record for this event</p>
              </div>
              
              {/* Member Profile Card - Previous Record */}
              <div 
                className="mb-5 p-4 md:p-5 rounded-xl border-2"
                style={{
                  background: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.05)',
                  borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)',
                }}
              >
                <div className="flex items-center gap-3 md:gap-4 mb-4">
                  {/* Profile Picture */}
                  <div className="flex-shrink-0">
                    {previousRecord.memberData?.profilePicture ? (
                      <img 
                        src={previousRecord.memberData.profilePicture} 
                        alt={previousRecord.member}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 shadow-lg"
                        style={{
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                        }}
                      />
                    ) : (
                      <div 
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-bold text-white text-xl md:text-2xl border-4 shadow-lg"
                        style={{
                          background: 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                        }}
                      >
                        {getInitials(previousRecord.member)}
                      </div>
                    )}
                  </div>

                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <h4 
                      className="truncate mb-1"
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    >
                      {previousRecord.member}
                    </h4>
                    <p 
                      className="text-sm truncate mb-0.5"
                      style={{
                        color: DESIGN_TOKENS.colors.brand.orange,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                      }}
                    >
                      {previousRecord.memberData?.position || 'Member'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {previousRecord.memberData?.committee || 'General Committee'}
                    </p>
                  </div>
                </div>

                {/* Previous Status Badge */}
                <div className="flex justify-center">
                  <div
                    className="inline-block px-4 py-2 rounded-full text-sm md:text-base"
                    style={{
                      backgroundColor: '#10b98120',
                      color: '#10b981',
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {previousRecord.status} (Previous)
                  </div>
                </div>
              </div>

              {/* Previous Record Details */}
              <div className="space-y-3">
                {/* Previous Time */}
                <div className="flex items-start gap-3 p-3 md:p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <Clock className="w-5 h-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Previous Record</p>
                    <p 
                      className="text-sm md:text-base"
                      style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
                    >
                      {previousRecord.timeType} at {previousRecord.timestamp}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer with Action Buttons */}
            <div 
              className="flex-shrink-0 p-5 md:p-7 pt-4 border-t flex gap-3"
              style={{
                background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <button
                onClick={() => {
                  setShowOverwriteWarning(false);
                  scanPauseRef.current = false;
                }}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm md:text-base"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                Cancel
              </button>
              <button
                onClick={confirmOverwrite}
                className="flex-1 px-4 py-3 rounded-xl text-white transition-all hover:shadow-lg text-sm md:text-base"
                style={{
                  background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {showEventDetailsModal && selectedEvent && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setShowEventDetailsModal(false)}
        >
          <div
            className="rounded-xl max-w-2xl w-full border max-h-[90vh] flex flex-col overflow-hidden"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
          {/* Sticky Header */}
          <div 
            className="sticky top-0 left-0 right-0 p-4 md:p-5 border-b flex items-center justify-between z-20"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div 
                className="w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                }}
              >
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  className="truncate"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  {selectedEvent.name}
                </h2>
                <p className="text-xs text-muted-foreground truncate">Event Details & Location</p>
              </div>
            </div>
            <button
              onClick={() => setShowEventDetailsModal(false)}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {/* Status Badge & Description */}
            <div className="flex items-start gap-3 mb-4">
              {(() => {
                const statusInfo = getEventStatusInfo(selectedEvent.status);
                return (
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs flex-shrink-0"
                    style={{
                      backgroundColor: statusInfo.bgColor,
                      color: statusInfo.color,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {statusInfo.icon}
                    {statusInfo.label}
                  </div>
                );
              })()}
              
              {/* Countdown Timer in Modal */}
              {(selectedEvent.status === 'upcoming' || selectedEvent.status === 'starting-soon') && (
                <div 
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
                  style={{
                    backgroundColor: '#f59e0b20',
                    color: '#f59e0b',
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  <Clock className="w-3 h-3" />
                  <span>Starts in: </span>
                  <CountdownTimer 
                    targetDate={getEventStartDateTime(selectedEvent)} 
                    status={selectedEvent.status} 
                  />
                </div>
              )}
            </div>
            
            {/* Event Not Started Warning */}
            {selectedEvent.status !== 'happening' && selectedEvent.status !== 'completed' && selectedEvent.status !== 'cancelled' && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      Event has not started yet
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Attendance recording will be available once the event begins. Please wait for the scheduled time.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {selectedEvent.description && (
              <p className="text-sm text-muted-foreground mb-4">{selectedEvent.description}</p>
            )}

            {/* Event Details Grid */}
            <div className="grid gap-3 mb-4">
              {/* Date Information */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                <Calendar className="w-5 h-5 text-[#ee8724] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Event Date</p>
                  <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                    {new Date(selectedEvent.startDate).toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                    {selectedEvent.startDate !== selectedEvent.endDate && (
                      <>
                        <br />
                        <span className="text-xs text-muted-foreground">to </span>
                        {new Date(selectedEvent.endDate).toLocaleDateString('en-US', { 
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Time Information */}
              {selectedEvent.startTime && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <Clock className="w-5 h-5 text-[#ee8724] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Event Time</p>
                    <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                      {formatEventTime(selectedEvent.startTime)}{selectedEvent.endTime && ` - ${formatEventTime(selectedEvent.endTime)}`}
                    </p>
                  </div>
                </div>
              )}

              {/* Location Information */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                <MapPin className="w-5 h-5 text-[#ee8724] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Event Location</p>
                  <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                    {selectedEvent.locationName || "Location not specified"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Coordinates: {selectedEvent.location.lat.toFixed(6)}, {selectedEvent.location.lng.toFixed(6)}
                  </p>
                </div>
              </div>

              {/* Geofence Radius - Only show if geofencing is enabled */}
              {selectedEvent.geofenceEnabled !== false && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <Navigation className="w-5 h-5 text-[#ee8724] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Geofence Radius</p>
                    <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                      {selectedEvent.radius} meters
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Attendance tracking area
                    </p>
                  </div>
                </div>
              )}
              
              {/* Geofencing Disabled Notice */}
              {selectedEvent.geofenceEnabled === false && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground mb-1">Location Check</p>
                    <p className="text-sm text-blue-600 dark:text-blue-400" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                      Geofencing is disabled for this event
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      You can record attendance from any location
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Your Location Status - Only show if geofencing is enabled */}
            {selectedEvent.geofenceEnabled !== false && (
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                Your Location Status
              </p>
              <div 
                className="p-4 rounded-lg border-2"
                style={{
                  backgroundColor: locationPermission === "granted" 
                    ? isWithinGeofence ? '#10b98115' : '#ef444415'
                    : isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                  borderColor: locationPermission === "granted"
                    ? isWithinGeofence ? '#10b981' : '#ef4444'
                    : '#3b82f6',
                }}
              >
                {locationPermission === "loading" && (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    <div>
                      <p className="text-sm font-medium">Detecting your location...</p>
                      <p className="text-xs text-muted-foreground">Please allow location access when prompted</p>
                    </div>
                  </div>
                )}
                {locationPermission === "denied" && (
                  <div className="flex items-center gap-3">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">Location access denied</p>
                      <p className="text-xs text-muted-foreground">Enable location services to verify your position</p>
                    </div>
                    <button
                      onClick={requestLocationPermission}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                )}
                {locationPermission === "prompt" && (
                  <div className="flex items-center gap-3">
                    <Crosshair className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Location permission needed</p>
                      <p className="text-xs text-muted-foreground">We need your location to verify you're at the event</p>
                    </div>
                    <button
                      onClick={requestLocationPermission}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 transition-colors"
                    >
                      Allow
                    </button>
                  </div>
                )}
                {locationPermission === "granted" && userLocation && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {isWithinGeofence ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${isWithinGeofence ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {isWithinGeofence ? "You're within the geofence!" : "You're outside the geofence"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Distance from event: {distanceFromEvent !== null ? `${distanceFromEvent}m` : 'Calculating...'}
                          {distanceFromEvent !== null && !isWithinGeofence && ` (${Math.max(0, distanceFromEvent - selectedEvent.radius)}m outside)`}
                        </p>
                      </div>
                      <button
                        onClick={refreshLocation}
                        className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                        title="Refresh location"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                    
                    {/* Location Warning Alert */}
                    {locationWarning && (
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
                        <p className="text-xs font-medium leading-relaxed">{locationWarning}</p>
                        <button
                          onClick={forceGPSRefresh}
                          disabled={isForceRefreshing}
                          className="mt-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isForceRefreshing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Getting fresh GPS...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4" />
                              Force GPS Refresh
                            </>
                          )}
                        </button>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        <span className="font-medium">Accuracy:</span> ±{Math.round(userLocation.accuracy)}m
                        {userLocation.accuracy > 50 && (
                          <span className="text-amber-500 ml-2">(Move outdoors for better GPS)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span>Updated {new Date(userLocation.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    
                    {/* Debug Coordinates - Toggle */}
                    <div className="border-t pt-2 mt-2" style={{ borderColor: 'rgba(128, 128, 128, 0.2)' }}>
                      <button 
                        onClick={() => setShowDebugCoords(!showDebugCoords)}
                        className="text-xs text-blue-500 hover:text-blue-600 underline mb-2"
                      >
                        {showDebugCoords ? 'Hide' : 'Show'} GPS Debug Info
                      </button>
                      {showDebugCoords && (
                        <div className="text-xs text-muted-foreground space-y-1 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg font-mono">
                          <p><strong>Your GPS:</strong> {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}</p>
                          <p><strong>Event Location:</strong> {selectedEvent.location.lat.toFixed(6)}, {selectedEvent.location.lng.toFixed(6)}</p>
                          <p><strong>GPS Accuracy:</strong> ±{Math.round(userLocation.accuracy)}m</p>
                          <p><strong>Distance:</strong> {distanceFromEvent}m (fence: {selectedEvent.radius}m)</p>
                          <p className="text-amber-500 mt-2">
                            If "Your GPS" shows Davao coords (≈7.07°N), your device is using cached/IP location instead of real GPS.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Interactive Map Preview - Using Leaflet - Only show if geofencing is enabled */}
            {selectedEvent.geofenceEnabled !== false && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  Location Map & Geofence
                </p>
                {userLocation && (
                  <span className="text-xs text-green-500 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Live Tracking
                  </span>
                )}
              </div>
              
              {/* Leaflet-based Interactive Map */}
              <GeofenceMap
                eventLat={selectedEvent.location.lat}
                eventLng={selectedEvent.location.lng}
                radius={selectedEvent.radius}
                userLocation={userLocation}
                isWithinGeofence={isWithinGeofence}
                isDark={isDark}
                locationName={selectedEvent.locationName}
              />
              
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {isWithinGeofence 
                  ? "✓ You're within the attendance zone - ready to record!"
                  : "Members must be within the geofence to record attendance"
                }
              </p>
            </div>
            )}
          </div>

          {/* Sticky Footer with Action Buttons */}
          <div 
            className="sticky bottom-0 left-0 right-0 p-4 md:p-6 border-t flex gap-3"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(10px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
          >
            <button
              onClick={() => setShowEventDetailsModal(false)}
              className="flex-1 px-4 py-2.5 md:py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm md:text-base"
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              Cancel
            </button>
            {(() => {
              // Determine if event has started (only allow attendance for "happening" status)
              const eventHasStarted = selectedEvent?.status === 'happening';
              const geofenceDisabled = selectedEvent?.geofenceEnabled === false;
              const locationOk = geofenceDisabled || (isWithinGeofence && locationPermission === "granted");
              const canProceed = eventHasStarted && locationOk;
              
              // Determine button state and message
              let buttonContent;
              let buttonDisabled = !canProceed;
              
              if (!eventHasStarted) {
                buttonContent = <><Clock className="w-4 h-4" /><span>Event Not Started</span></>;
              } else if (!geofenceDisabled && locationPermission !== "granted") {
                buttonContent = <><MapPin className="w-4 h-4" /><span>Enable Location First</span></>;
              } else if (!geofenceDisabled && !isWithinGeofence) {
                buttonContent = <><MapPin className="w-4 h-4" /><span>Move to Event Location</span></>;
              } else {
                buttonContent = <><span>Proceed to Choose Mode</span><ArrowLeft className="w-4 h-4 rotate-180" /></>;
              }
              
              return (
                <button
                  onClick={handleProceedToModeSelection}
                  disabled={buttonDisabled}
                  className="flex-1 px-4 py-2.5 md:py-3 rounded-xl text-white transition-colors text-sm md:text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: canProceed
                      ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                      : "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  {buttonContent}
                </button>
              );
            })()}
          </div>
        </div>
      </div>
    )}

      {/* Verification Modal */}
      {showVerificationModal && pendingRecord && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 sm:p-6 md:p-8"
          onClick={handleDismissVerificationModal}
        >
          <div
            className="rounded-xl w-full max-w-md md:max-w-lg border max-h-[85vh] flex flex-col overflow-hidden relative"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderColor: pendingRecord.isOffline 
                ? 'rgba(251, 191, 36, 0.5)' 
                : isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              boxShadow: pendingRecord.isOffline
                ? '0 20px 60px rgba(251, 191, 36, 0.2), 0 0 0 2px rgba(251, 191, 36, 0.3)'
                : isDark 
                  ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)' 
                  : '0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Offline Banner */}
            {pendingRecord.isOffline && (
              <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-amber-600 dark:text-amber-400 text-sm font-medium">
                  Saved Offline • Will sync when online
                </span>
              </div>
            )}
            
            {/* Close Button - Top Right */}
            <button
              onClick={handleDismissVerificationModal}
              className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors z-10"
              title="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            
            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 md:p-7">
              {/* Success Icon Header */}
              <div className="text-center mb-5">
                <div 
                  className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full mb-3"
                  style={{
                    background: pendingRecord.isOffline 
                      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                      : 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                    boxShadow: pendingRecord.isOffline 
                      ? '0 8px 16px rgba(245, 158, 11, 0.3)'
                      : '0 8px 16px rgba(246, 66, 31, 0.3)',
                  }}
                >
                  {pendingRecord.isOffline ? (
                    <Clock className="w-9 h-9 md:w-11 md:h-11 text-white" />
                  ) : pendingRecord.needsConfirmation ? (
                    <User className="w-9 h-9 md:w-11 md:h-11 text-white" />
                  ) : (
                    <CheckCircle className="w-9 h-9 md:w-11 md:h-11 text-white" />
                  )}
                </div>
                <h3
                  className="mb-1"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: pendingRecord.isOffline ? '#f59e0b' : DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  {pendingRecord.isOffline 
                    ? 'Queued for Sync' 
                    : pendingRecord.needsConfirmation 
                      ? 'Verify Identity' 
                      : 'Attendance Recorded'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {pendingRecord.isOffline 
                    ? 'This record will be synced when you have internet connection'
                    : pendingRecord.needsConfirmation
                      ? 'Is this the correct person? Verify before recording.'
                      : 'Attendance has been successfully recorded'}
                </p>
              </div>
              
              {/* Member Profile Card */}
              <div 
                className="mb-5 p-4 md:p-5 rounded-xl border-2"
                style={{
                  background: isDark ? 'rgba(246, 66, 31, 0.1)' : 'rgba(246, 66, 31, 0.05)',
                  borderColor: isDark ? 'rgba(246, 66, 31, 0.3)' : 'rgba(246, 66, 31, 0.2)',
                }}
              >
                <div className="flex items-center gap-3 md:gap-4 mb-4">
                  {/* Profile Picture */}
                  <div className="flex-shrink-0">
                    {pendingRecord.memberData?.profilePicture ? (
                      <img 
                        src={pendingRecord.memberData.profilePicture} 
                        alt={pendingRecord.member}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 shadow-lg"
                        style={{
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                        }}
                      />
                    ) : (
                      <div 
                        className="w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center font-bold text-white text-xl md:text-2xl border-4 shadow-lg"
                        style={{
                          background: 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)',
                          borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                        }}
                      >
                        {getInitials(pendingRecord.member)}
                      </div>
                    )}
                  </div>

                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <h4 
                      className="truncate mb-1"
                      style={{
                        fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        color: isDark ? '#ffffff' : '#000000',
                      }}
                    >
                      {pendingRecord.member}
                    </h4>
                    <p 
                      className="text-sm truncate mb-0.5"
                      style={{
                        color: DESIGN_TOKENS.colors.brand.orange,
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                      }}
                    >
                      {pendingRecord.memberData?.position || 'Member'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {pendingRecord.memberData?.committee || 'General Committee'}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex justify-center">
                  <div
                    className="inline-block px-4 py-2 rounded-full text-sm md:text-base"
                    style={{
                      backgroundColor: 
                        pendingRecord.status === 'Present' ? '#10b98120' :
                        pendingRecord.status === 'Late' ? '#f59e0b20' :
                        pendingRecord.status === 'Excused' ? '#3b82f620' :
                        '#ef444420',
                      color: 
                        pendingRecord.status === 'Present' ? '#10b981' :
                        pendingRecord.status === 'Late' ? '#f59e0b' :
                        pendingRecord.status === 'Excused' ? '#3b82f6' :
                        '#ef4444',
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    {pendingRecord.status}
                  </div>
                </div>
              </div>

              {/* Record Details Grid */}
              <div className="space-y-3">
                {/* Event */}
                <div className="flex items-start gap-3 p-3 md:p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <Calendar className="w-5 h-5 text-[#ee8724] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Event</p>
                    <p 
                      className="text-sm md:text-base truncate"
                      style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
                    >
                      {pendingRecord.event}
                    </p>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="flex items-start gap-3 p-3 md:p-4 rounded-lg bg-gray-100 dark:bg-gray-800">
                  <Clock className="w-5 h-5 text-[#ee8724] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Date & Time</p>
                    <p 
                      className="text-sm md:text-base"
                      style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
                    >
                      {pendingRecord.date}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {pendingRecord.timeType} at {pendingRecord.timestamp}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer with Verify Button */}
            <div 
              className="flex-shrink-0 p-5 md:p-7 pt-4 border-t"
              style={{
                background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              {pendingRecord.needsConfirmation ? (
                // Show Verify & Record button if not yet recorded
                <button
                  onClick={confirmAndRecordAttendance}
                  disabled={isRecordingAttendance}
                  className="w-full px-4 py-3 rounded-xl text-white transition-all hover:shadow-lg text-sm md:text-base flex items-center justify-center gap-2 disabled:opacity-70"
                  style={{
                    background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  {isRecordingAttendance ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      Verify & Record
                    </>
                  )}
                </button>
              ) : (
                // Show Done button if already recorded (e.g., after overwrite)
                <button
                  onClick={() => handleSuccessModalClose(true)}
                  className="w-full px-4 py-3 rounded-xl text-white transition-all hover:shadow-lg text-sm md:text-base"
                  style={{
                    background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Toast Container for Progress Tracking */}
      <UploadToastContainer
        messages={uploadToastMessages}
        onDismiss={dismissUploadToast}
        isDark={isDark}
      />
    </PageLayout>
  );
}
