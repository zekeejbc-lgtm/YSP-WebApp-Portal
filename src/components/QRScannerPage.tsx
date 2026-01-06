/**
 * =============================================================================
 * QR ATTENDANCE SCANNER PAGE
 * =============================================================================
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Uses PageLayout master component
 * ✅ Event select: 44px dropdown height
 * ✅ Time type toggle: proper button sizing
 * ✅ Camera preview: 16:9 aspect ratio
 * ✅ Toast notifications for scan results
 * 
 * =============================================================================
 */

import { useState } from "react";
import { toast } from "sonner";
import { PageLayout, DESIGN_TOKENS, getGlassStyle, Button } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { Camera, StopCircle, QrCode, CheckCircle } from "lucide-react";

interface QRScannerPageProps {
  onClose: () => void;
  isDark: boolean;
}

export default function QRScannerPage({ onClose, isDark }: QRScannerPageProps) {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [timeType, setTimeType] = useState<"in" | "out">("in");
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<
    "granted" | "denied" | "prompt"
  >("prompt");

  // Mock active events
  const activeEvents = [
    { id: "EVT-001", name: "Community Outreach 2025" },
    { id: "EVT-002", name: "Tree Planting Initiative" },
    { id: "EVT-003", name: "Leadership Training Workshop" },
  ];

  const handleStartScanning = async () => {
    if (!selectedEvent) {
      toast.error("Please select an event first");
      return;
    }

    // Simulate camera permission request
    try {
      setIsScanning(true);
      setCameraPermission("granted");

      // Simulate scanning delay
      setTimeout(() => {
        // Simulate successful scan
        const mockMember = "Juan Dela Cruz (MEM-001)";
        const mockTime = new Date().toLocaleTimeString("en-PH", {
          timeZone: "Asia/Manila",
          hour: "2-digit",
          minute: "2-digit",
        });

        toast.success(`Scan Successful!`, {
          description: `${mockMember} - ${
            timeType === "in" ? "Time In" : "Time Out"
          } at ${mockTime}`,
        });

        setIsScanning(false);
      }, 2000);
    } catch (error) {
      setCameraPermission("denied");
      toast.error("Camera access denied");
      setIsScanning(false);
    }
  };

  const glassStyle = getGlassStyle(isDark);

  return (
    <PageLayout
      title="QR Attendance Scanner"
      subtitle="Scan member QR codes for quick attendance recording"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Attendance Management", onClick: undefined },
        { label: "QR Scanner", onClick: undefined },
      ]}
    >
      {/* Controls Card */}
      <div
        className="border rounded-lg mb-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        {/* Event Selector */}
        <div
          style={{
            marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          }}
        >
          <label
            className="block mb-2"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.orange,
            }}
          >
            Select Event (Active Events Only)
          </label>
          <CustomDropdown
            value={selectedEvent}
            onChange={setSelectedEvent}
            options={[
              { value: "", label: "Choose an active event..." },
              ...activeEvents.map((event) => ({
                value: event.id,
                label: event.name,
              }))
            ]}
            isDark={isDark}
            size="md"
          />
        </div>

        {/* Time Type Toggle */}
        <div
          style={{
            marginBottom: `${DESIGN_TOKENS.spacing.scale.xl}px`,
          }}
        >
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
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setTimeType("in")}
              className={`px-6 py-3 rounded-lg transition-all ${
                timeType === "in"
                  ? "text-white"
                  : "border-2 hover:bg-white/30 dark:hover:bg-white/5"
              }`}
              style={{
                backgroundColor:
                  timeType === "in" ? DESIGN_TOKENS.colors.status.present : "transparent",
                borderColor:
                  timeType === "in"
                    ? "transparent"
                    : isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
                borderRadius: `${DESIGN_TOKENS.radius.button}px`,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.button}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
              }}
            >
              Time In
            </button>
            <button
              onClick={() => setTimeType("out")}
              className={`px-6 py-3 rounded-lg transition-all ${
                timeType === "out"
                  ? "text-white"
                  : "border-2 hover:bg-white/30 dark:hover:bg-white/5"
              }`}
              style={{
                backgroundColor:
                  timeType === "out" ? DESIGN_TOKENS.colors.status.late : "transparent",
                borderColor:
                  timeType === "out"
                    ? "transparent"
                    : isDark
                    ? "rgba(255, 255, 255, 0.1)"
                    : "rgba(0, 0, 0, 0.1)",
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
          disabled={!selectedEvent || isScanning}
          loading={isScanning}
          icon={<Camera className="w-5 h-5" />}
          fullWidth
        >
          {isScanning ? "Scanning..." : "Start Camera"}
        </Button>
      </div>

      {/* Camera Preview */}
      <div
        className="border rounded-lg overflow-hidden"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
          aspectRatio: DESIGN_TOKENS.media.cameraPreview.aspectRatio,
        }}
      >
        {isScanning ? (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <div className="text-center text-white">
              <QrCode className="w-16 h-16 mx-auto mb-4 animate-pulse" />
              <p
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Scanning for QR Code...
              </p>
              <p
                className="text-gray-400 mt-2"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                }}
              >
                Position the QR code within the frame
              </p>
            </div>
          </div>
        ) : cameraPermission === "denied" ? (
          <div className="w-full h-full flex items-center justify-center bg-red-500/10">
            <div className="text-center">
              <Camera className="w-16 h-16 mx-auto mb-4 text-red-500" />
              <p
                className="text-red-500"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Camera Access Denied
              </p>
              <p
                className="text-muted-foreground mt-2"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                }}
              >
                Please enable camera permissions in your browser settings
              </p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <QrCode className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p
                className="text-muted-foreground"
                style={{
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Select an event and click Start Camera
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div
        className="border rounded-lg mt-6"
        style={{
          borderRadius: `${DESIGN_TOKENS.radius.card}px`,
          padding: `${DESIGN_TOKENS.spacing.scale.lg}px`,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.1)",
          ...glassStyle,
        }}
      >
        <div className="flex items-start gap-3">
          <CheckCircle
            className="flex-shrink-0 mt-1"
            style={{
              width: "20px",
              height: "20px",
              color: DESIGN_TOKENS.colors.status.present,
            }}
          />
          <div>
            <p
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.normal,
              }}
            >
              <strong>How to use:</strong> Select an event, choose Time In or Time
              Out, then click Start Camera. Position the member's QR ID within the
              frame for automatic scanning.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}