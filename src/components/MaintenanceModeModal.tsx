/**
 * =============================================================================
 * MAINTENANCE MODE CONFIGURATION MODAL
 * =============================================================================
 * 
 * Modal for configuring maintenance mode settings
 * Mobile and Desktop Responsive
 * 
 * =============================================================================
 */

import { useState } from "react";
import { X, Wrench, Calendar, Clock } from "lucide-react";
import { DESIGN_TOKENS, Button } from "./design-system";
import { MODAL_REGULATIONS, getModalStyles, getHeaderGradient } from "./modal-regulations";

interface MaintenanceModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (config: MaintenanceFormData) => void;
  title: string;
  isDark: boolean;
}

export interface MaintenanceFormData {
  reason: string;
  estimatedTime: string;
  maintenanceDate: string;
  durationDays: number;
}

export default function MaintenanceModeModal({
  isOpen,
  onClose,
  onProceed,
  title,
  isDark,
}: MaintenanceModeModalProps) {
  const [formData, setFormData] = useState<MaintenanceFormData>({
    reason: "",
    estimatedTime: "",
    maintenanceDate: "",
    durationDays: 0,
  });

  if (!isOpen) return null;

  const handleProceed = () => {
    if (!formData.reason.trim()) {
      alert("Please provide a reason for maintenance");
      return;
    }
    onProceed(formData);
    onClose();
    setFormData({ reason: "", estimatedTime: "", maintenanceDate: "", durationDays: 0 });
  };

  const handleClose = () => {
    onClose();
    setFormData({ reason: "", estimatedTime: "", maintenanceDate: "", durationDays: 0 });
  };

  const modalStyles = getModalStyles(isDark, "medium");

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 md:p-8"
      style={{
        background: modalStyles.overlay.background,
        backdropFilter: modalStyles.overlay.backdropFilter,
        zIndex: 9999, // Must be above PageLayout header (z-200)
      }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-hidden"
        style={{
          maxWidth: modalStyles.panel.maxWidth,
          maxHeight: MODAL_REGULATIONS.panel.maxHeight,
          background: modalStyles.panel.background,
          backdropFilter: modalStyles.panel.backdropFilter,
          border: `${modalStyles.panel.borderWidth} solid ${modalStyles.panel.borderColor}`,
          borderRadius: modalStyles.panel.borderRadius,
          boxShadow: modalStyles.panel.boxShadow,
          transition: MODAL_REGULATIONS.transitions.normal,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-5 md:px-6 border-b"
          style={{
            background: getHeaderGradient(isDark, "red"),
            borderColor: modalStyles.header.borderColor,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 md:p-2.5 rounded-lg"
              style={{
                backgroundColor: `${DESIGN_TOKENS.colors.brand.red}20`,
                color: DESIGN_TOKENS.colors.brand.red,
              }}
            >
              <Wrench className="w-5 h-5" />
            </div>
            <h2
              className="text-base md:text-lg"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              }}
            >
              {title}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg transition-colors active:scale-95"
            style={{
              background: "transparent",
              transition: MODAL_REGULATIONS.transitions.fast,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark
                ? MODAL_REGULATIONS.closeButton.background.hover.dark
                : MODAL_REGULATIONS.closeButton.background.hover.light;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Scrollable */}
        <div
          className="overflow-y-auto px-4 py-5 md:px-6 md:py-6"
          style={{
            maxHeight: "calc(85vh - 160px)",
          }}
        >
          <div className="space-y-4 md:space-y-5">
            {/* Reason */}
            <div>
              <label
                htmlFor="reason"
                className="flex items-center gap-1 mb-2 text-sm md:text-base"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                Reason for Maintenance <span style={{ color: DESIGN_TOKENS.colors.brand.red }}>*</span>
              </label>
              <textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Server upgrades, Database optimization, Security updates"
                rows={3}
                className="w-full px-3 py-2.5 md:px-4 md:py-3 rounded-lg border text-sm md:text-base focus:outline-none focus:ring-2 transition-all"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.9)",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = DESIGN_TOKENS.colors.brand.red;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${DESIGN_TOKENS.colors.brand.red}20`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Estimated Time */}
            <div>
              <label
                htmlFor="estimatedTime"
                className="flex items-center gap-2 mb-2 text-sm md:text-base"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                <Clock className="w-4 h-4" />
                Estimated Completion Time
              </label>
              <input
                id="estimatedTime"
                type="text"
                value={formData.estimatedTime}
                onChange={(e) => setFormData({ ...formData, estimatedTime: e.target.value })}
                placeholder="e.g., 30 minutes, 2 hours, 1 day"
                className="w-full px-3 py-2.5 md:px-4 md:py-3 rounded-lg border text-sm md:text-base focus:outline-none focus:ring-2 transition-all"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.9)",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = DESIGN_TOKENS.colors.brand.red;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${DESIGN_TOKENS.colors.brand.red}20`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Maintenance Date */}
            <div>
              <label
                htmlFor="maintenanceDate"
                className="flex items-center gap-2 mb-2 text-sm md:text-base"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                <Calendar className="w-4 h-4" />
                Maintenance Date
              </label>
              <input
                id="maintenanceDate"
                type="date"
                value={formData.maintenanceDate}
                onChange={(e) => setFormData({ ...formData, maintenanceDate: e.target.value })}
                className="w-full px-3 py-2.5 md:px-4 md:py-3 rounded-lg border text-sm md:text-base focus:outline-none focus:ring-2 transition-all"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.9)",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = DESIGN_TOKENS.colors.brand.red;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${DESIGN_TOKENS.colors.brand.red}20`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {/* Duration Days */}
            <div>
              <label
                htmlFor="durationDays"
                className="flex items-center gap-2 mb-2 text-sm md:text-base"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                }}
              >
                Duration (Days)
              </label>
              <input
                id="durationDays"
                type="number"
                min="0"
                value={formData.durationDays}
                onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="w-full px-3 py-2.5 md:px-4 md:py-3 rounded-lg border text-sm md:text-base focus:outline-none focus:ring-2 transition-all"
                style={{
                  background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.9)",
                  borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = DESIGN_TOKENS.colors.brand.red;
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${DESIGN_TOKENS.colors.brand.red}20`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <p
                className="mt-1.5 text-xs md:text-sm"
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                  color: isDark ? "#9ca3af" : "#6b7280",
                }}
              >
                Leave as 0 if not applicable
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 px-4 py-4 md:px-6 md:py-5 border-t"
          style={{
            borderColor: modalStyles.footer.borderColor,
          }}
        >
          <Button variant="secondary" onClick={handleClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleProceed} className="w-full sm:w-auto">
            Proceed with Maintenance
          </Button>
        </div>
      </div>
    </div>
  );
}
