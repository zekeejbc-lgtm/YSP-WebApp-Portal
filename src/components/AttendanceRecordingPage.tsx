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
 * =============================================================================
 */

import { useState } from "react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { Camera, QrCode, CheckCircle, Save, AlertCircle, FileEdit, MapPin, Calendar, ArrowLeft, Clock, Navigation } from "lucide-react";

interface AttendanceRecordingPageProps {
  onClose: () => void;
  isDark: boolean;
}

type Step = "event-selection" | "mode-selection" | "recording";
type Mode = "qr" | "manual" | null;

interface Event {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  locationName?: string;
  location: { lat: number; lng: number };
  radius: number;
}

export default function AttendanceRecordingPage({ onClose, isDark }: AttendanceRecordingPageProps) {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<Step>("event-selection");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedMode, setSelectedMode] = useState<Mode>(null);
  const [showEventDetailsModal, setShowEventDetailsModal] = useState(false);

  // Attendance recording state
  const [timeType, setTimeType] = useState<"in" | "out">("in");

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

  // Mock active events
  const activeEvents: Event[] = [
    {
      id: "EVT-001",
      name: "Community Outreach 2025",
      description: "Annual community outreach program",
      startDate: "2025-02-01",
      endDate: "2025-02-03",
      locationName: "Tagum City Hall",
      location: { lat: 7.4500, lng: 125.8078 },
      radius: 100,
    },
    {
      id: "EVT-002",
      name: "Tree Planting Initiative",
      description: "Environmental conservation activity",
      startDate: "2025-03-15",
      endDate: "2025-03-15",
      locationName: "Freedom Park",
      location: { lat: 7.4520, lng: 125.8100 },
      radius: 150,
    },
    {
      id: "EVT-003",
      name: "Leadership Training Workshop",
      description: "Skills development for officers",
      startDate: "2025-04-10",
      endDate: "2025-04-12",
      locationName: "YSP Headquarters",
      location: { lat: 7.4480, lng: 125.8050 },
      radius: 80,
    },
  ];

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {activeEvents.map((event) => (
            <div
              key={event.id}
              className="border rounded-xl p-4 md:p-6 cursor-pointer transition-all hover:scale-105 hover:shadow-xl"
              style={{
                background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(20px)',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              }}
              onClick={() => handleEventSelect(event)}
            >
              {/* Event Header */}
              <div className="mb-3 md:mb-4">
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
                <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{event.description}</p>
              </div>

              {/* Event Details */}
              <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-4">
                <div className="flex items-center gap-2 text-xs md:text-sm">
                  <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#ee8724] flex-shrink-0" />
                  <span className="text-muted-foreground truncate">
                    {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} 
                    {event.startDate !== event.endDate && ` - ${new Date(event.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </span>
                </div>
                {event.locationName && (
                  <div className="flex items-center gap-2 text-xs md:text-sm">
                    <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-[#ee8724] flex-shrink-0" />
                    <span className="text-muted-foreground truncate">{event.locationName}</span>
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between">
                <div
                  className="inline-block px-2.5 py-1 rounded-full text-xs"
                  style={{
                    backgroundColor: "#10b98120",
                    color: "#10b981",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                  }}
                >
                  Active
                </div>
                <span className="text-xs text-muted-foreground hidden sm:inline">Click to select →</span>
              </div>
            </div>
          ))}
        </div>
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
            className="rounded-xl p-4 md:p-6 max-w-2xl w-full border max-h-[90vh] overflow-y-auto"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3
                  className="mb-1"
                  style={{
                    fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                    color: DESIGN_TOKENS.colors.brand.red,
                  }}
                >
                  {selectedEvent.name}
                </h3>
                <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
              </div>
            </div>

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

              {/* Location Information */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-gray-100 dark:bg-gray-800">
                <MapPin className="w-5 h-5 text-[#ee8724] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground mb-1">Location</p>
                  <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>
                    {selectedEvent.locationName || "Location not specified"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Coordinates: {selectedEvent.location.lat.toFixed(4)}, {selectedEvent.location.lng.toFixed(4)}
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

            {/* Map Preview */}
            <div className="mb-4">
              <p className="text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                Location Map & Geofence
              </p>
              <div 
                className="relative w-full rounded-lg overflow-hidden border"
                style={{
                  height: '300px',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                }}
              >
                {/* Satellite Map Background */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url(https://mt1.google.com/vt/lyrs=s&x=0&y=0&z=1)`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                />

                {/* Center Marker */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                  <div className="relative">
                    {/* Geofence Circle */}
                    <div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-blue-500/40 bg-blue-500/10"
                      style={{
                        width: `${Math.min(selectedEvent.radius * 2, 200)}px`,
                        height: `${Math.min(selectedEvent.radius * 2, 200)}px`,
                      }}
                    />
                    {/* Center Pin */}
                    <div className="relative z-20">
                      <MapPin className="w-8 h-8 text-red-500 drop-shadow-lg" fill="currentColor" />
                    </div>
                  </div>
                </div>

                {/* Map Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <p className="text-white text-xs">
                    <strong>{selectedEvent.locationName}</strong>
                  </p>
                  <p className="text-white/80 text-xs">
                    Geofence: {selectedEvent.radius}m radius
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                Members must be within the geofence to record attendance
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowEventDetailsModal(false)}
                className="flex-1 px-4 py-2.5 md:py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm md:text-base"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                Cancel
              </button>
              <button
                onClick={handleProceedToModeSelection}
                className="flex-1 px-4 py-2.5 md:py-3 rounded-xl text-white transition-colors text-sm md:text-base flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                <span>Proceed to Choose Mode</span>
                <ArrowLeft className="w-4 h-4 rotate-180" />
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
    </PageLayout>
  );
}