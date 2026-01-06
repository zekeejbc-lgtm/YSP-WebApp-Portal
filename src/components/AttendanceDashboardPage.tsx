import { useState } from "react";
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
} from "recharts@2.15.2";
import { Download, FileText } from "lucide-react";

interface AttendanceDashboardPageProps {
  onClose: () => void;
  isDark: boolean;
}

export default function AttendanceDashboardPage({ onClose, isDark }: AttendanceDashboardPageProps) {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedCommittee, setSelectedCommittee] = useState("All Members");
  const [chartType, setChartType] = useState<"pie" | "donut" | "bar" | "line" | "heatmap">("pie");
  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState<{ status: string; members: string[] } | null>(null);

  // Mock active events
  const activeEvents = [
    { id: "EVT-001", name: "Community Outreach 2025" },
    { id: "EVT-002", name: "Tree Planting Initiative" },
    { id: "EVT-003", name: "Leadership Training Workshop" },
  ];

  const committees = [
    "All Members",
    "All Heads",
    "Community Development",
    "Education & Youth Empowerment",
    "Environmental Conservation",
    "Health & Wellness",
    "Disaster Response",
    "Values Formation",
  ];

  // Mock attendance data
  const attendanceData = [
    { name: "Present", value: 45, color: "#10b981" },
    { name: "Late", value: 12, color: "#f59e0b" },
    { name: "Excused", value: 8, color: "#3b82f6" },
    { name: "Absent", value: 5, color: "#ef4444" },
  ];

  const barChartData = [
    { committee: "Community Dev", Present: 12, Late: 3, Excused: 2, Absent: 1 },
    { committee: "Education", Present: 10, Late: 2, Excused: 1, Absent: 1 },
    { committee: "Environment", Present: 8, Late: 2, Excused: 2, Absent: 1 },
    { committee: "Health", Present: 7, Late: 3, Excused: 1, Absent: 1 },
    { committee: "Disaster", Present: 5, Late: 1, Excused: 1, Absent: 0 },
    { committee: "Values", Present: 3, Late: 1, Excused: 1, Absent: 1 },
  ];

  const handleChartClick = (data: any) => {
    const status = data.name || data.status;
    const mockMembers = [
      "Juan Dela Cruz",
      "Maria Santos",
      "Pedro Reyes",
      "Ana Garcia",
      "Jose Mendoza",
    ];
    setModalData({ status, members: mockMembers });
    setShowModal(true);
  };

  const handleExportPDF = () => {
    toast.success("Exporting to PDF...", {
      description: "Your attendance report is being generated",
    });
  };

  const handleExportSpreadsheet = () => {
    toast.success("Exporting to Spreadsheet...", {
      description: "Your attendance data is being prepared",
    });
  };

  const renderChart = () => {
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
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
                { value: "", label: "Choose an event..." },
                ...activeEvents.map((event) => ({
                  value: event.id,
                  label: event.name,
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
              Select Committee
            </label>
            <CustomDropdown
              value={selectedCommittee}
              onChange={setSelectedCommittee}
              options={committees}
              isDark={isDark}
              size="md"
            />
          </div>
        </div>
      </div>

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
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#ee8724] text-white hover:bg-[#d97618] transition-colors"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
              <button
                onClick={handleExportSpreadsheet}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#fbcb29] text-gray-900 hover:bg-[#e0b624] transition-colors"
                style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Spreadsheet</span>
              </button>
            </div>
          </div>
          {renderChart()}
        </div>
      )}

      {/* Empty State */}
      {!selectedEvent && (
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
            Choose an active event and committee to view attendance analytics
          </p>
        </div>
      )}

      {/* Member List Modal */}
      {showModal && modalData && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-80 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
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
              {modalData.status} Members
            </h3>
            <div className="space-y-2 mb-4">
              {modalData.members.map((member, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg"
                >
                  {member}
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="w-full px-4 py-2 rounded-lg bg-[#f6421f] text-white hover:bg-[#d93819] transition-colors"
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}