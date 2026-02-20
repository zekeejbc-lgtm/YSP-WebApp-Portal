/**
 * Enhanced Create/Edit Opportunity Modal
 * Simplified version: just basic info and external link.
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, Calendar, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";
import { ApplicationOpportunity } from "./MembershipApplicationsPage";
import CustomDropdown from "./CustomDropdown";

const OPPORTUNITIES_PAGE_LINK = "/guest?page=Opportunities";

interface CreateOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  opportunity: ApplicationOpportunity | null;
  onSave: (opp: ApplicationOpportunity) => void | Promise<void>;
  isSaving?: boolean;
}

function createInitialFormData(opportunity: ApplicationOpportunity | null): ApplicationOpportunity {
  if (opportunity) return opportunity;

  const now = new Date();
  const nextMonth = new Date();
  nextMonth.setMonth(now.getMonth() + 1);

  // Handle timezone offset to ensure local time is displayed correctly in input.
  const formatForInput = (date: Date) => {
    const offset = date.getTimezoneOffset() * 60000;
    const localDate = new Date(date.getTime() - offset);
    return localDate.toISOString().slice(0, 16);
  };

  return {
    id: "",
    title: "",
    description: "",
    startDate: formatForInput(now),
    endDate: formatForInput(nextMonth),
    status: "open",
    visibility: "public",
    link: "",
  };
}

function normalizeOpportunityLinkInput(rawLink: string): string {
  const trimmed = rawLink.trim();
  const guestAliases = new Set([
    "/guest",
    "guest",
    "opportunities",
    "opportunity",
    "be-a-member",
    "be a member",
    "/guest?page=opportunities",
    "/guest?page=membershipapplications",
  ]);
  if (guestAliases.has(trimmed.toLowerCase())) return OPPORTUNITIES_PAGE_LINK;
  return trimmed;
}

function isAllowedOpportunityLink(rawLink: string): boolean {
  const normalized = normalizeOpportunityLinkInput(rawLink);
  if (normalized === OPPORTUNITIES_PAGE_LINK) return true;
  try {
    // Accept only absolute HTTP(S) for external links.
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default function CreateOpportunityModalEnhanced({
  isOpen,
  onClose,
  isDark,
  opportunity,
  onSave,
  isSaving = false,
}: CreateOpportunityModalProps) {
  const [formData, setFormData] = useState<ApplicationOpportunity>(() => createInitialFormData(opportunity));

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
    if (!isAllowedOpportunityLink(formData.link)) {
      toast.error("Use a valid URL (https://...) or /guest?page=Opportunities");
      return;
    }

    await Promise.resolve(onSave({
      ...formData,
      link: normalizeOpportunityLinkInput(formData.link),
    }));
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
                type="text"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                className="w-full pl-10 pr-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                placeholder="https://forms.google.com/... or /guest?page=Opportunities"
              />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, link: OPPORTUNITIES_PAGE_LINK })}
                className="px-3 py-1.5 rounded-lg text-xs border bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.12)" }}
              >
                Use Opportunities page
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Use external URL or set <code>/guest?page=Opportunities</code> for the Opportunities page.
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
                onChange={(value) => setFormData({ ...formData, status: value as ApplicationOpportunity["status"] })}
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
                onChange={(value) => setFormData({ ...formData, visibility: value as ApplicationOpportunity["visibility"] })}
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
