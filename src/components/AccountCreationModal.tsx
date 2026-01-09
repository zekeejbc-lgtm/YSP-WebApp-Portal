/**
 * =============================================================================
 * ACCOUNT CREATION MODAL
 * =============================================================================
 * 
 * Modal for creating accounts when approving membership applications.
 * Features:
 * - Username generation/customization
 * - Password generation
 * - Committee designation
 * - Role assignment (Admin, Auditor, User, Banned)
 * - Position selection
 * - Email notification preview
 * 
 * Mobile and Desktop Responsive
 * =============================================================================
 */

import { useState, useEffect } from "react";
import { X, User, Lock, Briefcase, Shield, Mail, CheckCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";
import { MODAL_REGULATIONS, getModalStyles } from "./modal-regulations";

interface AccountCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  applicantData: {
    fullName: string;
    email: string;
    committeePreference: string;
    desiredRole: string;
  };
  onCreateAccount: (accountData: {
    username: string;
    password: string;
    committee: string;
    role: string;
    position: string;
  }) => void;
}

export default function AccountCreationModal({
  isOpen,
  onClose,
  isDark,
  applicantData,
  onCreateAccount,
}: AccountCreationModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [committee, setCommittee] = useState("");
  const [role, setRole] = useState("User");
  const [position, setPosition] = useState("");

  const committees = [
    "Executive Board",
    "Community Development",
    "Environmental Conservation",
    "Youth Development",
    "Health & Wellness",
    "Education & Literacy",
    "Disaster Response",
    "Events Management",
    "Communications & Media",
  ];

  const roles = [
    { value: "Admin", label: "Admin", color: "#ef4444" },
    { value: "Auditor", label: "Auditor", color: "#f59e0b" },
    { value: "User", label: "User", color: "#10b981" },
    { value: "Banned", label: "Banned", color: "#6b7280" },
  ];

  const positions = [
    // Executive Positions
    "Chapter President",
    "Vice President",
    "Secretary",
    "Treasurer",
    "Auditor",
    
    // Committee Heads
    "Committee Chairperson",
    "Vice Chairperson",
    "Committee Secretary",
    
    // Officers
    "Project Coordinator",
    "Events Coordinator",
    "Communications Officer",
    "Outreach Officer",
    "Training Officer",
    
    // Members
    "Active Member",
    "Volunteer Member",
    "Associate Member",
  ];

  // Generate username from full name
  const generateUsername = (name: string): string => {
    const cleaned = name.toLowerCase().replace(/[^a-z\s]/g, "");
    const parts = cleaned.split(" ").filter(p => p);
    
    if (parts.length === 1) {
      return parts[0];
    } else if (parts.length === 2) {
      return parts[0] + "." + parts[1];
    } else {
      // First name + last name
      return parts[0] + "." + parts[parts.length - 1];
    }
  };

  // Generate random password
  const generatePassword = (): string => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
    let pass = "";
    for (let i = 0; i < 12; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pass;
  };

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen && applicantData) {
      setUsername(generateUsername(applicantData.fullName));
      setPassword(generatePassword());
      setCommittee(applicantData.committeePreference);
      setRole("User");
      setPosition(applicantData.desiredRole === "Officer" ? "Project Coordinator" : "Active Member");
    }
  }, [isOpen, applicantData]);

  const handleSubmit = () => {
    // Validation
    if (!username) {
      toast.error("Username is required");
      return;
    }
    if (!password || password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!committee) {
      toast.error("Committee designation is required");
      return;
    }
    if (!position) {
      toast.error("Position is required");
      return;
    }

    onCreateAccount({
      username,
      password,
      committee,
      role,
      position,
    });
  };

  if (!isOpen) return null;

  const modalStyles = getModalStyles(isDark, "medium");

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-8"
      style={{
        background: modalStyles.overlay.background,
        backdropFilter: modalStyles.overlay.backdropFilter,
      }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-hidden animate-in"
        style={{
          maxWidth: modalStyles.panel.maxWidth,
          maxHeight: "calc(100vh - 64px)",
          background: modalStyles.panel.background,
          backdropFilter: modalStyles.panel.backdropFilter,
          border: `${modalStyles.panel.borderWidth} solid ${modalStyles.panel.borderColor}`,
          borderRadius: modalStyles.panel.borderRadius,
          boxShadow: modalStyles.panel.boxShadow,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="p-4 md:p-6 border-b"
          style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            background: `linear-gradient(135deg, ${isDark ? "rgba(16, 185, 129, 0.1)" : "rgba(16, 185, 129, 0.05)"} 0%, ${isDark ? "rgba(251, 203, 41, 0.1)" : "rgba(251, 203, 41, 0.05)"} 100%)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: isDark ? "#6ee7b7" : "#059669",
                }}
              >
                Create Member Account
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                for {applicantData.fullName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body - Scrollable */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6" style={{ minHeight: 0 }}>
          {/* Username */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <User className="w-4 h-4 text-[#f6421f]" />
              Username *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                className="flex-1 px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#10b981] outline-none"
                style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                placeholder="username"
              />
              <button
                onClick={() => setUsername(generateUsername(applicantData.fullName))}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                title="Generate username"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Lowercase letters, numbers, dots, and underscores only
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <Lock className="w-4 h-4 text-[#ee8724]" />
              Password *
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#10b981] outline-none"
                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                  placeholder="••••••••••••"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={() => setPassword(generatePassword())}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                title="Generate password"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Minimum 8 characters. Click refresh to generate a secure password.
            </p>
          </div>

          {/* Committee Designation */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <Briefcase className="w-4 h-4 text-[#fbcb29]" />
              Committee Designation *
            </label>
            <select
              value={committee}
              onChange={(e) => setCommittee(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#10b981] outline-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
            >
              <option value="">Select Committee</option>
              {committees.map((comm) => (
                <option key={comm} value={comm}>
                  {comm}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Preferred: {applicantData.committeePreference}
            </p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <Shield className="w-4 h-4 text-[#f6421f]" />
              System Role *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {roles.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    role === r.value
                      ? "shadow-lg"
                      : "hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                  style={{
                    borderColor: role === r.value ? r.color : isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                    background: role === r.value ? `${r.color}20` : "transparent",
                    color: role === r.value ? r.color : "inherit",
                    fontWeight: role === r.value ? DESIGN_TOKENS.typography.fontWeight.semibold : DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              <strong>Admin:</strong> Full access • <strong>Auditor:</strong> View & review • <strong>User:</strong> Standard access • <strong>Banned:</strong> No access
            </p>
          </div>

          {/* Position */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <Briefcase className="w-4 h-4 text-[#10b981]" />
              Position *
            </label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#10b981] outline-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
            >
              <option value="">Select Position</option>
              <optgroup label="Executive Positions">
                {positions.slice(0, 5).map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Committee Leadership">
                {positions.slice(5, 8).map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Officers">
                {positions.slice(8, 13).map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Members">
                {positions.slice(13).map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Email Notification Preview */}
          <div
            className="p-4 rounded-lg border"
            style={{
              background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-[#10b981]" />
              <h4 style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                Email Notification Preview
              </h4>
            </div>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><strong>To:</strong> {applicantData.email}</p>
              <p><strong>Subject:</strong> Welcome to YSP Tagum Chapter - Your Application Has Been Approved!</p>
              <div className="mt-3 p-3 rounded bg-white dark:bg-gray-800 border" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                <p className="mb-2">Dear {applicantData.fullName},</p>
                <p className="mb-3">Congratulations! Your membership application has been approved.</p>
                <div className="my-3 p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-xs mb-1"><strong>Your Account Details:</strong></p>
                  <p className="text-xs">Username: <strong>{username || "[username]"}</strong></p>
                  <p className="text-xs">Password: <strong>{showPassword ? password : "••••••••••••"}</strong></p>
                  <p className="text-xs mt-2">Committee: <strong>{committee || "[committee]"}</strong></p>
                  <p className="text-xs">Position: <strong>{position || "[position]"}</strong></p>
                  <p className="text-xs">Role: <strong>{role}</strong></p>
                </div>
                <p className="text-xs mt-3">Welcome to YSP Tagum Chapter!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="p-4 md:p-6 border-t flex flex-col sm:flex-row gap-3"
          style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
        >
          <Button variant="secondary" onClick={onClose} className="flex-1 sm:flex-none sm:w-32">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            className="flex-1"
            icon={<CheckCircle className="w-5 h-5" />}
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            }}
          >
            Create Account & Send Email
          </Button>
        </div>
      </div>
    </div>
  );
}
