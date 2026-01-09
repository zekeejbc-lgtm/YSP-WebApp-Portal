/**
 * =============================================================================
 * REJECTION MODAL
 * =============================================================================
 * 
 * Modal for rejecting membership applications with reason and custom message.
 * Features:
 * - Predefined rejection reasons
 * - Custom rejection message
 * - Internal admin notes
 * - Email preview
 * - Send rejection email
 * 
 * Mobile and Desktop Responsive
 * =============================================================================
 */

import { useState } from "react";
import { X, XCircle, Mail, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";
import { MODAL_REGULATIONS, getModalStyles } from "./modal-regulations";

interface RejectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  applicantData: {
    fullName: string;
    email: string;
  };
  onReject: (rejectionData: {
    reason: string;
    customMessage: string;
    adminNotes: string;
  }) => void;
}

export default function RejectionModal({
  isOpen,
  onClose,
  isDark,
  applicantData,
  onReject,
}: RejectionModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [adminNotes, setAdminNotes] = useState("");

  const rejectionReasons = [
    "Incomplete application form",
    "Did not meet minimum age requirement",
    "Insufficient qualifications for desired role",
    "Committee already at full capacity",
    "Failed background verification",
    "Duplicate application",
    "Does not align with YSP mission and values",
    "Other (please specify in message)",
  ];

  const handleSubmit = () => {
    // Validation
    if (!selectedReason) {
      toast.error("Please select a rejection reason");
      return;
    }
    if (!customMessage.trim()) {
      toast.error("Please provide a message to the applicant");
      return;
    }

    onReject({
      reason: selectedReason,
      customMessage,
      adminNotes,
    });
  };

  // Auto-fill message based on reason
  const handleReasonChange = (reason: string) => {
    setSelectedReason(reason);
    
    // Auto-generate message template based on reason
    const templates: Record<string, string> = {
      "Incomplete application form": `Dear ${applicantData.fullName},\n\nThank you for your interest in joining Youth Service Philippines - Tagum Chapter. Unfortunately, we cannot process your application at this time as the submitted form is incomplete.\n\nWe encourage you to resubmit your application with all required information.\n\nBest regards,\nYSP Tagum Chapter`,
      "Did not meet minimum age requirement": `Dear ${applicantData.fullName},\n\nThank you for your interest in joining YSP Tagum Chapter. Unfortunately, applicants must meet our minimum age requirement to participate in our programs.\n\nWe appreciate your enthusiasm and encourage you to apply again when you meet the eligibility criteria.\n\nBest regards,\nYSP Tagum Chapter`,
      "Committee already at full capacity": `Dear ${applicantData.fullName},\n\nThank you for your application to YSP Tagum Chapter. We appreciate your interest in joining our team. Unfortunately, the committee you selected is currently at full capacity.\n\nWe encourage you to reapply for a different committee or check back with us in the future.\n\nBest regards,\nYSP Tagum Chapter`,
    };

    if (templates[reason]) {
      setCustomMessage(templates[reason]);
    } else {
      setCustomMessage(`Dear ${applicantData.fullName},\n\nThank you for your interest in joining Youth Service Philippines - Tagum Chapter.\n\n[Please provide specific details about the rejection]\n\nBest regards,\nYSP Tagum Chapter`);
    }
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
            background: `linear-gradient(135deg, ${isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)"} 0%, ${isDark ? "rgba(220, 38, 38, 0.1)" : "rgba(220, 38, 38, 0.05)"} 100%)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: "#ef4444",
                }}
              >
                Reject Application
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
          {/* Warning Banner */}
          <div
            className="flex items-start gap-3 p-4 rounded-lg border"
            style={{
              background: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(254, 226, 226, 0.8)",
              borderColor: "#ef4444",
            }}
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold, color: "#ef4444" }}>
                This action cannot be undone
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The applicant will receive a rejection email and their application will be permanently marked as rejected.
              </p>
            </div>
          </div>

          {/* Rejection Reason */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <XCircle className="w-4 h-4 text-[#ef4444]" />
              Rejection Reason *
            </label>
            <select
              value={selectedReason}
              onChange={(e) => handleReasonChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#ef4444] outline-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
            >
              <option value="">Select a reason</option>
              {rejectionReasons.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              This will be recorded internally and used for analytics
            </p>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <Mail className="w-4 h-4 text-[#3b82f6]" />
              Message to Applicant *
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#ef4444] outline-none resize-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
              rows={8}
              placeholder="Write a professional and respectful message to the applicant..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              This message will be sent to {applicantData.email}
            </p>
          </div>

          {/* Internal Admin Notes */}
          <div>
            <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Internal Admin Notes (Optional)
            </label>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#ef4444] outline-none resize-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
              rows={3}
              placeholder="Internal notes (not visible to applicant)..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              These notes are only visible to admins and auditors
            </p>
          </div>

          {/* Email Preview */}
          <div
            className="p-4 rounded-lg border"
            style={{
              background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-[#3b82f6]" />
              <h4 style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                Email Preview
              </h4>
            </div>
            <div className="text-sm space-y-2 text-muted-foreground">
              <p><strong>To:</strong> {applicantData.email}</p>
              <p><strong>Subject:</strong> YSP Tagum Chapter - Application Update</p>
              <div className="mt-3 p-3 rounded bg-white dark:bg-gray-800 border" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
                <p className="text-xs whitespace-pre-wrap">{customMessage || "[Your message will appear here]"}</p>
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
            icon={<XCircle className="w-5 h-5" />}
            style={{
              background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
            }}
          >
            Reject & Send Email
          </Button>
        </div>
      </div>
    </div>
  );
}
