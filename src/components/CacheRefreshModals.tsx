/**
 * =============================================================================
 * CACHE REFRESH & ROLE CHANGE MODALS
 * =============================================================================
 * 
 * Extracted from SystemToolsPage to avoid dynamic/static import conflict.
 * These modals are needed in App.tsx for cache version checking and role changes.
 * 
 * Components:
 * - CacheRefreshModal: Prompts user to hard refresh when cache version changes
 * - RoleChangeModal: Notifies user of role changes (promotion, demotion, suspension, etc.)
 * - determineRoleChangeType: Helper function to determine the type of role change
 * =============================================================================
 */

import { X, RefreshCw, AlertTriangle } from "lucide-react";
import { DESIGN_TOKENS, Button } from "./design-system";
import { MODAL_REGULATIONS, getHeaderGradient, getModalStyles } from "./modal-regulations";

// =================== CACHE REFRESH MODAL ===================

export interface CacheRefreshModalProps {
  isOpen: boolean;
  isDark: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function CacheRefreshModal({ isOpen, isDark, onConfirm, onClose }: CacheRefreshModalProps) {
  if (!isOpen) return null;

  const modalStyles = getModalStyles(isDark, "small");

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 md:p-8"
      style={{
        background: modalStyles.overlay.background,
        backdropFilter: modalStyles.overlay.backdropFilter,
        zIndex: 99999999, // Above everything including chatbot
      }}
      onClick={onClose}
    >
      <div
        className="w-full overflow-hidden"
        style={{
          maxWidth: modalStyles.panel.maxWidth,
          maxHeight: MODAL_REGULATIONS.panel.maxHeight,
          background: modalStyles.panel.background,
          backdropFilter: modalStyles.panel.backdropFilter,
          border: `${modalStyles.panel.borderWidth} solid ${modalStyles.panel.borderColor}`,
          borderRadius: modalStyles.panel.borderRadius,
          boxShadow: modalStyles.panel.boxShadow,
          transition: MODAL_REGULATIONS.transitions.normal,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-4 py-4 md:px-6 border-b"
          style={{
            background: getHeaderGradient(isDark, "blue"),
            borderColor: modalStyles.header.borderColor,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                backgroundColor: `${DESIGN_TOKENS.colors.brand.orange}20`,
                color: DESIGN_TOKENS.colors.brand.orange,
              }}
            >
              <RefreshCw className="w-5 h-5" />
            </div>
            <h2
              className="text-base md:text-lg"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
              }}
            >
              Hard Refresh Required
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors active:scale-95"
            style={{ background: "transparent", transition: MODAL_REGULATIONS.transitions.fast }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDark
                ? MODAL_REGULATIONS.closeButton.background.hover.dark
                : MODAL_REGULATIONS.closeButton.background.hover.light;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-5 md:px-6">
          <p
            className="text-sm md:text-base"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              color: isDark ? "#e5e7eb" : "#374151",
            }}
          >
            Cache version has been updated. Please do a hard refresh to clear all cached data and load
            the latest changes.
          </p>
          <p
            className="mt-3 text-xs md:text-sm font-medium"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              color: DESIGN_TOKENS.colors.brand.orange,
            }}
          >
            ⚠️ You will be logged out and need to log in again.
          </p>
          <p
            className="mt-2 text-xs md:text-sm"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              color: isDark ? "#9ca3af" : "#6b7280",
            }}
          >
            Tip: You can also press Ctrl+Shift+R.
          </p>
        </div>

        <div
          className="flex flex-col-reverse gap-2 px-4 py-4 md:px-6 border-t sm:flex-row sm:justify-end"
          style={{ borderColor: modalStyles.footer.borderColor }}
        >
          <Button variant="secondary" size="sm" onClick={onClose}>
            Not Now
          </Button>
          <Button variant="primary" size="sm" onClick={onConfirm}>
            Hard Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}

// =================== ROLE CHANGE MODAL ===================

export type RoleChangeType = 
  | 'promoted'      // User was promoted to a higher role
  | 'demoted'       // User was demoted to a lower role
  | 'suspended'     // User account was suspended
  | 'banned'        // User account was banned
  | 'reactivated'   // User account was reactivated from suspended/banned
  | 'changed';      // General role change

export interface RoleChangeModalProps {
  isOpen: boolean;
  isDark: boolean;
  changeType: RoleChangeType;
  oldRole: string;
  newRole: string;
  userName?: string;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Get role change message variations based on the type of change
 */
function getRoleChangeContent(changeType: RoleChangeType, oldRole: string, newRole: string, userName?: string) {
  const name = userName || 'Member';
  const oldRoleDisplay = oldRole.charAt(0).toUpperCase() + oldRole.slice(1);
  const newRoleDisplay = newRole.charAt(0).toUpperCase() + newRole.slice(1);
  
  const contents: Record<RoleChangeType, { icon: string; title: string; message: string; warning: string; color: string }> = {
    promoted: {
      icon: '',
      title: 'Congratulations! You\'ve Been Promoted',
      message: `Great news, ${name}! Your role has been upgraded from ${oldRoleDisplay} to ${newRoleDisplay}. You now have access to additional features and responsibilities.`,
      warning: 'Please refresh to access your new permissions.',
      color: '#22c55e', // Green
    },
    demoted: {
      icon: '',
      title: 'Your Role Has Been Updated',
      message: `Hello ${name}, your role has been changed from ${oldRoleDisplay} to ${newRoleDisplay}. Some features you previously had access to may no longer be available.`,
      warning: 'Please refresh to update your access level.',
      color: '#f59e0b', // Amber
    },
    suspended: {
      icon: '',
      title: 'Account Suspended',
      message: `${name}, your account has been temporarily suspended. You will have limited access to the platform until this is resolved.`,
      warning: 'Please contact an administrator for more information about your suspension.',
      color: '#ef4444', // Red
    },
    banned: {
      icon: '',
      title: 'Account Access Revoked',
      message: `${name}, your account access has been revoked. You will be logged out of the system.`,
      warning: 'If you believe this is an error, please contact the administrator.',
      color: '#dc2626', // Darker Red
    },
    reactivated: {
      icon: '',
      title: 'Welcome Back',
      message: `Good news, ${name}! Your account has been reactivated. Your role is now ${newRoleDisplay}. You can continue using the platform as normal.`,
      warning: 'Please refresh to restore your full access.',
      color: '#22c55e', // Green
    },
    changed: {
      icon: '',
      title: 'Your Role Has Changed',
      message: `Hello ${name}, your role has been updated from ${oldRoleDisplay} to ${newRoleDisplay}. Your permissions and access levels have been adjusted accordingly.`,
      warning: 'Please refresh to apply the changes to your session.',
      color: DESIGN_TOKENS.colors.brand.orange,
    },
  };
  
  return contents[changeType];
}

/**
 * Determine the type of role change
 */
export function determineRoleChangeType(oldRole: string, newRole: string): RoleChangeType {
  const rolePriority: Record<string, number> = {
    'banned': 0,
    'suspended': 1,
    'guest': 2,
    'member': 3,
    'head': 4,
    'admin': 5,
    'auditor': 6,
  };
  
  const oldPriority = rolePriority[oldRole] ?? 3;
  const newPriority = rolePriority[newRole] ?? 3;
  
  // Special cases for suspended/banned
  if (newRole === 'banned') return 'banned';
  if (newRole === 'suspended') return 'suspended';
  
  // Reactivated from banned/suspended
  if ((oldRole === 'banned' || oldRole === 'suspended') && newRole !== 'banned' && newRole !== 'suspended') {
    return 'reactivated';
  }
  
  // Promoted or demoted
  if (newPriority > oldPriority) return 'promoted';
  if (newPriority < oldPriority) return 'demoted';
  
  return 'changed';
}

export function RoleChangeModal({ 
  isOpen, 
  isDark, 
  changeType, 
  oldRole, 
  newRole, 
  userName,
  onConfirm, 
  onClose 
}: RoleChangeModalProps) {
  if (!isOpen) return null;

  const modalStyles = getModalStyles(isDark, "small");
  const content = getRoleChangeContent(changeType, oldRole, newRole, userName);

  // For banned users, don't allow closing - force logout
  const isBanned = changeType === 'banned';

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 md:p-8"
      style={{
        background: modalStyles.overlay.background,
        backdropFilter: modalStyles.overlay.backdropFilter,
        zIndex: 99999999, // Above everything including chatbot
      }}
      onClick={isBanned ? undefined : onClose}
    >
      <div
        className="w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{
          maxWidth: modalStyles.panel.maxWidth,
          maxHeight: MODAL_REGULATIONS.panel.maxHeight,
          background: modalStyles.panel.background,
          backdropFilter: modalStyles.panel.backdropFilter,
          border: `${modalStyles.panel.borderWidth} solid ${modalStyles.panel.borderColor}`,
          borderRadius: modalStyles.panel.borderRadius,
          boxShadow: modalStyles.panel.boxShadow,
          transition: MODAL_REGULATIONS.transitions.normal,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-4 md:px-6 border-b"
          style={{
            background: getHeaderGradient(isDark, changeType === 'banned' || changeType === 'suspended' ? 'red' : 
                                                 changeType === 'promoted' || changeType === 'reactivated' ? 'green' : 'blue'),
            borderColor: modalStyles.header.borderColor,
          }}
        >
          <div className="flex items-center gap-3">
            <h2
              className="text-base md:text-lg"
              style={{
                fontFamily: DESIGN_TOKENS.typography.fontFamily.headings,
                fontWeight: DESIGN_TOKENS.typography.fontWeight.semibold,
                color: isDark ? '#fff' : '#1a1a1a',
              }}
            >
              {content.title}
            </h2>
          </div>
          {!isBanned && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors active:scale-95"
              style={{ background: "transparent", transition: MODAL_REGULATIONS.transitions.fast }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isDark
                  ? MODAL_REGULATIONS.closeButton.background.hover.dark
                  : MODAL_REGULATIONS.closeButton.background.hover.light;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-5 md:px-6">
          <p
            className="text-sm md:text-base"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              color: isDark ? "#e5e7eb" : "#374151",
              lineHeight: 1.6,
            }}
          >
            {content.message}
          </p>
          
          {/* Role change badge */}
          <div 
            className="mt-4 flex items-center justify-center gap-3 py-3 px-4 rounded-lg"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            }}
          >
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{
                background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                color: isDark ? '#9ca3af' : '#6b7280',
                textDecoration: 'line-through',
              }}
            >
              {oldRole.charAt(0).toUpperCase() + oldRole.slice(1)}
            </span>
            <span style={{ color: content.color }}>→</span>
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{
                background: `${content.color}20`,
                color: content.color,
              }}
            >
              {newRole.charAt(0).toUpperCase() + newRole.slice(1)}
            </span>
          </div>

          <p
            className="mt-4 text-xs md:text-sm font-medium flex items-center gap-1"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              color: content.color,
            }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            {content.warning}
          </p>
          
          <p
            className="mt-2 text-xs md:text-sm"
            style={{
              fontFamily: DESIGN_TOKENS.typography.fontFamily.body,
              color: isDark ? "#9ca3af" : "#6b7280",
            }}
          >
            {isBanned 
              ? 'You will be automatically logged out.' 
              : 'Click "Refresh Now" to clear your session and apply changes, or "Not Now" to continue with limited access.'}
          </p>
        </div>

        {/* Footer */}
        <div
          className="flex flex-col-reverse gap-2 px-4 py-4 md:px-6 border-t sm:flex-row sm:justify-end"
          style={{ borderColor: modalStyles.footer.borderColor }}
        >
          {!isBanned && (
            <Button variant="secondary" size="sm" onClick={onClose}>
              Not Now
            </Button>
          )}
          <Button 
            variant="primary" 
            size="sm" 
            onClick={onConfirm}
            style={
              changeType === 'banned' || changeType === 'suspended' 
                ? { background: '#ef4444', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' } 
                : undefined
            }
          >
            {isBanned ? 'Log Out' : 'Refresh Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}
