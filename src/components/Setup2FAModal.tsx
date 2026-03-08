import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { AlertCircle, Check, Loader2, ShieldCheck, X } from "lucide-react";
import { Button, DESIGN_TOKENS } from "./design-system";
import type { TwoFactorEnrollmentResponse } from "../services/gasLoginService";

interface Setup2FAModalProps {
  isOpen: boolean;
  isDark: boolean;
  mode: "enroll" | "reset";
  onClose: () => void;
  onStart: () => Promise<TwoFactorEnrollmentResponse>;
  onConfirm: (code: string) => Promise<TwoFactorEnrollmentResponse>;
  onCompleted?: () => void;
}

export default function Setup2FAModal({
  isOpen,
  isDark,
  mode,
  onClose,
  onStart,
  onConfirm,
  onCompleted,
}: Setup2FAModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [secret, setSecret] = useState("");
  const [otpAuthUri, setOtpAuthUri] = useState("");
  const [code, setCode] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;

    const load = async () => {
      setIsLoading(true);
      setError("");
      setCode("");
      setSuccess(false);
      try {
        const result = await onStart();
        if (!mounted) return;
        if (result.success && result.secret && result.otpAuthUri) {
          setSecret(result.secret);
          setOtpAuthUri(result.otpAuthUri);
        } else {
          setError(result.error || "Failed to start authenticator setup.");
        }
      } catch {
        if (mounted) {
          setError("Failed to start authenticator setup.");
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [isOpen, onStart]);

  if (!isOpen) return null;

  const title = mode === "reset" ? "Reset Authenticator Secret" : "Set Up Authenticator";

  const handleSubmit = async () => {
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setError("Authenticator code must be 6 digits.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      const result = await onConfirm(cleanCode);
      if (result.success) {
        setSuccess(true);
        onCompleted?.();
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(result.error || "Invalid authenticator code.");
      }
    } catch {
      setError("Failed to verify authenticator code.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-1000000 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.72)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: isDark ? "#1e1e1e" : "#ffffff",
          borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between border-b p-4"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#f6421f]" />
            <h3
              style={{
                fontSize: `${DESIGN_TOKENS.typography.fontSize.h3}px`,
                color: isDark ? "#fff" : "#1a1a1a",
              }}
            >
              {title}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-black/10 dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing setup...
            </div>
          ) : (
            <>
              {otpAuthUri && (
                <div className="flex justify-center">
                  <div className="rounded-xl bg-white p-3">
                    <QRCodeSVG value={otpAuthUri} size={180} />
                  </div>
                </div>
              )}

              {secret && (
                <div
                  className="rounded-lg border p-3"
                  style={{ borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)" }}
                >
                  <p className="mb-1 text-xs text-muted-foreground">Manual key</p>
                  <p className="break-all font-mono text-sm" style={{ color: isDark ? "#fff" : "#1a1a1a" }}>
                    {secret}
                  </p>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm text-muted-foreground">Enter 6-digit code from your app</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                    setError("");
                  }}
                  className="w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#f6421f]/25"
                  style={{
                    borderColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.15)",
                    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#fff",
                    color: isDark ? "#fff" : "#1a1a1a",
                  }}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  <span>Authenticator updated successfully.</span>
                </div>
              )}
            </>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 border-t p-4"
          style={{ borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" }}
        >
          <Button variant="secondary" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={isLoading || isSubmitting || success}>
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
              </span>
            ) : (
              "Confirm"
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
