/**
 * =============================================================================
 * CUSTOMIZE MEMBERSHIP FORM MODAL
 * =============================================================================
 * 
 * Three-Tab Form Builder Interface:
 * 1. FORM FIELDS - Enable/disable, reorder, mark required
 * 2. FIELD SETTINGS - Configure individual field properties
 * 3. PREVIEW - Live preview of the form
 * 
 * Fully responsive design with mobile-first approach
 * Consistent with all other modals in the design system
 * =============================================================================
 */

import { useState } from "react";
import {
  X,
  Settings,
  Eye,
  GripVertical,
  ChevronDown,
  ChevronUp,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Type,
  AlignLeft,
  Mail,
  Phone,
  Calendar,
  List,
  Circle,
  Square,
  FileText,
  Upload,
  Lock,
  User,
  MapPin,
  Globe,
  Hash,
  Image,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button, DESIGN_TOKENS } from "./design-system";
import { MODAL_REGULATIONS, getModalStyles } from "./modal-regulations";
import AddFieldDropdown from "./AddFieldDropdown";

export interface MembershipFormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "email" | "phone" | "select" | "radio" | "checkbox" | "date" | "file" | "password" | "number" | "url";
  required: boolean;
  enabled: boolean;
  placeholder?: string;
  options?: string[]; // For select, radio, checkbox
  category: "personal" | "demographics" | "contact" | "address" | "social" | "emergency" | "ysp" | "privacy" | "account" | "system";
  systemField?: boolean; // Cannot be deleted, only disabled
  order: number;
  conditionalField?: boolean; // Shows only when certain conditions are met
  showWhen?: {
    fieldId: string;
    condition: "checked" | "unchecked" | "equals";
    value?: any;
  };
}

interface CustomizeMembershipFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  fields: MembershipFormField[];
  onSave: (fields: MembershipFormField[]) => void;
}

export default function CustomizeMembershipFormModal({
  isOpen,
  onClose,
  isDark,
  fields: initialFields,
  onSave,
}: CustomizeMembershipFormModalProps) {
  const [currentTab, setCurrentTab] = useState<"fields" | "settings" | "preview">("fields");
  const [fields, setFields] = useState<MembershipFormField[]>(initialFields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [addFieldCategory, setAddFieldCategory] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    personal: true,
    demographics: false,
    contact: false,
    address: false,
    social: false,
    emergency: false,
    ysp: false,
    privacy: false,
    account: false,
    system: false,
  });

  if (!isOpen) return null;

  const modalStyles = getModalStyles(isDark, 'xlarge');

  // Categories for organization
  const categories = [
    { id: "personal", label: "Personal Information", icon: User },
    { id: "demographics", label: "Demographics", icon: User },
    { id: "contact", label: "Contact Information", icon: Phone },
    { id: "address", label: "Address Details", icon: MapPin },
    { id: "social", label: "Social Media", icon: Globe },
    { id: "emergency", label: "Emergency Contact", icon: AlertCircle },
    { id: "ysp", label: "YSP Information", icon: FileText },
    { id: "privacy", label: "Privacy & Agreements", icon: Lock },
    { id: "account", label: "Account Information", icon: User },
    { id: "system", label: "System Fields", icon: Settings },
  ];

  // Field type icons
  const getFieldTypeIcon = (type: string) => {
    switch (type) {
      case "text": return Type;
      case "textarea": return AlignLeft;
      case "email": return Mail;
      case "phone": return Phone;
      case "date": return Calendar;
      case "select": return List;
      case "radio": return Circle;
      case "checkbox": return Square;
      case "file": return Upload;
      case "password": return Lock;
      case "number": return Hash;
      case "url": return Globe;
      default: return FileText;
    }
  };

  // Toggle field enabled/disabled
  const toggleFieldEnabled = (fieldId: string) => {
    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, enabled: !f.enabled } : f
    ));
  };

  // Toggle field required
  const toggleFieldRequired = (fieldId: string) => {
    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, required: !f.required } : f
    ));
  };

  // Move field up in order
  const moveFieldUp = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const categoryFields = fields.filter(f => f.category === field.category).sort((a, b) => a.order - b.order);
    const currentIndex = categoryFields.findIndex(f => f.id === fieldId);
    
    if (currentIndex > 0) {
      const newFields = [...fields];
      const prevField = categoryFields[currentIndex - 1];
      
      newFields.forEach(f => {
        if (f.id === fieldId) f.order = prevField.order;
        if (f.id === prevField.id) f.order = field.order;
      });
      
      setFields(newFields);
    }
  };

  // Move field down in order
  const moveFieldDown = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const categoryFields = fields.filter(f => f.category === field.category).sort((a, b) => a.order - b.order);
    const currentIndex = categoryFields.findIndex(f => f.id === fieldId);
    
    if (currentIndex < categoryFields.length - 1) {
      const newFields = [...fields];
      const nextField = categoryFields[currentIndex + 1];
      
      newFields.forEach(f => {
        if (f.id === fieldId) f.order = nextField.order;
        if (f.id === nextField.id) f.order = field.order;
      });
      
      setFields(newFields);
    }
  };

  // Update field settings
  const updateField = (fieldId: string, updates: Partial<MembershipFormField>) => {
    setFields(fields.map(f =>
      f.id === fieldId ? { ...f, ...updates } : f
    ));
  };

  // Add custom field to category
  const addFieldToCategory = (categoryId: string, fieldType: string) => {
    const categoryFields = fields.filter(f => f.category === categoryId);
    const maxOrder = Math.max(...fields.map(f => f.order), 0);
    const newFieldId = `custom_${Date.now()}`;
    
    const newField: MembershipFormField = {
      id: newFieldId,
      label: `New ${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} Field`,
      type: fieldType as any,
      required: false,
      enabled: true,
      placeholder: `Enter ${fieldType}...`,
      category: categoryId as any,
      systemField: false,
      order: maxOrder + 1,
      options: (fieldType === "select" || fieldType === "radio" || fieldType === "checkbox") 
        ? ["Option 1", "Option 2", "Option 3"] 
        : undefined,
    };
    
    setFields([...fields, newField]);
    toast.success(`New ${fieldType} field added to ${categories.find(c => c.id === categoryId)?.label}`);
    setSelectedFieldId(newFieldId);
    setCurrentTab("settings");
  };

  // Delete custom field
  const deleteField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (field?.systemField) {
      toast.error("Cannot delete system fields");
      return;
    }
    
    setFields(fields.filter(f => f.id !== fieldId));
    toast.success("Field deleted successfully");
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  // Stats
  const enabledFieldsCount = fields.filter(f => f.enabled).length;
  const requiredFieldsCount = fields.filter(f => f.enabled && f.required).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{
        background: modalStyles.overlay.background,
        backdropFilter: `blur(${MODAL_REGULATIONS.overlay.backdropBlur})`,
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-7xl rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{
          background: modalStyles.panel.background,
          backdropFilter: modalStyles.panel.backdropFilter,
          border: `${modalStyles.panel.borderWidth} solid ${modalStyles.panel.borderColor}`,
          boxShadow: modalStyles.panel.boxShadow,
          height: "auto",
          maxHeight: "95vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Responsive */}
        <div
          className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{
            borderColor: modalStyles.header.borderColor,
            background: isDark 
              ? "linear-gradient(135deg, rgba(246, 66, 31, 0.05) 0%, rgba(238, 135, 36, 0.05) 100%)"
              : "linear-gradient(135deg, rgba(246, 66, 31, 0.02) 0%, rgba(238, 135, 36, 0.02) 100%)",
          }}
        >
          <div className="flex-1">
            <h2
              className="text-xl sm:text-2xl"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                color: DESIGN_TOKENS.colors.brand.red,
              }}
            >
              Customize Membership Form
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {enabledFieldsCount} fields enabled • {requiredFieldsCount} required
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 sm:static p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Tab Navigation - Responsive */}
        <div
          className="flex border-b"
          style={{
            borderColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.15)",
            background: isDark ? "rgba(15, 23, 42, 0.5)" : "rgba(249, 250, 251, 0.5)",
          }}
        >
          {[
            { id: "fields", label: "Form Fields", icon: FileText, mobileLabel: "Fields" },
            { id: "settings", label: "Field Settings", icon: Settings, mobileLabel: "Settings" },
            { id: "preview", label: "Preview", icon: Eye, mobileLabel: "Preview" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id as any)}
              className="flex-1 min-w-[100px] px-4 sm:px-6 py-4 flex items-center justify-center gap-2 transition-all whitespace-nowrap font-medium"
              style={{
                background:
                  currentTab === tab.id
                    ? isDark
                      ? "rgba(246, 66, 31, 0.15)"
                      : "rgba(246, 66, 31, 0.08)"
                    : "transparent",
                borderBottom:
                  currentTab === tab.id
                    ? `3px solid ${DESIGN_TOKENS.colors.brand.red}`
                    : "3px solid transparent",
                color:
                  currentTab === tab.id
                    ? DESIGN_TOKENS.colors.brand.red
                    : isDark
                    ? "rgba(255, 255, 255, 0.9)"
                    : "rgba(0, 0, 0, 0.7)",
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                fontSize: "15px",
              }}
            >
              <tab.icon className="w-5 h-5" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.mobileLabel}</span>
            </button>
          ))}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* TAB 1: FORM FIELDS */}
          {currentTab === "fields" && (
            <div className="space-y-3 sm:space-y-4">
              {categories.map((category) => {
                const categoryFields = fields.filter((f) => f.category === category.id).sort((a, b) => a.order - b.order);
                if (categoryFields.length === 0) return null;

                const isExpanded = expandedCategories[category.id];

                return (
                  <div
                    key={category.id}
                    className="rounded-xl border overflow-hidden"
                    style={{
                      background: modalStyles.card.background,
                      borderColor: modalStyles.card.borderColor,
                    }}
                  >
                    {/* Category Header */}
                    <div
                      className="w-full px-4 sm:px-5 py-3 sm:py-4 flex items-center justify-between"
                      style={{
                        background: isDark 
                          ? "rgba(246, 66, 31, 0.05)" 
                          : "rgba(246, 66, 31, 0.03)",
                      }}
                    >
                      <button
                        onClick={() => setExpandedCategories({ ...expandedCategories, [category.id]: !isExpanded })}
                        className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity text-left"
                      >
                        <category.icon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                        <div>
                          <h3
                            className="text-sm sm:text-base"
                            style={{
                              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                              fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                            }}
                          >
                            {category.label}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {categoryFields.filter(f => f.enabled).length}/{categoryFields.length} enabled
                          </p>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      </button>
                      
                      <div className="ml-3" onClick={(e) => e.stopPropagation()}>
                        <AddFieldDropdown 
                          isDark={isDark}
                          onAddField={(fieldType) => addFieldToCategory(category.id, fieldType)}
                        />
                      </div>
                    </div>

                    {/* Category Fields */}
                    {isExpanded && (
                      <div className="divide-y" style={{ borderColor: modalStyles.card.borderColor }}>
                        {categoryFields.map((field, index) => {
                          const FieldIcon = getFieldTypeIcon(field.type);
                          const isFirst = index === 0;
                          const isLast = index === categoryFields.length - 1;

                          return (
                            <div
                              key={field.id}
                              className="px-4 sm:px-5 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                            >
                              {/* Field Info - Mobile Stacked, Desktop Row */}
                              <div className="flex-1 flex items-start sm:items-center gap-3 min-w-0">
                                {/* Drag Handle - Hidden on mobile */}
                                <GripVertical className="w-5 h-5 text-gray-400 cursor-move hidden sm:block flex-shrink-0" />
                                
                                {/* Field Icon & Details */}
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <FieldIcon className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-sm font-medium break-words max-w-full">{field.label}</span>
                                      {field.systemField && (
                                        <span 
                                          className="px-2 py-0.5 rounded text-xs flex-shrink-0"
                                          style={{
                                            background: "rgba(59, 130, 246, 0.1)",
                                            color: "#3b82f6",
                                          }}
                                        >
                                          System
                                        </span>
                                      )}
                                      {field.required && field.enabled && (
                                        <span 
                                          className="px-2 py-0.5 rounded text-xs flex-shrink-0"
                                          style={{
                                            background: "rgba(239, 68, 68, 0.1)",
                                            color: "#ef4444",
                                          }}
                                        >
                                          Required
                                        </span>
                                      )}
                                      {field.conditionalField && (
                                        <span 
                                          className="px-2 py-0.5 rounded text-xs flex-shrink-0"
                                          style={{
                                            background: "rgba(251, 191, 36, 0.1)",
                                            color: "#f59e0b",
                                          }}
                                        >
                                          Conditional
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{field.type}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Actions - Mobile Full Width, Desktop Auto */}
                              <div className="flex items-center gap-2 justify-end sm:justify-start flex-shrink-0">
                                {/* Move Up/Down - Desktop Only */}
                                <div className="hidden sm:flex items-center gap-1">
                                  <button
                                    onClick={() => moveFieldUp(field.id)}
                                    disabled={isFirst}
                                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Move up"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => moveFieldDown(field.id)}
                                    disabled={isLast}
                                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Move down"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Required Toggle */}
                                <button
                                  onClick={() => toggleFieldRequired(field.id)}
                                  disabled={!field.enabled}
                                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                  title={field.required ? "Mark optional" : "Mark required"}
                                >
                                  <AlertCircle 
                                    className="w-5 h-5" 
                                    style={{ 
                                      color: field.required && field.enabled ? "#ef4444" : "currentColor" 
                                    }}
                                  />
                                </button>

                                {/* Visibility Toggle */}
                                <button
                                  onClick={() => toggleFieldEnabled(field.id)}
                                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                  title={field.enabled ? "Hide field" : "Show field"}
                                >
                                  {field.enabled ? (
                                    <Eye className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                                  ) : (
                                    <EyeOff className="w-5 h-5 text-gray-400" />
                                  )}
                                </button>

                                {/* Settings Link */}
                                <button
                                  onClick={() => {
                                    setSelectedFieldId(field.id);
                                    setCurrentTab("settings");
                                  }}
                                  className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                  title="Configure field"
                                >
                                  <Settings className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: FIELD SETTINGS */}
          {currentTab === "settings" && (
            <div className="max-w-3xl mx-auto">
              {/* Field Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Select Field to Configure</label>
                <select
                  value={selectedFieldId || ""}
                  onChange={(e) => setSelectedFieldId(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500"
                  style={{
                    background: modalStyles.card.background,
                    borderColor: modalStyles.card.borderColor,
                  }}
                >
                  <option value="">Choose a field...</option>
                  {categories.map((category) => {
                    const categoryFields = fields.filter(f => f.category === category.id);
                    if (categoryFields.length === 0) return null;

                    return (
                      <optgroup key={category.id} label={category.label}>
                        {categoryFields.map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.label} ({field.type})
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              {/* Selected Field Settings */}
              {selectedFieldId && (() => {
                const field = fields.find(f => f.id === selectedFieldId);
                if (!field) return null;

                return (
                  <div 
                    className="rounded-xl p-6 space-y-6"
                    style={{
                      background: modalStyles.card.background,
                      border: `1px solid ${modalStyles.card.borderColor}`,
                    }}
                  >
                    <div>
                      <h3 
                        className="text-lg mb-4"
                        style={{
                          fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                        }}
                      >
                        {field.label} Settings
                      </h3>
                    </div>

                    {/* Field Label */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Field Label</label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500"
                        style={{
                          background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
                          borderColor: modalStyles.card.borderColor,
                        }}
                      />
                    </div>

                    {/* Placeholder */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Placeholder Text</label>
                      <input
                        type="text"
                        value={field.placeholder || ""}
                        onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500"
                        style={{
                          background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
                          borderColor: modalStyles.card.borderColor,
                        }}
                        placeholder={`Enter ${field.label.toLowerCase()}...`}
                      />
                    </div>

                    {/* Field Toggles */}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`enabled-${field.id}`}
                          checked={field.enabled}
                          onChange={() => toggleFieldEnabled(field.id)}
                          className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                        />
                        <label htmlFor={`enabled-${field.id}`} className="text-sm font-medium cursor-pointer">
                          Enabled
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`required-${field.id}`}
                          checked={field.required}
                          onChange={() => toggleFieldRequired(field.id)}
                          disabled={!field.enabled}
                          className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500 disabled:opacity-50"
                        />
                        <label htmlFor={`required-${field.id}`} className="text-sm font-medium cursor-pointer">
                          Required
                        </label>
                      </div>
                    </div>

                    {/* Options for select/radio/checkbox */}
                    {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Options (one per line)</label>
                        <textarea
                          value={field.options?.join("\n") || ""}
                          onChange={(e) => updateField(field.id, { 
                            options: e.target.value.split("\n").filter(o => o.trim()) 
                          })}
                          rows={5}
                          className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-orange-500"
                          style={{
                            background: isDark ? "rgba(30, 41, 59, 0.5)" : "rgba(249, 250, 251, 0.8)",
                            borderColor: modalStyles.card.borderColor,
                          }}
                          placeholder="Option 1&#10;Option 2&#10;Option 3"
                        />
                      </div>
                    )}

                    {/* Field Info */}
                    <div 
                      className="p-4 rounded-lg"
                      style={{
                        background: isDark ? "rgba(59, 130, 246, 0.05)" : "rgba(59, 130, 246, 0.03)",
                        border: "1px solid rgba(59, 130, 246, 0.2)",
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                          <p><strong>Field Type:</strong> {field.type}</p>
                          <p><strong>Category:</strong> {categories.find(c => c.id === field.category)?.label}</p>
                          {field.systemField && <p className="text-blue-500"><strong>System Field:</strong> Cannot be deleted</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 3: PREVIEW */}
          {currentTab === "preview" && (
            <div className="max-w-4xl mx-auto">
              <div 
                className="rounded-xl p-6 sm:p-8 space-y-6"
                style={{
                  background: modalStyles.card.background,
                  border: `1px solid ${modalStyles.card.borderColor}`,
                }}
              >
                <div className="text-center mb-8">
                  <h3 
                    className="text-2xl mb-2"
                    style={{
                      fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                      fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
                      color: DESIGN_TOKENS.colors.brand.red,
                    }}
                  >
                    Membership Registration Preview
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This is how applicants will see the form
                  </p>
                </div>

                {categories.map((category) => {
                  const categoryFields = fields
                    .filter(f => f.category === category.id && f.enabled)
                    .sort((a, b) => a.order - b.order);
                  
                  if (categoryFields.length === 0) return null;

                  return (
                    <div key={category.id} className="space-y-4">
                      <div className="flex items-center gap-3 pb-3 border-b" style={{ borderColor: modalStyles.card.borderColor }}>
                        <category.icon className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                        <h4 
                          className="text-base sm:text-lg"
                          style={{
                            fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                            fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                          }}
                        >
                          {category.label}
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {categoryFields.map((field) => (
                          <div 
                            key={field.id} 
                            className={field.type === "textarea" ? "sm:col-span-2" : ""}
                          >
                            <label className="block text-sm font-medium mb-2">
                              {field.label}
                              {field.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            
                            {field.type === "textarea" ? (
                              <textarea
                                placeholder={field.placeholder}
                                rows={3}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  background: isDark ? "rgba(30, 41, 59, 0.3)" : "white",
                                  borderColor: modalStyles.card.borderColor,
                                }}
                                disabled
                              />
                            ) : field.type === "select" ? (
                              <select
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  background: isDark ? "rgba(30, 41, 59, 0.3)" : "white",
                                  borderColor: modalStyles.card.borderColor,
                                }}
                                disabled
                              >
                                <option>{field.placeholder || `Select ${field.label.toLowerCase()}...`}</option>
                                {field.options?.map((opt, i) => (
                                  <option key={i}>{opt}</option>
                                ))}
                              </select>
                            ) : field.type === "checkbox" ? (
                              <div className="space-y-2">
                                {field.options?.map((opt, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <input type="checkbox" disabled className="w-4 h-4" />
                                    <span className="text-sm">{opt}</span>
                                  </div>
                                ))}
                              </div>
                            ) : field.type === "radio" ? (
                              <div className="space-y-2">
                                {field.options?.map((opt, i) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <input type="radio" name={field.id} disabled className="w-4 h-4" />
                                    <span className="text-sm">{opt}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <input
                                type={field.type}
                                placeholder={field.placeholder}
                                className="w-full px-4 py-2 rounded-lg border"
                                style={{
                                  background: isDark ? "rgba(30, 41, 59, 0.3)" : "white",
                                  borderColor: modalStyles.card.borderColor,
                                }}
                                disabled
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer - Responsive */}
        <div
          className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-t flex flex-col-reverse sm:flex-row justify-between items-center gap-3"
          style={{
            borderColor: modalStyles.footer.borderColor,
          }}
        >
          <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            <CheckCircle className="w-4 h-4 inline mr-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
            {enabledFieldsCount} of {fields.length} fields will be shown to applicants
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button
              variant="secondary"
              onClick={onClose}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onSave(fields);
                toast.success("Form configuration saved successfully!");
              }}
              className="flex-1 sm:flex-none"
            >
              Save Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}