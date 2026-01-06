/**
 * =============================================================================
 * MAINTENANCE LOGIN MODAL
 * =============================================================================
 * 
 * Special login modal for admin/auditor access during maintenance
 * 
 * =============================================================================
 */

import { X, Lock, User } from "lucide-react";
import { DESIGN_TOKENS } from "./design-system";
import { useState } from "react";

interface MaintenanceLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => void;
  isDark?: boolean;
}

export function MaintenanceLoginModal({
  isOpen,
  onClose,
  onLogin,
  isDark = false,
}: MaintenanceLoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(email, password);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl shadow-2xl p-8 ${
          isDark ? "bg-gray-800" : "bg-white"
        }`}
        onClick={(e) => e.stopPropagation()}
        style={{
          border: `2px solid ${isDark ? "#374151" : "#e5e7eb"}`,
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 ${
            isDark ? "hover:bg-gray-700" : "hover:bg-gray-100"
          } rounded-lg p-2 transition-colors`}
          aria-label="Close modal"
        >
          <X className={`w-5 h-5 ${isDark ? "text-gray-400" : "text-gray-500"}`} />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}, ${DESIGN_TOKENS.colors.brand.orange})`,
              }}
            >
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2
            className={`text-center ${isDark ? "text-white" : "text-gray-900"}`}
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
              fontSize: "1.5rem",
            }}
          >
            Maintenance Access
          </h2>
          <p
            className={`text-center mt-2 ${isDark ? "text-gray-400" : "text-gray-600"}`}
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              fontSize: "0.875rem",
            }}
          >
            Admin & Auditor access only
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label
              htmlFor="email"
              className={`block mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                fontSize: "0.875rem",
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              }}
            >
              Email Address
            </label>
            <div className="relative">
              <User
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                  isDark ? "text-gray-500" : "text-gray-400"
                }`}
              />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all focus:outline-none ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white focus:border-orange-500"
                    : "bg-gray-50 border-gray-300 text-gray-900 focus:border-orange-500"
                }`}
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                  fontSize: "0.9375rem",
                }}
                placeholder="Enter your email"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label
              htmlFor="password"
              className={`block mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                fontSize: "0.875rem",
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              }}
            >
              Password
            </label>
            <div className="relative">
              <Lock
                className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                  isDark ? "text-gray-500" : "text-gray-400"
                }`}
              />
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={`w-full pl-10 pr-4 py-3 rounded-xl border-2 transition-all focus:outline-none ${
                  isDark
                    ? "bg-gray-700 border-gray-600 text-white focus:border-orange-500"
                    : "bg-gray-50 border-gray-300 text-gray-900 focus:border-orange-500"
                }`}
                style={{
                  fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
                  fontSize: "0.9375rem",
                }}
                placeholder="Enter your password"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3.5 rounded-xl text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
            style={{
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.red}, ${DESIGN_TOKENS.colors.brand.orange})`,
              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              fontWeight: DESIGN_TOKENS.typography.fontWeight.bold,
              fontSize: "1rem",
            }}
          >
            Access System
          </button>
        </form>
      </div>
    </div>
  );
}
