import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface UploadToastMessage {
  id: string;
  title: string;
  message: string;
  status: 'loading' | 'success' | 'error' | 'info';
  progress?: number; // 0-100
  progressLabel?: string;
  onCancel?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

interface UploadToastProps {
  message: UploadToastMessage;
  onDismiss: (id: string) => void;
}

export function UploadToast({ message, onDismiss }: UploadToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const hasAction = Boolean(message.onAction && message.actionLabel);

  useEffect(() => {
    if (!hasAction && (message.status === 'success' || message.status === 'error' || message.status === 'info')) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss(message.id), 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message.status, message.id, onDismiss, hasAction]);

  return (
    <div
      className={`transform transition-all duration-300 ${
        isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`rounded-xl shadow-xl border overflow-hidden bg-white ${
        message.status === 'loading'
          ? 'border-orange-100'
          : message.status === 'success'
          ? 'border-green-100'
          : message.status === 'info'
          ? 'border-blue-100'
          : 'border-red-100'
      }`}>
        
        {/* Top Progress Bar */}
        {message.status === 'loading' && message.progress !== undefined && (
          <div className="h-1 bg-orange-50 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-300"
              style={{ width: `${message.progress}%` }}
            />
          </div>
        )}

        <div className="p-4 space-y-3">
          {/* Header with icon */}
          <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 mt-0.5 ${
              message.status === 'loading' ? 'text-orange-500' :
              message.status === 'success' ? 'text-green-500' :
              message.status === 'info' ? 'text-blue-500' :
              'text-red-500'
            }`}>
              {message.status === 'loading' && <Loader2 className="w-5 h-5 animate-spin" />}
              {message.status === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {message.status === 'info' && <AlertCircle className="w-5 h-5" />}
              {message.status === 'error' && <AlertCircle className="w-5 h-5" />}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-gray-900">
                {message.title}
              </h3>
              <p className="text-xs text-gray-600 mt-0.5 break-words">
                {message.message}
              </p>
            </div>

            <button
              onClick={() => {
                if (message.onCancel) {
                  message.onCancel();
                  return;
                }
                setIsVisible(false);
                setTimeout(() => onDismiss(message.id), 300);
              }}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar for loading state */}
          {message.status === 'loading' && message.progress !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">{message.progressLabel || "Uploading..."}</span>
                <span className="text-xs font-semibold text-orange-600">
                  {message.progress}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-300"
                  style={{ width: `${message.progress}%` }}
                />
              </div>
            </div>
          )}

          {hasAction && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  message.onAction?.();
                  setIsVisible(false);
                  setTimeout(() => onDismiss(message.id), 300);
                }}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                {message.actionLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Upload Toast Container Component
 * Place this once in your main layout
 */
interface UploadToastContainerProps {
  messages: UploadToastMessage[];
  onDismiss: (id: string) => void;
  isDark?: boolean;
}

export function UploadToastContainer({ messages, onDismiss, isDark }: UploadToastContainerProps) {
  return (
    <div 
      className={`fixed bottom-6 right-6 max-w-sm space-y-3 pointer-events-none ${
        isDark ? 'dark' : ''
      }`}
      style={{ zIndex: 9999999 }} // Force z-index higher than all modals (999999)
    >
      {messages.map((msg) => (
        <div key={msg.id} className="pointer-events-auto">
          <UploadToast message={msg} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
