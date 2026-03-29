/**
 * =============================================================================
 * ACCOUNT CREATION MODAL
 * =============================================================================
 *
 * Modal for creating accounts when approving membership applications.
 * =============================================================================
 */

import { useState, useEffect, useMemo } from "react";
import { X, User, Lock, Briefcase, Shield, Mail, CheckCircle, RefreshCw, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";
import { getModalStyles } from "./modal-regulations";
import type { SystemRole } from "../types/app";
import { YSP_COMMITTEE_NAMES } from "../constants/committees";
import { orgConfig } from "../config/org.config";

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
  }) => void | Promise<void>;
  availableRoles?: SystemRole[];
}

const FALLBACK_ROLES: SystemRole[] = [
  {
    name: "Auditor",
    powerLevel: 10,
    color: "#f59e0b",
    permissions: {
      canManageUsers: true,
      canAccessSystemTools: true,
      canExportData: true,
      canEditContent: true,
      canApproveMembers: true,
      canManageEvents: true,
    },
  },
  {
    name: "Assistant Auditor 1",
    powerLevel: 9,
    color: "#d97706",
    permissions: {
      canManageUsers: true,
      canAccessSystemTools: true,
      canExportData: true,
      canEditContent: true,
      canApproveMembers: true,
      canManageEvents: true,
    },
  },
  {
    name: "Assistant Auditor 2",
    powerLevel: 9,
    color: "#d97706",
    permissions: {
      canManageUsers: true,
      canAccessSystemTools: true,
      canExportData: true,
      canEditContent: true,
      canApproveMembers: true,
      canManageEvents: true,
    },
  },
  {
    name: "Admin",
    powerLevel: 8,
    color: "#ef4444",
    permissions: {
      canManageUsers: true,
      canAccessSystemTools: true,
      canExportData: true,
      canEditContent: true,
      canApproveMembers: true,
      canManageEvents: true,
    },
  },
  {
    name: "Assistant Admin 1",
    powerLevel: 7,
    color: "#dc2626",
    permissions: {
      canManageUsers: true,
      canAccessSystemTools: true,
      canExportData: false,
      canEditContent: true,
      canApproveMembers: true,
      canManageEvents: true,
    },
  },
  {
    name: "Assistant Admin 2",
    powerLevel: 7,
    color: "#dc2626",
    permissions: {
      canManageUsers: true,
      canAccessSystemTools: true,
      canExportData: false,
      canEditContent: true,
      canApproveMembers: true,
      canManageEvents: true,
    },
  },
  {
    name: "Founder",
    powerLevel: 6,
    color: "#7c3aed",
    permissions: {
      canManageUsers: false,
      canAccessSystemTools: false,
      canExportData: false,
      canEditContent: true,
      canApproveMembers: true,
      canManageEvents: true,
    },
  },
  {
    name: `${orgConfig.chapterName} President`,
    powerLevel: 5,
    color: "#059669",
    permissions: {
      canManageUsers: false,
      canAccessSystemTools: false,
      canExportData: false,
      canEditContent: true,
      canApproveMembers: true,
      canManageEvents: true,
    },
  },
  {
    name: "Barangay Chapter President",
    powerLevel: 4,
    color: "#10b981",
    permissions: {
      canManageUsers: false,
      canAccessSystemTools: false,
      canExportData: false,
      canEditContent: true,
      canApproveMembers: false,
      canManageEvents: true,
    },
  },
  {
    name: "Member",
    powerLevel: 2,
    color: "#3b82f6",
    permissions: {
      canManageUsers: false,
      canAccessSystemTools: false,
      canExportData: false,
      canEditContent: false,
      canApproveMembers: false,
      canManageEvents: false,
    },
  },
  {
    name: "Volunteer",
    powerLevel: 2,
    color: "#6366f1",
    permissions: {
      canManageUsers: false,
      canAccessSystemTools: false,
      canExportData: false,
      canEditContent: false,
      canApproveMembers: false,
      canManageEvents: false,
    },
  },
  {
    name: "Guest",
    powerLevel: 1,
    color: "#9ca3af",
    permissions: {
      canManageUsers: false,
      canAccessSystemTools: false,
      canExportData: false,
      canEditContent: false,
      canApproveMembers: false,
      canManageEvents: false,
    },
  },
  {
    name: "Suspended",
    powerLevel: 0,
    color: "#6b7280",
    permissions: {
      canManageUsers: false,
      canAccessSystemTools: false,
      canExportData: false,
      canEditContent: false,
      canApproveMembers: false,
      canManageEvents: false,
    },
  },
  {
    name: "Banned",
    powerLevel: 0,
    color: "#1f2937",
    permissions: {
      canManageUsers: false,
      canAccessSystemTools: false,
      canExportData: false,
      canEditContent: false,
      canApproveMembers: false,
      canManageEvents: false,
    },
  },
];

function generatePasswordValue(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let pass = "";
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export default function AccountCreationModal({
  isOpen,
  onClose,
  isDark,
  applicantData,
  onCreateAccount,
  availableRoles = [],
}: AccountCreationModalProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [committee, setCommittee] = useState("");
  const [role, setRole] = useState("Member");
  const [position, setPosition] = useState("");

  const committees = YSP_COMMITTEE_NAMES;

  const roleOptions = useMemo(() => {
    const source = availableRoles.length > 0 ? availableRoles : FALLBACK_ROLES;
    return [...source].sort((a, b) => {
      if (b.powerLevel !== a.powerLevel) return b.powerLevel - a.powerLevel;
      return a.name.localeCompare(b.name);
    });
  }, [availableRoles]);

  const generateUsername = (name: string): string => {
    const cleaned = name.toLowerCase().replace(/[^a-z\s]/g, "");
    const parts = cleaned.split(" ").filter((p) => p);

    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]}.${parts[1]}`;
    return `${parts[0]}.${parts[parts.length - 1]}`;
  };

  const generatedDefaults = useMemo(() => {
    if (!isOpen || !applicantData) return null;
    return {
      username: generateUsername(applicantData.fullName),
      password: generatePasswordValue(),
      committee: applicantData.committeePreference,
      role: roleOptions[0]?.name || "Member",
      position: applicantData.desiredRole === "Officer" ? "Documentation Officer" : "Member",
    };
  }, [isOpen, applicantData, roleOptions]);

  useEffect(() => {
    if (!generatedDefaults) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUsername(generatedDefaults.username);
    setPassword(generatedDefaults.password);
    setCommittee(generatedDefaults.committee);
    setRole(generatedDefaults.role);
    setPosition(generatedDefaults.position);
  }, [generatedDefaults]);

  const handleSubmit = () => {
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
    if (!role) {
      toast.error("System role is required");
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
      className="fixed inset-0 z-120 flex items-center justify-center p-4 md:p-8"
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
              <p className="text-sm text-muted-foreground mt-1">for {applicantData.fullName}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-6" style={{ minHeight: 0 }}>
          <div>
            <label className="text-sm mb-2 inline-flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
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
            <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, dots, and underscores only</p>
          </div>

          <div>
            <label className="text-sm mb-2 inline-flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
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
                  placeholder="************"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                onClick={() => setPassword(generatePasswordValue())}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
                title="Generate password"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters. Click refresh to generate a secure password.</p>
          </div>

          <div>
            <label className="text-sm mb-2 inline-flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
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
            <p className="text-xs text-muted-foreground mt-1">Preferred: {applicantData.committeePreference}</p>
          </div>

          <div>
            <label className="text-sm mb-2 inline-flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <Shield className="w-4 h-4 text-[#f6421f]" />
              System Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#10b981] outline-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
            >
              <option value="">Select Role</option>
              {roleOptions.map((roleOption) => (
                <option key={roleOption.name} value={roleOption.name}>
                  {roleOption.name} (Level {roleOption.powerLevel})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm mb-2 inline-flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
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
              <optgroup label="Executive Council">
                <option value={`${orgConfig.chapterName} President`}>{orgConfig.chapterName} President</option>
                <option value="Membership and Internal Affairs Officer">Membership and Internal Affairs Officer</option>
                <option value="External Relations Officer">External Relations Officer</option>
                <option value="Secretary and Documentation Officer">Secretary and Documentation Officer</option>
                <option value="Finance and Treasury Officer">Finance and Treasury Officer</option>
                <option value="Communications and Marketing Officer">Communications and Marketing Officer</option>
                <option value="Program Development Officer">Program Development Officer</option>
              </optgroup>
              <optgroup label="Secretariat and Documentation Committee">
                <option value="Documentation Officer">Documentation Officer</option>
                <option value="Records and Filing Officer">Records and Filing Officer</option>
                <option value="Schedule and Agenda Encoder">Schedule and Agenda Encoder</option>
              </optgroup>
              <optgroup label="Finance and Treasury Committee">
                <option value="Funds and Disbursement Officer">Funds and Disbursement Officer</option>
                <option value="Documentation and Liquidation Officer">Documentation and Liquidation Officer</option>
              </optgroup>
              <optgroup label="Communications and Marketing Committee">
                <option value="Communications and Media Visuals Officer">Communications and Media Visuals Officer</option>
                <option value="Marketing and Social Media Management Officer">Marketing and Social Media Management Officer</option>
                <option value="Visual Documentation Specialist">Visual Documentation Specialist</option>
                <option value="Digital Content Production Specialist">Digital Content Production Specialist</option>
              </optgroup>
              <optgroup label="External Relations Committee">
                <option value="External Affairs Liaison Officer">External Affairs Liaison Officer</option>
                <option value="Communications and Public Relations Officer">Communications and Public Relations Officer</option>
                <option value="Monitoring and Reporting Officer">Monitoring and Reporting Officer</option>
                <option value="Strategic Partnership Relations Officer">Strategic Partnership Relations Officer</option>
              </optgroup>
              <optgroup label="Membership and Internal Affairs Committee">
                <option value="Conduct and Membership Officer">Conduct and Membership Officer</option>
                <option value="Internal Resource Custodian">Internal Resource Custodian</option>
                <option value="Engagement and Welfare Officer">Engagement and Welfare Officer</option>
                <option value="Recognition and Awards Officer">Recognition and Awards Officer</option>
                <option value="Volunteer and Designation Officer">Volunteer and Designation Officer</option>
              </optgroup>
              <optgroup label="Program Development Committee">
                <option value="Community Engagement Officer">Community Engagement Officer</option>
                <option value="Documentation and Reporting Officer">Documentation and Reporting Officer</option>
              </optgroup>
              <optgroup label="Chapter Leadership">
                <option value="Barangay Chapter President">Barangay Chapter President</option>
              </optgroup>
              <optgroup label="General">
                <option value="Member">Member</option>
                <option value="Committee Member">Committee Member</option>
                <option value="Volunteer">Volunteer</option>
                <option value="Guest">Guest</option>
                <option value="Suspended">Suspended</option>
                <option value="Banned">Banned</option>
              </optgroup>
            </select>
          </div>

          <div
            className="p-4 rounded-lg border"
            style={{
              background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-[#10b981]" />
              <h4 style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Email Notification Preview</h4>
            </div>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><strong>To:</strong> {applicantData.email}</p>
              <p><strong>Subject:</strong> Welcome to {orgConfig.shortName} - Your Application Has Been Approved!</p>
              <div className="mt-3 p-3 rounded bg-white dark:bg-gray-800 border" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                <p className="mb-2">Dear {applicantData.fullName},</p>
                <p className="mb-3">Congratulations! Your membership application has been approved.</p>
                <div className="my-3 p-3 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-xs mb-1"><strong>Your Account Details:</strong></p>
                  <p className="text-xs">Username: <strong>{username || "[username]"}</strong></p>
                  <p className="text-xs">Password: <strong>{showPassword ? password : "************"}</strong></p>
                  <p className="text-xs mt-2">Committee: <strong>{committee || "[committee]"}</strong></p>
                  <p className="text-xs">Position: <strong>{position || "[position]"}</strong></p>
                  <p className="text-xs">Role: <strong>{role}</strong></p>
                </div>
                <p className="text-xs mt-3">Welcome to {orgConfig.shortName}!</p>
              </div>
            </div>
          </div>
        </div>

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
            Create Account and Send Email
          </Button>
        </div>
      </div>
    </div>
  );
}
