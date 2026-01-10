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
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import { UploadToastContainer, type UploadToastMessage } from "./UploadToast";
import CustomDropdown from "./CustomDropdown";
import { Camera, QrCode, CheckCircle, Save, AlertCircle, FileEdit, MapPin, Calendar, ArrowLeft, Clock, Navigation, RefreshCw, Loader2, PlayCircle, AlertTriangle, CheckCircle2, XCircle, Crosshair, X } from "lucide-react";
import {
  fetchEvents,
  clearEventsCache,
  type EventData,
} from "../services/gasEventsService";

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
  
  // Parse times if available
  let eventStatus: EventStatus = "upcoming";
  
  if (backendEvent.Status === 'Cancelled') {
    eventStatus = "cancelled";
  } else if (backendEvent.Status === 'Completed') {
    eventStatus = "completed";
  } else if (now > endDate) {
    eventStatus = "completed";
  } else if (now >= startDate && now <= endDate) {
    // Check if we're within the event time range
    if (backendEvent.StartTime && backendEvent.EndTime) {
      const [startHour, startMin] = backendEvent.StartTime.split(':').map(Number);
      const [endHour, endMin] = backendEvent.EndTime.split(':').map(Number);
      
      const eventStart = new Date(now);
      eventStart.setHours(startHour, startMin, 0, 0);
      
      const eventEnd = new Date(now);
      eventEnd.setHours(endHour, endMin, 0, 0);
      
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
        label: "Happening Now",
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
  
  // Check if it's an ISO date string (like "1899-12-30T00:00:00.000Z")
  if (timeStr.includes('T') && timeStr.includes('1899')) {
    // This is the Excel/Sheets date epoch issue - parse the time portion
    try {
      const date = new Date(timeStr);
      const hours = date.getUTCHours();
      const minutes = date.getUTCMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours % 12 || 12;
      return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } catch {
      return timeStr;
    }
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

  // Manual attendance state
  const [selectedMember, setSelectedMember] = useState("");
  const [status, setStatus] = useState<"Present" | "Late" | "Excused" | "Absent">("Present");
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [previousRecord, setPreviousRecord] = useState<any>(null);
  const [pendingRecord, setPendingRecord] = useState<any>(null);

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
    
    if (showToast) {
      addUploadToast({
        id: toastId,
        title: 'Loading Events',
        message: 'Fetching available events...',
        status: 'loading',
        progress: 10,
      });
    }
    
    try {
      if (showToast) {
        updateUploadToast(toastId, { progress: 30, message: 'Connecting to server...' });
      }
      
      // Fetch events from backend - only active/scheduled events for recording
      const backendEvents = await fetchEvents();
      
      if (showToast) {
        updateUploadToast(toastId, { progress: 70, message: 'Processing event data...' });
      }
      
      // Filter only relevant events (Active, Scheduled, or events happening today)
      const relevantEvents = backendEvents.filter(event => {
        const status = event.Status;
        // Include Active, Scheduled events and exclude Draft/Cancelled
        return status === 'Active' || status === 'Scheduled' || status === 'Completed';
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
    await loadEvents(true);
    setIsRefreshing(false);
  };

  // Mock members (will be replaced with real backend later)
  const members = [
    { 
      id: "MEM-001", 
      name: "Juan Dela Cruz", 
      committee: "Executive Board",
      position: "President",
      profilePicture: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop"
    },
    { 
      id: "MEM-002", 
      name: "Maria Santos", 
      committee: "Community Development",
      position: "Vice President",
      profilePicture: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop"
    },
    { 
      id: "MEM-003", 
      name: "Pedro Reyes", 
      committee: "Environmental Conservation",
      position: "Committee Head",
      profilePicture: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop"
    },
  ];

  // Navigation handlers
  const handleEventSelect = (event: Event) => {
    setSelectedEvent(event);
    setShowEventDetailsModal(true);
  };

  const handleProceedToModeSelection = () => {
    // Block if user is not within geofence
    if (!isWithinGeofence) {
      toast.error("You must be at the event location", {
        description: `You are ${distanceFromEvent}m away. Move within ${selectedEvent?.radius}m of the event to record attendance.`,
      });
      return;
    }
    
    setShowEventDetailsModal(false);
    setCurrentStep("mode-selection");
  };

  const handleModeSelect = (mode: Mode) => {
    setSelectedMode(mode);
    setCurrentStep("recording");
  };

  const handleGoBack = () => {
    if (currentStep === "recording") {
      setCurrentStep("mode-selection");
      setIsScanning(false);
      setSelectedMember("");
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
    setSelectedMember("");
    setStatus("Present");
  };

  const navigateToModeSelection = () => {
    setCurrentStep("mode-selection");
    setSelectedMode(null);
    setIsScanning(false);
    setSelectedMember("");
    setStatus("Present");
  };

  // QR Scanner handlers
  const handleStartScanning = async () => {
    try {
      setIsScanning(true);
      setCameraPermission("granted");

      setTimeout(() => {
        // Mock QR scan - Get random member
        const scannedMember = members[0]; // Juan Dela Cruz for demo
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

        setIsScanning(false);

        // Check for existing record (30% chance for demo)
        const hasExistingRecord = Math.random() > 0.7;
        
        if (hasExistingRecord) {
          // Show overwrite modal with existing record details
          setPreviousRecord({
            memberData: scannedMember,
            member: scannedMember.name,
            event: selectedEvent?.name,
            timeType: "Time In",
            status: "Present",
            timestamp: "10:30 AM",
            date: fullDate,
          });
          // Store pending new record
          setPendingRecord({
            memberData: scannedMember,
            member: scannedMember.name,
            event: selectedEvent?.name,
            timeType: timeType === "in" ? "Time In" : "Time Out",
            status: "Present", // QR always marks as Present
            timestamp: timestamp,
            date: fullDate,
          });
          setShowOverwriteWarning(true);
        } else {
          // Show success modal directly
          setPendingRecord({
            memberData: scannedMember,
            member: scannedMember.name,
            event: selectedEvent?.name,
            timeType: timeType === "in" ? "Time In" : "Time Out",
            status: "Present", // QR always marks as Present
            timestamp: timestamp,
            date: fullDate,
          });
          setShowVerificationModal(true);
        }
      }, 2000);
    } catch (error) {
      setCameraPermission("denied");
      toast.error("Camera access denied");
      setIsScanning(false);
    }
  };

  // Manual attendance handlers
  const handleRecordAttendance = () => {
    if (!selectedMember) {
      toast.error("Please select a member");
      return;
    }

    if ((status === "Absent" || status === "Excused") && timeType === "out") {
      toast.error("Cannot record Time Out for Absent or Excused status");
      return;
    }

    const member = members.find(m => m.id === selectedMember);
    if (!member) return;

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

    // Check for existing record (30% chance for demo)
    const hasExistingRecord = Math.random() > 0.7;
    
    if (hasExistingRecord) {
      // Show overwrite modal with existing record
      setPreviousRecord({
        memberData: member,
        member: member.name,
        event: selectedEvent?.name,
        timeType: "Time In",
        status: "Present",
        timestamp: "10:30 AM",
        date: fullDate,
      });
      // Store pending new record
      setPendingRecord({
        memberData: member,
        member: member.name,
        event: selectedEvent?.name,
        timeType: timeType === "in" ? "Time In" : "Time Out",
        status: status,
        timestamp: timestamp,
        date: fullDate,
      });
      setShowOverwriteWarning(true);
    } else {
      // Show success modal directly
      setPendingRecord({
        memberData: member,
        member: member.name,
        event: selectedEvent?.name,
        timeType: timeType === "in" ? "Time In" : "Time Out",
        status: status,
        timestamp: timestamp,
        date: fullDate,
      });
      setShowVerificationModal(true);
      
      // Reset form
      setSelectedMember("");
      setStatus("Present");
    }
  };

  const confirmOverwrite = () => {
    setShowOverwriteWarning(false);
    setShowVerificationModal(true);
    
    // Reset form for manual mode
    if (selectedMode === "manual") {
      setSelectedMember("");
      setStatus("Present");
    }
  };

  const handleSuccessModalClose = () => {
    setShowVerificationModal(false);
    
    // Show toast notification
    if (pendingRecord) {
      toast.success(`${pendingRecord.status} - ${pendingRecord.member}`, {
        description: `${pendingRecord.timeType} recorded at ${pendingRecord.timestamp}`,
      });
    }
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
          ) : events.length === 0 ? (
            /* Empty State */
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
                There are no active events for attendance recording at the moment.
              </p>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="px-4 py-2 rounded-lg text-white transition-all hover:shadow-lg inline-flex items-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Try Again
              </button>
            </div>
          ) : (
            /* Event Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {events.map((event) => {
                const statusInfo = getEventStatusInfo(event.status);
                const isSelectable = event.status !== "cancelled" && event.status !== "completed";
                
                return (
                  <div
                    key={event.id}
                    className={`border rounded-xl p-4 md:p-6 transition-all ${
                      isSelectable 
                        ? 'cursor-pointer hover:scale-105 hover:shadow-xl' 
                        : 'opacity-60 cursor-not-allowed'
                    }`}
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
                    onClick={() => isSelectable && handleEventSelect(event)}
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
                      {isSelectable && (
                        <span className="text-xs text-muted-foreground hidden sm:inline ml-auto">Click to select →</span>
                      )}
                      {!isSelectable && (
                        <span className="text-xs text-muted-foreground ml-auto">Not available</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

            {/* Start Scanning Button */}
            <Button
              variant="primary"
              onClick={handleStartScanning}
              disabled={isScanning}
              loading={isScanning}
              icon={<Camera className="w-4 h-4 md:w-5 md:h-5" />}
              fullWidth
            >
              {isScanning ? "Scanning..." : "Start Camera"}
            </Button>
          </div>

          {/* Camera Preview */}
          <div
            className="border rounded-lg overflow-hidden w-full"
            style={{
              borderRadius: `${DESIGN_TOKENS.radius.card}px`,
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
              ...glassStyle,
              height: "min(400px, 60vh)",
              maxWidth: "100%",
            }}
          >
            {isScanning ? (
              <div className="w-full h-full bg-black flex items-center justify-center">
                <div className="text-center text-white px-4">
                  <QrCode className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-3 md:mb-4 animate-pulse" />
                  <p
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    }}
                  >
                    Scanning for QR Code...
                  </p>
                  <p className="text-gray-400 mt-2 text-xs md:text-sm">
                    Position the QR code within the frame
                  </p>
                </div>
              </div>
            ) : cameraPermission === "denied" ? (
              <div className="w-full h-full flex items-center justify-center bg-red-500/10">
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
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
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
        <div 
          className="rounded-xl p-4 md:p-6 max-w-3xl mx-auto border"
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

          {/* Member Search */}
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
              Select Member *
            </label>
            <CustomDropdown
              value={selectedMember}
              onChange={setSelectedMember}
              options={[
                { value: "", label: "Search and select member..." },
                ...members.map((member) => ({
                  value: member.id,
                  label: `${member.name} - ${member.committee}`,
                }))
              ]}
              isDark={isDark}
              size="md"
            />
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

          {/* Record Button */}
          <Button onClick={handleRecordAttendance} icon={<Save className="w-4 h-4 md:w-5 md:h-5" />} fullWidth>
            Record Attendance
          </Button>
        </div>
      )}

      {/* Overwrite Confirmation Modal */}
      {showOverwriteWarning && previousRecord && pendingRecord && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 md:p-8"
          onClick={() => setShowOverwriteWarning(false)}
        >
          <div
            className="rounded-xl p-5 md:p-7 w-full max-w-md md:max-w-lg border max-h-[85vh] overflow-y-auto"
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
                  <img 
                    src={previousRecord.memberData?.profilePicture || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop'} 
                    alt={previousRecord.member}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 shadow-lg"
                    style={{
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                    }}
                  />
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
            <div className="space-y-3 mb-6">
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

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowOverwriteWarning(false)}
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
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
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
            </div>
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

              {/* Geofence Radius */}
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
            </div>

            {/* Your Location Status */}
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

            {/* Interactive Map Preview - Using Leaflet */}
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
            <button
              onClick={handleProceedToModeSelection}
              disabled={!isWithinGeofence || locationPermission !== "granted"}
              className="flex-1 px-4 py-2.5 md:py-3 rounded-xl text-white transition-colors text-sm md:text-base flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isWithinGeofence && locationPermission === "granted"
                  ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                  : "linear-gradient(135deg, #6b7280 0%, #4b5563 100%)",
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              }}
            >
              {locationPermission !== "granted" ? (
                <><MapPin className="w-4 h-4" /><span>Enable Location First</span></>
              ) : !isWithinGeofence ? (
                <><MapPin className="w-4 h-4" /><span>Move to Event Location</span></>
              ) : (
                <><span>Proceed to Choose Mode</span><ArrowLeft className="w-4 h-4 rotate-180" /></>
              )}
            </button>
          </div>
        </div>
      </div>
    )}

      {/* Verification Modal */}
      {showVerificationModal && pendingRecord && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6 md:p-8"
          onClick={handleSuccessModalClose}
        >
          <div
            className="rounded-xl p-5 md:p-7 w-full max-w-md md:max-w-lg border max-h-[85vh] overflow-y-auto"
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
            {/* Success Icon Header */}
            <div className="text-center mb-5">
              <div 
                className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full mb-3"
                style={{
                  background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                  boxShadow: '0 8px 16px rgba(246, 66, 31, 0.3)',
                }}
              >
                <CheckCircle className="w-9 h-9 md:w-11 md:h-11 text-white" />
              </div>
              <h3
                className="mb-1"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                Verify Attendance
              </h3>
              <p className="text-sm text-muted-foreground">Please verify the member information before recording</p>
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
                  <img 
                    src={pendingRecord.memberData?.profilePicture || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop'} 
                    alt={pendingRecord.member}
                    className="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 shadow-lg"
                    style={{
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                    }}
                  />
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
            <div className="space-y-3 mb-6">
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

            {/* Verify Button */}
            <button
              onClick={handleSuccessModalClose}
              className="w-full px-4 py-3 rounded-xl text-white transition-all hover:shadow-lg text-sm md:text-base"
              style={{
                background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              }}
            >
              Verify & Record
            </button>
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