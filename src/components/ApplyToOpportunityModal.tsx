/**
 * Apply to Opportunity Modal - Shows custom opportunity form with dynamic fields
 */

import { useState } from "react";
import { X, CheckCircle, AlertCircle, Upload, Calendar, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";

interface CustomField {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "select" | "radio" | "checkbox" | "date" | "file";
  required: boolean;
  enabled: boolean;
  options?: string[];
  placeholder?: string;
}

interface ApplicationOpportunity {
  id: string;
  title: string;
  description: string;
  committee: string;
  availableSlots: number;
  deadline: string;
  deadlineTime?: string;
  status: "open" | "closed";
  customFields?: CustomField[];
}

interface ApplyToOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  opportunity: ApplicationOpportunity;
  onSubmit: (applicationData: any) => void;
}

// Custom Dropdown Component
function CustomDropdown({ 
  field, 
  isDark, 
  value, 
  onChange 
}: { 
  field: CustomField; 
  isDark: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none text-left flex items-center justify-between"
        style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
      >
        <span className={value ? "" : "text-muted-foreground"}>
          {value || "Select an option"}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-[80]" 
            onClick={() => setIsOpen(false)}
          />
          <div
            className="absolute z-[90] w-full mt-1 rounded-lg border shadow-lg max-h-60 overflow-auto"
            style={{
              background: isDark ? "rgba(17, 24, 39, 1)" : "rgba(255, 255, 255, 1)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
            }}
          >
            {(field.options || []).map((option, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ApplyToOpportunityModal({
  isOpen,
  onClose,
  isDark,
  opportunity,
  onSubmit,
}: ApplyToOpportunityModalProps) {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const convertTo12Hour = (time24: string): string => {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => ({ ...prev, [fieldId]: "" }));
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    const enabledFields = (opportunity.customFields || []).filter(f => f.enabled);

    // Validate required fields
    enabledFields.forEach(field => {
      if (field.required && !formValues[field.id]) {
        newErrors[field.id] = `${field.label} is required`;
      }

      // Email validation
      if (field.type === "email" && formValues[field.id]) {
        if (!validateEmail(formValues[field.id])) {
          newErrors[field.id] = "Please enter a valid email address";
        }
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields correctly");
      return;
    }

    // Submit the application
    onSubmit({
      opportunityId: opportunity.id,
      opportunityTitle: opportunity.title,
      formData: formValues,
      submittedAt: new Date().toISOString(),
    });

    toast.success("Application submitted successfully!");
    onClose();
  };

  const renderField = (field: CustomField) => {
    const error = errors[field.id];
    const borderColor = error 
      ? "#ef4444" 
      : isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)";

    switch (field.type) {
      case "text":
      case "phone":
        return (
          <div>
            <input
              type="text"
              value={formValues[field.id] || ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
              style={{ borderColor }}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "email":
        return (
          <div>
            <input
              type="email"
              value={formValues[field.id] || ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              onBlur={(e) => {
                if (e.target.value && !validateEmail(e.target.value)) {
                  setErrors(prev => ({ ...prev, [field.id]: "Please enter a valid email address" }));
                }
              }}
              placeholder={field.placeholder}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
              style={{ borderColor }}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "textarea":
        return (
          <div>
            <textarea
              rows={4}
              value={formValues[field.id] || ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              placeholder={field.placeholder}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none resize-none"
              style={{ borderColor }}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "date":
        return (
          <div>
            <input
              type="date"
              value={formValues[field.id] || ""}
              onChange={(e) => handleFieldChange(field.id, e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
              style={{ borderColor }}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "select":
        return (
          <div>
            <CustomDropdown
              field={field}
              isDark={isDark}
              value={formValues[field.id] || ""}
              onChange={(value) => handleFieldChange(field.id, value)}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "radio":
        return (
          <div>
            <div className="space-y-2">
              {(field.options || []).map((option, idx) => (
                <label key={idx} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name={field.id}
                    checked={formValues[field.id] === option}
                    onChange={() => handleFieldChange(field.id, option)}
                    className="w-4 h-4 text-[#f6421f] focus:ring-[#f6421f]"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "checkbox":
        return (
          <div>
            <div className="space-y-2">
              {(field.options || []).map((option, idx) => (
                <label key={idx} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formValues[field.id] || []).includes(option)}
                    onChange={(e) => {
                      const current = formValues[field.id] || [];
                      const updated = e.target.checked
                        ? [...current, option]
                        : current.filter((v: string) => v !== option);
                      handleFieldChange(field.id, updated);
                    }}
                    className="w-4 h-4 rounded text-[#f6421f] focus:ring-[#f6421f]"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      case "file":
        return (
          <div>
            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              style={{ borderColor: error ? "#ef4444" : isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)" }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.onchange = (e: any) => {
                  const file = e.target.files[0];
                  if (file) {
                    handleFieldChange(field.id, file.name);
                  }
                };
                input.click();
              }}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {formValues[field.id] || "Click to upload or drag and drop"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX (MAX. 5MB)</p>
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  const enabledFields = (opportunity.customFields || []).filter(f => f.enabled);
  const isDeadlinePassed = new Date(opportunity.deadline) < new Date();
  const isClosed = opportunity.status === "closed";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-xl p-6 border overflow-y-auto max-h-[90vh]"
        style={{
          background: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h3
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h2}px`,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: DESIGN_TOKENS.colors.brand.red,
              }}
            >
              {opportunity.title}
            </h3>
            <p className="text-muted-foreground mt-2">
              {opportunity.description}
            </p>
            <div className="flex gap-4 mt-3 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Available Slots:</span>
                <span style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  {opportunity.availableSlots}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Deadline:</span>
                <span style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  {new Date(opportunity.deadline).toLocaleDateString()}
                  {opportunity.deadlineTime && ` at ${convertTo12Hour(opportunity.deadlineTime)}`}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors ml-4"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {(isClosed || isDeadlinePassed) && (
          <div
            className="rounded-lg p-4 mb-6 flex items-start gap-3"
            style={{
              background: isDark ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.05)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold, color: "#ef4444" }}>
                {isClosed ? "This opportunity is closed" : "Application deadline has passed"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Applications are no longer being accepted for this position.
              </p>
            </div>
          </div>
        )}

        {/* Application Form */}
        {!isClosed && !isDeadlinePassed && (
          <div className="space-y-4">
            <div
              className="rounded-lg p-4 mb-4"
              style={{
                background: isDark ? "rgba(246, 66, 31, 0.1)" : "rgba(246, 66, 31, 0.05)",
                border: `1px solid ${DESIGN_TOKENS.colors.brand.orange}`,
              }}
            >
              <p className="text-sm">
                Please fill out the application form below. Fields marked with{" "}
                <span className="text-red-500">*</span> are required.
              </p>
            </div>

            {enabledFields.map((field) => (
              <div key={field.id}>
                <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {renderField(field)}
              </div>
            ))}

            {enabledFields.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No application form has been configured for this opportunity.</p>
                <p className="text-sm mt-1">Please contact the administrator.</p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            {isClosed || isDeadlinePassed ? "Close" : "Cancel"}
          </Button>
          {!isClosed && !isDeadlinePassed && enabledFields.length > 0 && (
            <Button variant="primary" onClick={handleSubmit} className="flex-1">
              Submit Application
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}