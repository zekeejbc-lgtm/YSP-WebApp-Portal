import { useState } from "react";
import {
  Type,
  AlignLeft,
  Mail,
  Phone,
  Calendar,
  List,
  Circle,
  Square,
  Upload,
  Hash,
  Globe,
  ChevronDown,
  Plus,
} from "lucide-react";
import { DESIGN_TOKENS } from "./design-system";

interface AddFieldDropdownProps {
  isDark: boolean;
  onAddField: (fieldType: string) => void;
}

export default function AddFieldDropdown({
  isDark,
  onAddField,
}: AddFieldDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const fieldTypes = [
    { type: "text", label: "Short Text", icon: Type },
    { type: "textarea", label: "Long Text", icon: AlignLeft },
    { type: "email", label: "Email", icon: Mail },
    { type: "phone", label: "Phone", icon: Phone },
    { type: "number", label: "Number", icon: Hash },
    { type: "date", label: "Date", icon: Calendar },
    { type: "url", label: "URL", icon: Globe },
    { type: "select", label: "Dropdown", icon: List },
    { type: "radio", label: "Multiple Choice", icon: Circle },
    { type: "checkbox", label: "Checkboxes", icon: Square },
    { type: "file", label: "File Upload", icon: Upload },
  ];

  const handleSelect = (fieldType: string) => {
    onAddField(fieldType);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-all"
        style={{
          background: isDark
            ? "rgba(246, 66, 31, 0.1)"
            : "rgba(246, 66, 31, 0.08)",
          color: DESIGN_TOKENS.colors.brand.red,
          border: `1px solid ${DESIGN_TOKENS.colors.brand.red}40`,
          fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
        }}
      >
        <Plus className="w-4 h-4" />
        <span>Add Field</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div
            className="absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-2xl z-50 overflow-hidden"
            style={{
              background: isDark
                ? "rgba(30, 41, 59, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(20px)",
              borderColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.1)",
            }}
          >
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
                Select Field Type
              </div>
              <div className="space-y-1">
                {fieldTypes.map((field) => {
                  const Icon = field.icon;
                  return (
                    <button
                      key={field.type}
                      onClick={() => handleSelect(field.type)}
                      className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-sm transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
                      style={{
                        fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                      }}
                    >
                      <Icon className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                      <span>{field.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
