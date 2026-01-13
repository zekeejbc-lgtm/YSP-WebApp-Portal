/**
 * =============================================================================
 * STATUS CHIP MASTER COMPONENT
 * =============================================================================
 * 
 * Standardized status chip for attendance and other states:
 * - Consistent sizing (28px height, 8px radius)
 * - Status color tokens (Present, Late, Excused, Absent)
 * - Centered text
 * 
 * SMART SPEC COMPLIANCE:
 * ✅ Height: 28px
 * ✅ Border radius: 8px
 * ✅ Status color tokens
 * ✅ Center-aligned text
 * 
 * =============================================================================
 */

import { DESIGN_TOKENS, getStatusColor } from "./tokens";

type StatusType = "present" | "late" | "excused" | "absent" | "active" | "inactive" | "pending" | "verified" | "rejected" | "success" | "failed" | "warning";

interface StatusChipProps {
  status: StatusType | string; // Allow string for flexibility
  label?: string;
  size?: "sm" | "md";
  customColor?: string;
}

export default function StatusChip({ status, label, size = "md", customColor }: StatusChipProps) {
  const getStatusStyles = () => {
    if (customColor) {
      return {
        backgroundColor: customColor,
        color: "white",
        label: label || status,
      };
    }
    switch (status) {
      case "present":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.present,
          color: "white",
          label: label || "Present",
        };
      case "late":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.late,
          color: "white",
          label: label || "Late",
        };
      case "excused":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.excused,
          color: "white",
          label: label || "Excused",
        };
      case "absent":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.absent,
          color: "white",
          label: label || "Absent",
        };
      case "active":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.present,
          color: "white",
          label: label || "Active",
        };
      case "inactive":
        return {
          backgroundColor: "#6b7280",
          color: "white",
          label: label || "Inactive",
        };
      case "pending":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.late,
          color: "white",
          label: label || "Pending",
        };
      case "verified":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.present,
          color: "white",
          label: label || "Verified",
        };
      case "rejected":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.absent,
          color: "white",
          label: label || "Rejected",
        };
      case "success":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.present,
          color: "white",
          label: label || "Success",
        };
      case "failed":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.absent,
          color: "white",
          label: label || "Failed",
        };
      case "warning":
        return {
          backgroundColor: DESIGN_TOKENS.colors.status.late,
          color: "white",
          label: label || "Warning",
        };
      default:
        return {
          backgroundColor: "#6b7280",
          color: "white",
          label: label || status,
        };
    }
  };

  const statusStyles = getStatusStyles();
  const chipHeight = size === "sm" ? 24 : DESIGN_TOKENS.table.statusChip.height;
  const fontSize = size === "sm" ? DESIGN_TOKENS.typography.fontSize.caption : DESIGN_TOKENS.typography.fontSize.body;

  return (
    <span
      className="inline-flex items-center justify-center px-3"
      style={{
        height: `${chipHeight}px`,
        borderRadius: `${DESIGN_TOKENS.table.statusChip.radius}px`,
        backgroundColor: statusStyles.backgroundColor,
        color: statusStyles.color,
        fontSize: `${fontSize}px`,
        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
        whiteSpace: "nowrap",
      }}
    >
      {statusStyles.label}
    </span>
  );
}
