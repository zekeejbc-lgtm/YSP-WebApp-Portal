/**
 * Enhanced Create/Edit Opportunity Modal
 * Simplified version: just basic info and external link.
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";
import { ApplicationOpportunity } from "./MembershipApplicationsPage";
import CustomDropdown from "./CustomDropdown";

interface CreateOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  opportunity: ApplicationOpportunity | null;
  onSave: (opp: ApplicationOpportunity) => void | Promise<void>;
  isSaving?: boolean;
}

export default function CreateOpportunityModalEnhanced({
  isOpen,
  onClose,
  isDark,
  opportunity,
  onSave,
  isSaving = false,
}: CreateOpportunityModalProps) {
  const [formData, setFormData] = useState<ApplicationOpportunity>({
    id: "",
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    status: "open",
    visibility: "public",
    link: "",
  });

  // Load opportunity data when opening for edit
  useEffect(() => {
    if (opportunity) {
      setFormData(opportunity);
    } else {
      // Set default dates if creating new
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(now.getMonth() + 1);
      
      // Format to YYYY-MM-DDTHH:mm for datetime-local input
      const formatForInput = (date: Date) => {
        // Handle timezone offset to ensure local time is displayed correctly in input
        const offset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - offset);
        return localDate.toISOString().slice(0, 16);
      };

      setFormData({
        id: "",
        title: "",
        description: "",
        startDate: formatForInput(now),
        endDate: formatForInput(nextMonth),
        status: "open",
        visibility: "public",
        link: "",
      });
    }
  }, [opportunity, isOpen]);

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formData.description.trim()) {
      toast.error("Description is required");
      return;
    }
    if (!formData.startDate) {
      toast.error("Start date is required");
      return;
    }
    if (!formData.endDate) {
      toast.error("End date is required");
      return;
    }
    if (!formData.link.trim()) {
      toast.error("Link is required");
      return;
    }

    await Promise.resolve(onSave(formData));
  };

  if (!isOpen) return null;

  const modal = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          background: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
          <h3
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              color: DESIGN_TOKENS.colors.brand.red,
            }}
          >
            {opportunity ? "Edit Opportunity" : "Create New Opportunity"}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
              placeholder="e.g., Membership Registration 2026"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none resize-none"
              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
              rows={4}
              placeholder="Enter details about this opportunity..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                Start Date & Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                />
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                End Date & Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                />
              </div>
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
              Link (URL) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                className="w-full pl-10 pr-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                placeholder="https://forms.google.com/..."
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Link to Google Form or other external registration page.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status - Custom Dropdown */}
            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                Status
              </label>
              <CustomDropdown
                value={formData.status}
                onChange={(value) => setFormData({ ...formData, status: value as any })}
                options={[
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                  { value: "completed", label: "Completed" },
                  { value: "archived", label: "Archived" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>

            {/* Visibility - Custom Dropdown */}
            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                Visibility
              </label>
              <CustomDropdown
                value={formData.visibility}
                onChange={(value) => setFormData({ ...formData, visibility: value as any })}
                options={[
                  { value: "public", label: "Public" },
                  { value: "hidden", label: "Hidden" },
                ]}
                isDark={isDark}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t flex-shrink-0" style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}>
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="flex-1" disabled={isSaving}>
            {isSaving ? (opportunity ? "Updating..." : "Creating...") : "Create"}
          </Button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return modal;
  return createPortal(modal, document.body);
}
