import { useState } from "react";
import { toast } from "sonner";
import { PageLayout, Button, DESIGN_TOKENS } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { Save } from "lucide-react";

interface ManualAttendancePageProps {
  onClose: () => void;
  isDark: boolean;
}

export default function ManualAttendancePage({ onClose, isDark }: ManualAttendancePageProps) {
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [timeType, setTimeType] = useState<"in" | "out">("in");
  const [status, setStatus] = useState<"Present" | "Late" | "Excused" | "Absent">("Present");
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [previousRecord, setPreviousRecord] = useState<any>(null);

  // Mock data
  const members = [
    { id: "MEM-001", name: "Juan Dela Cruz", committee: "Executive Board" },
    { id: "MEM-002", name: "Maria Santos", committee: "Community Development" },
    { id: "MEM-003", name: "Pedro Reyes", committee: "Environmental Conservation" },
  ];

  const activeEvents = [
    { id: "EVT-001", name: "Community Outreach 2025" },
    { id: "EVT-002", name: "Tree Planting Initiative" },
  ];

  const handleRecordAttendance = () => {
    if (!selectedMember || !selectedEvent) {
      toast.error("Please fill in all required fields");
      return;
    }

    // Check business rules
    if ((status === "Absent" || status === "Excused") && timeType === "out") {
      toast.error("Cannot record Time Out for Absent or Excused status");
      return;
    }

    // Simulate checking for existing record
    const hasExistingRecord = Math.random() > 0.7;
    
    if (hasExistingRecord) {
      setPreviousRecord({
        member: "Juan Dela Cruz",
        event: "Community Outreach 2025",
        timeType: "Time In",
        status: "Present",
        timestamp: "10:30 AM",
      });
      setShowOverwriteModal(true);
    } else {
      saveAttendance();
    }
  };

  const saveAttendance = () => {
    const member = members.find(m => m.id === selectedMember);
    const timestamp = new Date().toLocaleTimeString("en-PH", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit"
    });

    toast.success("Attendance Recorded!", {
      description: `${member?.name} - ${status} - ${timeType === "in" ? "Time In" : "Time Out"} at ${timestamp}`,
    });

    // Reset form
    setSelectedMember("");
    setSelectedEvent("");
    setTimeType("in");
    setStatus("Present");
    setShowOverwriteModal(false);
  };

  return (
    <PageLayout
      title="Manual Attendance"
      subtitle="Record attendance manually for members"
      onClose={onClose}
      isDark={isDark}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Attendance Management", onClick: undefined },
        { label: "Manual Attendance", onClick: undefined },
      ]}
    >
      {/* Form Card */}
      <div 
        className="rounded-xl p-6 max-w-3xl mx-auto border"
        style={{
          background: isDark ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Member Search */}
        <div className="mb-6">
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

        {/* Event Search */}
        <div className="mb-6">
          <label
            className="block mb-2"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.orange,
            }}
          >
            Select Event (Active Events Only) *
          </label>
          <CustomDropdown
            value={selectedEvent}
            onChange={setSelectedEvent}
            options={[
              { value: "", label: "Search and select event..." },
              ...activeEvents.map((event) => ({
                value: event.id,
                label: event.name,
              }))
            ]}
            isDark={isDark}
            size="md"
          />
        </div>

        {/* Time Type */}
        <div className="mb-6">
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
          <div className="flex gap-4">
            <button
              onClick={() => setTimeType("in")}
              className={`flex-1 px-4 py-3 rounded-xl transition-all ${
                timeType === "in"
                  ? "bg-[#f6421f] text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              Time In
            </button>
            <button
              onClick={() => setTimeType("out")}
              disabled={status === "Absent" || status === "Excused"}
              className={`flex-1 px-4 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                timeType === "out"
                  ? "bg-[#f6421f] text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              }`}
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              Time Out
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="mb-6">
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
          <div className="mb-6 flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-amber-800 dark:text-amber-300">
              <strong>Note:</strong> Time Out cannot be recorded for Absent or Excused status
            </span>
          </div>
        )}

        {/* Record Button */}
        <Button
          onClick={handleRecordAttendance}
          icon={<Save className="w-5 h-5" />}
          fullWidth
        >
          Record Attendance
        </Button>
      </div>

      {/* Overwrite Confirmation Modal */}
      {showOverwriteModal && previousRecord && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-80 flex items-center justify-center p-4"
          onClick={() => setShowOverwriteModal(false)}
        >
          <div
            className="rounded-xl p-6 max-w-md w-full border z-90"
            style={{
              background: isDark ? 'rgba(17, 24, 39, 0.95)' : 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="mb-4"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.red,
              }}
            >
              Overwrite Existing Record?
            </h3>
            
            <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Previous Record:</p>
              <p style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}>{previousRecord.member}</p>
              <p className="text-sm">{previousRecord.event}</p>
              <p className="text-sm">{previousRecord.timeType} - {previousRecord.status}</p>
              <p className="text-sm text-muted-foreground">at {previousRecord.timestamp}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowOverwriteModal(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                Cancel
              </button>
              <button
                onClick={saveAttendance}
                className="flex-1 px-4 py-3 rounded-xl text-white transition-colors"
                style={{
                  background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                }}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}