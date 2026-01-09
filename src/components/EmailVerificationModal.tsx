/**
 * =============================================================================
 * EMAIL VERIFICATION MODAL
 * =============================================================================
 * 
 * OTP-based email verification modal with:
 * - 6-digit OTP input fields
 * - 30-second countdown timer for resend
 * - 15-minute OTP expiry notice
 * - Consistent design with other modals
 * 
 * =============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Loader2, Check, AlertCircle, Clock, RefreshCw, ShieldCheck } from "lucide-react";
import { DESIGN_TOKENS, Button } from "./design-system";

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  username: string;
  onSendOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  onVerifyOTP: (otp: string) => Promise<{ success: boolean; verified?: boolean; error?: string }>;
  isDark: boolean;
  addUploadToast?: (message: { id: string; title: string; message: string; status: 'loading' | 'success' | 'error'; progress?: number }) => void;
  updateUploadToast?: (id: string, updates: Partial<{ title?: string; message: string; status: 'loading' | 'success' | 'error'; progress?: number }>) => void;
}

export default function EmailVerificationModal({
  isOpen,
  onClose,
  email,
  username,
  onSendOTP,
  onVerifyOTP,
  isDark,
  addUploadToast,
  updateUploadToast,
}: EmailVerificationModalProps) {
  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [expiryTimer, setExpiryTimer] = useState(0); // 15 minutes in seconds
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Reset state when modal closes or opens
  useEffect(() => {
    if (isOpen) {
      setOtp(["", "", "", "", "", ""]);
      setError("");
      setSuccess(false);
      setOtpSent(false);
      setResendTimer(0);
      setExpiryTimer(0);
    }
  }, [isOpen]);

  // Resend timer countdown
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // OTP Expiry timer countdown (15 minutes)
  useEffect(() => {
    if (expiryTimer > 0) {
      const timer = setInterval(() => {
        setExpiryTimer(prev => {
          if (prev <= 1) {
            setError("Verification code has expired. Please request a new one.");
            setOtpSent(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [expiryTimer > 0]); // Only re-run when timer starts/stops

  // Auto-focus first input when OTP is sent
  useEffect(() => {
    if (otpSent && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [otpSent]);

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

  const handleClose = () => {
    if (!isLoading && !isSending) {
      onClose();
    }
  };

  const handleSendOTP = async () => {
    setIsSending(true);
    setError("");

    const toastId = `otp-send-${Date.now()}`;

    try {
      if (addUploadToast) {
        addUploadToast({
          id: toastId,
          title: "Email Verification",
          message: `Sending verification code to ${email}...`,
          status: "loading",
          progress: 30,
        });
      }

      const result = await onSendOTP(email);

      if (result.success) {
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            message: "Verification code sent! Check your email.",
            status: "success",
            progress: 100,
          });
        }
        setOtpSent(true);
        setResendTimer(30);
        setExpiryTimer(15 * 60); // 15 minutes in seconds
        setOtp(["", "", "", "", "", ""]);
      } else {
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            message: result.error || "Failed to send verification code",
            status: "error",
            progress: 100,
          });
        }
        setError(result.error || "Failed to send verification code");
      }
    } catch (err) {
      if (updateUploadToast) {
        updateUploadToast(toastId, {
          message: "Failed to send verification code",
          status: "error",
          progress: 100,
        });
      }
      setError("An error occurred. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    const otpCode = otp.join("");
    
    console.log('OTP array:', otp);
    console.log('OTP code:', otpCode);
    console.log('OTP length:', otpCode.length);
    
    if (otpCode.length !== 6 || otp.some(d => d === "")) {
      setError("Please enter all 6 digits");
      return;
    }

    setIsLoading(true);
    setError("");

    const toastId = `otp-verify-${Date.now()}`;

    try {
      if (addUploadToast) {
        addUploadToast({
          id: toastId,
          title: "Email Verification",
          message: "Verifying code...",
          status: "loading",
          progress: 50,
        });
      }

      const result = await onVerifyOTP(otpCode);

      if (result.success && result.verified) {
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            message: "Email verified successfully!",
            status: "success",
            progress: 100,
          });
        }
        setSuccess(true);
        
        // Close modal after showing success
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        if (updateUploadToast) {
          updateUploadToast(toastId, {
            message: result.error || "Invalid verification code",
            status: "error",
            progress: 100,
          });
        }
        setError(result.error || "Invalid verification code");
        // Clear OTP on error
        setOtp(["", "", "", "", "", ""]);
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }
    } catch (err) {
      if (updateUploadToast) {
        updateUploadToast(toastId, {
          message: "Failed to verify code",
          status: "error",
          progress: 100,
        });
      }
      setError("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError("");

    // Auto-focus next input
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        // Move to previous input if current is empty
        inputRefs.current[index - 1]?.focus();
        const newOtp = [...otp];
        newOtp[index - 1] = "";
        setOtp(newOtp);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      handleVerifyOTP();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData) {
      const newOtp = ["", "", "", "", "", ""];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      
      // Focus last filled input or last input
      const lastFilledIndex = Math.min(pastedData.length - 1, 5);
      inputRefs.current[lastFilledIndex]?.focus();
    }
  };

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
          {/* Header */}
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
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2
                  className="font-semibold"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    color: isDark ? "#fff" : "#1a1a1a",
                  }}
                >
                  Verify Email
                </h2>
                <p
                  className="text-muted-foreground truncate max-w-[200px]"
                  style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                >
                  {email}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isLoading || isSending}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1">
            <AnimatePresence mode="wait">
              {success ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8"
                >
                  <div
                    className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    }}
                  >
                    <Check className="w-8 h-8 text-white" />
                  </div>
                  <h3
                    className="font-semibold mb-2"
                    style={{
                      fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                      color: isDark ? "#fff" : "#1a1a1a",
                    }}
                  >
                    Email Verified!
                  </h3>
                  <p className="text-muted-foreground">
                    Your email has been successfully verified.
                  </p>
                </motion.div>
              ) : !otpSent ? (
                <motion.div
                  key="initial"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="text-center mb-6">
                    <div
                      className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${isDark ? 'rgba(246, 66, 31, 0.2)' : 'rgba(246, 66, 31, 0.1)'} 0%, ${isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.1)'} 100%)`,
                        border: "2px dashed #f6421f",
                      }}
                    >
                      <Mail className="w-8 h-8 text-[#f6421f]" />
                    </div>
                    <p
                      className="text-muted-foreground mb-2"
                      style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px` }}
                    >
                      We'll send a 6-digit verification code to:
                    </p>
                    <p
                      className="font-semibold"
                      style={{
                        fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                        color: isDark ? "#fff" : "#1a1a1a",
                      }}
                    >
                      {email}
                    </p>
                  </div>

                  {/* Info box */}
                  <div
                    className="rounded-lg p-4 mb-4"
                    style={{
                      backgroundColor: isDark ? "rgba(255, 136, 0, 0.1)" : "rgba(255, 136, 0, 0.05)",
                      border: "1px solid rgba(255, 136, 0, 0.2)",
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-[#FF8800] flex-shrink-0 mt-0.5" />
                      <div>
                        <p
                          className="font-medium mb-1"
                          style={{
                            fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                            color: isDark ? "#fff" : "#1a1a1a",
                          }}
                        >
                          Code expires in 15 minutes
                        </p>
                        <p
                          className="text-muted-foreground"
                          style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.small}px` }}
                        >
                          Make sure to check your spam folder if you don't see the email.
                        </p>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mb-4"
                    >
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-sm text-red-500">{error}</span>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="otp-entry"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="text-center mb-6">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <ShieldCheck className="w-5 h-5 text-[#f6421f]" />
                      <span
                        className="font-medium"
                        style={{
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                          color: isDark ? "#fff" : "#1a1a1a",
                        }}
                      >
                        Enter Verification Code
                      </span>
                    </div>
                    <p
                      className="text-muted-foreground"
                      style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                    >
                      We sent a 6-digit code to <strong>{email}</strong>
                    </p>
                  </div>

                  {/* OTP Input Fields */}
                  <div className="flex justify-center gap-2 sm:gap-3 mb-6" onPaste={handlePaste}>
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { inputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        disabled={isLoading}
                        className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold border-2 rounded-lg transition-all focus:outline-none focus:border-[#f6421f] focus:ring-2 focus:ring-[#f6421f]/20 disabled:opacity-50"
                        style={{
                          backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.02)",
                          borderColor: error
                            ? "#ef4444"
                            : digit
                            ? "#f6421f"
                            : isDark
                            ? "rgba(255, 255, 255, 0.1)"
                            : "rgba(0, 0, 0, 0.1)",
                          color: isDark ? "#fff" : "#1a1a1a",
                        }}
                      />
                    ))}
                  </div>

                  {/* Timer and Resend */}
                  <div className="text-center mb-4">
                    {resendTimer > 0 ? (
                      <p
                        className="text-muted-foreground"
                        style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                      >
                        Resend code in{" "}
                        <span className="font-semibold text-[#f6421f]">{resendTimer}s</span>
                      </p>
                    ) : (
                      <button
                        onClick={handleSendOTP}
                        disabled={isSending}
                        className="flex items-center gap-2 mx-auto text-[#f6421f] hover:text-[#d63a1a] transition-colors disabled:opacity-50"
                        style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                        <span>{isSending ? "Sending..." : "Resend Code"}</span>
                      </button>
                    )}
                  </div>

                  {/* Expiry countdown timer */}
                  <div
                    className="rounded-lg p-3 text-center"
                    style={{
                      backgroundColor: expiryTimer <= 60 
                        ? (isDark ? "rgba(239, 68, 68, 0.15)" : "rgba(239, 68, 68, 0.1)")
                        : expiryTimer <= 180
                        ? (isDark ? "rgba(250, 204, 21, 0.15)" : "rgba(250, 204, 21, 0.1)")
                        : (isDark ? "rgba(34, 197, 94, 0.15)" : "rgba(34, 197, 94, 0.1)"),
                      border: expiryTimer <= 60 
                        ? "1px solid rgba(239, 68, 68, 0.4)"
                        : expiryTimer <= 180
                        ? "1px solid rgba(250, 204, 21, 0.4)"
                        : "1px solid rgba(34, 197, 94, 0.4)",
                    }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Clock 
                        className={`w-4 h-4 ${
                          expiryTimer <= 60 
                            ? "text-red-500" 
                            : expiryTimer <= 180 
                            ? "text-yellow-600" 
                            : "text-green-600"
                        }`} 
                      />
                      <span
                        className={`font-medium ${
                          expiryTimer <= 60 
                            ? "text-red-600 dark:text-red-400" 
                            : expiryTimer <= 180 
                            ? "text-yellow-700 dark:text-yellow-400" 
                            : "text-green-700 dark:text-green-400"
                        }`}
                        style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                      >
                        Code expires in{" "}
                        <span className="font-bold tabular-nums">
                          {Math.floor(expiryTimer / 60)}:{(expiryTimer % 60).toString().padStart(2, '0')}
                        </span>
                      </span>
                    </div>
                    {expiryTimer <= 60 && (
                      <p 
                        className="text-red-500 mt-1"
                        style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.small}px` }}
                      >
                        Hurry! Code expiring soon
                      </p>
                    )}
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 mt-4"
                    >
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-sm text-red-500">{error}</span>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          {!success && (
            <div
              className="p-4 sm:p-6 border-t flex-shrink-0"
              style={{
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
                backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
              }}
            >
              {!otpSent ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSendOTP}
                  disabled={isSending}
                  className="w-full"
                >
                  {isSending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending Code...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Mail className="w-4 h-4" />
                      <span>Send Verification Code</span>
                    </span>
                  )}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleVerifyOTP}
                  disabled={isLoading || otp.some(d => d === "")}
                  className="w-full"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Check className="w-4 h-4" />
                      <span>Verify Email</span>
                    </span>
                  )}
                </Button>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
