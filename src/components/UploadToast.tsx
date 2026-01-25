import { Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

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
  const [swipeOffset, setSwipeOffset] = useState(0);
  const hasAction = Boolean(message.onAction && message.actionLabel);
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-dismiss for non-loading states
  useEffect(() => {
    if (!hasAction && (message.status === 'success' || message.status === 'error' || message.status === 'info')) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onDismiss(message.id), 300);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message.status, message.id, onDismiss, hasAction]);

  // Handle swipe to dismiss
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    // Only allow swiping to the right (positive diff)
    if (diff > 0) {
      setSwipeOffset(diff);
    }
  };

  const handleTouchEnd = () => {
    // If swiped more than 100px, dismiss
    if (swipeOffset > 100) {
      if (message.onCancel) message.onCancel();
      setIsVisible(false);
      setTimeout(() => onDismiss(message.id), 300);
    } else {
      // Snap back
      setSwipeOffset(0);
    }
    touchStartX.current = null;
  };

  const dismissToast = () => {
    if (message.onCancel) message.onCancel();
    setIsVisible(false);
    setTimeout(() => onDismiss(message.id), 300);
  };

  return (
    <div
      ref={containerRef}
      className={`transform transition-all duration-300 ${
        isVisible ? 'opacity-100' : 'translate-x-full opacity-0'
      }`}
      style={{
        transform: isVisible ? `translateX(${swipeOffset}px)` : 'translateX(100%)',
        opacity: isVisible ? Math.max(0, 1 - swipeOffset / 200) : 0,
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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

            {/* Dismiss button - large clickable area */}
            <div
              onClick={dismissToast}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                marginRight: '-8px',
                marginTop: '-4px',
                borderRadius: '50%',
                cursor: 'pointer',
                color: '#9ca3af',
                backgroundColor: 'transparent',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = '#9ca3af';
              }}
              role="button"
              tabIndex={0}
              aria-label="Dismiss notification"
            >
              <X style={{ width: '20px', height: '20px' }} />
            </div>
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
                  dismissToast();
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
  // Use portal to render at document.body level - ensures it's above everything including chatbot
  return createPortal(
    <div 
      style={{ 
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        maxWidth: '320px',
        zIndex: 2147483647, // Maximum z-index - above everything
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      {messages.map((msg) => (
        <div 
          key={msg.id}
          style={{ 
            pointerEvents: 'auto',
            cursor: 'default',
          }}
        >
          <UploadToast message={msg} onDismiss={onDismiss} />
        </div>
      ))}
    </div>,
    document.body
  );
}
