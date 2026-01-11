import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Edit, Search, MapPin, Move, Trash2, Loader2, RefreshCw, X, ToggleLeft, ToggleRight, FileText, MapPinned, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";
import { PageLayout, DESIGN_TOKENS } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { UploadToastContainer, type UploadToastMessage } from "./UploadToast";
import {
  fetchEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  clearEventsCache,
  getEventGeofence,
  type EventData,
} from "../services/gasEventsService";

// --- COMPONENTS ---

// 1. Skeleton Loading Component
function EventCardSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div 
      className="rounded-xl p-6 border animate-pulse"
      style={{
        background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="h-6 rounded-lg mb-2 w-3/4" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
          <div className="h-4 rounded w-1/2" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />
        </div>
        <div className="h-6 w-20 rounded-full" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
      </div>
      <div className="h-4 rounded w-full mb-2" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />
      <div className="h-4 rounded w-2/3 mb-4" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />
      <div className="space-y-2 mb-4">
        <div className="h-4 rounded w-1/2" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />
        <div className="h-4 rounded w-1/3" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-9 rounded-lg" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
        <div className="w-16 h-9 rounded-lg" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
        <div className="w-10 h-9 rounded-lg" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
      </div>
    </div>
  );
}

// 2. FIXED Geofence Map Component (Uses Refs to fix rendering issues in Modals)
function GeofenceMapPreview({ 
  lat, 
  lng, 
  radius, 
  isDark,
  onLocationChange 
}: { 
  lat: number; 
  lng: number; 
  radius: number; 
  isDark: boolean;
  onLocationChange: (lat: number, lng: number) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      // Prevent double init
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;
      if (!isMounted) return;

      // Custom Icon
      const redIcon = L.divIcon({
        html: `
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#EF4444" stroke="#991B1B" stroke-width="2"/>
            <circle cx="12" cy="10" r="3" fill="white"/>
          </svg>
        `,
        className: 'custom-map-marker',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      // Initialize Map
      const map = L.map(mapContainerRef.current).setView([lat, lng], 17);

      L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google',
      }).addTo(map);

      const marker = L.marker([lat, lng], {
        icon: redIcon,
        draggable: true,
      }).addTo(map);

      const circle = L.circle([lat, lng], {
        radius: radius,
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.15,
        weight: 3,
      }).addTo(map);

      // Event Listeners
      marker.on('dragend', function(e: any) {
        const position = e.target.getLatLng();
        onLocationChange(position.lat, position.lng);
        circle.setLatLng(position);
      });

      map.on('click', function(e: any) {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        onLocationChange(lat, lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      // CRITICAL FIX: Invalidates size to ensure tiles render correctly in modal
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Map when props change
  useEffect(() => {
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      const currentCenter = mapInstanceRef.current.getCenter();
      // Only move view if significantly different (prevents jitter)
      if (Math.abs(currentCenter.lat - lat) > 0.00001 || Math.abs(currentCenter.lng - lng) > 0.00001) {
        markerRef.current.setLatLng([lat, lng]);
        circleRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.setView([lat, lng], 17);
      }
      circleRef.current.setRadius(radius);
    }
  }, [lat, lng, radius]);

  return (
    <div 
      className="rounded-xl overflow-hidden border-2 mb-3 relative"
      style={{ borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)' }}
    >
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        .custom-map-marker { background: none; border: none; }
        .leaflet-control-zoom { border: 2px solid rgba(255,255,255,0.3) !important; border-radius: 8px !important; overflow: hidden; }
        .leaflet-control-zoom a { background: ${isDark ? '#1f2937' : '#fff'} !important; color: ${isDark ? '#fff' : '#000'} !important; border: none !important; }
      `}</style>
      
      <div ref={mapContainerRef} style={{ height: '300px', width: '100%', zIndex: 1 }} />
      
      <div className="px-3 py-2.5 flex items-center justify-between text-xs border-t bg-white/95 dark:bg-gray-900/95 backdrop-blur">
        <div className="flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-muted-foreground">Click or drag to set location</span>
        </div>
        <div className="flex items-center gap-3">
           <span className="text-muted-foreground">📍 {lat.toFixed(6)}, {lng.toFixed(6)}</span>
           <span className="text-blue-600 dark:text-blue-400 font-semibold">{radius}m</span>
        </div>
      </div>
    </div>
  );
}

// --- UTILS ---

interface Event {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  status: "Active" | "Inactive" | "Scheduled" | "Cancelled" | "Completed" | "Draft";
  locationName?: string;
  location: { lat: number; lng: number };
  radius: number;
  geofenceEnabled: boolean;
  currentAttendees: number;
}

function convertToDateInput(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const dateValue = String(dateStr);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
    if (dateValue.includes('-') && dateValue.includes('T')) {
      const isoMatch = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
    if (dateValue.includes('/')) {
      const dateParts = dateValue.split('/');
      if (dateParts.length === 3) {
        const [month, day, year] = dateParts;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
    return '';
  } catch {
    return '';
  }
}

function convertToTimeInput(timeStr: string): string {
  if (!timeStr) return '';
  try {
    const timeValue = String(timeStr);
    if (/^\d{2}:\d{2}$/.test(timeValue)) return timeValue;
    if (timeValue.includes('T')) {
      const timeMatch = timeValue.match(/T(\d{2}):(\d{2})/);
      if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}`;
    }
    const ampmMatch = timeValue.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = ampmMatch[2];
      const period = ampmMatch[3]?.toUpperCase();
      if (period === 'PM' && hours !== 12) hours += 12;
      else if (period === 'AM' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes}`;
    }
    return '';
  } catch {
    return '';
  }
}

function convertToFrontendEvent(backendEvent: EventData): Event {
  const geofence = getEventGeofence(backendEvent);
  let status: Event['status'] = 'Active';
  const backendStatus = backendEvent.Status?.toString() || '';
  
  if (backendStatus === 'Cancelled' || backendStatus === 'Disabled') status = 'Cancelled';
  else if (backendStatus === 'Completed') status = 'Completed';
  else if (backendStatus === 'Draft') status = 'Draft';
  else if (backendStatus === 'Scheduled') status = 'Scheduled';
  else if (backendStatus === 'Active') status = 'Active';

  const geofenceEnabled = backendEvent.GeofenceEnabled === true || 
    backendEvent.GeofenceEnabled === 'TRUE' || 
    backendEvent.GeofenceEnabled === 'true' ||
    backendEvent.GeofenceEnabled === undefined;

  const rawStartDate = backendEvent.StartDate as any;
  const rawEndDate = backendEvent.EndDate as any;

  const startDateStr = rawStartDate instanceof Date 
    ? `${rawStartDate.getMonth() + 1}/${rawStartDate.getDate()}/${rawStartDate.getFullYear()}`
    : String(rawStartDate || '');
  const endDateStr = rawEndDate instanceof Date 
    ? `${rawEndDate.getMonth() + 1}/${rawEndDate.getDate()}/${rawEndDate.getFullYear()}`
    : String(rawEndDate || '');

  return {
    id: backendEvent.EventID,
    name: backendEvent.Title,
    description: backendEvent.Description,
    startDate: startDateStr,
    endDate: endDateStr,
    startTime: String(backendEvent.StartTime || ''),
    endTime: String(backendEvent.EndTime || ''),
    status,
    locationName: geofence?.name || backendEvent.LocationName || '',
    location: {
      lat: geofence?.lat || 7.4500,
      lng: geofence?.lng || 125.8078,
    },
    radius: geofence?.radius || 100,
    geofenceEnabled,
    currentAttendees: backendEvent.CurrentAttendees || 0,
  };
}

// --- MAIN PAGE COMPONENT ---

interface ManageEventsPageProps {
  onClose: () => void;
  isDark: boolean;
}

export default function ManageEventsPage({ onClose, isDark }: ManageEventsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    locationName: "",
    lat: 7.4500,
    lng: 125.8078,
    radius: 100,
  });
  const [geofencingEnabled, setGeofencingEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'geofencing'>('details');
  const [uploadToastMessages, setUploadToastMessages] = useState<UploadToastMessage[]>([]);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ isOpen: boolean; event: Event | null }>({
    isOpen: false,
    event: null,
  });
  const formDataRef = useRef(formData);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  const addUploadToast = useCallback((message: UploadToastMessage) => {
    setUploadToastMessages(prev => [...prev.filter(m => m.id !== message.id), message]);
  }, []);

  const updateUploadToast = useCallback((id: string, updates: Partial<UploadToastMessage>) => {
    setUploadToastMessages(prev =>
      prev.map(msg => msg.id === id ? { ...msg, ...updates } : msg)
    );
  }, []);

  const dismissUploadToast = useCallback((id: string) => {
    setUploadToastMessages(prev => prev.filter(msg => msg.id !== id));
  }, []);

  const [events, setEvents] = useState<Event[]>([]);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      clearEventsCache();
      const backendEvents = await fetchEvents();
      const frontendEvents = backendEvents.map(convertToFrontendEvent);
      setEvents(frontendEvents);
    } catch (error) {
      console.error("Failed to load events:", error);
      toast.error("Failed to load events", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleRefresh = async () => {
    clearEventsCache();
    await loadEvents();
    toast.success("Events refreshed");
  };

  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleStatusChange = async (eventId: string, newStatus: Event['status']) => {
    const event = events.find(e => e.id === eventId);
    if (!event || event.status === newStatus) return;

    const toastId = `status-${Date.now()}`;
    addUploadToast({
      id: toastId,
      title: 'Updating Status',
      message: `Changing to ${newStatus}...`,
      status: 'loading',
      progress: 30,
    });

    try {
      updateUploadToast(toastId, { progress: 60, message: 'Saving to backend...' });
      await updateEvent(eventId, { status: newStatus });
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId ? { ...e, status: newStatus } : e
        )
      );
      updateUploadToast(toastId, { progress: 100, status: 'success', title: 'Status Updated!', message: `Event is now ${newStatus}` });
    } catch (error) {
      updateUploadToast(toastId, { progress: 100, status: 'error', title: 'Failed to Update', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const openDeleteModal = (event: Event) => {
    setDeleteConfirmModal({ isOpen: true, event });
  };

  const closeDeleteModal = () => {
    setDeleteConfirmModal({ isOpen: false, event: null });
  };

  const handleDelete = async () => {
    const event = deleteConfirmModal.event;
    if (!event) return;

    const eventId = event.id;
    const eventName = event.name;
    closeDeleteModal();
    setIsDeleting(eventId);

    const toastId = `delete-${Date.now()}`;
    addUploadToast({
      id: toastId,
      title: 'Deleting Event',
      message: `Removing "${eventName}"...`,
      status: 'loading',
      progress: 20,
    });

    try {
      updateUploadToast(toastId, { progress: 50, message: 'Connecting to backend...' });
      await deleteEvent(eventId);
      updateUploadToast(toastId, { progress: 80, message: 'Updating local data...' });
      setEvents((prev) => prev.filter((e) => e.id !== eventId));
      updateUploadToast(toastId, { progress: 100, status: 'success', title: 'Event Deleted!', message: `"${eventName}" has been removed successfully.` });
    } catch (error) {
      updateUploadToast(toastId, { progress: 100, status: 'error', title: 'Delete Failed', message: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreateOrEdit = async () => {
    if (!formData.name || !formData.startDate || !formData.startTime || !formData.endDate || !formData.endTime) {
      toast.error("Please fill in all required fields (name, date, and time)");
      return;
    }

    const startParsed = new Date(`${formData.startDate}T${formData.startTime}`);
    const endParsed = new Date(`${formData.endDate}T${formData.endTime}`);

    if (endParsed <= startParsed) {
      toast.error("End time must be after start time");
      return;
    }

    setIsSaving(true);
    const toastId = `event-${Date.now()}`;
    const isEditing = !!editingEvent;

    addUploadToast({
      id: toastId,
      title: isEditing ? 'Updating Event' : 'Creating Event',
      message: 'Preparing event data...',
      status: 'loading',
      progress: 10,
    });

    try {
      updateUploadToast(toastId, { progress: 20, message: 'Validating event details...' });
      
      const geoLat = formData.lat;
      const geoLng = formData.lng;
      const geoRadius = formData.radius;

      if (editingEvent) {
        updateUploadToast(toastId, { progress: 40, message: 'Connecting to backend...' });
        await updateEvent(editingEvent.id, {
          title: formData.name,
          description: formData.description,
          startDate: formData.startDate,
          startTime: formData.startTime,
          endDate: formData.endDate,
          endTime: formData.endTime,
          locationName: formData.locationName,
          latitude: geoLat,
          longitude: geoLng,
          radius: geoRadius,
          geofenceEnabled: geofencingEnabled,
        });

        updateUploadToast(toastId, { progress: 80, message: 'Refreshing local data...' });

        setEvents((prev) =>
          prev.map((event) =>
            event.id === editingEvent.id
              ? {
                  ...event,
                  name: formData.name,
                  description: formData.description,
                  startDate: formData.startDate,
                  startTime: formData.startTime,
                  endDate: formData.endDate,
                  endTime: formData.endTime,
                  locationName: formData.locationName,
                  location: { lat: geoLat, lng: geoLng },
                  radius: geoRadius,
                  geofenceEnabled: geofencingEnabled,
                }
              : event
          )
        );
        updateUploadToast(toastId, { progress: 100, status: 'success', title: 'Event Updated!', message: `"${formData.name}" has been updated successfully.` });
      } else {
        updateUploadToast(toastId, { progress: 40, message: 'Connecting to backend...' });
        const result = await createEvent({
          title: formData.name,
          description: formData.description,
          startDate: formData.startDate,
          startTime: formData.startTime,
          endDate: formData.endDate,
          endTime: formData.endTime,
          locationName: formData.locationName,
          latitude: geoLat,
          longitude: geoLng,
          radius: geoRadius,
          geofenceEnabled: geofencingEnabled,
          status: "Scheduled",
        });

        updateUploadToast(toastId, { progress: 80, message: 'Finalizing...' });

        const newEvent: Event = {
          id: result.eventId,
          name: formData.name,
          description: formData.description,
          startDate: formData.startDate,
          endDate: formData.endDate,
          startTime: formData.startTime,
          endTime: formData.endTime,
          status: "Scheduled",
          locationName: formData.locationName,
          location: { lat: geoLat, lng: geoLng },
          radius: geoRadius,
          geofenceEnabled: geofencingEnabled,
          currentAttendees: 0,
        };
        
        setEvents((prev) => [newEvent, ...prev]);
        updateUploadToast(toastId, { progress: 100, status: 'success', title: 'Event Created!', message: `"${formData.name}" has been created successfully.` });
      }

      setShowModal(false);
      setEditingEvent(null);
      resetForm();
    } catch (error) {
      console.error("Save error:", error);
      updateUploadToast(toastId, { status: 'error', progress: 100, title: isEditing ? 'Update Failed' : 'Creation Failed', message: error instanceof Error ? error.message : 'Unknown error occurred' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      startDate: "",
      startTime: "",
      endDate: "",
      endTime: "",
      locationName: "",
      lat: 7.4500,
      lng: 125.8078,
      radius: 100,
    });
    setGeofencingEnabled(true);
    setActiveTab('details');
  };

  const openCreateModal = () => {
    resetForm();
    setEditingEvent(null);
    setShowModal(true);
  };

  const openEditModal = (event: Event) => {
    const startDateValue = convertToDateInput(event.startDate);
    const startTimeValue = convertToTimeInput(event.startTime);
    const endDateValue = convertToDateInput(event.endDate);
    const endTimeValue = convertToTimeInput(event.endTime);
    
    setFormData({
      name: event.name,
      description: event.description,
      startDate: startDateValue,
      startTime: startTimeValue,
      endDate: endDateValue,
      endTime: endTimeValue,
      locationName: event.locationName || "",
      lat: event.location.lat,
      lng: event.location.lng,
      radius: event.radius,
    });
    setGeofencingEnabled(event.geofenceEnabled);
    setActiveTab('details');
    setEditingEvent(event);
    setShowModal(true);
  };

  return (
    <PageLayout
      title="Manage Events"
      subtitle="Create and manage attendance events with geofencing"
      onClose={onClose}
      isDark={isDark}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Attendance Management", onClick: undefined },
        { label: "Manage Events", onClick: undefined },
      ]}
      actions={null}
    >
      {isLoading && (
        <>
          <div className="mb-6">
            <div className="w-full h-12 rounded-xl animate-pulse" style={{ background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => <EventCardSkeleton key={i} isDark={isDark} />)}
          </div>
        </>
      )}

      {!isLoading && (
        <div className="mb-6 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Event Name or ID..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
              style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
            />
          </div>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
            title="Refresh Events"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreateModal}
            className="ml-2 px-4 py-3 rounded-xl text-white transition-all hover:shadow-lg flex items-center gap-2"
            style={{ background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)", fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
          >
            <Plus className="w-5 h-5" />
            Create
          </button>
        </div>
      )}

      {!isLoading && (
        <div className="grid md:grid-cols-2 gap-6">
          {filteredEvents.map((event) => (
            <div 
              key={event.id} 
              className="rounded-xl p-6 border"
              style={{
                background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="mb-1" style={{ fontFamily: DESIGN_TOKENS.typography.fontFamily.headings, fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold, color: DESIGN_TOKENS.colors.brand.red }}>
                    {event.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">{event.id}</p>
                </div>
                <span
                  className="px-3 py-1 rounded-full text-sm"
                  style={{
                    backgroundColor: event.status === "Active" ? "#10b98120" : event.status === "Scheduled" ? "#3b82f620" : event.status === "Completed" ? "#6b728020" : event.status === "Cancelled" ? "#ef444420" : "#f59e0b20",
                    color: event.status === "Active" ? "#10b981" : event.status === "Scheduled" ? "#3b82f6" : event.status === "Completed" ? "#6b7280" : event.status === "Cancelled" ? "#ef4444" : "#f59e0b",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  {event.status}
                </span>
              </div>

              <p className="text-muted-foreground text-sm mb-3">{event.description || "No description"}</p>

              <div className="text-sm text-muted-foreground mb-4">
                <p><strong>Start:</strong> {event.startDate ? new Date(event.startDate).toLocaleDateString() : 'Not set'}</p>
                <p><strong>End:</strong> {event.endDate ? new Date(event.endDate).toLocaleDateString() : 'Not set'}</p>
                {event.locationName && <p><strong>Location:</strong> {event.locationName}</p>}
                <p><strong>Radius:</strong> {event.radius}m</p>
                <p className="flex items-center gap-1"><Users className="w-4 h-4" /> <strong>Attendees:</strong> {event.currentAttendees}</p>
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <CustomDropdown
                    value={event.status}
                    onChange={(newStatus) => handleStatusChange(event.id, newStatus as Event['status'])}
                    options={[
                      { value: 'Scheduled', label: 'Scheduled' },
                      { value: 'Active', label: 'Active' },
                      { value: 'Completed', label: 'Completed' },
                      { value: 'Cancelled', label: 'Cancelled' },
                    ]}
                    isDark={isDark}
                    size="sm"
                  />
                </div>
                <button
                  onClick={() => openEditModal(event)}
                  className="px-3 py-2 rounded-lg bg-[#ee8724] text-white hover:bg-[#d97618] transition-colors flex items-center gap-2 text-sm"
                  style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
                >
                  <Edit className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => openDeleteModal(event)}
                  disabled={isDeleting === event.id}
                  className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                  style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
                >
                  {isDeleting === event.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filteredEvents.length === 0 && (
        <div 
          className="rounded-xl p-12 text-center border"
          style={{ background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(20px)', borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
        >
          <h3 className="mb-2" style={{ fontFamily: DESIGN_TOKENS.typography.fontFamily.headings, fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`, fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold, color: DESIGN_TOKENS.colors.brand.orange }}>
            {searchQuery ? "No events found" : "No events yet"}
          </h3>
          <p className="text-muted-foreground">{searchQuery ? "Try a different search term" : "Create your first event to get started"}</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-start md:items-center justify-center overflow-y-auto"
          onClick={() => setShowModal(false)}
          style={{ padding: 'clamp(8px, 2vw, 24px)', zIndex: 9999 }}
        >
          <div
            className="rounded-xl w-full border flex flex-col"
            style={{
              maxWidth: 'min(95vw, 680px)',
              maxHeight: 'calc(100vh - 32px)',
              margin: 'clamp(16px, 4vh, 40px) auto',
              background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b shrink-0" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <h3 style={{ fontFamily: DESIGN_TOKENS.typography.fontFamily.headings, fontSize: 'clamp(1.25rem, 4vw, 1.5rem)', fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold, color: DESIGN_TOKENS.colors.brand.red }}>
                {editingEvent ? "Edit Event" : "Create Event"}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" disabled={isSaving}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b shrink-0" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <button onClick={() => setActiveTab('details')} className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'details' ? 'text-[#f6421f] border-b-2 border-[#f6421f]' : 'text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100'}`}>
                <FileText className="w-4 h-4" /> Event Details
              </button>
              <button onClick={() => setActiveTab('geofencing')} className={`flex-1 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${activeTab === 'geofencing' ? 'text-[#f6421f] border-b-2 border-[#f6421f]' : 'text-muted-foreground hover:text-gray-900 dark:hover:text-gray-100'}`}>
                <MapPinned className="w-4 h-4" /> Geofencing {!geofencingEnabled && <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">OFF</span>}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4" style={{ minHeight: 0 }}>
              {activeTab === 'details' && (
                <div className="space-y-3 md:space-y-4">
                  <div>
                    <label className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>Event Name *</label>
                    <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter event name" className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                  </div>
                  <div>
                    <label className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>Description</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Describe your event..." className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none resize-none text-sm md:text-base" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                  </div>
                  <div className="space-y-3 md:space-y-4">
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>Start Date *</label>
                        <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                      </div>
                      <div>
                        <label className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>Start Time *</label>
                        <input type="time" value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>End Date *</label>
                        <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                      </div>
                      <div>
                        <label className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>End Time *</label>
                        <input type="time" value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>Location Name</label>
                    <input type="text" value={formData.locationName || ''} onChange={(e) => setFormData({ ...formData, locationName: e.target.value })} placeholder="e.g., Tagum City Hall, Freedom Park" className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                  </div>
                  <div className="p-3 rounded-xl flex items-center justify-between" style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)', border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.08)' }}>
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-4 h-4 ${geofencingEnabled ? 'text-[#f6421f]' : 'text-gray-400'}`} />
                      <span className="text-sm">Geofencing {geofencingEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                    <button onClick={() => setActiveTab('geofencing')} className="text-xs text-[#f6421f] hover:underline">Configure →</button>
                  </div>
                </div>
              )}

              {activeTab === 'geofencing' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl flex items-center justify-between" style={{ background: geofencingEnabled ? (isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)') : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)'), border: geofencingEnabled ? '1px solid rgba(34, 197, 94, 0.3)' : (isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)') }}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${geofencingEnabled ? 'bg-green-500/20 text-green-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-400'}`}>
                        <MapPinned className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">Location-based Check-in</p>
                        <p className="text-xs text-muted-foreground">{geofencingEnabled ? 'Members must be within the specified area to check in' : 'Members can check in from anywhere'}</p>
                      </div>
                    </div>
                    <button onClick={() => setGeofencingEnabled(!geofencingEnabled)} className="p-1">
                      {geofencingEnabled ? <ToggleRight className="w-10 h-10 text-green-500" /> : <ToggleLeft className="w-10 h-10 text-gray-400" />}
                    </button>
                  </div>

                  {geofencingEnabled && (
                    <>
                      <div>
                        <label className="block mb-2 text-muted-foreground flex items-center gap-2 text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                          <MapPin className="w-4 h-4 text-[#f6421f]" /> Coordinates & Radius
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                          <div>
                            <input type="number" step="0.000001" value={formData.lat} onChange={(e) => setFormData(prev => ({ ...prev, lat: parseFloat(e.target.value) || 0 }))} placeholder="Latitude" className="w-full px-3 py-2.5 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                            <p className="text-xs text-muted-foreground mt-1">Tagum: ~7.4500</p>
                          </div>
                          <div>
                            <input type="number" step="0.000001" value={formData.lng} onChange={(e) => setFormData(prev => ({ ...prev, lng: parseFloat(e.target.value) || 0 }))} placeholder="Longitude" className="w-full px-3 py-2.5 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                            <p className="text-xs text-muted-foreground mt-1">Tagum: ~125.8078</p>
                          </div>
                          <div>
                            <input type="number" value={formData.radius} onChange={(e) => setFormData(prev => ({ ...prev, radius: parseInt(e.target.value) || 0 }))} placeholder="Radius (m)" className="w-full px-3 py-2.5 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }} />
                            <p className="text-xs text-muted-foreground mt-1">Typical: 50-200m</p>
                          </div>
                        </div>
                      </div>
                      
                      {formData.lat && formData.lng && formData.radius > 0 && (
                        <GeofenceMapPreview lat={formData.lat} lng={formData.lng} radius={formData.radius} isDark={isDark} onLocationChange={(lat, lng) => setFormData(prev => ({ ...prev, lat, lng }))} />
                      )}
                      
                      {formData.lat && formData.lng && formData.radius > 0 && (
                        <div className="p-3 rounded-xl flex items-start gap-3" style={{ background: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)', border: isDark ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(59, 130, 246, 0.15)' }}>
                          <MapPin className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">Geofence Active</p>
                            <p className="text-xs text-muted-foreground">📍 {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}</p>
                            <p className="text-xs text-muted-foreground">Members must be within {formData.radius}m to check in</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {!geofencingEnabled && (
                    <div className="p-4 rounded-xl text-center" style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', border: isDark ? '1px dashed rgba(255, 255, 255, 0.1)' : '1px dashed rgba(0, 0, 0, 0.1)' }}>
                      <MapPinned className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-muted-foreground">Location-based check-in is disabled</p>
                      <p className="text-xs text-muted-foreground mt-1">Enable it to restrict attendance to a specific area</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 md:gap-3 px-4 md:px-6 py-4 border-t shrink-0" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)', background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)' }}>
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 md:py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm md:text-base disabled:opacity-50" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }} disabled={isSaving}>Cancel</button>
              <button onClick={handleCreateOrEdit} disabled={isSaving} className="flex-1 px-4 py-2.5 md:py-3 rounded-xl text-white transition-colors text-sm md:text-base disabled:opacity-50 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)", fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> {editingEvent ? "Saving..." : "Creating..."}</> : (editingEvent ? "Save Changes" : "Create Event")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal - Z-INDEX FIX APPLIED HERE */}
      {deleteConfirmModal.isOpen && deleteConfirmModal.event && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-[9999] p-4" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div 
            className="rounded-2xl shadow-2xl w-full max-w-md mx-auto"
            style={{
              background: isDark 
                ? 'linear-gradient(135deg, rgba(17, 24, 39, 0.98) 0%, rgba(31, 41, 55, 0.98) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(249, 250, 251, 0.98) 100%)',
            }}
          >
            <div className="flex items-center gap-3 px-6 py-5 border-b" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <div className="p-3 rounded-full" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h2 className={`text-xl ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.bold }}>Delete Event</h2>
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>This action cannot be undone</p>
              </div>
            </div>

            <div className="px-6 py-6">
              <p className={`text-base ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                Are you sure you want to delete <span className={isDark ? 'text-white' : 'text-gray-900'} style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>"{deleteConfirmModal.event.name}"</span>?
              </p>
              <div className="mt-4 p-3 rounded-lg flex items-start gap-3" style={{ background: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)', border: `1px solid ${isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.15)'}` }}>
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>All attendees and related event data will be permanently removed from the system.</p>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}>
              <button onClick={closeDeleteModal} className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Cancel</button>
              <button onClick={handleDelete} className="flex-1 px-4 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                <Trash2 className="w-4 h-4" /> Delete Event
              </button>
            </div>
          </div>
        </div>
      )}

      <UploadToastContainer messages={uploadToastMessages} onDismiss={dismissUploadToast} isDark={isDark} />
    </PageLayout>
  );
}