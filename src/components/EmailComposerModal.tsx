/**
 * =============================================================================
 * EMAIL COMPOSER MODAL
 * =============================================================================
 * 
 * Modal for composing and sending emails to applicants/members.
 * Features:
 * - To/CC/BCC fields
 * - Subject line
 * - Rich text email body
 * - Email templates
 * - Send functionality
 * 
 * Mobile and Desktop Responsive
 * =============================================================================
 */

import { useState } from "react";
import { X, Mail, Send, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";
import { MODAL_REGULATIONS, getModalStyles } from "./modal-regulations";

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  recipientEmail: string;
  recipientName?: string;
}

export default function EmailComposerModal({
  isOpen,
  onClose,
  isDark,
  recipientEmail,
  recipientName,
}: EmailComposerModalProps) {
  const [to, setTo] = useState(recipientEmail);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);

  const emailTemplates = [
    {
      name: "Welcome Message",
      subject: "Welcome to YSP Tagum Chapter!",
      body: `Dear ${recipientName || "[Name]"},\n\nWelcome to Youth Service Philippines - Tagum Chapter! We're thrilled to have you join our community of passionate youth leaders.\n\nYour journey with us begins now. We look forward to working with you on various community projects and initiatives.\n\nBest regards,\nYSP Tagum Chapter`,
    },
    {
      name: "Follow-up Request",
      subject: "Additional Information Required - YSP Application",
      body: `Dear ${recipientName || "[Name]"},\n\nThank you for your application to YSP Tagum Chapter. We need some additional information to complete your application review.\n\nPlease provide:\n- [Specify required documents/information]\n\nKindly respond to this email at your earliest convenience.\n\nBest regards,\nYSP Tagum Chapter`,
    },
    {
      name: "Event Invitation",
      subject: "You're Invited: YSP Community Event",
      body: `Dear ${recipientName || "[Name]"},\n\nWe're excited to invite you to our upcoming community event!\n\nEvent: [Event Name]\nDate: [Date]\nTime: [Time]\nVenue: [Location]\n\nPlease confirm your attendance by replying to this email.\n\nBest regards,\nYSP Tagum Chapter`,
    },
    {
      name: "General Inquiry",
      subject: "Regarding Your YSP Application",
      body: `Dear ${recipientName || "[Name]"},\n\n[Your message here]\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nYSP Tagum Chapter`,
    },
  ];

  const handleTemplateSelect = (template: typeof emailTemplates[0]) => {
    setSubject(template.subject);
    setBody(template.body);
    toast.success("Template applied!");
  };

  const handleSend = () => {
    // Validation
    if (!to.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    if (!subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!body.trim()) {
      toast.error("Email body cannot be empty");
      return;
    }

    // Simulate sending email
    toast.success("Email Sent Successfully!", {
      description: `Email sent to ${to}`,
    });

    onClose();
  };

  if (!isOpen) return null;

  const modalStyles = getModalStyles(isDark, "large");

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
            background: `linear-gradient(135deg, ${isDark ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.05)"} 0%, ${isDark ? "rgba(37, 99, 235, 0.1)" : "rgba(37, 99, 235, 0.05)"} 100%)`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <h2
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: "#3b82f6",
                }}
              >
                Compose Email
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Send email to {recipientName || recipientEmail}
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
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4" style={{ minHeight: 0 }}>
          {/* Email Templates */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <Sparkles className="w-4 h-4 text-[#fbcb29]" />
              Quick Templates
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {emailTemplates.map((template) => (
                <button
                  key={template.name}
                  onClick={() => handleTemplateSelect(template)}
                  className="px-3 py-2 rounded-lg border text-sm hover:border-[#3b82f6] hover:bg-[#3b82f6]/10 transition-all"
                  style={{
                    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                    fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                  }}
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>

          {/* To Field */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <Mail className="w-4 h-4 text-[#3b82f6]" />
              To *
            </label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#3b82f6] outline-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
              placeholder="recipient@email.com"
            />
          </div>

          {/* CC/BCC Toggle */}
          {!showCcBcc && (
            <button
              onClick={() => setShowCcBcc(true)}
              className="text-sm text-[#3b82f6] hover:underline"
              style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.medium }}
            >
              + Add CC/BCC
            </button>
          )}

          {/* CC Field */}
          {showCcBcc && (
            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                CC
              </label>
              <input
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#3b82f6] outline-none"
                style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                placeholder="cc@email.com (optional)"
              />
            </div>
          )}

          {/* BCC Field */}
          {showCcBcc && (
            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                BCC
              </label>
              <input
                type="email"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#3b82f6] outline-none"
                style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                placeholder="bcc@email.com (optional)"
              />
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-sm mb-2 flex items-center gap-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              <FileText className="w-4 h-4 text-[#ee8724]" />
              Subject *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#3b82f6] outline-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
              placeholder="Email subject"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Message *
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#3b82f6] outline-none resize-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
              rows={12}
              placeholder="Write your message here..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              {body.length} characters
            </p>
          </div>

          {/* Email Signature */}
          <div
            className="p-4 rounded-lg border"
            style={{
              background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <p className="text-xs text-muted-foreground mb-1">Email Signature (auto-appended):</p>
            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
              <p style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>Youth Service Philippines</p>
              <p>Tagum Chapter</p>
              <p>Email: ysp.tagum@ysp.org.ph</p>
              <p>Website: www.ysp.org.ph</p>
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
            onClick={handleSend}
            className="flex-1"
            icon={<Send className="w-5 h-5" />}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
            }}
          >
            Send Email
          </Button>
        </div>
      </div>
    </div>
  );
}
