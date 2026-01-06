import { useState, useEffect } from "react";
import { Plus, Edit, Search, MapPin, Move } from "lucide-react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";

// Interactive Geofence Map Component
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
  const [map, setMap] = useState<any>(null);
  const [marker, setMarker] = useState<any>(null);
  const [circle, setCircle] = useState<any>(null);

  useEffect(() => {
    // Dynamically import Leaflet
    const initMap = async () => {
      const L = (await import('leaflet')).default;
      
      // Create custom icon
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

      // Initialize map
      const mapInstance = L.map('geofence-map', {
        center: [lat, lng],
        zoom: 17,
        zoomControl: true,
      });

      // Add satellite tile layer (Google Satellite)
      L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google',
      }).addTo(mapInstance);

      // Add draggable marker
      const markerInstance = L.marker([lat, lng], {
        icon: redIcon,
        draggable: true,
      }).addTo(mapInstance);

      // Add circle for radius
      const circleInstance = L.circle([lat, lng], {
        radius: radius,
        color: '#3B82F6',
        fillColor: '#3B82F6',
        fillOpacity: 0.15,
        weight: 3,
      }).addTo(mapInstance);

      // Handle marker drag
      markerInstance.on('dragend', function(e: any) {
        const position = e.target.getLatLng();
        onLocationChange(position.lat, position.lng);
        circleInstance.setLatLng(position);
      });

      // Handle map click
      mapInstance.on('click', function(e: any) {
        const { lat, lng } = e.latlng;
        markerInstance.setLatLng([lat, lng]);
        circleInstance.setLatLng([lat, lng]);
        onLocationChange(lat, lng);
      });

      setMap(mapInstance);
      setMarker(markerInstance);
      setCircle(circleInstance);
    };

    if (!map) {
      initMap();
    }

    // Cleanup
    return () => {
      if (map) {
        map.remove();
      }
    };
  }, []);

  // Update marker and circle when props change (from manual input)
  useEffect(() => {
    if (marker && circle && map) {
      marker.setLatLng([lat, lng]);
      circle.setLatLng([lat, lng]);
      circle.setRadius(radius);
      map.setView([lat, lng], 17);
    }
  }, [lat, lng, radius, marker, circle, map]);

  return (
    <div 
      className="rounded-xl overflow-hidden border-2 mb-3"
      style={{
        borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.2)',
      }}
    >
      {/* Leaflet CSS */}
      <style>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        
        #geofence-map {
          height: 300px;
          width: 100%;
        }
        
        .custom-map-marker {
          background: none;
          border: none;
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
      `}</style>
      
      <div id="geofence-map" />
      
      {/* Map Info Bar */}
      <div 
        className="px-3 py-2.5 flex items-center justify-between text-xs border-t"
        style={{
          background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        <div className="flex items-center gap-2">
          <Move className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-muted-foreground">
            Click or drag to set location
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">
            📍 {lat.toFixed(6)}, {lng.toFixed(6)}
          </span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold">
            {radius}m
          </span>
        </div>
      </div>
    </div>
  );
}

interface Event {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: "Active" | "Inactive";
  locationName?: string;
  location: { lat: number; lng: number };
  radius: number;
}

interface ManageEventsPageProps {
  onClose: () => void;
  isDark: boolean;
}

export default function ManageEventsPage({ onClose, isDark }: ManageEventsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    locationName: "",
    lat: 7.4500,
    lng: 125.8078,
    radius: 100,
  });

  const [events, setEvents] = useState<Event[]>([
    {
      id: "EVT-001",
      name: "Community Outreach 2025",
      description: "Annual community outreach program",
      startDate: "2025-02-01",
      endDate: "2025-02-03",
      status: "Active",
      location: { lat: 7.4500, lng: 125.8078 },
      radius: 100,
    },
    {
      id: "EVT-002",
      name: "Tree Planting Initiative",
      description: "Environmental conservation activity",
      startDate: "2025-03-15",
      endDate: "2025-03-15",
      status: "Active",
      location: { lat: 7.4500, lng: 125.8078 },
      radius: 150,
    },
    {
      id: "EVT-003",
      name: "Past Event Example",
      description: "Completed event",
      startDate: "2024-12-01",
      endDate: "2024-12-01",
      status: "Inactive",
      location: { lat: 7.4500, lng: 125.8078 },
      radius: 100,
    },
  ]);

  const filteredEvents = events.filter(
    (event) =>
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleStatus = (eventId: string) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventId
          ? { ...event, status: event.status === "Active" ? "Inactive" : "Active" as "Active" | "Inactive" }
          : event
      )
    );
    toast.success("Event status updated", {
      description: "Status changed successfully",
    });
  };

  const handleCreateOrEdit = () => {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (editingEvent) {
      setEvents((prev) =>
        prev.map((event) =>
          event.id === editingEvent.id
            ? {
                ...event,
                name: formData.name,
                description: formData.description,
                startDate: formData.startDate,
                endDate: formData.endDate,
                locationName: formData.locationName,
                location: { lat: formData.lat, lng: formData.lng },
                radius: formData.radius,
              }
            : event
        )
      );
      toast.success("Event updated successfully");
    } else {
      const newEvent: Event = {
        id: `EVT-${String(events.length + 1).padStart(3, "0")}`,
        name: formData.name,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: "Active",
        locationName: formData.locationName,
        location: { lat: formData.lat, lng: formData.lng },
        radius: formData.radius,
      };
      setEvents((prev) => [...prev, newEvent]);
      toast.success("Event created successfully");
    }

    setShowModal(false);
    setEditingEvent(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      startDate: "",
      endDate: "",
      locationName: "",
      lat: 7.4500,
      lng: 125.8078,
      radius: 100,
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditingEvent(null);
    setShowModal(true);
  };

  const openEditModal = (event: Event) => {
    setFormData({
      name: event.name,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      locationName: event.locationName || "",
      lat: event.location.lat,
      lng: event.location.lng,
      radius: event.radius,
    });
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
      actions={
        <button
          onClick={openCreateModal}
          className="px-4 py-2 rounded-lg text-white transition-all hover:shadow-lg flex items-center gap-2"
          style={{
            background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
          }}
        >
          <Plus className="w-4 h-4" />
          Create Event
        </button>
      }
    >
      {/* Search Bar */}
      <div className="mb-6 relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by Event Name or ID..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none"
          style={{
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        />
      </div>

      {/* Events Grid */}
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
                <h3
                  className="mb-1"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  {event.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {event.id}
                </p>
              </div>
              <span
                className="px-3 py-1 rounded-full text-sm"
                style={{
                  backgroundColor: event.status === "Active" ? "#10b98120" : "#6b728020",
                  color: event.status === "Active" ? "#10b981" : "#6b7280",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                {event.status}
              </span>
            </div>

            <p className="text-muted-foreground text-sm mb-3">
              {event.description}
            </p>

            <div className="text-sm text-muted-foreground mb-4">
              <p>
                <strong>Start:</strong> {new Date(event.startDate).toLocaleDateString()}
              </p>
              <p>
                <strong>End:</strong> {new Date(event.endDate).toLocaleDateString()}
              </p>
              <p>
                <strong>Radius:</strong> {event.radius}m
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleToggleStatus(event.id)}
                className="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                {event.status === "Active" ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => openEditModal(event)}
                className="px-4 py-2 rounded-lg bg-[#ee8724] text-white hover:bg-[#d97618] transition-colors flex items-center gap-2"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty/No Results State */}
      {filteredEvents.length === 0 && (
        <div 
          className="rounded-xl p-12 text-center border"
          style={{
            background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3
            className="mb-2"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.orange,
            }}
          >
            {searchQuery ? "No events found" : "No events yet"}
          </h3>
          <p className="text-muted-foreground">
            {searchQuery
              ? "Try a different search term"
              : "Create your first event to get started"}
          </p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-80 flex items-start md:items-center justify-center overflow-y-auto"
          onClick={() => setShowModal(false)}
          style={{
            padding: 'clamp(8px, 2vw, 24px)',
          }}
        >
          <div
            className="rounded-xl w-full border z-90"
            style={{
              maxWidth: 'min(95vw, 680px)',
              maxHeight: 'calc(100vh - 32px)',
              margin: 'clamp(16px, 4vh, 40px) auto',
              padding: 'clamp(16px, 3vw, 32px)',
              background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              overflowY: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="mb-4 md:mb-6"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: 'clamp(1.25rem, 4vw, 1.75rem)',
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.red,
              }}
            >
              {editingEvent ? "Edit Event" : "Create Event"}
            </h3>

            <div className="space-y-3 md:space-y-4">
              {/* Event Name */}
              <div>
                <label 
                  className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base"
                  style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
                >
                  Event Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base"
                  style={{
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>

              {/* Description */}
              <div>
                <label 
                  className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base"
                  style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
                >
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none resize-none text-sm md:text-base"
                  style={{
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>

              {/* Date & Time Range */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label 
                    className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base"
                    style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
                  >
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base"
                    style={{
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
                <div>
                  <label 
                    className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base"
                    style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
                  >
                    End Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base"
                    style={{
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                    }}
                  />
                </div>
              </div>

              {/* Location Name */}
              <div>
                <label 
                  className="block mb-1.5 md:mb-2 text-muted-foreground text-sm md:text-base"
                  style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
                >
                  Location Name
                </label>
                <input
                  type="text"
                  value={formData.locationName || ''}
                  onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
                  placeholder="e.g., Tagum City Hall, Freedom Park"
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base"
                  style={{
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
              </div>

              {/* Geofence Coordinates & Radius */}
              <div>
                <label 
                  className="block mb-1.5 md:mb-2 text-muted-foreground flex items-center gap-2 text-sm md:text-base"
                  style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
                >
                  <MapPin className="w-4 h-4 text-[#f6421f]" />
                  Geofence Coordinates & Radius
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-3">
                  <div>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.lat}
                      onChange={(e) => setFormData({ ...formData, lat: parseFloat(e.target.value) || 0 })}
                      placeholder="Latitude"
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base"
                      style={{
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Tagum: ~7.4500</p>
                  </div>
                  <div>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.lng}
                      onChange={(e) => setFormData({ ...formData, lng: parseFloat(e.target.value) || 0 })}
                      placeholder="Longitude"
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base"
                      style={{
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Tagum: ~125.8078</p>
                  </div>
                  <div>
                    <input
                      type="number"
                      value={formData.radius}
                      onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) || 0 })}
                      placeholder="Radius (meters)"
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 rounded-xl border-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 transition-all outline-none text-sm md:text-base"
                      style={{
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Typical: 50-200m</p>
                  </div>
                </div>
                
                {/* Satellite Map Preview */}
                {formData.lat && formData.lng && formData.radius > 0 && (
                  <GeofenceMapPreview 
                    lat={formData.lat} 
                    lng={formData.lng} 
                    radius={formData.radius} 
                    isDark={isDark}
                    onLocationChange={(lat, lng) => setFormData({ ...formData, lat, lng })}
                  />
                )}
                
                {/* Geofence Info Display */}
                {formData.lat && formData.lng && formData.radius > 0 && (
                  <div 
                    className="p-2.5 md:p-3 rounded-xl flex items-start gap-2 md:gap-3"
                    style={{
                      background: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                      border: isDark ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid rgba(59, 130, 246, 0.15)',
                    }}
                  >
                    <MapPin className="w-4 h-4 md:w-5 md:h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs md:text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
                        Geofence Active
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Location: {formData.lat.toFixed(6)}, {formData.lng.toFixed(6)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Members must be within {formData.radius} meters to check in
                      </p>
                    </div>
                  </div>
                )}
                
                <p className="text-xs text-muted-foreground mt-2">
                  Set the exact coordinates where the event will be held. Attendance can only be recorded within the specified radius.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 md:gap-3 mt-4 md:mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 md:py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm md:text-base"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrEdit}
                className="flex-1 px-4 py-2.5 md:py-3 rounded-xl text-white transition-colors text-sm md:text-base"
                style={{
                  background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                {editingEvent ? "Save Changes" : "Create Event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}