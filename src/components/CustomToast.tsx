/**
 * =============================================================================
 * CUSTOM TOAST COMPONENT
 * =============================================================================
 * 
 * Custom toast notification panel for YSP application
 * 
 * =============================================================================
 */

import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";
import { DESIGN_TOKENS } from "./design-system";
import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  type?: "success" | "error" | "info" | "warning";
  duration?: number;
  onClose?: () => void;
  isDark?: boolean;
}

export function CustomToast({ 
  message, 
  type = "info", 
  duration = 3000, 
  onClose,
  isDark = false 
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5" style={{ color: "#10b981" }} />;
      case "error":
        return <AlertCircle className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.red }} />;
      case "warning":
        return <AlertTriangle className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.yellow }} />;
      case "info":
      default:
        return <Info className="w-5 h-5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />;
    }
  };

  const getBackgroundColor = () => {
    if (isDark) {
      return "rgba(31, 41, 55, 0.98)"; // gray-800 with high opacity
    }
    return "rgba(255, 255, 255, 0.98)"; // white with high opacity
  };

  const getBorderColor = () => {
    switch (type) {
      case "success":
        return "#10b981";
      case "error":
        return DESIGN_TOKENS.colors.brand.red;
      case "warning":
        return DESIGN_TOKENS.colors.brand.yellow;
      case "info":
      default:
        return DESIGN_TOKENS.colors.brand.orange;
    }
  };

  return (
    <div
      className={`fixed top-6 right-6 z-[9999] flex items-start gap-3 px-5 py-4 rounded-xl shadow-2xl backdrop-blur-md border-2 transition-all duration-300 ${
        isExiting ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0"
      }`}
      style={{
        background: getBackgroundColor(),
        borderColor: getBorderColor(),
        maxWidth: "420px",
        minWidth: "320px",
      }}
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>

      {/* Message */}
      <p
        className={`flex-1 ${isDark ? "text-gray-100" : "text-gray-800"}`}
        style={{
          fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
          fontSize: "0.9375rem",
          fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
          lineHeight: "1.5",
        }}
      >
        {message}
      </p>

      {/* Close Button */}
      <button
        onClick={handleClose}
        className={`flex-shrink-0 ${isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"} rounded-lg p-1 transition-colors`}
        aria-label="Close notification"
      >
        <X className={`w-4 h-4 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
      </button>
    </div>
  );
}

// Toast Manager Hook
export function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "success" | "error" | "info" | "warning"; isDark?: boolean }>>([]);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "info", isDark = false) => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type, isDark }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return {
    toasts,
    showToast,
    removeToast,
  };
}
