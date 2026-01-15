/**
 * =============================================================================
 * CHANGE PASSWORD MODAL
 * =============================================================================
 * 
 * Two-step modal for changing user password:
 * Step 1: Verify current password
 * Step 2: Enter new password with strength validation and confirmation
 * 
 * =============================================================================
 */

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Eye, EyeOff, Check, AlertCircle, Loader2, Lock, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";
import { DESIGN_TOKENS, Button } from "./design-system";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChangePassword: (currentPassword: string, newPassword: string, signal?: AbortSignal) => Promise<{ success: boolean; error?: string }>;
  onVerifyPassword: (password: string) => Promise<{ valid: boolean; error?: string }>;
  isDark: boolean;
  addUploadToast?: (message: { id: string; title: string; message: string; status: 'loading' | 'success' | 'error' | 'info'; progress?: number; onCancel?: () => void }) => void;
  updateUploadToast?: (id: string, updates: Partial<{ title?: string; message: string; status: 'loading' | 'success' | 'error' | 'info'; progress?: number }>) => void;
}

interface PasswordStrength {
  score: number; // 0-4
  label: string;
  color: string;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  onChangePassword,
  onVerifyPassword,
  isDark,
  addUploadToast,
  updateUploadToast,
}: ChangePasswordModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState("");
  const [verifiedPassword, setVerifiedPassword] = useState("");

  // Calculate password strength
  const calculateStrength = (password: string): PasswordStrength => {
    const requirements = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    };

    const score = Object.values(requirements).filter(Boolean).length;

    const labels = ["Very Weak", "Weak", "Fair", "Strong", "Very Strong"];
    const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"];

    return {
      score: Math.min(score, 4),
      label: labels[Math.min(score, 4)],
      color: colors[Math.min(score, 4)],
      requirements,
    };
  };

  const passwordStrength = calculateStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const isSameAsOldPassword = newPassword.length > 0 && newPassword === verifiedPassword;
  const isPasswordValid = passwordStrength.score >= 3 && passwordsMatch && !isSameAsOldPassword;

  // Reset state when modal closes
  const handleClose = () => {
    setStep(1);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setError("");
    setVerifiedPassword("");
    onClose();
  };

  // Step 1: Verify current password
  const handleVerifyPassword = async () => {
    if (!currentPassword.trim()) {
      setError("Please enter your current password");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const result = await onVerifyPassword(currentPassword);
      if (result.valid) {
        setVerifiedPassword(currentPassword);
        setStep(2);
        setError("");
      } else {
        setError(result.error || "Incorrect password. Please try again.");
      }
    } catch (err) {
      setError("Failed to verify password. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  // Step 2: Change password
  const handleChangePassword = async () => {
    if (!isPasswordValid) {
      setError("Please ensure your password meets all requirements and both passwords match");
      return;
    }

    // Check if new password is same as current
    if (newPassword === verifiedPassword) {
      setError("New password must be different from your current password");
      return;
    }

    setIsChanging(true);
    setError("");

    // Generate toast ID
    const toastId = `password-change-${Date.now()}`;
    const controller = new AbortController();
    const { signal } = controller;

    try {
      // Show progress toast
      if (addUploadToast) {
        addUploadToast({
          id: toastId,
          title: "Password Change",
          message: "Changing password...",
          status: "loading",
          progress: 30,
          onCancel: () => {
            controller.abort();
            if (updateUploadToast) {
              updateUploadToast(toastId, {
                title: "Cancelled",
                message: "Password change cancelled",
                status: "info",
                progress: 100,
              });
            }
          },
        });
      }

      const result = await onChangePassword(verifiedPassword, newPassword, signal);
      if (signal.aborted) {
        return;
      }

      if (result.success) {
        // Update toast to success
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            message: "Password changed successfully!",
            status: "success",
            progress: 100,
          });
        }
        
        // Close modal after short delay
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        // Update toast to error
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            message: result.error || "Failed to change password",
            status: "error",
            progress: 100,
          });
        }
        setError(result.error || "Failed to change password. Please try again.");
      }
    } catch (err) {
      if (signal.aborted) {
        return;
      }
      if (updateUploadToast) {
        updateUploadToast(toastId, {
          message: "Failed to change password",
          status: "error",
          progress: 100,
        });
      }
      setError("An error occurred. Please try again.");
    } finally {
      setIsChanging(false);
    }
  };

  const inputStyle = {
    height: `${DESIGN_TOKENS.interactive.input.height}px`,
    borderRadius: `${DESIGN_TOKENS.radius.input}px`,
    paddingLeft: "16px",
    paddingRight: "48px",
    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
        style={{ 
          backgroundColor: "rgba(0, 0, 0, 0.7)",
          zIndex: 999999,
        }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
          style={{
            backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
            borderRadius: `${DESIGN_TOKENS.radius.modal}px`,
            border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}`,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sticky Header */}
          <div
            className="flex items-center justify-between p-4 sm:p-6 border-b flex-shrink-0"
            style={{
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="p-2 rounded-lg"
                style={{
                  background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                }}
              >
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2
                  className="font-semibold"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    color: isDark ? "#fff" : "#1a1a1a",
                  }}
                >
                  Change Password
                </h2>
                <p
                  className="text-muted-foreground"
                  style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                >
                  Step {step} of 2
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Progress indicator - part of header */}
          <div className="px-4 sm:px-6 pb-4 flex-shrink-0" style={{ backgroundColor: isDark ? "#1e1e1e" : "#ffffff" }}>
            <div className="flex gap-2">
              <div
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{
                  background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
                }}
              />
              <div
                className="h-1 flex-1 rounded-full transition-all duration-300"
                style={{
                  background: step === 2
                    ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                    : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                }}
              />
            </div>
          </div>

          {/* Scrollable Content */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            <AnimatePresence mode="wait">
              {step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="w-4 h-4 text-[#f6421f]" />
                      <span
                        className="font-medium"
                        style={{
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                          color: isDark ? "#fff" : "#1a1a1a",
                        }}
                      >
                        Verify Your Identity
                      </span>
                    </div>
                    <p
                      className="text-muted-foreground"
                      style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                    >
                      Enter your current password to continue
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label
                        className="block text-muted-foreground mb-2"
                        style={{
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                        }}
                      >
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showCurrentPassword ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => {
                            setCurrentPassword(e.target.value);
                            setError("");
                          }}
                          placeholder="Enter your current password"
                          className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                          style={{
                            ...inputStyle,
                            borderColor: error
                              ? "#ef4444"
                              : isDark
                              ? "rgba(255, 255, 255, 0.1)"
                              : "rgba(0, 0, 0, 0.1)",
                            color: isDark ? "#fff" : "#1a1a1a",
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !isVerifying) {
                              handleVerifyPassword();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showCurrentPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                      >
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="text-sm text-red-500">{error}</span>
                      </motion.div>
                    )}

                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-4 h-4 text-[#f6421f]" />
                      <span
                        className="font-medium"
                        style={{
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                          color: isDark ? "#fff" : "#1a1a1a",
                        }}
                      >
                        Create New Password
                      </span>
                    </div>
                    <p
                      className="text-muted-foreground"
                      style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                    >
                      Choose a strong, unique password
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* New Password */}
                    <div>
                      <label
                        className="block text-muted-foreground mb-2"
                        style={{
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                        }}
                      >
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setError("");
                          }}
                          placeholder="Enter new password"
                          className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                          style={{
                            ...inputStyle,
                            borderColor: isDark
                              ? "rgba(255, 255, 255, 0.1)"
                              : "rgba(0, 0, 0, 0.1)",
                            color: isDark ? "#fff" : "#1a1a1a",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showNewPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>

                      {/* Password Strength Indicator */}
                      {newPassword && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 space-y-2"
                        >
                          {/* Strength bar */}
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(passwordStrength.score + 1) * 20}%` }}
                                className="h-full rounded-full transition-all duration-300"
                                style={{ backgroundColor: passwordStrength.color }}
                              />
                            </div>
                            <span
                              className="text-xs font-medium"
                              style={{ color: passwordStrength.color }}
                            >
                              {passwordStrength.label}
                            </span>
                          </div>

                          {/* Requirements checklist */}
                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <RequirementItem
                              met={passwordStrength.requirements.minLength}
                              text="8+ characters"
                            />
                            <RequirementItem
                              met={passwordStrength.requirements.hasUppercase}
                              text="Uppercase letter"
                            />
                            <RequirementItem
                              met={passwordStrength.requirements.hasLowercase}
                              text="Lowercase letter"
                            />
                            <RequirementItem
                              met={passwordStrength.requirements.hasNumber}
                              text="Number"
                            />
                            <RequirementItem
                              met={passwordStrength.requirements.hasSpecial}
                              text="Special character"
                            />
                          </div>

                          {/* Same as old password warning */}
                          {isSameAsOldPassword && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center gap-2 p-2 rounded-lg mt-2"
                              style={{
                                backgroundColor: "rgba(245, 158, 11, 0.1)",
                                border: "1px solid rgba(245, 158, 11, 0.3)",
                              }}
                            >
                              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                This is the same as your current password
                              </span>
                            </motion.div>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label
                        className="block text-muted-foreground mb-2"
                        style={{
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                          fontWeight: DESIGN_TOKENS.typography.fontWeight.medium,
                        }}
                      >
                        Confirm New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setError("");
                          }}
                          placeholder="Confirm new password"
                          className="w-full border-2 bg-white/50 dark:bg-white/5 backdrop-blur-sm transition-all focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20"
                          style={{
                            ...inputStyle,
                            borderColor: confirmPassword
                              ? passwordsMatch
                                ? "#22c55e"
                                : "#ef4444"
                              : isDark
                              ? "rgba(255, 255, 255, 0.1)"
                              : "rgba(0, 0, 0, 0.1)",
                            color: isDark ? "#fff" : "#1a1a1a",
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && isPasswordValid && !isChanging) {
                              handleChangePassword();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="w-5 h-5" />
                          ) : (
                            <Eye className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      {confirmPassword && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-1 mt-1"
                        >
                          {passwordsMatch ? (
                            <>
                              <Check className="w-3 h-3 text-green-500" />
                              <span className="text-xs text-green-500">Passwords match</span>
                            </>
                          ) : (
                            <>
                              <AlertCircle className="w-3 h-3 text-red-500" />
                              <span className="text-xs text-red-500">Passwords do not match</span>
                            </>
                          )}
                        </motion.div>
                      )}
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20"
                      >
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <span className="text-sm text-red-500">{error}</span>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sticky Footer with Action Buttons */}
          <div
            className="p-4 sm:p-6 border-t flex-shrink-0"
            style={{
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
              backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
            }}
          >
            {step === 1 ? (
              <Button
                variant="primary"
                size="md"
                onClick={handleVerifyPassword}
                disabled={isVerifying || !currentPassword.trim()}
                className="w-full"
                style={{ whiteSpace: 'nowrap' }}
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying...</span>
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <span>Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setStep(1);
                    setNewPassword("");
                    setConfirmPassword("");
                    setError("");
                  }}
                  style={{ flex: '0 0 auto', minWidth: '100px', whiteSpace: 'nowrap' }}
                >
                  <span className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back</span>
                  </span>
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleChangePassword}
                  disabled={isChanging || !isPasswordValid}
                  style={{ flex: '1', whiteSpace: 'nowrap' }}
                >
                  {isChanging ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>Save Password</span>
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

// Requirement item component
function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <Check className="w-3 h-3 text-green-500" />
      ) : (
        <div className="w-3 h-3 rounded-full border border-gray-300 dark:border-gray-600" />
      )}
      <span className={met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}>
        {text}
      </span>
    </div>
  );
}
