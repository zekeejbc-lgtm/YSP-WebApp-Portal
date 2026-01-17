/**
 * =============================================================================
 * FORGOT PASSWORD MODAL
 * =============================================================================
 *
 * Three-step password reset flow:
 * Step 1: Find account (username, full name, or email)
 * Step 2: Verify account + OTP
 * Step 3: Set new password
 *
 * =============================================================================
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { DESIGN_TOKENS, Button } from "./design-system";
import {
  lookupPasswordResetUser,
  sendPasswordResetOTP,
  verifyPasswordResetOTP,
  resetPasswordWithToken,
} from "../services/gasLoginService";

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
}

interface ResetUserInfo {
  fullName: string;
  username: string;
  email: string;
  idCode?: string;
}

interface PasswordStrength {
  score: number;
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

export default function ForgotPasswordModal({ isOpen, onClose, isDark }: ForgotPasswordModalProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [identifier, setIdentifier] = useState("");
  const [userInfo, setUserInfo] = useState<ResetUserInfo | null>(null);
  const [error, setError] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [otp, setOtp] = useState<string[]>(["", "", "", "", "", ""]);
  const [otpSent, setOtpSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [expiryTimer, setExpiryTimer] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

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
  const isPasswordValid = passwordStrength.score >= 3 && passwordsMatch;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    if (expiryTimer > 0) {
      const timer = setInterval(() => {
        setExpiryTimer((prev) => {
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
  }, [expiryTimer > 0]);

  useEffect(() => {
    if (otpSent && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [otpSent]);

  const handleClose = () => {
    if (isLookingUp || isSending || isVerifying || isSaving) return;
    setStep(1);
    setIdentifier("");
    setUserInfo(null);
    setError("");
    setOtp(["", "", "", "", "", ""]);
    setOtpSent(false);
    setResendTimer(0);
    setExpiryTimer(0);
    setResetToken("");
    setNewPassword("");
    setConfirmPassword("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setSuccess(false);
    onClose();
  };

  const handleLookup = async () => {
    const input = identifier.trim();
    if (!input) {
      setError("Please enter your username, full name, or email.");
      return;
    }

    setIsLookingUp(true);
    setError("");

    try {
      const result = await lookupPasswordResetUser(input);
      if (result.success && result.user) {
        setUserInfo(result.user);
        setStep(2);
        setOtp(["", "", "", "", "", ""]);
        setOtpSent(false);
        setResendTimer(0);
        setExpiryTimer(0);

        if (result.matchedBy === "email") {
          await handleSendOTP(result.user.username, result.user.email);
        }
      } else {
        setError(result.error || "No account found with that information.");
      }
    } catch (err) {
      setError("Failed to look up account. Please try again.");
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSendOTP = async (username?: string, email?: string) => {
    const user = userInfo;
    const targetUsername = username || user?.username;
    const targetEmail = email || user?.email;

    if (!targetUsername || !targetEmail) {
      setError("Email address is required to send a verification code.");
      return;
    }

    setIsSending(true);
    setError("");

    try {
      const result = await sendPasswordResetOTP(targetUsername, targetEmail);
      if (result.success) {
        setOtpSent(true);
        setResendTimer(30);
        setExpiryTimer(15 * 60);
        setOtp(["", "", "", "", "", ""]);
      } else {
        setError(result.error || "Failed to send verification code.");
      }
    } catch (err) {
      setError("Failed to send verification code. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!userInfo) {
      setError("Account information is missing.");
      return;
    }

    const otpCode = otp.join("");
    if (otpCode.length !== 6 || otp.some((d) => d === "")) {
      setError("Please enter all 6 digits.");
      return;
    }

    setIsVerifying(true);
    setError("");

    try {
      const result = await verifyPasswordResetOTP(userInfo.username, userInfo.email, otpCode);
      if (result.success && result.verified && result.resetToken) {
        setResetToken(result.resetToken);
        setStep(3);
        setOtp(["", "", "", "", "", ""]);
        setOtpSent(false);
        setResendTimer(0);
        setExpiryTimer(0);
      } else {
        setError(result.error || "Invalid verification code.");
        setOtp(["", "", "", "", "", ""]);
        if (inputRefs.current[0]) {
          inputRefs.current[0].focus();
        }
      }
    } catch (err) {
      setError("Failed to verify code. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userInfo || !resetToken) {
      setError("Verification is required before resetting your password.");
      return;
    }

    if (!isPasswordValid) {
      setError("Please ensure your password meets all requirements and matches.");
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const result = await resetPasswordWithToken(userInfo.username, resetToken, newPassword);
      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError(result.error || "Failed to reset password.");
      }
    } catch (err) {
      setError("Failed to reset password. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    setError("");
    if (value && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...otp];
        next[index - 1] = "";
        setOtp(next);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === "Enter") {
      handleVerifyOTP();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const next = ["", "", "", "", "", ""];
      for (let i = 0; i < pasted.length; i++) {
        next[i] = pasted[i];
      }
      setOtp(next);
      const lastIndex = Math.min(pasted.length - 1, 5);
      inputRefs.current[lastIndex]?.focus();
    }
  };

  const inputStyle = {
    height: `${DESIGN_TOKENS.interactive.input.height}px`,
    borderRadius: `${DESIGN_TOKENS.radius.input}px`,
    paddingLeft: "16px",
    paddingRight: "48px",
    fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
  };

  if (!isOpen) return null;

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.7)", zIndex: 999999 }}
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
                style={{ background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)" }}
              >
                <KeyRound className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2
                  className="font-semibold"
                  style={{
                    fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                    color: isDark ? "#fff" : "#1a1a1a",
                  }}
                >
                  Reset Password
                </h2>
                <p
                  className="text-muted-foreground"
                  style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                >
                  Step {step} of 3
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isLookingUp || isSending || isVerifying || isSaving}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex-shrink-0 disabled:opacity-50"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Progress */}
          <div className="px-4 sm:px-6 pb-4 flex-shrink-0" style={{ backgroundColor: isDark ? "#1e1e1e" : "#ffffff" }}>
            <div className="flex gap-2">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-1 flex-1 rounded-full transition-all duration-300"
                  style={{
                    background:
                      step >= index
                        ? "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)"
                        : isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.1)",
                  }}
                />
              ))}
            </div>
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
                    style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)" }}
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
                    Password Updated
                  </h3>
                  <p className="text-muted-foreground">
                    Your password has been reset successfully.
                  </p>
                </motion.div>
              ) : step === 1 ? (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <User className="w-4 h-4 text-[#f6421f]" />
                      <span
                        className="font-medium"
                        style={{
                          fontSize: `${DESIGN_TOKENS.typography.fontSize.body}px`,
                          color: isDark ? "#fff" : "#1a1a1a",
                        }}
                      >
                        Find Your Account
                      </span>
                    </div>
                    <p
                      className="text-muted-foreground"
                      style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                    >
                      Enter your username, full name, or email address.
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
                        Account Identifier
                      </label>
                      <input
                        type="text"
                        value={identifier}
                        onChange={(e) => {
                          setIdentifier(e.target.value);
                          setError("");
                        }}
                        placeholder="Username, full name, or email"
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
                          if (e.key === "Enter" && !isLookingUp) {
                            handleLookup();
                          }
                        }}
                      />
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
              ) : step === 2 ? (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
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
                        Verify Your Account
                      </span>
                    </div>
                    <p
                      className="text-muted-foreground"
                      style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                    >
                      Confirm these details and enter the OTP sent to your email.
                    </p>
                  </div>

                  {userInfo && (
                    <div
                      className="rounded-lg p-4 mb-4"
                      style={{
                        backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                        border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
                      }}
                    >
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Full name</span>
                          <span style={{ color: isDark ? "#fff" : "#1a1a1a" }}>{userInfo.fullName || "--"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Username</span>
                          <span style={{ color: isDark ? "#fff" : "#1a1a1a" }}>{userInfo.username}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">ID Code</span>
                          <span style={{ color: isDark ? "#fff" : "#1a1a1a" }}>{userInfo.idCode || "--"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Email</span>
                          <span style={{ color: isDark ? "#fff" : "#1a1a1a" }}>{userInfo.email}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {otpSent && (
                    <>
                      <div className="text-center mb-4">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          <Mail className="w-4 h-4 text-[#f6421f]" />
                          <span
                            className="font-medium"
                            style={{
                              fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px`,
                              color: isDark ? "#fff" : "#1a1a1a",
                            }}
                          >
                            Enter the 6-digit code
                          </span>
                        </div>
                        <p
                          className="text-muted-foreground"
                          style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.small}px` }}
                        >
                          We sent a code to <strong>{userInfo?.email}</strong>
                        </p>
                      </div>

                      <div className="flex justify-center gap-2 sm:gap-3 mb-6" onPaste={handleOtpPaste}>
                        {otp.map((digit, index) => (
                          <input
                            key={index}
                            ref={(el) => {
                              inputRefs.current[index] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(index, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                            disabled={isVerifying}
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

                      <div className="text-center mb-4">
                        {resendTimer > 0 ? (
                          <p
                            className="text-muted-foreground"
                            style={{ fontSize: `${DESIGN_TOKENS.typography.fontSize.caption}px` }}
                          >
                            Resend code in <span className="font-semibold text-[#f6421f]">{resendTimer}s</span>
                          </p>
                        ) : (
                          <button
                            onClick={() => handleSendOTP()}
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

                      <div
                        className="rounded-lg p-3 text-center"
                        style={{
                          backgroundColor:
                            expiryTimer <= 60
                              ? isDark
                                ? "rgba(239, 68, 68, 0.15)"
                                : "rgba(239, 68, 68, 0.1)"
                              : expiryTimer <= 180
                              ? isDark
                                ? "rgba(250, 204, 21, 0.15)"
                                : "rgba(250, 204, 21, 0.1)"
                              : isDark
                              ? "rgba(34, 197, 94, 0.15)"
                              : "rgba(34, 197, 94, 0.1)",
                          border:
                            expiryTimer <= 60
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
                            Code expires in <span className="font-bold tabular-nums">{Math.floor(expiryTimer / 60)}:{(expiryTimer % 60).toString().padStart(2, "0")}</span>
                          </span>
                        </div>
                      </div>
                    </>
                  )}

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
              ) : (
                <motion.div
                  key="step3"
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
                      Choose a strong, unique password.
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
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>

                      {newPassword && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-3 space-y-2"
                        >
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${(passwordStrength.score + 1) * 20}%` }}
                                className="h-full rounded-full transition-all duration-300"
                                style={{ backgroundColor: passwordStrength.color }}
                              />
                            </div>
                            <span className="text-xs font-medium" style={{ color: passwordStrength.color }}>
                              {passwordStrength.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-xs">
                            <RequirementItem met={passwordStrength.requirements.minLength} text="8+ characters" />
                            <RequirementItem met={passwordStrength.requirements.hasUppercase} text="Uppercase letter" />
                            <RequirementItem met={passwordStrength.requirements.hasLowercase} text="Lowercase letter" />
                            <RequirementItem met={passwordStrength.requirements.hasNumber} text="Number" />
                            <RequirementItem met={passwordStrength.requirements.hasSpecial} text="Special character" />
                          </div>
                        </motion.div>
                      )}
                    </div>

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
                            if (e.key === "Enter" && isPasswordValid && !isSaving) {
                              handleResetPassword();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {confirmPassword && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1 mt-1">
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

          {/* Footer */}
          {!success && (
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
                  onClick={handleLookup}
                  disabled={isLookingUp || !identifier.trim()}
                  className="w-full"
                >
                  {isLookingUp ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching...</span>
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              ) : step === 2 ? (
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setStep(1);
                      setError("");
                      setOtpSent(false);
                      setOtp(["", "", "", "", "", ""]);
                    }}
                    style={{ flex: "0 0 auto", minWidth: "100px", whiteSpace: "nowrap" }}
                  >
                    <span className="flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </span>
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={otpSent ? handleVerifyOTP : () => handleSendOTP()}
                    disabled={isSending || isVerifying || (!otpSent && !userInfo?.email)}
                    style={{ flex: 1, whiteSpace: "nowrap" }}
                  >
                    {otpSent ? (
                      isVerifying ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying...</span>
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Check className="w-4 h-4" />
                          <span>Verify Code</span>
                        </span>
                      )
                    ) : isSending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Sending Code...</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>Send Code</span>
                      </span>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={() => {
                      setStep(2);
                      setError("");
                    }}
                    style={{ flex: "0 0 auto", minWidth: "100px", whiteSpace: "nowrap" }}
                  >
                    <span className="flex items-center gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </span>
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleResetPassword}
                    disabled={isSaving || !isPasswordValid}
                    style={{ flex: 1, whiteSpace: "nowrap" }}
                  >
                    {isSaving ? (
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
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

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
