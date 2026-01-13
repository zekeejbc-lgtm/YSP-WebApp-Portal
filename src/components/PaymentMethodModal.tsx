/**
 * =============================================================================
 * PAYMENT METHOD MODAL COMPONENT
 * =============================================================================
 * 
 * Shows full payment details for Tabang ta Bai donations
 * - Large QR code display (256x256px)
 * - Account name and number
 * - Copy to clipboard functionality
 * - Instructions
 * - Edit button (admin/auditor only)
 * - Fully responsive
 * 
 * =============================================================================
 */

import { X, Copy, Check, Edit2, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ImageWithFallback } from './figma/ImageWithFallback';

export interface PaymentMethod {
  id: string;
  name: string;
  accountName: string;
  accountNumber: string;
  qrCode: string;
  instructions: string;
  logo?: string;
}

interface PaymentMethodModalProps {
  paymentMethod: PaymentMethod;
  isDark: boolean;
  userRole?: 'admin' | 'auditor' | 'member';
  onClose: () => void;
  onEdit?: (method: PaymentMethod) => void;
}

export default function PaymentMethodModal({
  paymentMethod,
  isDark,
  userRole,
  onClose,
  onEdit
}: PaymentMethodModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(paymentMethod.accountNumber);
    setCopied(true);
    toast.success('Account number copied!', {
      description: 'Paste it in your payment app'
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const canEdit = userRole === 'admin' || userRole === 'auditor';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{
          background: isDark
            ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.98) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(248, 250, 252, 0.98) 100%)',
          border: isDark ? '2px solid rgba(238, 135, 36, 0.3)' : '2px solid rgba(238, 135, 36, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-start justify-between p-6 border-b"
          style={{
            background: isDark
              ? 'rgba(30, 41, 59, 0.95)'
              : 'rgba(255, 255, 255, 0.95)',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex-1 min-w-0">
            <h2
              className="text-2xl mb-1 truncate"
              style={{
                fontFamily: 'var(--font-headings)',
                fontWeight: 'var(--font-weight-bold)',
                color: '#ee8724',
              }}
            >
              {paymentMethod.name}
            </h2>
            <p
              className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
              style={{ fontWeight: '500' }}
            >
              Payment Details
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 rounded-lg transition-all duration-300 hover:scale-110 flex-shrink-0"
            style={{
              background: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              color: isDark ? '#fff' : '#1e293b',
            }}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* QR Code - Large Display */}
          <div className="flex flex-col items-center">
            <div
              className="relative rounded-2xl overflow-hidden shadow-lg mb-4"
              style={{
                border: '4px solid #ee8724',
                background: '#fff',
              }}
            >
              <ImageWithFallback
                src={paymentMethod.qrCode}
                alt={`${paymentMethod.name} QR Code`}
                className="w-64 h-64 object-contain"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Smartphone className="w-4 h-4" />
              <span style={{ fontWeight: '500' }}>Scan with your payment app</span>
            </div>
          </div>

          {/* Account Details */}
          <div className="space-y-4">
            {/* Account Name */}
            <div>
              <label
                className={`block text-sm mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                style={{ fontWeight: '600' }}
              >
                Account Name
              </label>
              <div
                className="px-4 py-3 rounded-xl"
                style={{
                  background: isDark ? 'rgba(238, 135, 36, 0.1)' : 'rgba(238, 135, 36, 0.05)',
                  border: isDark ? '1px solid rgba(238, 135, 36, 0.2)' : '1px solid rgba(238, 135, 36, 0.15)',
                }}
              >
                <p
                  className="text-lg"
                  style={{
                    fontWeight: '700',
                    color: isDark ? '#fff' : '#1e293b',
                  }}
                >
                  {paymentMethod.accountName}
                </p>
              </div>
            </div>

            {/* Account Number */}
            <div>
              <label
                className={`block text-sm mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                style={{ fontWeight: '600' }}
              >
                Account Number / Mobile Number
              </label>
              <div
                className="px-4 py-3 rounded-xl flex items-center justify-between gap-3"
                style={{
                  background: isDark ? 'rgba(238, 135, 36, 0.1)' : 'rgba(238, 135, 36, 0.05)',
                  border: isDark ? '1px solid rgba(238, 135, 36, 0.2)' : '1px solid rgba(238, 135, 36, 0.15)',
                }}
              >
                <p
                  className="text-lg font-mono flex-1 min-w-0"
                  style={{
                    fontWeight: '700',
                    color: isDark ? '#fff' : '#1e293b',
                  }}
                >
                  {paymentMethod.accountNumber}
                </p>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg transition-all duration-300 hover:scale-110 flex-shrink-0"
                  style={{
                    background: isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.15)',
                    color: '#ee8724',
                  }}
                  aria-label="Copy account number"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label
                className={`block text-sm mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                style={{ fontWeight: '600' }}
              >
                Instructions
              </label>
              <div
                className="px-4 py-3 rounded-xl"
                style={{
                  background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(0, 0, 0, 0.1)',
                }}
              >
                <p
                  className={`text-sm whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                  style={{ fontWeight: '500', lineHeight: '1.6' }}
                >
                  {paymentMethod.instructions}
                </p>
              </div>
            </div>
          </div>

          {/* Edit Button (Admin/Auditor Only) */}
          {canEdit && onEdit && (
            <button
              onClick={() => {
                onClose();
                onEdit(paymentMethod);
              }}
              className="w-full py-3 rounded-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #f6421f 0%, #ee8724 100%)',
                color: 'white',
                fontWeight: '700',
              }}
            >
              <Edit2 className="w-5 h-5" />
              Edit Payment Method
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

