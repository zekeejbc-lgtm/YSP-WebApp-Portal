import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Eye, EyeOff, Loader2, ShieldCheck, X } from "lucide-react";
import { Button, DESIGN_TOKENS } from "./design-system";

interface TwoFactorActionModalProps {
  isOpen: boolean;
  isDark: boolean;
  title: string;
  subtitle: string;
  confirmLabel: string;
  loadingLabel?: string;
  onClose: () => void;
  onConfirm: (currentPassword: string, totpCode: string) => Promise<{ success: boolean; error?: string }>;
}

export default function TwoFactorActionModal({
  isOpen,
  isDark,
  title,
  subtitle,
  confirmLabel,
  loadingLabel = "Processing...",
  onClose,
  onConfirm,
}: TwoFactorActionModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleClose = () => {
    if (isSubmitting) return;
    setCurrentPassword("");
    setTotpCode("");
    setError("");
    setShowPassword(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (!currentPassword.trim()) {
      setError("Current password is required.");
      return;
    }

    const cleanCode = totpCode.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setError("Authenticator code must be 6 digits.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const result = await onConfirm(currentPassword, cleanCode);
      if (result.success) {
        handleClose();
      } else {
        setError(result.error || "Action failed.");
      }
    } catch {
      setError("Action failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputStyle = {
    height: `${DESIGN_TOKENS.interactive.input.height}px`,
    borderRadius: `${DESIGN_TOKENS.radius.input}px`,
    paddingLeft: "16px",
    paddingRight: "48px",
    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[1000000] flex items-center justify-center p-4 sm:p-6"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.7)" }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-md overflow-hidden shadow-2xl"
          style={{
            backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
            borderRadius: `${DESIGN_TOKENS.radius.modal}px`,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center justify-between border-b p-4 sm:p-6"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center gap-3">
              <div
                className="rounded-lg p-2"
                style={{ background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)" }}
              >
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`, color: isDark ? "#fff" : "#1a1a1a" }}>
                  {title}
                </h3>
                <p className="text-muted-foreground" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                  {subtitle}
                </p>
              </div>
            </div>
            <button onClick={handleClose} className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <label className="mb-2 block text-muted-foreground" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => {
                    setCurrentPassword(e.target.value);
                    setError("");
                  }}
                  placeholder="Enter your current password"
                  className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                  style={{
                    ...inputStyle,
                    borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                    color: isDark ? "#fff" : "#1a1a1a",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-muted-foreground" style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}>
                Authenticator Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => {
                  setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                placeholder="Enter 6-digit authenticator code"
                className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                style={{
                  ...inputStyle,
                  borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                  color: isDark ? "#fff" : "#1a1a1a",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isSubmitting) {
                    void handleSubmit();
                  }
                }}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div
            className="flex gap-3 border-t p-4 sm:p-6"
            style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
          >
            <Button variant="secondary" size="md" onClick={handleClose} style={{ flex: "0 0 auto", minWidth: "100px" }}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={handleSubmit} disabled={isSubmitting} style={{ flex: 1 }}>
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>{loadingLabel}</span>
                </span>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
