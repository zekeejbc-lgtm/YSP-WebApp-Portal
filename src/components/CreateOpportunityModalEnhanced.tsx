/**
 * Enhanced Create/Edit Opportunity Modal with Google Forms-style Field Builder
 */

import { useState } from "react";
import {
  Plus, Edit, Trash2, X, Settings, GripVertical, Eye, EyeOff,
  Type, AlignLeft, Mail, Phone, List, Circle, Square,
  FileText, Upload, ChevronDown, ChevronUp, Calendar
} from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";

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

interface CustomField {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "select" | "radio" | "checkbox" | "date" | "file";
  required: boolean;
  enabled: boolean;
  options?: string[];
  placeholder?: string;
}

interface CreateOpportunityModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  opportunity: ApplicationOpportunity | null;
  onSave: (opp: ApplicationOpportunity) => void;
}

// Default field templates
function getDefaultFields(): CustomField[] {
  return [
    {
      id: "field-1",
      label: "Full Name",
      type: "text",
      required: true,
      enabled: true,
      placeholder: "Enter your full name",
    },
    {
      id: "field-2",
      label: "Email Address",
      type: "email",
      required: true,
      enabled: true,
      placeholder: "your.email@example.com",
    },
    {
      id: "field-3",
      label: "Phone Number",
      type: "phone",
      required: true,
      enabled: true,
      placeholder: "+63 XXX XXX XXXX",
    },
    {
      id: "field-4",
      label: "Date of Birth",
      type: "date",
      required: false,
      enabled: true,
    },
    {
      id: "field-5",
      label: "Why do you want to join?",
      type: "textarea",
      required: true,
      enabled: true,
      placeholder: "Tell us about your motivation...",
    },
    {
      id: "field-6",
      label: "Preferred Committee",
      type: "select",
      required: true,
      enabled: true,
      options: [
        "Community Development",
        "Environmental Conservation",
        "Youth Development",
        "Health & Wellness",
        "Education"
      ],
    },
    {
      id: "field-7",
      label: "Resume/CV",
      type: "file",
      required: false,
      enabled: false,
    },
  ];
}

// Custom Dropdown Component
function CustomDropdown({ field, isDark }: { field: CustomField; isDark: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState("");

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none text-left flex items-center justify-between"
        style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
      >
        <span className={selected ? "" : "text-muted-foreground"}>
          {selected || "Select an option"}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        <div
          className="absolute z-10 w-full mt-1 rounded-lg border shadow-lg max-h-60 overflow-auto"
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
                setSelected(option);
                setIsOpen(false);
              }}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Preview Field Renderer
function PreviewField({ field, isDark }: { field: CustomField; isDark: boolean }) {
  const [emailError, setEmailError] = useState("");

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !emailRegex.test(email)) {
      setEmailError("Please enter a valid email address");
    } else {
      setEmailError("");
    }
  };

  const renderInput = () => {
    switch (field.type) {
      case "text":
      case "phone":
        return (
          <input
            type="text"
            placeholder={field.placeholder}
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
            style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
          />
        );

      case "email":
        return (
          <div>
            <input
              type="email"
              placeholder={field.placeholder}
              onBlur={(e) => validateEmail(e.target.value)}
              onChange={(e) => validateEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
              style={{ 
                borderColor: emailError 
                  ? "#ef4444" 
                  : isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)"
              }}
            />
            {emailError && (
              <p className="text-red-500 text-xs mt-1">{emailError}</p>
            )}
          </div>
        );

      case "textarea":
        return (
          <textarea
            rows={4}
            placeholder={field.placeholder}
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none resize-none"
            style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
          />
        );

      case "date":
        return (
          <input
            type="date"
            className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
            style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
          />
        );

      case "select":
        return <CustomDropdown field={field} isDark={isDark} />;

      case "radio":
        return (
          <div className="space-y-2">
            {(field.options || []).map((option, idx) => (
              <label key={idx} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.id}
                  className="w-4 h-4 text-[#f6421f] focus:ring-[#f6421f]"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {(field.options || []).map((option, idx) => (
              <label key={idx} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded text-[#f6421f] focus:ring-[#f6421f]"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        );

      case "file":
        return (
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)" }}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX (MAX. 5MB)</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
    </div>
  );
}

export default function CreateOpportunityModalEnhanced({
  isOpen,
  onClose,
  isDark,
  opportunity,
  onSave,
}: CreateOpportunityModalProps) {
  const [activeTab, setActiveTab] = useState<"basic" | "fields" | "preview">("basic");
  const [formData, setFormData] = useState<ApplicationOpportunity>(
    opportunity || {
      id: "",
      title: "",
      description: "",
      committee: "",
      availableSlots: 1,
      deadline: "",
      status: "open",
      customFields: getDefaultFields(),
    }
  );

  const handleAddField = () => {
    const newField: CustomField = {
      id: `field-${Date.now()}`,
      label: "New Field",
      type: "text",
      required: false,
      enabled: true,
      placeholder: "",
    };
    setFormData({
      ...formData,
      customFields: [...(formData.customFields || []), newField],
    });
  };

  const handleUpdateField = (index: number, updates: Partial<CustomField>) => {
    const fields = [...(formData.customFields || [])];
    fields[index] = { ...fields[index], ...updates };
    setFormData({ ...formData, customFields: fields });
  };

  const handleDeleteField = (index: number) => {
    const fields = [...(formData.customFields || [])];
    fields.splice(index, 1);
    setFormData({ ...formData, customFields: fields });
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    const fields = [...(formData.customFields || [])];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
    setFormData({ ...formData, customFields: fields });
  };

  const handleAddOption = (fieldIndex: number) => {
    const fields = [...(formData.customFields || [])];
    const field = fields[fieldIndex];
    field.options = [...(field.options || []), "New Option"];
    setFormData({ ...formData, customFields: fields });
  };

  const handleUpdateOption = (fieldIndex: number, optionIndex: number, value: string) => {
    const fields = [...(formData.customFields || [])];
    const field = fields[fieldIndex];
    if (field.options) {
      field.options[optionIndex] = value;
      setFormData({ ...formData, customFields: fields });
    }
  };

  const handleDeleteOption = (fieldIndex: number, optionIndex: number) => {
    const fields = [...(formData.customFields || [])];
    const field = fields[fieldIndex];
    if (field.options) {
      field.options.splice(optionIndex, 1);
      setFormData({ ...formData, customFields: fields });
    }
  };

  const getFieldIcon = (type: CustomField["type"]) => {
    switch (type) {
      case "text": return <Type className="w-4 h-4" />;
      case "textarea": return <AlignLeft className="w-4 h-4" />;
      case "email": return <Mail className="w-4 h-4" />;
      case "phone": return <Phone className="w-4 h-4" />;
      case "select": return <List className="w-4 h-4" />;
      case "radio": return <Circle className="w-4 h-4" />;
      case "checkbox": return <Square className="w-4 h-4" />;
      case "date": return <Calendar className="w-4 h-4" />;
      case "file": return <Upload className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const convertTo12Hour = (time24: string): string => {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.deadline) {
      toast.error("Please fill in all required fields");
      return;
    }

    onSave(formData);
  };

  if (!isOpen) return null;

  const enabledFields = (formData.customFields || []).filter(f => f.enabled);

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
        className="w-full max-w-5xl rounded-xl p-6 border overflow-y-auto max-h-[90vh]"
        style={{
          background: isDark ? "rgba(17, 24, 39, 0.95)" : "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(20px)",
          borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("basic")}
            className={`px-4 py-2 transition-colors ${
              activeTab === "basic"
                ? "border-b-2"
                : "text-muted-foreground"
            }`}
            style={{
              borderColor: activeTab === "basic" ? DESIGN_TOKENS.colors.brand.red : "transparent",
              fontWeight: activeTab === "basic" ? DESIGN_TOKENS.typography.fontWeight.semibold : DESIGN_TOKENS.typography.fontWeight.normal,
            }}
          >
            Basic Information
          </button>
          <button
            onClick={() => setActiveTab("fields")}
            className={`px-4 py-2 transition-colors ${
              activeTab === "fields"
                ? "border-b-2"
                : "text-muted-foreground"
            }`}
            style={{
              borderColor: activeTab === "fields" ? DESIGN_TOKENS.colors.brand.red : "transparent",
              fontWeight: activeTab === "fields" ? DESIGN_TOKENS.typography.fontWeight.semibold : DESIGN_TOKENS.typography.fontWeight.normal,
            }}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Custom Form Fields
            </div>
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-2 transition-colors ${
              activeTab === "preview"
                ? "border-b-2"
                : "text-muted-foreground"
            }`}
            style={{
              borderColor: activeTab === "preview" ? DESIGN_TOKENS.colors.brand.red : "transparent",
              fontWeight: activeTab === "preview" ? DESIGN_TOKENS.typography.fontWeight.semibold : DESIGN_TOKENS.typography.fontWeight.normal,
            }}
          >
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </div>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "basic" && (
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                Position Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                placeholder="e.g., Community Development Officer"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none resize-none"
                style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                rows={3}
                placeholder="Describe the role and responsibilities"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Available Slots */}
              <div>
                <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  Available Slots *
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.availableSlots}
                  onChange={(e) => setFormData({ ...formData, availableSlots: parseInt(e.target.value) || 1 })}
                  className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "open" | "closed" })}
                  className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                >
                  <option value="open">Open</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Deadline Date */}
              <div>
                <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  Application Deadline (Date) *
                </label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                />
              </div>

              {/* Deadline Time */}
              <div>
                <label className="block text-sm mb-2" style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                  Deadline Time
                </label>
                <input
                  type="time"
                  value={formData.deadlineTime || "23:59"}
                  onChange={(e) => setFormData({ ...formData, deadlineTime: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "fields" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Customize the application form fields. Toggle fields on/off, mark as required, and rearrange them as needed.
              </p>
              <Button
                variant="primary"
                onClick={handleAddField}
                icon={<Plus className="w-4 h-4" />}
                size="sm"
              >
                Add Field
              </Button>
            </div>

            {/* Field List */}
            <div className="space-y-3">
              {(formData.customFields || []).map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-lg p-4 border"
                  style={{
                    background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 1)",
                    borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(229, 231, 235, 1)",
                    opacity: field.enabled ? 1 : 0.5,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Drag Handle */}
                    <div className="flex flex-col gap-1 pt-2">
                      <button
                        onClick={() => handleMoveField(index, "up")}
                        disabled={index === 0}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <GripVertical className="w-4 h-4 text-muted-foreground" />
                      <button
                        onClick={() => handleMoveField(index, "down")}
                        disabled={index === (formData.customFields || []).length - 1}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Field Content */}
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Label */}
                        <div>
                          <label className="block text-xs mb-1 text-muted-foreground">Field Label</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => handleUpdateField(index, { label: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                            style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                            placeholder="e.g., Full Name"
                          />
                        </div>

                        {/* Type */}
                        <div>
                          <label className="block text-xs mb-1 text-muted-foreground">Field Type</label>
                          <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {getFieldIcon(field.type)}
                            </div>
                            <select
                              value={field.type}
                              onChange={(e) => handleUpdateField(index, { type: e.target.value as CustomField["type"] })}
                              className="w-full pl-10 pr-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                              style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                            >
                              <option value="text">Text</option>
                              <option value="textarea">Long Text</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                              <option value="select">Dropdown</option>
                              <option value="radio">Radio Buttons</option>
                              <option value="checkbox">Checkboxes</option>
                              <option value="date">Date</option>
                              <option value="file">File Upload</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Placeholder (for text-based fields) */}
                      {["text", "textarea", "email", "phone"].includes(field.type) && (
                        <div>
                          <label className="block text-xs mb-1 text-muted-foreground">Placeholder</label>
                          <input
                            type="text"
                            value={field.placeholder || ""}
                            onChange={(e) => handleUpdateField(index, { placeholder: e.target.value })}
                            className="w-full px-3 py-2 text-sm rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                            style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                            placeholder="Optional placeholder text"
                          />
                        </div>
                      )}

                      {/* Options (for select/radio/checkbox) */}
                      {["select", "radio", "checkbox"].includes(field.type) && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-xs text-muted-foreground">Options</label>
                            <button
                              onClick={() => handleAddOption(index)}
                              className="text-xs px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                              style={{ color: DESIGN_TOKENS.colors.brand.red }}
                            >
                              + Add Option
                            </button>
                          </div>
                          <div className="space-y-2">
                            {(field.options || []).map((option, optIndex) => (
                              <div key={optIndex} className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => handleUpdateOption(index, optIndex, e.target.value)}
                                  className="flex-1 px-3 py-1 text-sm rounded-lg border bg-white dark:bg-gray-800 focus:ring-2 focus:ring-[#f6421f] outline-none"
                                  style={{ borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)" }}
                                  placeholder={`Option ${optIndex + 1}`}
                                />
                                <button
                                  onClick={() => handleDeleteOption(index, optIndex)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                                >
                                  <X className="w-4 h-4 text-red-500" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Settings & Actions */}
                    <div className="flex flex-col gap-2 pt-2">
                      {/* Toggle Enabled */}
                      <button
                        onClick={() => handleUpdateField(index, { enabled: !field.enabled })}
                        className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title={field.enabled ? "Hide field" : "Show field"}
                      >
                        {field.enabled ? (
                          <Eye className="w-4 h-4 text-green-500" />
                        ) : (
                          <EyeOff className="w-4 h-4 text-gray-400" />
                        )}
                      </button>

                      {/* Toggle Required */}
                      <button
                        onClick={() => handleUpdateField(index, { required: !field.required })}
                        className={`px-2 py-1 text-xs rounded ${
                          field.required
                            ? "bg-red-100 dark:bg-red-900/20 text-red-600"
                            : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                        }`}
                        title={field.required ? "Make optional" : "Make required"}
                      >
                        {field.required ? "Required" : "Optional"}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteField(index)}
                        className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete field"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {(formData.customFields || []).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No fields yet. Click "Add Field" to get started.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "preview" && (
          <div className="space-y-6">
            <div className="rounded-lg p-6 border" style={{
              background: isDark ? "rgba(246, 66, 31, 0.1)" : "rgba(246, 66, 31, 0.05)",
              borderColor: DESIGN_TOKENS.colors.brand.orange,
            }}>
              <h3
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                  fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                  fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                  color: DESIGN_TOKENS.colors.brand.red,
                }}
              >
                {formData.title || "Position Title"}
              </h3>
              <p className="text-muted-foreground mt-2">
                {formData.description || "Position description will appear here"}
              </p>
              <div className="flex gap-4 mt-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Available Slots: </span>
                  <span style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                    {formData.availableSlots}
                  </span>
                </div>
                {formData.deadline && (
                  <div>
                    <span className="text-muted-foreground">Deadline: </span>
                    <span style={{ fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold }}>
                      {new Date(formData.deadline).toLocaleDateString()}
                      {formData.deadlineTime && ` at ${convertTo12Hour(formData.deadlineTime)}`}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {enabledFields.length > 0 ? (
                enabledFields.map((field) => (
                  <PreviewField key={field.id} field={field} isDark={isDark} />
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No enabled fields to preview</p>
                  <p className="text-sm mt-1">Go to Custom Form Fields to add and enable fields</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} className="flex-1">
            {opportunity ? "Save Changes" : "Create Opportunity"}
          </Button>
        </div>
      </div>
    </div>
  );
}