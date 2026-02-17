/**
 * =============================================================================
 * ISSUANCE CENTER PAGE
 * =============================================================================
 * 
 * Complete issuance management system for Admin and Auditor roles.
 * 
 * Features:
 * - Table and Card view modes
 * - Search and filter issuances
 * - Create new issuances with recipient selection
 * - View issuance details with PDF preview
 * - Send to email or download individually
 * - Template management
 * 
 * =============================================================================
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import {
  X, Plus, Search, FileText, Mail, Download, Eye, Edit2, Trash2,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Loader2, CheckCircle, XCircle, AlertCircle,
  LayoutGrid, List, Send, Users, Calendar, Building, Globe, User,
  RefreshCw, Settings, Copy, ExternalLink, FileCheck, Clock, Image, Archive, AlertTriangle, Link, Paperclip, Hash
} from "lucide-react";
import { PageLayout, Button, SearchInput, StatusChip, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { UploadToastContainer, type UploadToastMessage } from "./UploadToast";
import { FormattedText } from "./FormattedText";
import {
  getIssuances,
  getIssuancesByRecipient,
  getIssuanceById,
  createIssuance,
  deleteIssuance,
  permanentDeleteIssuance,
  updateIssuance,
  getTemplates,
  createTemplate,
  updateTemplate,
  sendIssuance,
  publishIssuance,
  cancelSending,
  resendToRecipient,
  downloadIssuance,
  generatePdfPreview,
  getRecipientsByIssuance,
  getEventAttendees,
  getTemplateById,
  getSettings,
  updateSetting,
  clearIssuanceCache,
  getIssuanceStatusColor,
  getRecipientTypeLabel,
  formatIssuanceDate,
  parseFieldInputs,
  parseRecipientDetails,
  convertPdfToImagePreview,
  generateIssuanceFilename,
  migrateColumns,
  type Issuance,
  type IssuanceTemplate,
  type IssuanceAttachment,
  type Recipient,
  type Committee,
  type SendResult,
  type CreateIssuanceData,
  type CreateTemplateData,
  type PdfPreviewItem,
} from "../services/gasIssuanceService";
import { fetchEvents, type EventData } from "../services/gasEventsService";
import { getAllOfficers, type DirectoryOfficer } from "../services/gasDirectoryService";
import { logCreate, logEdit, logDelete } from "../services/gasSystemToolsService";

// =====================================================
// TYPES & INTERFACES
// =====================================================

interface IssuanceCenterPageProps {
  onClose: () => void;
  isDark: boolean;
  userRole: string;
  username?: string;
  userEmail?: string; // Email for filtering member's issuances
  userProfilePicture?: string; // Profile picture URL for member view
  onModalStateChange?: (isOpen: boolean) => void; // Callback when any modal opens/closes (to hide chatbot)
  initialIssuanceId?: string;
  buildShareableUrl?: (pageName: string, params?: { id?: string }) => string;
}

type ViewMode = 'table' | 'card';
type RecipientType = 'Event' | 'Person' | 'Committee' | 'Directory' | 'External';
type CreateModalTab = 'recipients' | 'preview' | 'templates';
type DetailModalTab = 'info' | 'preview';

interface MemberWithEmail {
  id: string;
  name: string;
  email: string;
  committee?: string;
  profilePicture?: string;
}

interface SelectedRecipient {
  id: string;
  name: string;
  email: string;
  type: 'Member' | 'External';
  source?: string; // Event name, Committee name, etc.
  hasEmail?: boolean; // Flag to indicate if recipient has email (for styling)
  eventId?: string; // Event ID if recipient is from an event (for control numbers)
}

interface FieldInput {
  placeholder: string;
  value: string;
  enabled: boolean;
  isCustomName?: boolean; // For {NAME} field: true = use custom value, false = auto-fill from recipient
  isAllCaps?: boolean; // For {NAME} field: true = convert name to ALL CAPS
  isCustomControlNumber?: boolean; // For {CONTROL_NUMBER} field: true = use custom value, false = auto-generate from event
  // Name positioning options (for certificate name line)
  nameStartPosition?: number; // Start position in cm (default 8.1)
  nameEndPosition?: number; // End position in cm (default 27.6)
  namePositionUnit?: 'cm' | 'inch'; // Unit for positioning (default cm)
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

// Helper to get initials from a name (handles "Lastname, Firstname" format)
const getInitials = (name: string) => {
  if (!name) return '?';
  // Handle names with comma (e.g., "Lastname, Firstname Middle")
  let displayName = name;
  if (name.includes(',')) {
    // Split by comma and reverse to get "Firstname Lastname"
    const parts = name.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      // Get first name (after comma) first word
      const firstNames = parts[1].split(' ').filter(p => p.length > 0);
      const lastName = parts[0].split(' ')[0]; // Get first word of lastname
      displayName = `${firstNames[0] || ''} ${lastName}`;
    }
  }
  // Now get initials from displayName
  const words = displayName.split(' ').filter(p => p.length > 0);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  // First letter of first word + first letter of second word  
  return (words[0][0] + words[1][0]).toUpperCase();
};

// Helper to detect attachment type from URL
const detectAttachmentType = (url: string): 'pdf' | 'document' | 'spreadsheet' | 'video' | 'image' | 'link' | 'other' => {
  const lowerUrl = url.toLowerCase();
  
  // PDF files
  if (lowerUrl.includes('.pdf') || lowerUrl.includes('/pdf')) {
    return 'pdf';
  }
  
  // Google Docs / Word documents
  if (lowerUrl.includes('docs.google.com/document') || 
      lowerUrl.includes('.doc') || 
      lowerUrl.includes('.docx')) {
    return 'document';
  }
  
  // Google Sheets / Excel spreadsheets
  if (lowerUrl.includes('docs.google.com/spreadsheet') || 
      lowerUrl.includes('sheets.google.com') ||
      lowerUrl.includes('.xls') || 
      lowerUrl.includes('.xlsx') ||
      lowerUrl.includes('.csv')) {
    return 'spreadsheet';
  }
  
  // Videos (YouTube, Facebook videos, etc.)
  if (lowerUrl.includes('youtube.com') || 
      lowerUrl.includes('youtu.be') ||
      lowerUrl.includes('facebook.com/watch') ||
      lowerUrl.includes('fb.watch') ||
      lowerUrl.includes('vimeo.com') ||
      lowerUrl.includes('.mp4') ||
      lowerUrl.includes('.mov') ||
      lowerUrl.includes('.avi')) {
    return 'video';
  }
  
  // Images
  if (lowerUrl.includes('.jpg') || 
      lowerUrl.includes('.jpeg') ||
      lowerUrl.includes('.png') ||
      lowerUrl.includes('.gif') ||
      lowerUrl.includes('.webp') ||
      lowerUrl.includes('.svg') ||
      lowerUrl.includes('photos.google.com') ||
      lowerUrl.includes('instagram.com')) {
    return 'image';
  }
  
  // Google Drive links
  if (lowerUrl.includes('drive.google.com')) {
    return 'link';
  }
  
  // Social media links
  if (lowerUrl.includes('facebook.com') || 
      lowerUrl.includes('fb.com') ||
      lowerUrl.includes('twitter.com') ||
      lowerUrl.includes('x.com') ||
      lowerUrl.includes('linkedin.com')) {
    return 'link';
  }
  
  return 'other';
};

// Helper to get icon for attachment type
const getAttachmentIcon = (type: string) => {
  switch (type) {
    case 'pdf':
      return '[PDF]';
    case 'document':
      return '[DOC]';
    case 'spreadsheet':
      return '[XLS]';
    case 'video':
      return '[VID]';
    case 'image':
      return '[IMG]';
    case 'link':
      return '[URL]';
    default:
      return '[FILE]';
  }
};

// =====================================================
// PREVIEW CACHING UTILITIES
// =====================================================

interface PreviewCacheEntry {
  cacheKey: string;
  pdfBase64: string;
  pdfPreviews?: Array<{ recipientName: string; pdfBase64: string }>;
  timestamp: number;
  templateUrl: string;
}

const PREVIEW_CACHE_KEY = 'issuance_preview_cache';
const PREVIEW_CACHE_MAX_AGE = 30 * 60 * 1000; // 30 minutes
const PREVIEW_CACHE_MAX_ENTRIES = 5; // Keep last 5 previews

// Generate a cache key from preview parameters
const generatePreviewCacheKey = (
  templateUrl: string,
  fieldValues: Record<string, string>,
  recipients: Array<{ name: string; email: string }> | undefined,
  customNameOverride: string | undefined,
  options: { useAllCaps: boolean; nameStartPosition: number; nameEndPosition: number; namePositionUnit: string }
): string => {
  const keyData = {
    templateUrl,
    fieldValues,
    recipientNames: recipients?.map(r => r.name).sort() || [],
    customNameOverride,
    ...options
  };
  return btoa(encodeURIComponent(JSON.stringify(keyData))).slice(0, 64);
};

// Get cached preview from localStorage
const getCachedPreview = (cacheKey: string): PreviewCacheEntry | null => {
  try {
    const cacheStr = localStorage.getItem(PREVIEW_CACHE_KEY);
    if (!cacheStr) return null;
    
    const cache: PreviewCacheEntry[] = JSON.parse(cacheStr);
    const entry = cache.find(e => e.cacheKey === cacheKey);
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > PREVIEW_CACHE_MAX_AGE) {
      // Remove expired entry
      const filtered = cache.filter(e => e.cacheKey !== cacheKey);
      localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(filtered));
      return null;
    }
    
    return entry;
  } catch {
    return null;
  }
};

// Save preview to localStorage cache
const setCachedPreview = (entry: PreviewCacheEntry): void => {
  try {
    const cacheStr = localStorage.getItem(PREVIEW_CACHE_KEY);
    let cache: PreviewCacheEntry[] = cacheStr ? JSON.parse(cacheStr) : [];
    
    // Remove existing entry with same key
    cache = cache.filter(e => e.cacheKey !== entry.cacheKey);
    
    // Add new entry at the beginning
    cache.unshift(entry);
    
    // Keep only last N entries
    cache = cache.slice(0, PREVIEW_CACHE_MAX_ENTRIES);
    
    // Remove expired entries
    cache = cache.filter(e => Date.now() - e.timestamp < PREVIEW_CACHE_MAX_AGE);
    
    localStorage.setItem(PREVIEW_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    // If localStorage is full, clear cache and try again
    console.warn('Preview cache storage failed, clearing cache', e);
    localStorage.removeItem(PREVIEW_CACHE_KEY);
  }
};

// Convert base64 to blob URL
const base64ToBlobUrl = (base64: string): string => {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
};

// Clear preview cache (can be called when templates change)
const clearPreviewCache = (): void => {
  localStorage.removeItem(PREVIEW_CACHE_KEY);
};

// =====================================================
// MEMBER ISSUANCE MODAL COMPONENT
// Simplified view for heads, members, and roles below auditor/admin
// =====================================================

interface MemberIssuanceModalProps {
  issuance: Issuance;
  isDark: boolean;
  glassStyle: React.CSSProperties;
  userEmail: string;
  username: string;
  profilePicture?: string;
  members?: Array<{ name: string; email: string; profilePicture?: string }>;
  onClose: () => void;
  addUploadToast: (message: UploadToastMessage) => void;
  updateUploadToast: (id: string, updates: Partial<UploadToastMessage>) => void;
  removeUploadToast: (id: string) => void;
}

function MemberIssuanceModal({
  issuance,
  isDark,
  glassStyle,
  userEmail,
  username,
  profilePicture,
  members = [],
  onClose,
  addUploadToast,
  updateUploadToast,
  removeUploadToast,
}: MemberIssuanceModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  // Find the user's recipient record
  const userRecipient = useMemo(() => {
    if (!issuance.Recipients || issuance.Recipients.length === 0) return null;
    
    const emailLower = userEmail?.toLowerCase().trim() || '';
    const nameLower = username?.toLowerCase().trim() || '';
    
    return issuance.Recipients.find(r => {
      const recipientEmailLower = r.RecipientEmail?.toLowerCase().trim() || '';
      const recipientNameLower = r.RecipientName?.toLowerCase().trim() || '';
      return (emailLower && recipientEmailLower === emailLower) || 
             (nameLower && recipientNameLower === nameLower);
    }) || issuance.Recipients[0]; // Fallback to first recipient
  }, [issuance.Recipients, userEmail, username]);

  // Helper to find real name from members list by email
  const findMemberNameLocal = (email?: string): string | undefined => {
    if (!members || members.length === 0 || !email) return undefined;
    const emailLower = email.toLowerCase().trim();
    const member = members.find(m => m.email?.toLowerCase().trim() === emailLower);
    return member?.name;
  };

  // Determine display name and custom name indicator
  const { displayName, customNameToShow } = useMemo(() => {
    const fieldValues = parseFieldInputs(issuance.FieldInputs);
    const nameFieldValue = fieldValues['{NAME}'];
    
    // Try to get real name from members list
    const realNameFromMembers = findMemberNameLocal(userRecipient?.RecipientEmail);
    
    // Use real name from members if found, otherwise use stored recipient name
    const name = realNameFromMembers || userRecipient?.RecipientName || username || 'N/A';
    
    // Check if stored name differs from real name (was stored incorrectly as custom value)
    const storedNameIsCustom = realNameFromMembers && userRecipient?.RecipientName && realNameFromMembers !== userRecipient.RecipientName;
    
    // Determine what custom name to show
    const customName = storedNameIsCustom 
      ? userRecipient?.RecipientName  // Show the incorrectly stored name as custom
      : (nameFieldValue && nameFieldValue !== name ? nameFieldValue : null);  // Show {NAME} field value if different
    
    return { displayName: name, customNameToShow: customName };
  }, [issuance.FieldInputs, userRecipient, username, members]);

  const handleDownloadCertificate = async () => {
    if (!userRecipient) {
      toast.error('No certificate found for your account');
      return;
    }

    const toastId = `download-cert-${Date.now()}`;
    setIsDownloading(true);

    addUploadToast({
      id: toastId,
      title: 'Preparing Certificate',
      message: 'Generating your certificate...',
      status: 'loading',
      progress: 20
    });

    try {
      // Get field values from the issuance
      const fieldValues = parseFieldInputs(issuance.FieldInputs);
      // Only use recipient name as fallback if no custom {NAME} value was set
      if (!fieldValues['{NAME}'] || fieldValues['{NAME}'].trim() === '') {
        fieldValues['{NAME}'] = userRecipient.RecipientName;
      }

      updateUploadToast(toastId, { progress: 40, message: 'Fetching template...' });

      // Get the template URL
      const templateUrl = issuance.CustomTemplateUrl || 
        (await getTemplateById(issuance.TemplateID)).DocsUrl;

      if (!templateUrl) {
        throw new Error('No template configured for this certificate');
      }

      updateUploadToast(toastId, { progress: 60, message: 'Generating PDF...' });

      // Generate the PDF
      const result = await generatePdfPreview(
        templateUrl,
        fieldValues,
        userRecipient.RecipientName
      );

      updateUploadToast(toastId, { progress: 80, message: 'Preparing download...' });

      // Download the PDF
      if (result.pdfUrl) {
        // Create a filename
        const filename = generateIssuanceFilename(issuance.Title, userRecipient.RecipientName);
        
        // Fetch and download the PDF
        const response = await fetch(result.pdfUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Track the download in the backend
        try {
          await downloadIssuance(issuance.IssuanceID, userRecipient.RecordID, username);
        } catch (trackError) {
          console.warn('Failed to track download:', trackError);
          // Don't fail the download if tracking fails
        }

        updateUploadToast(toastId, {
          status: 'success',
          title: 'Download Complete',
          message: 'Your certificate has been downloaded!',
          progress: 100
        });

        setTimeout(() => removeUploadToast(toastId), 3000);
      } else {
        throw new Error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Download error:', error);
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Download Failed',
        message: error instanceof Error ? error.message : 'Failed to download certificate'
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border-2 flex flex-col"
      style={{
        ...glassStyle,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
      }}
    >
      {/* Modal Header */}
      <div 
        className="px-5 py-4 border-b relative flex-shrink-0"
        style={{ 
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange}15 0%, rgba(246, 66, 31, 0.1) 100%)`
        }}
      >
        {/* Close Button - Single one at top right */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>
        
        {/* Centered Content */}
        <div className="text-center pr-8">
          {/* Certificate Icon */}
          <div 
            className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center"
            style={{ 
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)`,
              boxShadow: '0 4px 16px rgba(246, 66, 31, 0.3)'
            }}
          >
            <FileCheck className="w-6 h-6 text-white" />
          </div>
          
          <h2 className="text-base sm:text-lg font-bold mb-1 line-clamp-2 break-words px-2" style={{ color: isDark ? '#fff' : '#000' }} title={issuance.Title}>
            {issuance.Title}
          </h2>
          <p className="text-sm text-muted-foreground">
            Certificate issued to you
          </p>
        </div>
      </div>
      
      {/* Modal Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Recipient Card with Profile Picture */}
        <div 
          className="p-4 rounded-xl flex items-center gap-4"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
        >
          {/* Profile Picture or Initials */}
          <div className="relative w-14 h-14 flex-shrink-0">
            {profilePicture ? (
              <>
                <img
                  src={profilePicture}
                  alt={userRecipient?.RecipientName || username}
                  className="w-14 h-14 rounded-full object-cover absolute inset-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                {/* Fallback initials shown behind the image */}
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold"
                  style={{ background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)` }}
                >
                  {getInitials(displayName)}
                </div>
              </>
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold"
                style={{ background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)` }}
              >
                {getInitials(displayName)}
              </div>
            )}
          </div>
          
          {/* Name and Label */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Recipient Name</p>
            <p className="text-lg font-semibold truncate" style={{ color: isDark ? '#fff' : '#000' }}>
              {displayName}
              {customNameToShow && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  (as {customNameToShow})
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Email Details Section */}
        {(issuance.EmailTitle || issuance.EmailMessage) && (
          <div 
            className="p-3 sm:p-4 rounded-xl space-y-2 sm:space-y-3"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
          >
            <div className="flex items-center gap-2 sm:gap-3 mb-1.5">
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">Email Details</span>
            </div>
            
            {issuance.EmailTitle && (
              <div className="pl-6 sm:pl-8">
                <p className="text-xs text-muted-foreground mb-0.5">Subject</p>
                <p className="text-sm font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
                  {issuance.EmailTitle}
                </p>
              </div>
            )}
            
            {issuance.EmailMessage && (
              <div className="pl-6 sm:pl-8">
                <p className="text-xs text-muted-foreground mb-0.5">Message</p>
                <div 
                  className="text-xs sm:text-sm leading-relaxed max-h-32 overflow-y-auto" 
                  style={{ 
                    color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                    textAlign: 'justify',
                    wordBreak: 'break-word',
                    hyphens: 'auto'
                  }}
                >
                  <FormattedText text={issuance.EmailMessage} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notes Section - Only shown if notes exist */}
        {issuance.Notes && (
          <div 
            className="p-4 rounded-xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 flex-shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              <span className="text-sm font-medium text-muted-foreground">Document Notes</span>
            </div>
            <p 
              className="text-sm leading-relaxed pl-8 whitespace-pre-wrap" 
              style={{ color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)' }}
            >
              {issuance.Notes}
            </p>
          </div>
        )}

        {/* Issued On Info */}
        <div 
          className="p-4 rounded-xl"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
        >
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="w-5 h-5 flex-shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
            <span className="text-sm font-medium text-muted-foreground">Issued On</span>
          </div>
          <p className="text-sm pl-8" style={{ color: isDark ? '#fff' : '#000' }}>
            {formatIssuanceDate(issuance.SentAt || issuance.CreatedAt)}
          </p>
        </div>

        {/* Control Number - Only shown if recipient has a control number */}
        {userRecipient?.ControlNumber && (
          <div 
            className="p-4 rounded-xl"
            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
          >
            <div className="flex items-center gap-3 mb-2">
              <Hash className="w-5 h-5 flex-shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
              <span className="text-sm font-medium text-muted-foreground">Control Number</span>
            </div>
            <p 
              className="text-sm pl-8 font-mono"
              style={{ color: DESIGN_TOKENS.colors.brand.orange }}
            >
              {userRecipient.ControlNumber}
            </p>
          </div>
        )}
      </div>
      
      {/* Modal Footer - Download Button Only */}
      <div 
        className="p-5 border-t flex-shrink-0"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
      >
        <button
          onClick={handleDownloadCertificate}
          disabled={isDownloading || !userRecipient}
          className="w-full py-3.5 px-6 rounded-xl text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          style={{
            background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)`,
            color: '#fff',
            boxShadow: '0 4px 16px rgba(246, 66, 31, 0.3)',
          }}
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Preparing...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>Download Certificate</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function IssuanceCenterPage({
  onClose,
  isDark,
  userRole,
  username = "admin",
  userEmail = "",
  userProfilePicture,
  onModalStateChange,
  initialIssuanceId,
  buildShareableUrl,
}: IssuanceCenterPageProps) {
  const glassStyle = getGlassStyle(isDark);
  
  // Check if user can create issuances (Admin or Auditor only)
  const roleLower = userRole.toLowerCase();
  const canCreate = roleLower === 'admin' || roleLower === 'auditor';
  const isMemberView = !canCreate;
  
  // ============= STATE =============
  // List state
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [archivedIssuances, setArchivedIssuances] = useState<Issuance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  
  // Archive section state
  const [showArchiveSection, setShowArchiveSection] = useState(false);
  const [isArchiveSearch, setIsArchiveSearch] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showMemberPreviewMode, setShowMemberPreviewMode] = useState(false);
  const [issuanceToDelete, setIssuanceToDelete] = useState<Issuance | null>(null);
  const [selectedIssuance, setSelectedIssuance] = useState<Issuance | null>(null);
  const [createModalTab, setCreateModalTab] = useState<CreateModalTab>('recipients');
  const [detailModalTab, setDetailModalTab] = useState<DetailModalTab>('info');
  
  // Edit mode state for Draft issuances
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingIssuanceId, setEditingIssuanceId] = useState<string | null>(null);
  
  // Create form state
  const [templates, setTemplates] = useState<IssuanceTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<IssuanceTemplate | null>(null);
  const [selectedRecipients, setSelectedRecipients] = useState<SelectedRecipient[]>([]);
  const [fieldInputs, setFieldInputs] = useState<FieldInput[]>([]);
  const [emailTitle, setEmailTitle] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [customTemplateUrl, setCustomTemplateUrl] = useState("");
  const [issuanceTitle, setIssuanceTitle] = useState("");
  const [sendToEmail, setSendToEmail] = useState(true);
  
  // Attachments state - for attaching links (Google Drive, YouTube, etc.)
  const [attachments, setAttachments] = useState<IssuanceAttachment[]>([]);
  const [newAttachmentName, setNewAttachmentName] = useState("");
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  
  // Event linking state for control numbers
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEventTitle, setSelectedEventTitle] = useState<string | null>(null);
  
  // Recipient search state
  const [recipientSearchQuery, setRecipientSearchQuery] = useState("");
  const [showRecipientDropdown, setShowRecipientDropdown] = useState(false);
  const [events, setEvents] = useState<EventData[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [members, setMembers] = useState<MemberWithEmail[]>([]);
  const [isLoadingRecipients, setIsLoadingRecipients] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [externalName, setExternalName] = useState("");
  const [externalEmail, setExternalEmail] = useState("");
  
  // Universal search command state - extended with @archive
  type SearchCommand = '@Person' | '@Event' | '@Committee' | '@All' | '@External' | '@archive' | null;
  const [activeCommand, setActiveCommand] = useState<SearchCommand>(null);
  const [commandSearchQuery, setCommandSearchQuery] = useState("");
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  
  // Template creation state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateType, setNewTemplateType] = useState("Custom");
  const [newTemplateDocsUrl, setNewTemplateDocsUrl] = useState("");
  const [newTemplateFields, setNewTemplateFields] = useState<string[]>(["{NAME}"]);
  const [newFieldInput, setNewFieldInput] = useState("");
  
  // Template editing state
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState("");
  const [editTemplateType, setEditTemplateType] = useState("Custom");
  const [editTemplateDocsUrl, setEditTemplateDocsUrl] = useState("");
  const [editTemplateFields, setEditTemplateFields] = useState<string[]>([]);
  const [editFieldInput, setEditFieldInput] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  
  // Dynamic field addition state (for adding fields while creating issuance)
  const [showAddFieldInput, setShowAddFieldInput] = useState(false);
  const [dynamicFieldInput, setDynamicFieldInput] = useState("");
  
  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<SendResult | null>(null);
  const [resendingRecipientId, setResendingRecipientId] = useState<string | null>(null);
  const [sendCancelled, setSendCancelled] = useState(false); // Track if user wants to cancel sending
  
  // PDF Preview state
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [previewImageUrl, setPreviewImageUrl] = useState(""); // PNG image for member individual view
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [previewPdfList, setPreviewPdfList] = useState<Array<{ recipientName: string; pdfUrl: string; imageUrl?: string }>>([]);
  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  
  // Settings state
  const [settings, setSettings] = useState<Record<string, { value: string; description: string }>>({});
  
  // Upload Toast State for debug/progress notifications at bottom-right
  const [uploadToastMessages, setUploadToastMessages] = useState<UploadToastMessage[]>([]);
  
  const recipientSearchRef = useRef<HTMLDivElement>(null);

  // ============= MODAL STATE TRACKING FOR CHATBOT VISIBILITY =============
  // Track when any modal is open and notify parent to hide chatbot
  useEffect(() => {
    const anyModalOpen = showCreateModal || showDetailModal || showDeleteConfirmModal || showMemberPreviewMode;
    onModalStateChange?.(anyModalOpen);
  }, [showCreateModal, showDetailModal, showDeleteConfirmModal, showMemberPreviewMode, onModalStateChange]);

  // ============= UPLOAD TOAST HELPERS =============
  const addUploadToast = (message: UploadToastMessage) => {
    setUploadToastMessages(prev => [...prev.filter(m => m.id !== message.id), message]);
  };

  const updateUploadToast = (id: string, updates: Partial<UploadToastMessage>) => {
    setUploadToastMessages(prev => 
      prev.map(m => m.id === id ? { ...m, ...updates } : m)
    );
  };

  const removeUploadToast = (id: string) => {
    setUploadToastMessages(prev => prev.filter(m => m.id !== id));
  };

  // ============= LOCAL STORAGE HELPERS =============
  const CACHE_KEYS = {
    members: 'ysp_issuance_members',
    events: 'ysp_issuance_events',
    committees: 'ysp_issuance_committees',
  };
  const CACHE_TTL = 10 * 60 * 1000; // 10 minutes for better performance

  interface CachedItem<T> {
    data: T;
    timestamp: number;
  }

  const getCachedData = <T,>(key: string): T | null => {
    try {
      const cached = localStorage.getItem(key);
      if (!cached) return null;
      const parsed: CachedItem<T> = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        return parsed.data;
      }
      // Expired, remove it
      localStorage.removeItem(key);
    } catch { /* ignore */ }
    return null;
  };

  const setCachedData = <T,>(key: string, data: T) => {
    try {
      const item: CachedItem<T> = { data, timestamp: Date.now() };
      localStorage.setItem(key, JSON.stringify(item));
    } catch { /* ignore - quota exceeded or disabled */ }
  };

  // ============= EFFECTS =============
  
  // Load initial data
  useEffect(() => {
    loadIssuances();
    // Always load templates for filtering to work
    loadTemplates();
    // Only load admin-specific data if user can create issuances
    if (canCreate) {
      loadCommittees();
      loadEvents();
      loadMembers();
      loadSettings();
    }
  }, [canCreate]);
  
  // Deep link: Auto-select issuance from URL parameter
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (initialIssuanceId && issuances.length > 0 && !hasAutoSelectedRef.current) {
      const issuance = issuances.find(i => i.id === initialIssuanceId);
      if (issuance) {
        setSelectedIssuance(issuance);
        setShowDetailModal(true);
        hasAutoSelectedRef.current = true;
      }
    }
  }, [initialIssuanceId, issuances]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (recipientSearchRef.current && !recipientSearchRef.current.contains(e.target as Node)) {
        setShowRecipientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  
  // Handle @archive search command in main search bar
  useEffect(() => {
    if (searchQuery.toLowerCase().startsWith('@archive ')) {
      setIsArchiveSearch(true);
      setShowArchiveSection(true);
    } else if (searchQuery.toLowerCase() === '@archive') {
      setIsArchiveSearch(true);
      setShowArchiveSection(true);
    } else {
      setIsArchiveSearch(false);
    }
  }, [searchQuery]);
  
  // ============= DATA LOADERS (with localStorage caching) =============
  
  const loadIssuances = async () => {
    setIsLoading(true);
    try {
      // If member view (heads, members, and roles below auditor/admin), 
      // only load issuances where they are a recipient (matched by email or name)
      const data = isMemberView && (userEmail || username)
        ? await getIssuancesByRecipient(userEmail || '', username)
        : await getIssuances();
      
      // Separate active and archived issuances
      const active = data.filter((i: Issuance) => i.Status !== 'Archived');
      const archived = data.filter((i: Issuance) => i.Status === 'Archived');
      
      setIssuances(active);
      setArchivedIssuances(archived);
    } catch (error) {
      console.error("Error loading issuances:", error);
      toast.error("Failed to load issuances");
    } finally {
      setIsLoading(false);
    }
  };
  
  const loadTemplates = async () => {
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error("Error loading templates:", error);
    }
  };
  
  const loadCommittees = async () => {
    // Use the actual YSP committee list
    const yspCommittees: Committee[] = [
      { id: 'executive', name: 'Executive Board' },
      { id: 'membership', name: 'Membership and Internal Affairs Committee' },
      { id: 'external', name: 'External Relations Committee' },
      { id: 'secretariat', name: 'Secretariat and Documentation Committee' },
      { id: 'finance', name: 'Finance and Treasury Committee' },
      { id: 'program', name: 'Program Development Committee' },
      { id: 'communications', name: 'Communications and Marketing Committee' },
      { id: 'general', name: 'General Members Committee' },
    ];
    setCommittees(yspCommittees);
  };
  
  const loadEvents = async (forceRefresh = false) => {
    setIsLoadingEvents(true);
    try {
      // Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = getCachedData<EventData[]>(CACHE_KEYS.events);
        if (cached && cached.length > 0) {
          setEvents(cached);
          setIsLoadingEvents(false);
          return;
        }
      }
      const data = await fetchEvents();
      // fetchEvents returns EventData[] directly
      const filtered = data.filter((e: EventData) => e.Status === 'Active' || e.Status === 'Completed');
      setEvents(filtered);
      setCachedData(CACHE_KEYS.events, filtered);
    } catch (error) {
      console.error("Error loading events:", error);
    } finally {
      setIsLoadingEvents(false);
    }
  };
  
  const loadMembers = async (forceRefresh = false) => {
    setIsLoadingMembers(true);
    setMembersError(null);
    try {
      // Try localStorage cache first for instant load (unless force refresh)
      if (!forceRefresh) {
        const cached = getCachedData<MemberWithEmail[]>(CACHE_KEYS.members);
        if (cached && cached.length > 0) {
          setMembers(cached);
          // Silenced: repetitive cache hit log
          // console.warn(`[Issuance] Loaded ${cached.length} members from cache`);
          setIsLoadingMembers(false);
          return;
        }
      }
      
      // Fetch from Directory service (same data as Officer Directory page)
      // Fetch all pages to get complete member list
      const allMembers: MemberWithEmail[] = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore) {
        const response = await getAllOfficers(page, 100);
        if (response.success && response.officers) {
          const mapped = response.officers
            .filter((o: DirectoryOfficer) => o.personalEmail || o.email) // Must have email
            .map((o: DirectoryOfficer, idx: number) => ({
              id: `member-${page}-${idx}`,
              name: o.fullName,
              email: o.personalEmail || o.email,
              committee: o.committee || '',
              profilePicture: o.profilePicture || ''
            }));
          allMembers.push(...mapped);
          hasMore = response.pagination?.hasMore || false;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      // Deduplicate by email
      const uniqueMembers = allMembers.filter((m, idx, arr) => 
        arr.findIndex(x => x.email.toLowerCase() === m.email.toLowerCase()) === idx
      );
      
      if (uniqueMembers.length === 0) {
        setMembersError('No members with email addresses found. Use @External to add recipients manually.');
      } else {
        setMembers(uniqueMembers);
        setCachedData(CACHE_KEYS.members, uniqueMembers);
      }
    } catch (error) {
      console.error("Error loading members from Directory:", error);
      setMembersError('Failed to load members. Click to retry or use @External to add recipients.');
      // Members will be empty, user can still add external recipients
    } finally {
      setIsLoadingMembers(false);
    }
  };
  
  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };
  
  // ============= DATABASE MIGRATION =============
  
  const handleMigrateColumns = async () => {
    try {
      toast.loading("Running database migration...");
      const result = await migrateColumns();
      toast.dismiss();
      if (result.success) {
        if ((result as { noChanges?: boolean }).noChanges) {
          toast.success("Database columns are already aligned correctly!");
        } else {
          toast.success("Database migration completed successfully! Please reload the page.");
          // Reload issuances
          await loadIssuances();
        }
      } else {
        toast.error(`Migration failed: ${result.error}`);
      }
    } catch (error) {
      toast.dismiss();
      toast.error(`Migration error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // ============= FILTERING =============
  
  const filteredIssuances = useMemo(() => {
    let filtered = issuances;
    
    // Filter by type (using template type)
    if (typeFilter !== "all") {
      filtered = filtered.filter(i => {
        // Find the template to get its type
        const template = templates.find(t => t.TemplateID === i.TemplateID);
        if (template?.Type === typeFilter) return true;
        
        // Fallback: check if TemplateName contains the type keyword
        const templateNameLower = i.TemplateName?.toLowerCase() || '';
        const filterLower = typeFilter.toLowerCase();
        
        // Handle special cases
        if (typeFilter === 'Digital Certificate') {
          return templateNameLower.includes('certificate') || templateNameLower.includes('e-certificate');
        }
        if (typeFilter === 'Memo') {
          return templateNameLower.includes('memo') || templateNameLower.includes('memorandum');
        }
        
        return templateNameLower.includes(filterLower);
      });
    }
    
    // Filter by search query (exclude @archive command from the search query)
    if (searchQuery.trim() && !isArchiveSearch) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        i.Title.toLowerCase().includes(query) ||
        i.TemplateName.toLowerCase().includes(query) ||
        i.CreatedBy.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [issuances, typeFilter, searchQuery, templates, isArchiveSearch]);
  
  // Filter archived issuances
  const filteredArchivedIssuances = useMemo(() => {
    let filtered = archivedIssuances;
    
    // If @archive search, extract the search query after @archive
    if (isArchiveSearch && searchQuery.toLowerCase().startsWith('@archive ')) {
      const archiveQuery = searchQuery.slice(9).toLowerCase().trim();
      if (archiveQuery) {
        filtered = filtered.filter(i =>
          i.Title.toLowerCase().includes(archiveQuery) ||
          i.TemplateName.toLowerCase().includes(archiveQuery) ||
          i.CreatedBy.toLowerCase().includes(archiveQuery)
        );
      }
    }
    
    // Also apply type filter to archived
    if (typeFilter !== "all") {
      filtered = filtered.filter(i => {
        const template = templates.find(t => t.TemplateID === i.TemplateID);
        if (template?.Type === typeFilter) return true;
        const templateNameLower = i.TemplateName?.toLowerCase() || '';
        const filterLower = typeFilter.toLowerCase();
        if (typeFilter === 'Digital Certificate') {
          return templateNameLower.includes('certificate') || templateNameLower.includes('e-certificate');
        }
        if (typeFilter === 'Memo') {
          return templateNameLower.includes('memo') || templateNameLower.includes('memorandum');
        }
        return templateNameLower.includes(filterLower);
      });
    }
    
    return filtered;
  }, [archivedIssuances, searchQuery, isArchiveSearch, typeFilter, templates]);
  
  // Command suggestions for universal search
  const SEARCH_COMMANDS = [
    { command: '@Person' as const, icon: User, label: 'Search individual members', color: '#3b82f6' },
    { command: '@Event' as const, icon: Calendar, label: 'Load attendees from event', color: '#8b5cf6' },
    { command: '@Committee' as const, icon: Building, label: 'Load members by committee', color: '#10b981' },
    { command: '@All' as const, icon: Users, label: 'Load all directory members', color: '#f59e0b' },
    { command: '@External' as const, icon: Globe, label: 'Add external recipient', color: '#ec4899' },
  ];

  // Universal search suggestions based on active command
  const universalSearchSuggestions = useMemo(() => {
    const query = commandSearchQuery.toLowerCase().trim();
    
    // If no command is active, show command suggestions
    if (!activeCommand) {
      if (!recipientSearchQuery.startsWith('@')) return [];
      const cmdQuery = recipientSearchQuery.toLowerCase();
      return SEARCH_COMMANDS.filter(c => 
        c.command.toLowerCase().startsWith(cmdQuery) || 
        c.label.toLowerCase().includes(cmdQuery.replace('@', ''))
      );
    }
    
    // Filter based on active command
    switch (activeCommand) {
      case '@Person':
        if (!query) return members.slice(0, 8);
        return members.filter(m =>
          m.name.toLowerCase().includes(query) ||
          m.email?.toLowerCase().includes(query)
        ).slice(0, 8);
      
      case '@Event':
        if (!query) return events.slice(0, 8);
        return events.filter(e =>
          e.Title.toLowerCase().includes(query) ||
          e.Status?.toLowerCase().includes(query)
        ).slice(0, 8);
      
      case '@Committee':
        if (!query) return committees.slice(0, 8);
        return committees.filter(c =>
          c.name.toLowerCase().includes(query)
        ).slice(0, 8);
      
      case '@All':
        return []; // No suggestions needed, direct action
      
      case '@External':
        return []; // No suggestions, manual input
      
      default:
        return [];
    }
  }, [activeCommand, commandSearchQuery, recipientSearchQuery, members, events, committees]);
  
  // ============= HANDLERS =============
  
  const handleViewIssuance = async (issuance: Issuance) => {
    // Reset preview states when opening detail modal
    setPreviewPdfUrl("");
    setPreviewImageUrl("");
    setPreviewPdfList([]);
    setCurrentPreviewIndex(0);
    setShowMemberPreviewMode(false);
    
    setSelectedIssuance(issuance);
    setDetailModalTab('info');
    setShowDetailModal(true);
    
    // Load full issuance data with recipients
    try {
      const fullData = await getIssuanceById(issuance.IssuanceID);
      setSelectedIssuance(fullData);
      
      // Debug log silenced for production
      // console.warn('[Issuance Debug] Full data loaded:', {
      //   issuanceId: fullData.IssuanceID,
      //   title: fullData.Title,
      //   recipientsCount: fullData.Recipients?.length || 0,
      //   recipients: fullData.Recipients
      // });
    } catch (error) {
      console.error("Error loading issuance details:", error);
    }
  };
  
  // Open delete confirmation modal
  const handleOpenDeleteConfirm = (issuance: Issuance) => {
    setIssuanceToDelete(issuance);
    setShowDeleteConfirmModal(true);
  };
  
  // Archive issuance (soft delete)
  const handleArchiveIssuance = async (id: string) => {
    const toastId = `archive-${Date.now()}`;
    
    addUploadToast({
      id: toastId,
      title: 'Archiving Issuance',
      message: 'Moving issuance to archive...',
      status: 'loading',
      progress: 30
    });
    
    try {
      await deleteIssuance(id);
      
      updateUploadToast(toastId, {
        status: 'success',
        title: 'Archived Successfully',
        message: 'Issuance has been moved to archive',
        progress: 100
      });
      
      logDelete(username, "Issuance (Archived)", id);
      loadIssuances();
      
      setTimeout(() => removeUploadToast(toastId), 3000);
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Archive Failed',
        message: error instanceof Error ? error.message : 'Failed to archive issuance'
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };
  
  // Permanently delete issuance (hard delete)
  const handlePermanentDelete = async () => {
    if (!issuanceToDelete) return;
    
    const toastId = `delete-${Date.now()}`;
    const issuanceTitle = issuanceToDelete.Title;
    const id = issuanceToDelete.IssuanceID;
    
    setShowDeleteConfirmModal(false);
    
    addUploadToast({
      id: toastId,
      title: 'Deleting Issuance',
      message: 'Permanently removing issuance and all associated data...',
      status: 'loading',
      progress: 20
    });
    
    try {
      updateUploadToast(toastId, { progress: 50, message: 'Deleting recipients...' });
      
      await permanentDeleteIssuance(id);
      
      updateUploadToast(toastId, {
        status: 'success',
        title: 'Deleted Successfully',
        message: `"${issuanceTitle}" has been permanently deleted`,
        progress: 100
      });
      
      logDelete(username, "Issuance (Permanent)", `${id} - ${issuanceTitle}`);
      loadIssuances();
      setIssuanceToDelete(null);
      
      setTimeout(() => removeUploadToast(toastId), 4000);
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'Failed to permanently delete issuance'
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };
  
  // Resend email to a failed recipient
  const handleResendToRecipient = async (issuanceId: string, recipientId: string, recipientName: string) => {
    const toastId = `resend-${Date.now()}`;
    setResendingRecipientId(recipientId);
    
    addUploadToast({
      id: toastId,
      title: 'Resending Email',
      message: `Sending email to ${recipientName}...`,
      status: 'loading',
      progress: 30
    });
    
    try {
      const result = await resendToRecipient(issuanceId, recipientId, username);
      
      updateUploadToast(toastId, {
        status: 'success',
        title: 'Email Sent',
        message: `Successfully sent email to ${result.name}`,
        progress: 100
      });
      
      // Refresh the issuance details to update the recipients list
      if (selectedIssuance) {
        const updatedIssuance = await getIssuanceById(issuanceId);
        setSelectedIssuance(updatedIssuance);
      }
      
      // Also refresh the main list
      loadIssuances();
      
      setTimeout(() => removeUploadToast(toastId), 3000);
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Send Failed',
        message: error instanceof Error ? error.message : 'Failed to send email'
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    } finally {
      setResendingRecipientId(null);
    }
  };
  
  // Restore archived issuance
  const handleRestoreIssuance = async (id: string) => {
    const toastId = `restore-${Date.now()}`;
    
    addUploadToast({
      id: toastId,
      title: 'Restoring Issuance',
      message: 'Restoring issuance from archive...',
      status: 'loading',
      progress: 30
    });
    
    try {
      await updateIssuance({ id, Status: 'Sent' });
      
      updateUploadToast(toastId, {
        status: 'success',
        title: 'Restored Successfully',
        message: 'Issuance has been restored',
        progress: 100
      });
      
      loadIssuances();
      
      setTimeout(() => removeUploadToast(toastId), 3000);
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Restore Failed',
        message: error instanceof Error ? error.message : 'Failed to restore issuance'
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };
  
  // Cleanup blob URL when modal closes or component unmounts
  const cleanupPreviewUrl = () => {
    if (previewPdfUrl && previewPdfUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewPdfUrl);
    }
    // Also cleanup any preview list URLs
    previewPdfList.forEach(preview => {
      if (preview.pdfUrl && preview.pdfUrl.startsWith('blob:')) {
        URL.revokeObjectURL(preview.pdfUrl);
      }
    });
    // Clear image preview URL as well
    setPreviewImageUrl("");
  };
  
  const handleOpenCreateModal = () => {
    // Cleanup any existing preview URL
    cleanupPreviewUrl();
    // Reset form
    setSelectedTemplate(null);
    setSelectedRecipients([]);
    setFieldInputs([]);
    setEmailTitle("");
    setEmailMessage("");
    setCustomTemplateUrl("");
    setIssuanceTitle("");
    setSendToEmail(true);
    setCreateModalTab('recipients');
    setPreviewPdfUrl("");
    setPreviewImageUrl("");
    setPreviewPdfList([]);
    setCurrentPreviewIndex(0);
    // Reset universal search state
    setActiveCommand(null);
    setCommandSearchQuery('');
    setRecipientSearchQuery('');
    setShowRecipientDropdown(false);
    setExternalName('');
    setExternalEmail('');
    // Reset dynamic field state
    setShowAddFieldInput(false);
    setDynamicFieldInput('');
    // Reset attachments state
    setAttachments([]);
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setShowAttachmentForm(false);
    // Reset event linking state
    setSelectedEventId(null);
    setSelectedEventTitle(null);
    // Reset edit mode
    setIsEditMode(false);
    setEditingIssuanceId(null);
    setShowCreateModal(true);
  };

  // Handle editing a draft issuance
  const handleEditDraftIssuance = async (issuance: Issuance) => {
    // Only allow editing Draft issuances
    if (issuance.Status !== 'Draft') {
      toast.error('Only draft issuances can be edited');
      return;
    }
    
    // Cleanup any existing preview URL
    cleanupPreviewUrl();
    
    // Close detail modal if open
    setShowDetailModal(false);
    
    // Set edit mode
    setIsEditMode(true);
    setEditingIssuanceId(issuance.IssuanceID);
    
    // Populate form with existing data
    setIssuanceTitle(issuance.Title);
    setEmailTitle(issuance.EmailTitle || '');
    setEmailMessage(issuance.EmailMessage || '');
    setCustomTemplateUrl(issuance.CustomTemplateUrl || '');
    setSendToEmail(issuance.DeliveryMethod !== 'DownloadOnly');
    
    // Get name formatting settings from issuance columns (primary) or fallback to FieldInputs JSON (legacy)
    const nameAllCapsFromColumn = String(issuance.NameAllCaps) === 'true';
    const nameStartFromColumn = parseFloat(issuance.NameStartPos as string) || 8.1;
    const nameEndFromColumn = parseFloat(issuance.NameEndPos as string) || 27.6;
    const nameUnitFromColumn = ((issuance.NamePosUnit as string) || 'cm') as 'cm' | 'inch';
    
    // Find and set the template
    const template = templates.find(t => t.TemplateID === issuance.TemplateID);
    if (template) {
      setSelectedTemplate(template);
      
      // Parse and set field inputs from the issuance
      try {
        const savedFieldInputs = JSON.parse(issuance.FieldInputs || '{}');
        const templateFields = template.FieldsParsed || [];
        
        // Use column values as primary source, fall back to JSON values for legacy data
        const useAllCaps = issuance.NameAllCaps !== undefined 
          ? nameAllCapsFromColumn 
          : (savedFieldInputs['{NAME}_ALLCAPS'] !== 'false' && savedFieldInputs['{NAME}_ALLCAPS'] !== false);
        const nameStart = issuance.NameStartPos !== undefined 
          ? nameStartFromColumn 
          : (parseFloat(savedFieldInputs['{NAME}_START']) || 8.1);
        const nameEnd = issuance.NameEndPos !== undefined 
          ? nameEndFromColumn 
          : (parseFloat(savedFieldInputs['{NAME}_END']) || 27.6);
        const nameUnit = issuance.NamePosUnit !== undefined 
          ? nameUnitFromColumn 
          : (savedFieldInputs['{NAME}_UNIT'] || 'cm');
        
        const newFieldInputs: FieldInput[] = templateFields.map(placeholder => ({
          placeholder,
          value: savedFieldInputs[placeholder] || '',
          enabled: true,
          isCustomName: placeholder === '{NAME}' && !!savedFieldInputs['{NAME}'],
          isAllCaps: placeholder === '{NAME}' ? useAllCaps : undefined,
          isCustomControlNumber: placeholder === '{CONTROL_NUMBER}' 
            ? (savedFieldInputs['{CONTROL_NUMBER}_CUSTOM'] === 'true' || !!savedFieldInputs['{CONTROL_NUMBER}'])
            : undefined,
          nameStartPosition: placeholder === '{NAME}' ? nameStart : undefined,
          nameEndPosition: placeholder === '{NAME}' ? nameEnd : undefined,
          namePositionUnit: placeholder === '{NAME}' ? nameUnit : undefined
        }));
        setFieldInputs(newFieldInputs);
      } catch {
        // If parsing fails, use default field inputs
        const templateFields = template.FieldsParsed || [];
        setFieldInputs(templateFields.map(placeholder => ({
          placeholder,
          value: '',
          enabled: true,
          isCustomName: false,
          isAllCaps: placeholder === '{NAME}' ? nameAllCapsFromColumn : undefined,
          isCustomControlNumber: placeholder === '{CONTROL_NUMBER}' ? false : undefined,
          nameStartPosition: placeholder === '{NAME}' ? nameStartFromColumn : undefined,
          nameEndPosition: placeholder === '{NAME}' ? nameEndFromColumn : undefined,
          namePositionUnit: placeholder === '{NAME}' ? nameUnitFromColumn : undefined
        })));
      }
    }
    
    // Parse and set recipients
    try {
      const recipientDetails = JSON.parse(issuance.RecipientDetails || '[]');
      const recipients: SelectedRecipient[] = recipientDetails.map((r: { name: string; email: string; source?: string }, index: number) => ({
        id: `edit-${index}`,
        name: r.name,
        email: r.email,
        type: r.email ? 'Member' : 'External' as 'Member' | 'External',
        source: r.source,
        hasEmail: !!r.email
      }));
      setSelectedRecipients(recipients);
    } catch {
      setSelectedRecipients([]);
    }
    
    // Parse and set attachments
    try {
      const attachmentsData = JSON.parse(issuance.Attachments || '[]');
      setAttachments(attachmentsData);
    } catch {
      setAttachments([]);
    }
    setNewAttachmentName('');
    setNewAttachmentUrl('');
    setShowAttachmentForm(false);
    
    // Reset other states
    setCreateModalTab('recipients');
    setPreviewPdfUrl("");
    setPreviewImageUrl("");
    setPreviewPdfList([]);
    setCurrentPreviewIndex(0);
    setActiveCommand(null);
    setCommandSearchQuery('');
    setRecipientSearchQuery('');
    setShowRecipientDropdown(false);
    setExternalName('');
    setExternalEmail('');
    setShowAddFieldInput(false);
    setDynamicFieldInput('');
    
    // Open modal
    setShowCreateModal(true);
  };
  
  // Handle downloading the preview PDF with proper naming
  // Format: YSP-Name_Title_Date.pdf
  const handleDownloadPreviewPdf = (customTitle?: string, customName?: string) => {
    const currentUrl = previewPdfList.length > 1 
      ? previewPdfList[currentPreviewIndex]?.pdfUrl 
      : previewPdfUrl;
    const currentName = customName || (previewPdfList.length > 1 
      ? previewPdfList[currentPreviewIndex]?.recipientName 
      : (selectedRecipients[0]?.name || selectedIssuance?.Recipients?.[0]?.RecipientName || 'Preview'));
    
    const title = customTitle || issuanceTitle || selectedIssuance?.Title || 'Certificate';
    
    if (currentUrl) {
      const link = document.createElement('a');
      link.href = currentUrl;
      link.download = generateIssuanceFilename(currentName, title, 'pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Downloaded: ${currentName}`);
    }
  };
  
  // Handle opening preview PDF in new tab
  const handleOpenPreviewInNewTab = () => {
    if (previewPdfUrl) {
      window.open(previewPdfUrl, '_blank');
    }
  };
  
  const handleTemplateSelect = (template: IssuanceTemplate) => {
    setSelectedTemplate(template);
    
    // Parse fields and create field inputs
    const fields = template.FieldsParsed || [];
    setFieldInputs(fields.map(f => ({
      placeholder: f,
      value: "",
      enabled: true,
      isCustomName: f === '{NAME}' ? false : undefined, // NAME field defaults to auto-fill
      isAllCaps: f === '{NAME}' ? true : undefined, // NAME field defaults to ALL CAPS
      isCustomControlNumber: f === '{CONTROL_NUMBER}' ? false : undefined, // CONTROL_NUMBER defaults to auto-generate
      // Default name positioning (8.1cm to 27.6cm for standard A4 landscape certificate)
      nameStartPosition: f === '{NAME}' ? 8.1 : undefined,
      nameEndPosition: f === '{NAME}' ? 27.6 : undefined,
      namePositionUnit: f === '{NAME}' ? 'cm' : undefined
    })));
    
    // Set default email title
    setEmailTitle(`Your ${template.Name}`);
    
    // Check for default template URL from settings
    const templateKey = `Default${template.Type.replace(/\s+/g, '')}Template`;
    if (settings[templateKey]?.value) {
      setCustomTemplateUrl("");
    }
  };
  
  // Check if a recipient is already in the selected list (for duplicate detection)
  const isRecipientAlreadyAdded = (email?: string, name?: string, id?: string): boolean => {
    if (!email && !name) return false;
    const recipientKey = email || `${id}-${name}`;
    return selectedRecipients.some(r => (r.email || `${r.id}-${r.name}`) === recipientKey);
  };
  
  const handleAddRecipient = (recipient: SelectedRecipient) => {
    // Use id or email+name as unique identifier (for recipients without email)
    const recipientKey = recipient.email || `${recipient.id}-${recipient.name}`;
    if (selectedRecipients.find(r => (r.email || `${r.id}-${r.name}`) === recipientKey)) {
      toast.info(`${recipient.name} is already in the list`, { duration: 2000 });
      return;
    }
    setSelectedRecipients(prev => [...prev, recipient]);
    setRecipientSearchQuery("");
    setCommandSearchQuery("");
    // Don't close dropdown - allow combining sources
    // setShowRecipientDropdown(false);
    toast.success(`Added: ${recipient.name}`);
  };
  
  const handleRemoveRecipient = (recipientKey: string) => {
    setSelectedRecipients(prev => prev.filter(r => (r.email || `${r.id}-${r.name}`) !== recipientKey));
  };
  
  // Universal search input handler
  const handleUniversalSearchInput = (value: string) => {
    setRecipientSearchQuery(value);
    setShowRecipientDropdown(true);
    
    // Check if typing a command
    if (value.startsWith('@') && !activeCommand) {
      // User is typing a command
      return;
    }
    
    // If command is active, update command search query
    if (activeCommand) {
      setCommandSearchQuery(value);
    }
  };
  
  // Handle command selection
  const handleSelectCommand = (command: typeof SEARCH_COMMANDS[number]['command']) => {
    setActiveCommand(command);
    setRecipientSearchQuery('');
    setCommandSearchQuery('');
    setShowRecipientDropdown(true);
    
    // For @All, immediately load all members
    if (command === '@All') {
      handleLoadAllDirectory();
      setActiveCommand(null);
      setShowRecipientDropdown(false);
    }
  };
  
  // Handle selecting an item from suggestions
  const handleSelectSuggestion = async (item: MemberWithEmail | EventData | Committee) => {
    if (!activeCommand) return;
    
    switch (activeCommand) {
      case '@Person':
        const member = item as MemberWithEmail;
        if (member.email) {
          handleAddRecipient({
            id: member.id,
            name: member.name,
            email: member.email,
            type: 'Member',
            source: 'Directory'
          });
        } else {
          toast.error("Member has no email address");
        }
        break;
      
      case '@Event':
        const event = item as EventData;
        setIsLoadingRecipients(true);
        try {
          const attendees = await getEventAttendees(event.EventID);
          // Include ALL attendees - those without email will be flagged
          const newRecipients: SelectedRecipient[] = attendees.map((a, idx) => ({
            id: a.memberId || `event-${event.EventID}-${idx}`,
            name: a.name,
            email: a.email || '',
            type: 'Member' as const,
            source: event.Title,
            hasEmail: a.hasEmail !== undefined ? a.hasEmail : !!a.email,
            eventId: event.EventID // Track event ID for control numbers
          }));
          
          // Store the selected event for control number generation
          setSelectedEventId(event.EventID);
          setSelectedEventTitle(event.Title);
          
          // Track how many were added vs skipped (duplicates)
          let addedCount = 0;
          setSelectedRecipients(prev => {
            // Use id+name as key for recipients without email
            const existing = new Set(prev.map(r => r.email || `${r.id}-${r.name}`));
            const toAdd = newRecipients.filter(r => !existing.has(r.email || `${r.id}-${r.name}`));
            addedCount = toAdd.length;
            return [...prev, ...toAdd];
          });
          
          const skipped = newRecipients.length - addedCount;
          
          // Show detailed toast with email status and duplicate info
          const withEmail = newRecipients.filter(r => r.hasEmail).length;
          const withoutEmail = newRecipients.length - withEmail;
          let message = `Added ${addedCount} attendees from ${event.Title}`;
          if (skipped > 0) message += ` (${skipped} duplicates skipped)`;
          if (withoutEmail > 0) message += ` - ${withoutEmail} without email`;
          toast.success(message);
        } catch {
          toast.error("Failed to load event attendees");
        } finally {
          setIsLoadingRecipients(false);
        }
        break;
      
      case '@Committee':
        const committee = item as Committee;
        setIsLoadingRecipients(true);
        try {
          // For "General Members Committee", include members with no committee assigned
          const committeeMembers = committee.id === 'general' 
            ? members.filter(m => !m.committee || m.committee.trim() === '' || m.committee.toLowerCase().includes('general'))
            : members.filter(m => m.committee?.toLowerCase().includes(committee.name.toLowerCase()));
          const newRecipients: SelectedRecipient[] = committeeMembers.map(m => ({
            id: m.id,
            name: m.name,
            email: m.email || '',
            type: 'Member' as const,
            source: committee.name
          })).filter(r => r.email);

          // Track how many were added vs skipped (duplicates)
          const existing = new Set(selectedRecipients.map(r => r.email));
          const toAdd = newRecipients.filter(r => !existing.has(r.email));
          const addedCount = toAdd.length;
          setSelectedRecipients(prev => [...prev, ...toAdd]);

          const skipped = newRecipients.length - addedCount;
          if (skipped > 0) {
            toast.success(`Added ${addedCount} members from ${committee.name} (${skipped} duplicates skipped)`);
          } else {
            toast.success(`Added ${addedCount} members from ${committee.name}`);
          }
        } catch {
          toast.error("Failed to load committee members");
        } finally {
          setIsLoadingRecipients(false);
        }
        break;
    }
    
    // Reset after selection
    setCommandSearchQuery('');
    setRecipientSearchQuery('');
    // Keep dropdown open for more selections
  };
  
  // Handle clearing the command
  const handleClearCommand = () => {
    setActiveCommand(null);
    setCommandSearchQuery('');
    setRecipientSearchQuery('');
  };

  const handleAddExternalRecipient = () => {
    if (!externalName.trim() || !externalEmail.trim()) {
      toast.error("Please enter both name and email");
      return;
    }
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(externalEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }
    
    // Check for duplicate by email
    if (isRecipientAlreadyAdded(externalEmail.trim())) {
      toast.info(`A recipient with this email is already added`, { duration: 2000 });
      return;
    }
    
    handleAddRecipient({
      id: `ext-${Date.now()}`,
      name: externalName.trim(),
      email: externalEmail.trim(),
      type: 'External',
      source: 'External'
    });
    
    setExternalName("");
    setExternalEmail("");
    // Keep dropdown open for more additions
  };
  
  const handleLoadAllDirectory = async () => {
    setIsLoadingRecipients(true);
    try {
      const allMembers = members.filter(m => m.email);
      
      const newRecipients: SelectedRecipient[] = allMembers.map(m => ({
        id: m.id,
        name: m.name,
        email: m.email || '',
        type: 'Member' as const,
        source: 'Directory'
      }));
      
      // Filter out duplicates when combining with existing recipients
      const existingEmails = new Set(selectedRecipients.map(r => r.email?.toLowerCase()).filter(Boolean));
      const toAdd = newRecipients.filter(r => !existingEmails.has(r.email.toLowerCase()));
      const skipped = newRecipients.length - toAdd.length;
      
      setSelectedRecipients(prev => [...prev, ...toAdd]);
      
      if (skipped > 0) {
        toast.success(`Added ${toAdd.length} members from directory (${skipped} duplicates skipped)`);
      } else {
        toast.success(`Added ${toAdd.length} members from directory`);
      }
    } catch (error) {
      toast.error("Failed to load directory");
    } finally {
      setIsLoadingRecipients(false);
    }
  };
  
  const handleGeneratePreview = async () => {
    if (!selectedTemplate) {
      toast.error("Please select a template first");
      return;
    }
    
    const templateUrl = customTemplateUrl || selectedTemplate.DocsUrl;
    if (!templateUrl) {
      toast.error("No template URL configured. Please set in General Settings or enter a custom URL.");
      return;
    }
    
    const toastId = `preview-${Date.now()}`;
    setIsGeneratingPreview(true);
    
    try {
      // Cleanup previous preview URLs
      cleanupPreviewUrl();
      
      const fieldValues: Record<string, string> = {};
      const nameField = fieldInputs.find(f => f.placeholder === '{NAME}');
      const controlNumberField = fieldInputs.find(f => f.placeholder === '{CONTROL_NUMBER}');
      const useCustomName = nameField?.isCustomName && nameField?.value?.trim();
      const useAllCaps = nameField?.isAllCaps === true; // Check if ALL CAPS is enabled
      
      fieldInputs.forEach(f => {
        if (f.enabled) {
          // For {NAME} field with custom value enabled, use the custom value
          if (f.placeholder === '{NAME}' && f.isCustomName && f.value?.trim()) {
            let nameValue = f.value.trim();
            // Apply ALL CAPS if enabled
            if (useAllCaps) {
              nameValue = nameValue.toUpperCase();
            }
            fieldValues[f.placeholder] = nameValue;
          } 
          // For {CONTROL_NUMBER} field with custom value enabled, use the custom value
          else if (f.placeholder === '{CONTROL_NUMBER}' && f.isCustomControlNumber && f.value?.trim()) {
            fieldValues[f.placeholder] = f.value.trim();
          }
          // For {CONTROL_NUMBER} with auto-generate (no custom value), show placeholder for preview
          else if (f.placeholder === '{CONTROL_NUMBER}' && !f.isCustomControlNumber) {
            // In preview mode, show a sample control number format
            fieldValues[f.placeholder] = 'YSP-XX-TCXXYYY';
          }
          else {
            fieldValues[f.placeholder] = f.value || `[${f.placeholder}]`;
          }
        }
      });
      
      // Determine preview name for single recipient or fallback
      let previewName = useCustomName 
        ? nameField!.value.trim()
        : (selectedRecipients.length > 0 
          ? selectedRecipients[0].name 
          : "Sample Recipient Name");
      
      // Apply ALL CAPS to preview name if enabled
      if (useAllCaps) {
        previewName = previewName.toUpperCase();
      }
      
      // For multi-recipient previews WITHOUT custom name, leave {NAME} empty 
      // so the backend can fill each recipient's name individually.
      // Only pre-fill {NAME} for single recipient preview or when using custom name.
      const isMultiRecipientPreview = selectedRecipients.length > 1 && !useCustomName;
      if (!isMultiRecipientPreview && !useCustomName && (fieldValues['{NAME}'] === '' || fieldValues['{NAME}'] === '[{NAME}]')) {
        fieldValues['{NAME}'] = previewName;
      } else if (isMultiRecipientPreview) {
        // Clear {NAME} for multi-recipient preview so backend uses each recipient's name
        fieldValues['{NAME}'] = '';
      }
      
      // Pass all recipients for combined multi-page preview
      // If using custom name, modify recipients to all use the same name for preview
      // Apply ALL CAPS transformation to recipient names if enabled
      let recipientsForPreview = selectedRecipients.length > 0 
        ? (useAllCaps 
          ? selectedRecipients.map(r => ({ ...r, name: r.name.toUpperCase() }))
          : selectedRecipients)
        : undefined;
      
      // If using custom name override, pass that info to the preview generator
      let customNameForPreview = useCustomName ? nameField!.value.trim() : undefined;
      if (customNameForPreview && useAllCaps) {
        customNameForPreview = customNameForPreview.toUpperCase();
      }
      
      // Add name positioning to field values for backend processing
      if (nameField) {
        fieldValues['{NAME}_START'] = String(nameField.nameStartPosition || 8.1);
        fieldValues['{NAME}_END'] = String(nameField.nameEndPosition || 27.6);
        fieldValues['{NAME}_UNIT'] = nameField.namePositionUnit || 'cm';
      }
      
      // Prepare name formatting options for backend
      const nameFormattingOptions = {
        useAllCaps: useAllCaps,
        nameStartPosition: nameField?.nameStartPosition || 8.1,
        nameEndPosition: nameField?.nameEndPosition || 27.6,
        namePositionUnit: (nameField?.namePositionUnit || 'cm') as 'cm' | 'inch',
      };
      
      // Generate cache key for this preview configuration
      const cacheKey = generatePreviewCacheKey(
        templateUrl,
        fieldValues,
        recipientsForPreview?.map(r => ({ name: r.name, email: r.email })),
        customNameForPreview,
        nameFormattingOptions
      );
      
      // Check cache first
      const cachedPreview = getCachedPreview(cacheKey);
      
      if (cachedPreview) {
        // Use cached preview - instant!
        addUploadToast({
          id: toastId,
          title: 'Preview Loaded',
          message: 'Using cached preview (instant)',
          status: 'success',
          progress: 100,
          progressLabel: 'From cache'
        });
        
        // Convert base64 to blob URLs
        const pdfUrl = base64ToBlobUrl(cachedPreview.pdfBase64);
        setPreviewPdfUrl(pdfUrl);
        setCreateModalTab('preview');
        
        if (cachedPreview.pdfPreviews && cachedPreview.pdfPreviews.length > 1) {
          const pdfPreviews = cachedPreview.pdfPreviews.map(p => ({
            recipientName: p.recipientName,
            pdfUrl: base64ToBlobUrl(p.pdfBase64)
          }));
          setPreviewPdfList(pdfPreviews);
          setCurrentPreviewIndex(0);
        } else {
          setPreviewPdfList([]);
          setCurrentPreviewIndex(0);
        }
        
        setTimeout(() => removeUploadToast(toastId), 2000);
        setIsGeneratingPreview(false);
        return;
      }
      
      // No cache - generate fresh preview
      // Show recipient names in progress if multiple recipients
      const recipientCount = recipientsForPreview?.length || 1;
      
      addUploadToast({
        id: toastId,
        title: 'Generating Preview',
        message: recipientCount > 1 
          ? `Creating ${recipientCount} certificates...`
          : `Creating certificate for ${previewName}...`,
        status: 'loading',
        progress: 5,
        progressLabel: recipientCount > 1 
          ? `1/${recipientCount}: ${recipientsForPreview?.[0]?.name || previewName}...`
          : 'Processing template...'
      });
      
      // Track current recipient index for progress display
      let currentIndex = 0;
      let isCompleted = false;
      
      // Sequential progress updates - one recipient at a time
      const progressInterval = setInterval(() => {
        if (isCompleted) {
          clearInterval(progressInterval);
          return;
        }
        
        currentIndex++;
        if (currentIndex >= recipientCount) {
          // Stay on last recipient until backend completes
          currentIndex = recipientCount - 1;
        }
        
        const currentRecipient = recipientsForPreview?.[currentIndex]?.name || previewName;
        // Progress from 5% to 95% based on recipient count, with 2 decimal places
        const progressPercent = parseFloat((5 + ((currentIndex + 1) / recipientCount) * 90).toFixed(2));
        
        updateUploadToast(toastId, { 
          progress: progressPercent, 
          progressLabel: recipientCount > 1 
            ? `${currentIndex + 1}/${recipientCount}: ${currentRecipient}... (${progressPercent.toFixed(2)}%)`
            : `Processing: ${currentRecipient}... (${progressPercent.toFixed(2)}%)`
        });
      }, 800); // Update every 800ms to simulate per-recipient generation
      
      const result = await generatePdfPreview(templateUrl, fieldValues, previewName, recipientsForPreview, customNameForPreview, nameFormattingOptions);
      
      // Mark as completed and clear the progress interval
      isCompleted = true;
      clearInterval(progressInterval);
      
      updateUploadToast(toastId, { progress: 97.50, progressLabel: 'Caching for faster access... (97.50%)' });
      
      // Cache the result for next time using base64 data
      if (result.pdfBase64) {
        try {
          setCachedPreview({
            cacheKey,
            pdfBase64: result.pdfBase64,
            pdfPreviews: result.rawPdfPreviews,
            timestamp: Date.now(),
            templateUrl
          });
        } catch (e) {
          console.warn('Failed to cache preview:', e);
        }
      }
      
      setPreviewPdfUrl(result.pdfUrl);
      setCreateModalTab('preview');
      
      // Store the preview list for pagination if multiple recipients
      if (result.pdfPreviews && result.pdfPreviews.length > 1) {
        setPreviewPdfList(result.pdfPreviews);
        setCurrentPreviewIndex(0);
        
        updateUploadToast(toastId, {
          status: 'success',
          title: 'Preview Generated & Cached',
          message: `${result.pdfPreviews.length} certificates ready. Next preview will be instant!`,
          progress: 100
        });
      } else {
        setPreviewPdfList([]);
        setCurrentPreviewIndex(0);
        
        updateUploadToast(toastId, {
          status: 'success',
          title: 'Preview Generated & Cached',
          message: 'Document ready. Next preview will be instant!',
          progress: 100
        });
      }
      
      setTimeout(() => removeUploadToast(toastId), 3000);
      
    } catch (error) {
      console.error('Preview generation error:', error);
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Preview Failed',
        message: error instanceof Error ? error.message : 'Failed to generate preview'
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    } finally {
      setIsGeneratingPreview(false);
    }
  };
  
  const handleCreateIssuance = async () => {
    // Validation
    if (!issuanceTitle.trim()) {
      toast.error("Please enter a title for this issuance");
      return;
    }
    if (!selectedTemplate) {
      toast.error("Please select a template");
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error("Please add at least one recipient");
      return;
    }
    
    const templateUrl = customTemplateUrl || selectedTemplate.DocsUrl;
    if (!templateUrl && sendToEmail) {
      toast.error("No template URL configured");
      return;
    }
    
    const toastId = `issuance-${Date.now()}`;
    const isUpdating = isEditMode && editingIssuanceId;
    
    // Add debug toast
    addUploadToast({
      id: toastId,
      title: isUpdating ? 'Updating Draft' : (sendToEmail ? 'Sending Issuance' : 'Creating Issuance'),
      message: isUpdating ? 'Updating issuance...' : 'Preparing issuance...',
      status: 'loading',
      progress: 5,
      progressLabel: 'Initializing...'
    });
    
    try {
      // Prepare field inputs
      const fieldValues: Record<string, string> = {};
      const nameField = fieldInputs.find(f => f.placeholder === '{NAME}');
      const controlNumberField = fieldInputs.find(f => f.placeholder === '{CONTROL_NUMBER}');
      const useCustomName = nameField?.isCustomName && nameField?.value?.trim();
      const useAllCaps = nameField?.isAllCaps === true; // Check if ALL CAPS is enabled
      
      fieldInputs.forEach(f => {
        if (f.enabled) {
          // For {NAME} field with custom value enabled, use the custom value
          if (f.placeholder === '{NAME}' && f.isCustomName && f.value?.trim()) {
            let nameValue = f.value.trim();
            // Apply ALL CAPS if enabled
            if (useAllCaps) {
              nameValue = nameValue.toUpperCase();
            }
            fieldValues[f.placeholder] = nameValue;
          } 
          // For {CONTROL_NUMBER} field with custom value enabled, use the custom value
          else if (f.placeholder === '{CONTROL_NUMBER}' && f.isCustomControlNumber && f.value?.trim()) {
            fieldValues[f.placeholder] = f.value.trim();
          }
          // For {CONTROL_NUMBER} with auto-generate, don't set value (backend will generate)
          else if (f.placeholder === '{CONTROL_NUMBER}' && !f.isCustomControlNumber) {
            // Leave empty - backend will auto-generate based on eventId
          }
          else {
            fieldValues[f.placeholder] = f.value;
          }
        }
      });
      
      // Store ALL CAPS setting in fieldValues for later retrieval
      if (nameField) {
        fieldValues['{NAME}_ALLCAPS'] = useAllCaps ? 'true' : 'false';
        // Store name positioning settings
        fieldValues['{NAME}_START'] = String(nameField.nameStartPosition || 8.1);
        fieldValues['{NAME}_END'] = String(nameField.nameEndPosition || 27.6);
        fieldValues['{NAME}_UNIT'] = nameField.namePositionUnit || 'cm';
      }
      
      // Store control number mode
      if (controlNumberField) {
        fieldValues['{CONTROL_NUMBER}_CUSTOM'] = controlNumberField.isCustomControlNumber ? 'true' : 'false';
      }
      
      // Store custom name value if using custom name for all recipients
      let customNameValue = useCustomName ? nameField!.value.trim() : undefined;
      if (customNameValue && useAllCaps) {
        customNameValue = customNameValue.toUpperCase();
      }
      
      // Prepare recipients with ALL CAPS transformation if enabled
      const processedRecipients = useAllCaps 
        ? selectedRecipients.map(r => ({ ...r, name: r.name.toUpperCase() }))
        : selectedRecipients;
      
      // Determine recipient type based on sources
      const determineRecipientType = (): RecipientType => {
        if (selectedRecipients.length === 0) return 'Person';
        const sources = new Set(selectedRecipients.map(r => r.source));
        if (sources.has('Directory') && sources.size === 1) return 'Directory';
        if (selectedRecipients.every(r => r.type === 'External')) return 'External';
        // Check if all from same event
        const firstSource = selectedRecipients[0].source;
        if (firstSource && events.some(e => e.Title === firstSource)) return 'Event';
        if (firstSource && committees.some(c => c.name === firstSource)) return 'Committee';
        return 'Person';
      };
      
      updateUploadToast(toastId, { progress: 15, progressLabel: isUpdating ? 'Updating issuance record...' : 'Creating issuance record...' });
      
      if (isUpdating) {
        // UPDATE existing draft issuance
        await updateIssuance({
          id: editingIssuanceId!,
          Title: issuanceTitle,
          TemplateID: selectedTemplate.TemplateID,
          TemplateName: selectedTemplate.Name,
          RecipientType: determineRecipientType(),
          RecipientDetails: JSON.stringify(processedRecipients.map(r => ({
            name: r.name,
            email: r.email,
            source: r.source
          }))),
          TotalRecipients: processedRecipients.length,
          FieldInputs: JSON.stringify(fieldValues),
          EmailTitle: sendToEmail ? emailTitle : '',
          EmailMessage: sendToEmail ? emailMessage : '',
          CustomTemplateUrl: customTemplateUrl || '',
          DeliveryMethod: sendToEmail ? 'Email' : 'DownloadOnly',
          // Include name formatting columns for update
          NameAllCaps: String(useAllCaps),
          NameStartPos: String(nameField?.nameStartPosition || 8.1),
          NameEndPos: String(nameField?.nameEndPosition || 27.6),
          NamePosUnit: nameField?.namePositionUnit || 'cm',
          // Include attachments
          Attachments: JSON.stringify(attachments)
        });
        
        updateUploadToast(toastId, { progress: 80, progressLabel: 'Draft updated...' });
        
        logEdit(username, "Issuance", issuanceTitle);
        
        updateUploadToast(toastId, {
          status: 'success',
          title: 'Draft Updated',
          message: `Issuance draft updated successfully with ${processedRecipients.length} recipients.`,
          progress: 100
        });
        setTimeout(() => removeUploadToast(toastId), 3000);
      } else {
        // CREATE new issuance
        const issuanceData: CreateIssuanceData = {
          title: issuanceTitle,
          templateId: selectedTemplate.TemplateID,
          templateName: selectedTemplate.Name,
          createdBy: username,
          recipientType: determineRecipientType(),
          recipientDetails: processedRecipients.map(r => ({
            name: r.name, // Name with ALL CAPS applied if enabled
            email: r.email,
            source: r.source
          })),
          totalRecipients: processedRecipients.length,
          fieldInputs: fieldValues, // Custom {NAME} value is already in fieldValues if set, ALL CAPS setting stored
          emailTitle: sendToEmail ? emailTitle : undefined,
          emailMessage: sendToEmail ? emailMessage : undefined,
          customTemplateUrl: customTemplateUrl || undefined,
          recipients: processedRecipients.map(r => ({
            name: r.name, // Name with ALL CAPS applied if enabled
            email: r.email,
            type: r.type
          })),
          downloadOnly: !sendToEmail, // Mark as downloadOnly if not sending to email
          customNameOverride: customNameValue, // Pass custom name override for backend processing (with ALL CAPS if enabled)
          // Name formatting options for backend columns
          nameAllCaps: useAllCaps,
          nameStartPosition: nameField?.nameStartPosition || 8.1,
          nameEndPosition: nameField?.nameEndPosition || 27.6,
          namePositionUnit: (nameField?.namePositionUnit || 'cm') as 'cm' | 'inch',
          // Include attachments
          attachments: attachments,
          // Event linking for control numbers (only if auto-generate is enabled for {CONTROL_NUMBER})
          eventId: (() => {
            const controlField = fieldInputs.find(f => f.placeholder === '{CONTROL_NUMBER}');
            // Only pass eventId if control number field exists, is enabled, and not using custom value
            if (controlField && controlField.enabled && !controlField.isCustomControlNumber && selectedEventId) {
              return selectedEventId;
            }
            return undefined;
          })(),
          eventTitle: (() => {
            const controlField = fieldInputs.find(f => f.placeholder === '{CONTROL_NUMBER}');
            if (controlField && controlField.enabled && !controlField.isCustomControlNumber && selectedEventTitle) {
              return selectedEventTitle;
            }
            return undefined;
          })(),
        };
        
        await createIssuance(issuanceData);
        
        updateUploadToast(toastId, { progress: 80, progressLabel: 'Issuance created...' });
        
        logCreate(username, "Issuance", issuanceTitle);
        
        // Always save as draft first - don't send immediately
        // User must click Send button from the issuance detail view to send emails
        if (sendToEmail) {
          // Email mode - saved as draft, user needs to send manually
          updateUploadToast(toastId, {
            status: 'success',
            title: 'Draft Created',
            message: `Issuance saved as draft. Open it and click Send to deliver to ${processedRecipients.length} recipients.`,
            progress: 100
          });
          setTimeout(() => removeUploadToast(toastId), 4000);
        } else {
          // Download only - no email sending
          updateUploadToast(toastId, {
            status: 'success',
            title: 'Issuance Created',
            message: 'Issuance saved successfully (download only mode)',
            progress: 100
          });
          setTimeout(() => removeUploadToast(toastId), 3000);
        }
      }
      
      // Refresh list and close modal
      loadIssuances();
      setShowCreateModal(false);
      // Reset edit mode
      setIsEditMode(false);
      setEditingIssuanceId(null);
      
    } catch (error) {
      console.error(isUpdating ? 'Update issuance error:' : 'Create issuance error:', error);
      updateUploadToast(toastId, {
        status: 'error',
        title: isUpdating ? 'Update Failed' : 'Creation Failed',
        message: error instanceof Error ? error.message : (isUpdating ? 'Failed to update issuance' : 'Failed to create issuance')
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
    }
  };
  
  // Handle sending emails from the detail view for Draft issuances
  const handleSendFromDetail = async () => {
    if (!selectedIssuance) return;
    
    const toastId = `send-${Date.now()}`;
    setIsSending(true);
    setSendCancelled(false); // Reset cancel flag
    
    addUploadToast({
      id: toastId,
      title: 'Sending Emails',
      message: `Preparing to send to ${selectedIssuance.TotalRecipients} recipients...`,
      status: 'loading',
      progress: 10,
      progressLabel: 'Starting...'
    });
    
    try {
      const result = await sendIssuance(selectedIssuance.IssuanceID, username, (progress) => {
        setSendProgress(progress);
        const percent = Math.round(10 + (progress.sent / progress.total) * 85);
        updateUploadToast(toastId, { 
          progress: percent, 
          progressLabel: `Sent ${progress.sent}/${progress.total}...`,
          message: `Sent ${progress.sent} of ${progress.total} emails${progress.failed > 0 ? ` (${progress.failed} failed)` : ''}`
        });
      });
      
      setSendProgress(result);
      
      // Check if sending was cancelled
      if (result.cancelled) {
        updateUploadToast(toastId, {
          status: 'error',
          title: 'Sending Cancelled',
          message: result.message || `Cancelled. ${result.sent} emails were sent before cancellation.`,
          progress: 100
        });
        setTimeout(() => removeUploadToast(toastId), 6000);
      } else if (result.failed > 0) {
        // Final result - some failed
        const failedRecipients = result.details
          .filter(d => d.status === 'failed')
          .map(d => d.name)
          .slice(0, 3);
        const failedMsg = failedRecipients.length > 3 
          ? `${failedRecipients.join(', ')} and ${result.failed - 3} more`
          : failedRecipients.join(', ');
        
        updateUploadToast(toastId, {
          status: 'error',
          title: 'Partially Sent',
          message: `Sent: ${result.sent} | Failed: ${result.failed}\nFailed: ${failedMsg}`,
          progress: 100
        });
        setTimeout(() => removeUploadToast(toastId), 8000);
      } else {
        updateUploadToast(toastId, {
          status: 'success',
          title: 'Emails Sent Successfully',
          message: `All ${result.sent} emails sent successfully!`,
          progress: 100
        });
        setTimeout(() => removeUploadToast(toastId), 4000);
      }
      
      // Refresh the issuance data
      loadIssuances();
      // Refresh selected issuance detail
      const refreshedIssuances = await getIssuances();
      const updated = refreshedIssuances.find(i => i.IssuanceID === selectedIssuance.IssuanceID);
      if (updated) {
        setSelectedIssuance(updated);
      }
      
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Sending Failed',
        message: error instanceof Error ? error.message : 'Failed to send emails'
      });
      setTimeout(() => removeUploadToast(toastId), 6000);
    } finally {
      setIsSending(false);
      setSendCancelled(false);
    }
  };

  // Handle stopping the send process - calls backend to set cancel flag
  const handleStopSending = async () => {
    if (!selectedIssuance) return;
    
    setSendCancelled(true);
    
    try {
      // Call backend to set cancel flag
      await cancelSending(selectedIssuance.IssuanceID);
      toast.warning('Cancellation requested. Waiting for current email to finish...', {
        description: 'Some emails may have already been sent.',
        duration: 5000,
      });
    } catch (error) {
      console.error('Failed to cancel sending:', error);
      toast.error('Failed to request cancellation, but sending will stop on frontend.');
    }
    
    // Note: We don't set isSending to false immediately - the sendIssuance promise 
    // will complete and handle the cancelled state from the backend response
  };
  
  // Handle publishing a Download-Only issuance (makes it visible to members)
  const handlePublishFromDetail = async () => {
    if (!selectedIssuance) return;
    
    const toastId = `publish-${Date.now()}`;
    
    addUploadToast({
      id: toastId,
      title: 'Publishing Issuance',
      message: `Making issuance visible to ${selectedIssuance.TotalRecipients} recipients...`,
      status: 'loading',
      progress: 30,
      progressLabel: 'Publishing...'
    });
    
    try {
      const result = await publishIssuance(selectedIssuance.IssuanceID, username);
      
      updateUploadToast(toastId, {
        status: 'success',
        title: 'Published Successfully',
        message: result.message || `Issuance is now visible to ${result.recipientCount} recipients`,
        progress: 100
      });
      setTimeout(() => removeUploadToast(toastId), 4000);
      
      // Refresh the issuance data
      loadIssuances();
      // Refresh selected issuance detail
      const refreshedIssuances = await getIssuances();
      const updated = refreshedIssuances.find(i => i.IssuanceID === selectedIssuance.IssuanceID);
      if (updated) {
        setSelectedIssuance(updated);
      }
      
    } catch (error) {
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Publish Failed',
        message: error instanceof Error ? error.message : 'Failed to publish issuance'
      });
      setTimeout(() => removeUploadToast(toastId), 6000);
    }
  };
  
  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!newTemplateDocsUrl.trim()) {
      toast.error("Please enter the Google Docs URL");
      return;
    }
    if (newTemplateFields.length === 0) {
      toast.error("Please add at least one field placeholder");
      return;
    }
    
    try {
      const templateData: CreateTemplateData = {
        name: newTemplateName,
        type: newTemplateType,
        docsUrl: newTemplateDocsUrl,
        fields: newTemplateFields,
        createdBy: username
      };
      
      await createTemplate(templateData);
      toast.success("Template created successfully");
      logCreate(username, "Issuance Template", newTemplateName);
      
      // Reset form and reload
      setNewTemplateName("");
      setNewTemplateType("Custom");
      setNewTemplateDocsUrl("");
      setNewTemplateFields(["{NAME}"]);
      setShowTemplateForm(false);
      loadTemplates();
      
    } catch (error) {
      toast.error("Failed to create template");
    }
  };
  
  const handleAddFieldPlaceholder = () => {
    if (!newFieldInput.trim()) return;
    
    let field = newFieldInput.trim().toUpperCase();
    if (!field.startsWith("{")) field = "{" + field;
    if (!field.endsWith("}")) field = field + "}";
    
    if (newTemplateFields.includes(field)) {
      toast.error("Field already exists");
      return;
    }
    
    setNewTemplateFields(prev => [...prev, field]);
    setNewFieldInput("");
  };

  // ============= TEMPLATE EDITING HANDLERS =============
  
  const handleStartEditTemplate = (template: IssuanceTemplate) => {
    setEditingTemplateId(template.TemplateID);
    setEditTemplateName(template.Name);
    setEditTemplateType(template.Type);
    setEditTemplateDocsUrl(template.DocsUrl || "");
    setEditTemplateFields(template.FieldsParsed || []);
    setEditFieldInput("");
  };
  
  const handleCancelEditTemplate = () => {
    setEditingTemplateId(null);
    setEditTemplateName("");
    setEditTemplateType("Custom");
    setEditTemplateDocsUrl("");
    setEditTemplateFields([]);
    setEditFieldInput("");
  };
  
  const handleAddEditFieldPlaceholder = () => {
    if (!editFieldInput.trim()) return;
    
    let field = editFieldInput.trim().toUpperCase();
    if (!field.startsWith("{")) field = "{" + field;
    if (!field.endsWith("}")) field = field + "}";
    
    if (editTemplateFields.includes(field)) {
      toast.error("Field already exists");
      return;
    }
    
    setEditTemplateFields(prev => [...prev, field]);
    setEditFieldInput("");
  };
  
  const handleSaveTemplate = async () => {
    if (!editingTemplateId) return;
    
    if (!editTemplateName.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!editTemplateDocsUrl.trim()) {
      toast.error("Please enter the Google Docs URL");
      return;
    }
    if (editTemplateFields.length === 0) {
      toast.error("Please add at least one field placeholder");
      return;
    }
    
    const toastId = `save-template-${Date.now()}`;
    setIsSavingTemplate(true);
    
    try {
      // Show progress toast
      addUploadToast({
        id: toastId,
        title: "Saving Template",
        message: "Connecting to backend...",
        status: "loading",
        progress: 10,
      });
      
      // Update progress - sending data
      updateUploadToast(toastId, {
        message: "Updating template data...",
        progress: 40,
      });
      
      await updateTemplate({
        id: editingTemplateId,
        name: editTemplateName,
        type: editTemplateType,
        docsUrl: editTemplateDocsUrl,
        fields: editTemplateFields,
      });
      
      // Update progress - finalizing
      updateUploadToast(toastId, {
        message: "Refreshing templates list...",
        progress: 80,
      });
      
      // Reload templates
      await loadTemplates();
      
      // Success
      updateUploadToast(toastId, {
        title: "Template Saved",
        message: `"${editTemplateName}" has been updated successfully`,
        status: "success",
        progress: 100,
      });
      
      logEdit(username, "Issuance Template", editTemplateName);
      
      // Reset editing state
      handleCancelEditTemplate();
      
    } catch (error) {
      updateUploadToast(toastId, {
        title: "Save Failed",
        message: error instanceof Error ? error.message : "Failed to save template",
        status: "error",
        progress: 0,
      });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Helper to find profile picture by email or name from the members list
  const findProfilePicture = (email?: string, name?: string): string | undefined => {
    if (!members || members.length === 0) return undefined;
    
    const emailLower = email?.toLowerCase().trim() || '';
    const nameLower = name?.toLowerCase().trim() || '';
    
    // First try to match by email (most reliable)
    if (emailLower) {
      const memberByEmail = members.find(m => m.email?.toLowerCase().trim() === emailLower);
      if (memberByEmail?.profilePicture) return memberByEmail.profilePicture;
    }
    
    // Then try to match by name
    if (nameLower) {
      const memberByName = members.find(m => m.name?.toLowerCase().trim() === nameLower);
      if (memberByName?.profilePicture) return memberByName.profilePicture;
    }
    
    return undefined;
  };

  // Helper to find the real registered name by email from the members list
  const findMemberName = (email?: string): string | undefined => {
    if (!members || members.length === 0 || !email) return undefined;
    
    const emailLower = email.toLowerCase().trim();
    const member = members.find(m => m.email?.toLowerCase().trim() === emailLower);
    return member?.name;
  };

  // ============= RENDER =============
  
  return (
    <PageLayout
      title="Issuance Center"
      subtitle="Create, manage, and send certificates, notices, and documents"
      isDark={isDark}
      onClose={onClose}
      breadcrumbs={[
        { label: "Home", onClick: onClose },
        { label: "Communication Center", onClick: undefined },
        { label: "Issuance Center", onClick: undefined },
      ]}
    >
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search issuances... (use @archive to search archived)"
            isDark={isDark}
          />
          {isArchiveSearch && (
            <p className="text-xs mt-1 text-amber-600 dark:text-amber-400">
              Searching in archived issuances
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle - Single button that switches */}
          <button
            onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
            className="p-2.5 rounded-lg border transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
            title={viewMode === 'card' ? 'Switch to Table View' : 'Switch to Card View'}
          >
            {viewMode === 'card' ? <List className="w-5 h-5" /> : <LayoutGrid className="w-5 h-5" />}
          </button>
          
          {/* Refresh - Icon only */}
          <button
            onClick={() => { clearIssuanceCache(); loadIssuances(); }}
            className="p-2.5 rounded-lg border transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          
          {/* Create Button - Only for Admin/Auditor */}
          {canCreate && (
            <Button
              variant="primary"
              size="md"
              onClick={handleOpenCreateModal}
              icon={<Plus className="w-4 h-4" />}
            >
              Create
            </Button>
          )}
        </div>
      </div>

      {/* Type Filter Dropdown */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm font-medium" style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}>
          Type:
        </span>
        <div style={{ width: "min(200px, 100%)" }}>
          <CustomDropdown
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: "all", label: "All Types" },
              { value: "Digital Certificate", label: "Certificate" },
              { value: "Meeting Notice", label: "Meeting Notice" },
              { value: "Notice", label: "Notice" },
              { value: "Letter", label: "Letter" },
              { value: "Memo", label: "Memorandum" },
              { value: "Custom", label: "Custom" },
            ]}
            placeholder="Filter by type"
            isDark={isDark}
            size="md"
            maxHeight={250}
            forceDirection="down"
          />
        </div>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#f6421f]" />
        </div>
      ) : filteredIssuances.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <p className="text-lg font-medium mb-2" style={{ color: isDark ? '#fff' : '#000' }}>
            No issuances found
          </p>
          <p className="text-sm text-muted-foreground">
            {searchQuery 
              ? "Try a different search term" 
              : isMemberView 
                ? "You don't have any issuances yet" 
                : "Create your first issuance to get started"}
          </p>
        </div>
      ) : viewMode === 'card' ? (
        /* Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIssuances.map((issuance) => (
            <div
              key={issuance.IssuanceID}
              onClick={() => handleViewIssuance(issuance)}
              className="p-5 rounded-xl border-2 cursor-pointer hover:scale-[1.02] transition-all"
              style={{
                ...glassStyle,
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <h3 className="font-semibold text-base mb-1 line-clamp-2 break-words" style={{ color: isDark ? '#fff' : '#000' }}>
                    {issuance.Title}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {issuance.TemplateName}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <StatusChip
                    status={issuance.Status.toLowerCase() as 'draft' | 'sent'}
                    label={issuance.Status}
                    customColor={getIssuanceStatusColor(issuance.Status)}
                  />
                  {/* Delivery Method Badge */}
                  <span 
                    className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ 
                      background: issuance.DeliveryMethod === 'DownloadOnly' 
                        ? `${DESIGN_TOKENS.colors.brand.orange}20` 
                        : 'rgba(59, 130, 246, 0.15)',
                      color: issuance.DeliveryMethod === 'DownloadOnly'
                        ? DESIGN_TOKENS.colors.brand.orange
                        : '#3b82f6'
                    }}
                  >
                    {issuance.DeliveryMethod === 'DownloadOnly' ? (
                      <><Download className="w-3 h-3" /> Download</>
                    ) : (
                      <><Mail className="w-3 h-3" /> Email</>
                    )}
                  </span>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{issuance.TotalRecipients} recipients</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>{formatIssuanceDate(issuance.CreatedAt)}</span>
                </div>
                {issuance.SentCount > 0 && (
                  <div className="flex items-center gap-2 text-sm">
                    <Send className="w-4 h-4 text-green-500" />
                    <span className="text-green-600 dark:text-green-400">
                      {issuance.SentCount} sent
                    </span>
                    {(issuance.ResentCount || 0) > 0 && (
                      <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                        <RefreshCw className="w-3 h-3" />
                        {issuance.ResentCount} resent
                      </span>
                    )}
                    {issuance.FailedCount > 0 && (
                      <span className="text-red-600 dark:text-red-400">
                        ({issuance.FailedCount} failed)
                      </span>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handleViewIssuance(issuance); }}
                  className="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                >
                  <Eye className="w-4 h-4 inline mr-1" />
                  View
                </button>
                {canCreate && (
                  <>
                    {/* Edit button - only for Draft issuances */}
                    {issuance.Status === 'Draft' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditDraftIssuance(issuance); }}
                        className="py-2 px-3 rounded-lg text-sm font-medium transition-all bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                        title="Edit Draft"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleArchiveIssuance(issuance.IssuanceID); }}
                      className="py-2 px-3 rounded-lg text-sm font-medium transition-all bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                      title="Archive"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenDeleteConfirm(issuance); }}
                      className="py-2 px-3 rounded-lg text-sm font-medium transition-all bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                      title="Delete Permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                <th className="text-left p-4 font-semibold">Title</th>
                <th className="text-left p-4 font-semibold">Template</th>
                <th className="text-left p-4 font-semibold">Recipients</th>
                <th className="text-left p-4 font-semibold">Status</th>
                <th className="text-left p-4 font-semibold">Delivery</th>
                <th className="text-left p-4 font-semibold">Created</th>
                <th className="text-left p-4 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredIssuances.map((issuance) => (
                <tr
                  key={issuance.IssuanceID}
                  className="border-b hover:bg-white/30 dark:hover:bg-white/5 cursor-pointer transition-colors"
                  style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                  onClick={() => handleViewIssuance(issuance)}
                >
                  <td className="p-4 max-w-[200px]">
                    <span className="font-medium block truncate" style={{ color: isDark ? '#fff' : '#000' }} title={issuance.Title}>
                      {issuance.Title}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {issuance.TemplateName}
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{issuance.TotalRecipients}</span>
                    {issuance.SentCount > 0 && (
                      <span className="text-xs text-green-600 dark:text-green-400 ml-2">
                        ({issuance.SentCount} sent)
                      </span>
                    )}
                    {(issuance.ResentCount || 0) > 0 && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 ml-1">
                        ({issuance.ResentCount} resent)
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <StatusChip
                      status={issuance.Status.toLowerCase() as 'draft' | 'sent'}
                      label={issuance.Status}
                      customColor={getIssuanceStatusColor(issuance.Status)}
                    />
                  </td>
                  <td className="p-4">
                    <span 
                      className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"
                      style={{ 
                        background: issuance.DeliveryMethod === 'DownloadOnly' 
                          ? `${DESIGN_TOKENS.colors.brand.orange}20` 
                          : 'rgba(59, 130, 246, 0.15)',
                        color: issuance.DeliveryMethod === 'DownloadOnly'
                          ? DESIGN_TOKENS.colors.brand.orange
                          : '#3b82f6'
                      }}
                    >
                      {issuance.DeliveryMethod === 'DownloadOnly' ? (
                        <><Download className="w-3 h-3" /> Download</>
                      ) : (
                        <><Mail className="w-3 h-3" /> Email</>
                      )}
                    </span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {formatIssuanceDate(issuance.CreatedAt)}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleViewIssuance(issuance); }}
                        className="p-2 rounded-lg hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 transition-colors"
                        title="View"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {canCreate && (
                        <>
                          {/* Edit button - only for Draft issuances */}
                          {issuance.Status === 'Draft' && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEditDraftIssuance(issuance); }}
                              className="p-2 rounded-lg hover:bg-green-500/20 text-green-600 dark:text-green-400 transition-colors"
                              title="Edit Draft"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleArchiveIssuance(issuance.IssuanceID); }}
                            className="p-2 rounded-lg hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-colors"
                            title="Archive"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenDeleteConfirm(issuance); }}
                            className="p-2 rounded-lg hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* ============= ARCHIVED ISSUANCES SECTION ============= */}
      {canCreate && (archivedIssuances.length > 0 || isArchiveSearch) && (
        <div className="mt-8">
          <button
            onClick={() => setShowArchiveSection(!showArchiveSection)}
            className="w-full flex items-center justify-between p-4 rounded-xl border transition-all hover:bg-gray-50 dark:hover:bg-gray-800/50"
            style={{
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <div className="flex items-center gap-3">
              <Archive className="w-5 h-5 text-amber-500" />
              <span className="font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                Archived Issuances ({archivedIssuances.length})
              </span>
              {isArchiveSearch && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  Searching archives
                </span>
              )}
            </div>
            {showArchiveSection ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
          
          {showArchiveSection && (
            <div className="mt-4 space-y-3">
              {filteredArchivedIssuances.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Archive className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No archived issuances found</p>
                  {isArchiveSearch && (
                    <p className="text-xs mt-1">Try a different search term after @archive</p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredArchivedIssuances.map((issuance) => (
                    <div
                      key={issuance.IssuanceID}
                      className="p-4 rounded-xl border-2 cursor-pointer hover:shadow-lg transition-all overflow-hidden"
                      style={{
                        ...glassStyle,
                        borderColor: isDark ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.3)',
                        background: isDark ? 'rgba(245,158,11,0.05)' : 'rgba(245,158,11,0.05)',
                      }}
                      onClick={() => handleViewIssuance(issuance)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <h3 className="font-medium text-sm line-clamp-2 break-words" style={{ color: isDark ? '#fff' : '#000' }} title={issuance.Title}>
                            {issuance.Title}
                          </h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {issuance.TemplateName}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-600 dark:text-gray-400 flex-shrink-0">
                          Archived
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                        <Users className="w-3 h-3" />
                        <span>{issuance.TotalRecipients} recipients</span>
                        <span>-</span>
                        <span>{formatIssuanceDate(issuance.CreatedAt)}</span>
                      </div>
                      
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleRestoreIssuance(issuance.IssuanceID)}
                          className="flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                        >
                          <RefreshCw className="w-3 h-3 inline mr-1" />
                          Restore
                        </button>
                        <button
                          onClick={() => handleOpenDeleteConfirm(issuance)}
                          className="py-1.5 px-2 rounded-lg text-xs font-medium transition-all bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                          title="Delete Permanently"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============= CREATE MODAL ============= */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          style={{ zIndex: 9999993 }}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border-2 flex flex-col"
            style={{
              ...glassStyle,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              <div>
                <h2 className="text-xl font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
                  {isEditMode ? 'Edit Draft Issuance' : 'Create New Issuance'}
                </h2>
                {isEditMode && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Editing draft - changes will update the existing issuance
                  </p>
                )}
              </div>
              <button
                onClick={() => { cleanupPreviewUrl(); setShowCreateModal(false); }}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              {[
                { id: 'recipients', label: 'Recipients & Fields', icon: Users },
                { id: 'preview', label: 'Preview', icon: Eye },
                { id: 'templates', label: 'Template Settings', icon: Settings },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCreateModalTab(tab.id as CreateModalTab)}
                  className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
                    createModalTab === tab.id
                      ? 'text-[#f6421f] border-b-2 border-[#f6421f]'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm font-medium hidden sm:inline">{tab.label}</span>
                </button>
              ))}
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {/* Tab 1: Recipients & Fields */}
              {createModalTab === 'recipients' && (
                <div className="space-y-6">
                  {/* Issuance Title */}
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                      Issuance Title *
                    </label>
                    <input
                      type="text"
                      value={issuanceTitle}
                      onChange={(e) => setIssuanceTitle(e.target.value)}
                      placeholder="e.g., Panagsangka 2025 Certificates"
                      className="w-full p-3 rounded-xl border-2 transition-all focus:outline-none focus:border-[#f6421f]"
                      style={{
                        background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        color: isDark ? '#fff' : '#000',
                      }}
                    />
                  </div>
                  
                  {/* Template Selection */}
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                      Template *
                    </label>
                    <CustomDropdown
                      value={selectedTemplate?.TemplateID || ''}
                      onChange={(templateId) => {
                        const template = templates.find(t => t.TemplateID === templateId);
                        if (template) handleTemplateSelect(template);
                      }}
                      options={templates.map(t => ({
                        value: t.TemplateID,
                        label: `${t.Name} (${t.Type})`,
                      }))}
                      placeholder="Select a template..."
                      isDark={isDark}
                      size="md"
                      maxHeight={250}
                      forceDirection="down"
                    />
                    {selectedTemplate && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="w-3.5 h-3.5" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                        <span>{selectedTemplate.FieldsParsed?.length || 0} fields</span>
                        {selectedTemplate.DocsUrl ? (
                          <span className="text-green-500">- Template configured</span>
                        ) : (
                          <span className="text-amber-500">- No template URL set</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Universal Recipient Search */}
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                      Add Recipients
                    </label>
                    
                    {/* Selected Recipients (moved above search bar) */}
                    {selectedRecipients.length > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            {selectedRecipients.length} recipient{selectedRecipients.length !== 1 ? 's' : ''} selected
                            {(() => {
                              const withoutEmail = selectedRecipients.filter(r => !r.email || r.hasEmail === false).length;
                              if (withoutEmail > 0) {
                                return <span className="text-red-500 ml-1">({withoutEmail} without email)</span>;
                              }
                              return null;
                            })()}
                          </span>
                          <div className="flex items-center gap-2">
                            {selectedRecipients.length > 8 && (
                              <button
                                onClick={() => setShowAllRecipients(!showAllRecipients)}
                                className="text-xs text-blue-500 hover:text-blue-600 font-medium"
                              >
                                {showAllRecipients ? 'Show less' : `Show all ${selectedRecipients.length}`}
                              </button>
                            )}
                            <button
                              onClick={() => { setSelectedRecipients([]); setShowAllRecipients(false); }}
                              className="text-xs text-red-500 hover:text-red-600"
                            >
                              Clear all
                            </button>
                          </div>
                        </div>
                        <div 
                          className={`flex flex-wrap gap-2 p-2 rounded-lg overflow-hidden transition-all ${showAllRecipients ? 'max-h-48 overflow-y-auto' : 'max-h-16'}`} 
                          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                        >
                          {(showAllRecipients ? selectedRecipients : selectedRecipients.slice(0, 8)).map((recipient) => {
                            const hasEmail = recipient.hasEmail !== false && !!recipient.email;
                            const recipientKey = recipient.email || `${recipient.id}-${recipient.name}`;
                            return (
                              <div
                                key={recipientKey}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                                style={{
                                  background: hasEmail 
                                    ? (isDark ? 'rgba(246, 66, 31, 0.2)' : 'rgba(246, 66, 31, 0.1)')
                                    : (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'),
                                  border: hasEmail 
                                    ? `1px solid ${DESIGN_TOKENS.colors.brand.orange}40`
                                    : '1px solid rgba(239, 68, 68, 0.5)',
                                }}
                                title={hasEmail ? recipient.email : 'No email - Download only'}
                              >
                                <span 
                                  className="font-medium" 
                                  style={{ color: hasEmail ? DESIGN_TOKENS.colors.brand.orange : '#ef4444' }}
                                >
                                  {recipient.name}
                                </span>
                                {!hasEmail && (
                                  <span className="text-[10px] text-red-500 font-normal">(no email)</span>
                                )}
                                {recipient.type === 'External' && (
                                  <Globe className="w-3 h-3 text-pink-500" />
                                )}
                                <button
                                  onClick={() => handleRemoveRecipient(recipientKey)}
                                  className="p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
                                >
                                  <X className="w-3 h-3 text-red-500" />
                                </button>
                              </div>
                            );
                          })}
                          {!showAllRecipients && selectedRecipients.length > 8 && (
                            <div 
                              className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                              style={{ background: isDark ? 'rgba(100,100,100,0.3)' : 'rgba(0,0,0,0.1)' }}
                              onClick={() => setShowAllRecipients(true)}
                            >
                              +{selectedRecipients.length - 8} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Universal Search Bar */}
                    <div className="space-y-3" ref={recipientSearchRef}>
                      <div className="relative">
                        <div className="relative">
                          {/* Command icon indicator inside input */}
                          {activeCommand && (() => {
                            const cmd = SEARCH_COMMANDS.find(c => c.command === activeCommand);
                            return cmd ? (
                              <cmd.icon 
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" 
                                style={{ color: cmd.color }} 
                              />
                            ) : null;
                          })()}
                          {!activeCommand && (
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          )}
                          <input
                            type="text"
                            value={activeCommand ? commandSearchQuery : recipientSearchQuery}
                            onChange={(e) => handleUniversalSearchInput(e.target.value)}
                            onFocus={() => setShowRecipientDropdown(true)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                // If showing commands, select first command
                                if (!activeCommand && universalSearchSuggestions.length > 0 && recipientSearchQuery.startsWith('@')) {
                                  const firstCmd = universalSearchSuggestions[0] as typeof SEARCH_COMMANDS[number];
                                  if (firstCmd.command) {
                                    handleSelectCommand(firstCmd.command);
                                  }
                                }
                                // If @Person and has suggestions, add first person
                                else if (activeCommand === '@Person' && universalSearchSuggestions.length > 0) {
                                  handleSelectSuggestion(universalSearchSuggestions[0] as MemberWithEmail);
                                }
                                // If @External, show external form
                                else if (activeCommand === '@External' && commandSearchQuery.trim()) {
                                  // Parse as "Name <email>" or just use as name
                                  const match = commandSearchQuery.match(/^(.+?)\s*<(.+@.+)>$/);
                                  if (match) {
                                    setExternalName(match[1].trim());
                                    setExternalEmail(match[2].trim());
                                  } else {
                                    setExternalName(commandSearchQuery.trim());
                                  }
                                }
                              }
                              if (e.key === 'Escape') {
                                if (activeCommand) {
                                  handleClearCommand();
                                } else {
                                  setShowRecipientDropdown(false);
                                }
                              }
                              if (e.key === 'Backspace' && activeCommand && !commandSearchQuery) {
                                handleClearCommand();
                              }
                            }}
                            placeholder={
                              activeCommand === '@Person' ? 'Search by name or email...' :
                              activeCommand === '@Event' ? 'Search events...' :
                              activeCommand === '@Committee' ? 'Search committees...' :
                              activeCommand === '@External' ? 'Enter: Name <email@example.com>' :
                              'Type @ to see commands'
                            }
                            className="w-full py-3 pl-12 pr-4 rounded-xl border-2 transition-all focus:outline-none"
                            style={{
                              background: activeCommand 
                                ? (isDark ? `${SEARCH_COMMANDS.find(c => c.command === activeCommand)?.color}15` : `${SEARCH_COMMANDS.find(c => c.command === activeCommand)?.color}08`)
                                : (isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)'),
                              borderColor: activeCommand
                                ? `${SEARCH_COMMANDS.find(c => c.command === activeCommand)?.color}50`
                                : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                              color: isDark ? '#fff' : '#000',
                            }}
                          />
                        </div>
                        
                        {/* Dropdown Suggestions */}
                        {showRecipientDropdown && (
                          <div
                            className="absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl max-h-64 overflow-y-auto"
                            style={{
                              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              zIndex: 9999999,
                            }}
                          >
                            {/* Command Suggestions */}
                            {!activeCommand && recipientSearchQuery.startsWith('@') && universalSearchSuggestions.length > 0 && (
                              <>
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                  Commands
                                </div>
                                {(universalSearchSuggestions as typeof SEARCH_COMMANDS).map((cmd) => (
                                  <button
                                    key={cmd.command}
                                    onClick={() => handleSelectCommand(cmd.command)}
                                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                                  >
                                    <div
                                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                                      style={{ background: cmd.color + '20' }}
                                    >
                                      <cmd.icon className="w-4 h-4" style={{ color: cmd.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-semibold" style={{ color: cmd.color }}>
                                        {cmd.command}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {cmd.label}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </>
                            )}
                            
                            {/* Show hint when no @ typed */}
                            {!activeCommand && !recipientSearchQuery.startsWith('@') && !recipientSearchQuery && (
                              <div className="p-4 text-center">
                                <p className="text-sm text-muted-foreground mb-3">
                                  Type <span className="font-mono text-[#f6421f]">@</span> to see available commands
                                </p>
                                <div className="flex flex-wrap justify-center gap-2">
                                  {SEARCH_COMMANDS.map((cmd) => (
                                    <button
                                      key={cmd.command}
                                      onClick={() => handleSelectCommand(cmd.command)}
                                      className="px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105"
                                      style={{
                                        background: cmd.color + '15',
                                        color: cmd.color,
                                        border: `1px solid ${cmd.color}30`,
                                      }}
                                    >
                                      {cmd.command}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Person Suggestions - Loading State */}
                            {activeCommand === '@Person' && isLoadingMembers && (
                              <div className="p-6 text-center">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: '#3b82f6' }} />
                                <p className="text-sm text-muted-foreground">Loading members...</p>
                              </div>
                            )}
                            
                            {/* Person Suggestions - Error State */}
                            {activeCommand === '@Person' && !isLoadingMembers && membersError && (
                              <div className="p-4 text-center">
                                <p className="text-sm text-red-500 mb-2">{membersError}</p>
                                <button
                                  onClick={() => loadMembers(true)}
                                  className="text-sm px-3 py-1.5 rounded-md transition-colors"
                                  style={{ 
                                    background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                    color: '#3b82f6'
                                  }}
                                >
                                  Retry Loading Members
                                </button>
                              </div>
                            )}
                            
                            {/* Person Suggestions - Empty State */}
                            {activeCommand === '@Person' && !isLoadingMembers && !membersError && members.length === 0 && (
                              <div className="p-4 text-center">
                                <p className="text-sm text-muted-foreground mb-2">No members loaded yet.</p>
                                <button
                                  onClick={() => loadMembers(true)}
                                  className="text-sm px-3 py-1.5 rounded-md transition-colors"
                                  style={{ 
                                    background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
                                    color: '#3b82f6'
                                  }}
                                >
                                  Load Members
                                </button>
                              </div>
                            )}
                            
                            {/* Person Suggestions - Results */}
                            {activeCommand === '@Person' && !isLoadingMembers && universalSearchSuggestions.length > 0 && (
                              <>
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                  Members ({members.length} total)
                                </div>
                                {(universalSearchSuggestions as MemberWithEmail[]).map((member) => (
                                  <button
                                    key={member.id}
                                    onClick={() => handleSelectSuggestion(member)}
                                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                                    disabled={!member.email}
                                  >
                                    {/* Profile Picture with Fallback */}
                                    <div className="relative w-8 h-8 flex-shrink-0">
                                      {member.profilePicture ? (
                                        <>
                                          <img
                                            src={member.profilePicture}
                                            alt={member.name}
                                            className="w-8 h-8 rounded-full object-cover absolute inset-0"
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              target.style.display = 'none';
                                            }}
                                          />
                                          {/* Fallback initials shown behind the image */}
                                          <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                                          >
                                            {getInitials(member.name)}
                                          </div>
                                        </>
                                      ) : (
                                        <div
                                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}
                                        >
                                          {getInitials(member.name)}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                                        {member.name}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {member.email || 'No email'}
                                      </p>
                                    </div>
                                    {selectedRecipients.some(r => r.email === member.email) && (
                                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    )}
                                  </button>
                                ))}
                              </>
                            )}
                            
                            {/* Event Suggestions - Loading State */}
                            {activeCommand === '@Event' && isLoadingEvents && (
                              <div className="p-6 text-center">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" style={{ color: '#8b5cf6' }} />
                                <p className="text-sm text-muted-foreground">Loading events...</p>
                              </div>
                            )}
                            
                            {/* Event Suggestions - Empty State */}
                            {activeCommand === '@Event' && !isLoadingEvents && events.length === 0 && (
                              <div className="p-4 text-center">
                                <p className="text-sm text-muted-foreground mb-2">No events loaded yet.</p>
                                <button
                                  onClick={() => loadEvents(true)}
                                  className="text-sm px-3 py-1.5 rounded-md transition-colors"
                                  style={{ 
                                    background: isDark ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
                                    color: '#8b5cf6'
                                  }}
                                >
                                  Load Events
                                </button>
                              </div>
                            )}
                            
                            {/* Event Suggestions - Results */}
                            {activeCommand === '@Event' && !isLoadingEvents && universalSearchSuggestions.length > 0 && (
                              <>
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                  Events ({events.length} total) - Click to load attendees
                                </div>
                                {(universalSearchSuggestions as EventData[]).map((event) => (
                                  <button
                                    key={event.EventID}
                                    onClick={() => handleSelectSuggestion(event)}
                                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                                    disabled={isLoadingRecipients}
                                  >
                                    <div
                                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                                      style={{ background: '#8b5cf620' }}
                                    >
                                      <Calendar className="w-4 h-4" style={{ color: '#8b5cf6' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                                        {event.Title}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">
                                        {event.Status} - {event.StartDate}
                                      </p>
                                    </div>
                                    {isLoadingRecipients && (
                                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    )}
                                  </button>
                                ))}
                              </>
                            )}
                            
                            {/* Committee Suggestions */}
                            {activeCommand === '@Committee' && universalSearchSuggestions.length > 0 && (
                              <>
                                <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                                  Committees - Click to load members
                                </div>
                                {(universalSearchSuggestions as Committee[]).map((committee) => (
                                  <button
                                    key={committee.id}
                                    onClick={() => handleSelectSuggestion(committee)}
                                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                                    disabled={isLoadingRecipients}
                                  >
                                    <div
                                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                                      style={{ background: '#10b98120' }}
                                    >
                                      <Building className="w-4 h-4" style={{ color: '#10b981' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                                        {committee.name}
                                      </p>
                                    </div>
                                    {isLoadingRecipients && (
                                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    )}
                                  </button>
                                ))}
                              </>
                            )}
                            
                            {/* External Input Form */}
                            {activeCommand === '@External' && (
                              <div className="p-4 space-y-3">
                                <div className="text-xs font-semibold text-muted-foreground mb-2">
                                  Add External Recipient
                                </div>
                                <input
                                  type="text"
                                  value={externalName}
                                  onChange={(e) => setExternalName(e.target.value)}
                                  placeholder="Full Name"
                                  className="w-full p-2.5 rounded-lg border transition-all focus:outline-none focus:border-[#ec4899]"
                                  style={{
                                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                    color: isDark ? '#fff' : '#000',
                                  }}
                                />
                                <input
                                  type="email"
                                  value={externalEmail}
                                  onChange={(e) => setExternalEmail(e.target.value)}
                                  placeholder="email@example.com"
                                  className="w-full p-2.5 rounded-lg border transition-all focus:outline-none focus:border-[#ec4899]"
                                  style={{
                                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                    color: isDark ? '#fff' : '#000',
                                  }}
                                />
                                <Button
                                  variant="secondary"
                                  onClick={() => {
                                    handleAddExternalRecipient();
                                    // Keep dropdown open for more additions
                                  }}
                                  icon={<Plus className="w-4 h-4" />}
                                  fullWidth
                                  disabled={!externalName.trim() || !externalEmail.trim()}
                                >
                                  Add External Recipient
                                </Button>
                              </div>
                            )}
                            
                            {/* No results */}
                            {activeCommand && activeCommand !== '@External' && activeCommand !== '@All' && universalSearchSuggestions.length === 0 && commandSearchQuery && (
                              <div className="p-4 text-center text-muted-foreground text-sm">
                                No results found for "{commandSearchQuery}"
                              </div>
                            )}
                            
                            {/* Quick Actions - Always visible to combine sources */}
                            {(activeCommand && activeCommand !== '@External') && (
                              <div 
                                className="border-t px-3 py-2"
                                style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-muted-foreground">
                                    Combine with other sources:
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {SEARCH_COMMANDS.filter(c => c.command !== activeCommand).map((cmd) => (
                                    <button
                                      key={cmd.command}
                                      onClick={() => handleSelectCommand(cmd.command)}
                                      className="px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 flex items-center gap-1"
                                      style={{
                                        background: cmd.color + '15',
                                        color: cmd.color,
                                        border: `1px solid ${cmd.color}30`,
                                      }}
                                    >
                                      <cmd.icon className="w-3 h-3" />
                                      {cmd.command.replace('@', '')}
                                    </button>
                                  ))}
                                </div>
                                {selectedRecipients.length > 0 && (
                                  <p className="text-[10px] text-muted-foreground mt-1.5">
                                    Tip: Duplicates are automatically prevented
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                  </div>
                  
                  {/* Field Inputs */}
                  {selectedTemplate && fieldInputs.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                          Template Fields
                        </label>
                        <button
                          onClick={() => setShowAddFieldInput(!showAddFieldInput)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105"
                          style={{
                            background: showAddFieldInput 
                              ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)')
                              : (isDark ? 'rgba(246, 66, 31, 0.2)' : 'rgba(246, 66, 31, 0.1)'),
                            color: showAddFieldInput ? '#ef4444' : DESIGN_TOKENS.colors.brand.orange,
                          }}
                          title={showAddFieldInput ? 'Cancel' : 'Add new field'}
                        >
                          {showAddFieldInput ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                          <span>{showAddFieldInput ? 'Cancel' : 'Add Field'}</span>
                        </button>
                      </div>
                      
                      {/* Add New Field Input */}
                      {showAddFieldInput && (
                        <div 
                          className="flex gap-2 mb-3 p-3 rounded-lg"
                          style={{
                            background: isDark ? 'rgba(246, 66, 31, 0.1)' : 'rgba(246, 66, 31, 0.05)',
                            border: `1px dashed ${DESIGN_TOKENS.colors.brand.orange}50`,
                          }}
                        >
                          <input
                            type="text"
                            value={dynamicFieldInput}
                            onChange={(e) => setDynamicFieldInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && dynamicFieldInput.trim()) {
                                e.preventDefault();
                                // Format field name
                                let fieldName = dynamicFieldInput.trim().toUpperCase();
                                if (!fieldName.startsWith('{')) fieldName = '{' + fieldName;
                                if (!fieldName.endsWith('}')) fieldName = fieldName + '}';
                                
                                // Check if already exists
                                if (fieldInputs.some(f => f.placeholder === fieldName)) {
                                  toast.error('Field already exists');
                                  return;
                                }
                                
                                // Add to fieldInputs
                                setFieldInputs(prev => [...prev, {
                                  placeholder: fieldName,
                                  value: '',
                                  enabled: true
                                }]);
                                setDynamicFieldInput('');
                                setShowAddFieldInput(false);
                                toast.success(`Added field: ${fieldName}`);
                              }
                              if (e.key === 'Escape') {
                                setShowAddFieldInput(false);
                                setDynamicFieldInput('');
                              }
                            }}
                            placeholder="Enter field name (e.g., POSITION)"
                            className="flex-1 p-2 rounded-lg border transition-all focus:outline-none focus:border-[#f6421f]"
                            style={{
                              background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              color: isDark ? '#fff' : '#000',
                            }}
                            autoFocus
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              if (!dynamicFieldInput.trim()) return;
                              // Format field name
                              let fieldName = dynamicFieldInput.trim().toUpperCase();
                              if (!fieldName.startsWith('{')) fieldName = '{' + fieldName;
                              if (!fieldName.endsWith('}')) fieldName = fieldName + '}';
                              
                              // Check if already exists
                              if (fieldInputs.some(f => f.placeholder === fieldName)) {
                                toast.error('Field already exists');
                                return;
                              }
                              
                              // Add to fieldInputs
                              setFieldInputs(prev => [...prev, {
                                placeholder: fieldName,
                                value: '',
                                enabled: true
                              }]);
                              setDynamicFieldInput('');
                              setShowAddFieldInput(false);
                              toast.success(`Added field: ${fieldName}`);
                            }}
                            disabled={!dynamicFieldInput.trim()}
                            icon={<Plus className="w-4 h-4" />}
                          >
                            Add
                          </Button>
                        </div>
                      )}
                      
                      <div className="space-y-3">
                        {fieldInputs.map((field, index) => {
                          const isNameField = field.placeholder === '{NAME}';
                          const isControlNumberField = field.placeholder === '{CONTROL_NUMBER}';
                          const isDynamicField = !selectedTemplate.FieldsParsed?.includes(field.placeholder);
                          
                          return (
                            <div key={field.placeholder} className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={field.enabled}
                                onChange={(e) => {
                                  const updated = [...fieldInputs];
                                  updated[index].enabled = e.target.checked;
                                  // For NAME field, if disabling, also reset custom name
                                  if (isNameField && !e.target.checked) {
                                    updated[index].isCustomName = false;
                                    updated[index].value = '';
                                  }
                                  // For CONTROL_NUMBER field, if disabling, also reset
                                  if (isControlNumberField && !e.target.checked) {
                                    updated[index].isCustomControlNumber = false;
                                    updated[index].value = '';
                                  }
                                  setFieldInputs(updated);
                                }}
                                className="w-5 h-5 rounded border-2 accent-[#f6421f] mt-1"
                              />
                              <span 
                                className="w-36 text-sm font-mono flex items-center gap-1 mt-1" 
                                style={{ color: isDynamicField ? '#8b5cf6' : DESIGN_TOKENS.colors.brand.orange }}
                                title={isDynamicField ? 'Dynamically added field' : 'Template field'}
                              >
                                {field.placeholder}
                                {isDynamicField && (
                                  <button
                                    onClick={() => {
                                      setFieldInputs(prev => prev.filter((_, i) => i !== index));
                                      toast.success(`Removed field: ${field.placeholder}`);
                                    }}
                                    className="p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
                                    title="Remove field"
                                  >
                                    <X className="w-3 h-3 text-red-500" />
                                  </button>
                                )}
                              </span>
                              {isNameField ? (
                                <div className="flex-1 flex flex-col gap-2">
                                  {/* Toggle between auto-fill and custom value */}
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                                      <input
                                        type="radio"
                                        checked={!field.isCustomName}
                                        onChange={() => {
                                          const updated = [...fieldInputs];
                                          updated[index].isCustomName = false;
                                          updated[index].value = '';
                                          setFieldInputs(updated);
                                        }}
                                        disabled={!field.enabled}
                                        className="accent-[#22c55e]"
                                      />
                                      <span className={!field.enabled ? 'opacity-50' : ''}>Auto-fill from recipients</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                                      <input
                                        type="radio"
                                        checked={field.isCustomName === true}
                                        onChange={() => {
                                          const updated = [...fieldInputs];
                                          updated[index].isCustomName = true;
                                          setFieldInputs(updated);
                                        }}
                                        disabled={!field.enabled}
                                        className="accent-[#f6421f]"
                                      />
                                      <span className={!field.enabled ? 'opacity-50' : ''}>Custom value</span>
                                    </label>
                                    {/* ALL CAPS Toggle */}
                                    <div className="ml-auto flex items-center gap-2">
                                      <label className="flex items-center gap-2 cursor-pointer text-xs">
                                        <input
                                          type="checkbox"
                                          checked={field.isAllCaps === true}
                                          onChange={(e) => {
                                            setFieldInputs(prev => prev.map((f, i) => 
                                              i === index ? { ...f, isAllCaps: e.target.checked } : f
                                            ));
                                          }}
                                          disabled={!field.enabled}
                                          className="w-4 h-4 rounded accent-[#3b82f6]"
                                        />
                                        <span 
                                          className={`font-semibold ${!field.enabled ? 'opacity-50' : ''}`}
                                          style={{ color: field.isAllCaps ? '#3b82f6' : (isDark ? '#94a3b8' : '#64748b') }}
                                        >
                                          ALL CAPS
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                  
                                  {/* Show input or auto-fill indicator based on toggle */}
                                  {field.isCustomName ? (
                                    <input
                                      type="text"
                                      value={field.value}
                                      onChange={(e) => {
                                        const updated = [...fieldInputs];
                                        updated[index].value = e.target.value;
                                        setFieldInputs(updated);
                                      }}
                                      disabled={!field.enabled}
                                      placeholder="e.g., To all Members, Dear Team, etc."
                                      className="w-full p-2 rounded-lg border transition-all focus:outline-none focus:border-[#f6421f] disabled:opacity-50"
                                      style={{
                                        background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                        color: isDark ? '#fff' : '#000',
                                      }}
                                    />
                                  ) : (
                                    <div 
                                      className={`p-2 rounded-lg border text-sm ${!field.enabled ? 'opacity-50' : ''}`}
                                      style={{
                                        background: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
                                        borderColor: 'rgba(34, 197, 94, 0.3)',
                                        color: isDark ? 'rgba(134, 239, 172, 1)' : 'rgba(22, 163, 74, 1)',
                                      }}
                                    >
                                      Auto-filled for each recipient {selectedRecipients.length > 0 
                                        ? `(${selectedRecipients.length} recipient${selectedRecipients.length > 1 ? 's' : ''}: ${field.isAllCaps ? selectedRecipients[0].name.toUpperCase() : selectedRecipients[0].name}${selectedRecipients.length > 1 ? `, ${field.isAllCaps ? selectedRecipients[1].name.toUpperCase() : selectedRecipients[1].name}${selectedRecipients.length > 2 ? ', ...' : ''}` : ''})` 
                                        : '(Add recipients first)'}
                                    </div>
                                  )}
                                  
                                  {/* Name Line Positioning */}
                                  <div 
                                    className="p-3 rounded-lg border mt-2"
                                    style={{
                                      background: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
                                      borderColor: 'rgba(59, 130, 246, 0.3)',
                                    }}
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs font-semibold" style={{ color: '#3b82f6' }}>
                                        Name Line Position
                                      </span>
                                      {/* Unit Toggle */}
                                      <div className="flex items-center gap-1 text-xs">
                                        <button
                                          onClick={() => {
                                            const updated = [...fieldInputs];
                                            const currentUnit = updated[index].namePositionUnit || 'cm';
                                            if (currentUnit === 'cm') {
                                              // Convert cm to inch
                                              updated[index].namePositionUnit = 'inch';
                                              updated[index].nameStartPosition = parseFloat(((updated[index].nameStartPosition || 8.1) / 2.54).toFixed(2));
                                              updated[index].nameEndPosition = parseFloat(((updated[index].nameEndPosition || 27.6) / 2.54).toFixed(2));
                                            } else {
                                              // Convert inch to cm
                                              updated[index].namePositionUnit = 'cm';
                                              updated[index].nameStartPosition = parseFloat(((updated[index].nameStartPosition || 3.19) * 2.54).toFixed(1));
                                              updated[index].nameEndPosition = parseFloat(((updated[index].nameEndPosition || 10.87) * 2.54).toFixed(1));
                                            }
                                            setFieldInputs(updated);
                                          }}
                                          disabled={!field.enabled}
                                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${!field.enabled ? 'opacity-50' : 'hover:opacity-80'}`}
                                          style={{
                                            background: (field.namePositionUnit || 'cm') === 'cm' ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                                            color: (field.namePositionUnit || 'cm') === 'cm' ? '#fff' : (isDark ? '#fff' : '#000'),
                                          }}
                                        >
                                          cm
                                        </button>
                                        <button
                                          onClick={() => {
                                            const updated = [...fieldInputs];
                                            const currentUnit = updated[index].namePositionUnit || 'cm';
                                            if (currentUnit === 'cm') {
                                              // Convert cm to inch
                                              updated[index].namePositionUnit = 'inch';
                                              updated[index].nameStartPosition = parseFloat(((updated[index].nameStartPosition || 8.1) / 2.54).toFixed(2));
                                              updated[index].nameEndPosition = parseFloat(((updated[index].nameEndPosition || 27.6) / 2.54).toFixed(2));
                                            } else {
                                              // Already in inch, no conversion needed
                                            }
                                            setFieldInputs(updated);
                                          }}
                                          disabled={!field.enabled}
                                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${!field.enabled ? 'opacity-50' : 'hover:opacity-80'}`}
                                          style={{
                                            background: (field.namePositionUnit || 'cm') === 'inch' ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'),
                                            color: (field.namePositionUnit || 'cm') === 'inch' ? '#fff' : (isDark ? '#fff' : '#000'),
                                          }}
                                        >
                                          inch
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="flex-1">
                                        <label className="text-xs opacity-70 block mb-1">Start</label>
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            step={field.namePositionUnit === 'inch' ? '0.1' : '0.5'}
                                            min="0"
                                            value={field.nameStartPosition || (field.namePositionUnit === 'inch' ? 3.19 : 8.1)}
                                            onChange={(e) => {
                                              const updated = [...fieldInputs];
                                              updated[index].nameStartPosition = parseFloat(e.target.value) || 0;
                                              setFieldInputs(updated);
                                            }}
                                            disabled={!field.enabled}
                                            className="w-20 p-1.5 rounded border text-sm text-center disabled:opacity-50"
                                            style={{
                                              background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                              borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                                              color: isDark ? '#fff' : '#000',
                                            }}
                                          />
                                          <span className="text-xs opacity-60">{field.namePositionUnit || 'cm'}</span>
                                        </div>
                                      </div>
                                      <div className="flex items-center pt-5">
                                        
                                      </div>
                                      <div className="flex-1">
                                        <label className="text-xs opacity-70 block mb-1">End</label>
                                        <div className="flex items-center gap-1">
                                          <input
                                            type="number"
                                            step={field.namePositionUnit === 'inch' ? '0.1' : '0.5'}
                                            min="0"
                                            value={field.nameEndPosition || (field.namePositionUnit === 'inch' ? 10.87 : 27.6)}
                                            onChange={(e) => {
                                              const updated = [...fieldInputs];
                                              updated[index].nameEndPosition = parseFloat(e.target.value) || 0;
                                              setFieldInputs(updated);
                                            }}
                                            disabled={!field.enabled}
                                            className="w-20 p-1.5 rounded border text-sm text-center disabled:opacity-50"
                                            style={{
                                              background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                              borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
                                              color: isDark ? '#fff' : '#000',
                                            }}
                                          />
                                          <span className="text-xs opacity-60">{field.namePositionUnit || 'cm'}</span>
                                        </div>
                                      </div>
                                      <div className="flex-1 text-right pt-5">
                                        <span className="text-xs opacity-60">
                                          Width: {((field.nameEndPosition || (field.namePositionUnit === 'inch' ? 10.87 : 27.6)) - (field.nameStartPosition || (field.namePositionUnit === 'inch' ? 3.19 : 8.1))).toFixed(1)} {field.namePositionUnit || 'cm'}
                                        </span>
                                      </div>
                                    </div>
                                    <p className="text-xs opacity-50 mt-2">
                                      Defines where the name text starts and ends horizontally on the certificate.
                                    </p>
                                  </div>
                                </div>
                              ) : isControlNumberField ? (
                                /* CONTROL NUMBER FIELD - similar to NAME field with auto/custom toggle */
                                <div className="flex-1 flex flex-col gap-2">
                                  {/* Toggle between auto-generate and custom value */}
                                  <div className="flex items-center gap-3 flex-wrap">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                                      <input
                                        type="radio"
                                        checked={!field.isCustomControlNumber}
                                        onChange={() => {
                                          const updated = [...fieldInputs];
                                          updated[index].isCustomControlNumber = false;
                                          updated[index].value = '';
                                          setFieldInputs(updated);
                                        }}
                                        disabled={!field.enabled}
                                        className="accent-[#22c55e]"
                                      />
                                      <span className={!field.enabled ? 'opacity-50' : ''}>Auto-generate from event</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                                      <input
                                        type="radio"
                                        checked={field.isCustomControlNumber === true}
                                        onChange={() => {
                                          const updated = [...fieldInputs];
                                          updated[index].isCustomControlNumber = true;
                                          setFieldInputs(updated);
                                        }}
                                        disabled={!field.enabled}
                                        className="accent-[#f6421f]"
                                      />
                                      <span className={!field.enabled ? 'opacity-50' : ''}>Custom value</span>
                                    </label>
                                  </div>
                                  
                                  {/* Show input or auto-generate indicator based on toggle */}
                                  {field.isCustomControlNumber ? (
                                    <input
                                      type="text"
                                      value={field.value}
                                      onChange={(e) => {
                                        const updated = [...fieldInputs];
                                        updated[index].value = e.target.value;
                                        setFieldInputs(updated);
                                      }}
                                      disabled={!field.enabled}
                                      placeholder="e.g., CERT-2026-001"
                                      className="w-full p-2 rounded-lg border transition-all focus:outline-none focus:border-[#f6421f] disabled:opacity-50"
                                      style={{
                                        background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                        color: isDark ? '#fff' : '#000',
                                      }}
                                    />
                                  ) : (
                                    <div 
                                      className={`p-2 rounded-lg border text-sm ${!field.enabled ? 'opacity-50' : ''}`}
                                      style={{
                                        background: selectedEventId 
                                          ? (isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)')
                                          : (isDark ? 'rgba(234, 179, 8, 0.1)' : 'rgba(234, 179, 8, 0.05)'),
                                        borderColor: selectedEventId ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)',
                                        color: selectedEventId 
                                          ? (isDark ? 'rgba(134, 239, 172, 1)' : 'rgba(22, 163, 74, 1)')
                                          : (isDark ? 'rgba(250, 204, 21, 1)' : 'rgba(161, 98, 7, 1)'),
                                      }}
                                    >
                                      {selectedEventId ? (
                                        <>
                                          Auto-generated for each recipient
                                          <span className="block text-xs opacity-75 mt-1">
                                            Format: YSP-{new Date().getFullYear().toString().slice(-2)}-TC##-### (e.g., YSP-26-TC01001)
                                          </span>
                                          <span className="block text-xs opacity-60">
                                            Event: {selectedEventTitle}
                                          </span>
                                        </>
                                      ) : (
                                        <>
                                          Select recipients from an event (@Event) to enable auto-generation
                                          <span className="block text-xs opacity-75 mt-1">
                                            Or switch to "Custom value" to enter manually
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={field.value}
                                  onChange={(e) => {
                                    const updated = [...fieldInputs];
                                    updated[index].value = e.target.value;
                                    setFieldInputs(updated);
                                  }}
                                  disabled={!field.enabled}
                                  placeholder={`Value for ${field.placeholder}`}
                                  className="flex-1 p-2 rounded-lg border transition-all focus:outline-none focus:border-[#f6421f] disabled:opacity-50"
                                  style={{
                                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                    color: isDark ? '#fff' : '#000',
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Tip: {'{NAME}'} can be auto-fill or custom. Use <strong>ALL CAPS</strong> for uppercase. Adjust <strong>Name Line Position</strong> (in cm or inches) to fit your certificate template.
                      </p>
                      {fieldInputs.some(f => !selectedTemplate.FieldsParsed?.includes(f.placeholder)) && (
                        <p className="text-xs mt-1" style={{ color: '#8b5cf6' }}>
                          Note: Purple fields are dynamically added - make sure the placeholder exists in your Google Docs template
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Send Options */}
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                      Delivery Method
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={sendToEmail}
                          onChange={() => setSendToEmail(true)}
                          className="w-5 h-5 accent-[#f6421f]"
                        />
                        <Mail className="w-4 h-4" />
                        <span className="text-sm">Send to Email</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          checked={!sendToEmail}
                          onChange={() => setSendToEmail(false)}
                          className="w-5 h-5 accent-[#f6421f]"
                        />
                        <Download className="w-4 h-4" />
                        <span className="text-sm">Download Only</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Email Settings (if sending to email) */}
                  {sendToEmail && (
                    <div className="space-y-4 p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                      <div>
                        <label className="block text-sm font-medium mb-1">Email Subject</label>
                        <input
                          type="text"
                          value={emailTitle}
                          onChange={(e) => setEmailTitle(e.target.value)}
                          placeholder="e.g., Your Certificate of Participation"
                          className="w-full p-3 rounded-xl border transition-all focus:outline-none focus:border-[#f6421f]"
                          style={{
                            background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            color: isDark ? '#fff' : '#000',
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Email Message</label>
                        <textarea
                          value={emailMessage}
                          onChange={(e) => setEmailMessage(e.target.value)}
                          placeholder="Write a message to accompany the certificate..."
                          rows={3}
                          className="w-full p-3 rounded-xl border transition-all focus:outline-none focus:border-[#f6421f] resize-none"
                          style={{
                            background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            color: isDark ? '#fff' : '#000',
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Formatting:</span> Use **text** for <strong>bold</strong>, line breaks preserved
                        </p>
                        {/* Real-time Preview */}
                        {emailMessage && (
                          <div className="mt-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                              <Eye className="w-3 h-3" />
                              <span>Preview</span>
                            </div>
                            <div 
                              className="p-3 rounded-lg text-sm leading-relaxed"
                              style={{ 
                                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                                border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                              }}
                            >
                              <FormattedText text={emailMessage} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Document Info (for Download Only) - Still allow title/description */}
                  {!sendToEmail && (
                    <div className="space-y-4 p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                      <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 mb-2">
                        <Download className="w-4 h-4" />
                        <span>Download Only Mode - Documents will be saved for manual distribution</span>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Document Title (optional)</label>
                        <input
                          type="text"
                          value={emailTitle}
                          onChange={(e) => setEmailTitle(e.target.value)}
                          placeholder="e.g., Certificate of Participation"
                          className="w-full p-3 rounded-xl border transition-all focus:outline-none focus:border-[#f6421f]"
                          style={{
                            background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            color: isDark ? '#fff' : '#000',
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Description/Notes (optional)</label>
                        <textarea
                          value={emailMessage}
                          onChange={(e) => setEmailMessage(e.target.value)}
                          placeholder="Add any notes or description for this issuance..."
                          rows={2}
                          className="w-full p-3 rounded-xl border transition-all focus:outline-none focus:border-[#f6421f] resize-none"
                          style={{
                            background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            color: isDark ? '#fff' : '#000',
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Formatting:</span> Use **text** for <strong>bold</strong>, line breaks preserved
                        </p>
                        {/* Real-time Preview */}
                        {emailMessage && (
                          <div className="mt-3">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                              <Eye className="w-3 h-3" />
                              <span>Preview</span>
                            </div>
                            <div 
                              className="p-3 rounded-lg text-sm leading-relaxed"
                              style={{ 
                                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                                border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                              }}
                            >
                              <FormattedText text={emailMessage} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Attachments Section - for adding link attachments */}
                  <div 
                    className="p-4 rounded-xl border"
                    style={{ 
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Paperclip className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                        <span className="font-medium text-sm">Attachments</span>
                        <span className="text-xs text-muted-foreground">
                          ({attachments.length} {attachments.length === 1 ? 'link' : 'links'})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAttachmentForm(!showAttachmentForm)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                        style={{
                          background: showAttachmentForm 
                            ? (isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)')
                            : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                          color: showAttachmentForm ? '#ef4444' : (isDark ? '#fff' : '#000'),
                        }}
                      >
                        {showAttachmentForm ? (
                          <>
                            <X className="w-3 h-3" />
                            <span>Cancel</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>Add Link</span>
                          </>
                        )}
                      </button>
                    </div>
                    
                    {/* Add attachment form */}
                    {showAttachmentForm && (
                      <div 
                        className="p-3 rounded-lg mb-3 space-y-3"
                        style={{ 
                          background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                          border: "1px solid " + (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"),
                        }}
                      >
                        <div>
                          <label className="block text-xs font-medium mb-1">Display Name</label>
                          <input
                            type="text"
                            value={newAttachmentName}
                            onChange={(e) => setNewAttachmentName(e.target.value)}
                            placeholder="e.g., Event Photos, Certificate Template, YouTube Video..."
                            className="w-full p-2 rounded-lg border text-sm transition-all focus:outline-none focus:border-[#f6421f]"
                            style={{
                              background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              color: isDark ? '#fff' : '#000',
                            }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">URL</label>
                          <input
                            type="url"
                            value={newAttachmentUrl}
                            onChange={(e) => setNewAttachmentUrl(e.target.value)}
                            placeholder="https://drive.google.com/..., https://youtube.com/..., etc."
                            className="w-full p-2 rounded-lg border text-sm transition-all focus:outline-none focus:border-[#f6421f]"
                            style={{
                              background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              color: isDark ? '#fff' : '#000',
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Supports: Google Drive, YouTube, Facebook, Instagram, PDFs, Documents, and any URL
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (!newAttachmentUrl.trim()) {
                              toast.error('Please enter a URL');
                              return;
                            }
                            // Validate URL format
                            try {
                              new URL(newAttachmentUrl);
                            } catch {
                              toast.error('Please enter a valid URL');
                              return;
                            }
                            const type = detectAttachmentType(newAttachmentUrl);
                            const name = newAttachmentName.trim() || newAttachmentUrl.split('/').pop() || 'Attachment';
                            setAttachments([...attachments, { name, url: newAttachmentUrl.trim(), type }]);
                            setNewAttachmentName('');
                            setNewAttachmentUrl('');
                            setShowAttachmentForm(false);
                            toast.success('Attachment added');
                          }}
                          disabled={!newAttachmentUrl.trim()}
                          className="w-full px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{
                            background: DESIGN_TOKENS.colors.brand.orange,
                            color: '#fff',
                          }}
                        >
                          Add Attachment
                        </button>
                      </div>
                    )}
                    
                    {/* Attachments list */}
                    {attachments.length > 0 ? (
                      <div className="space-y-2">
                        {attachments.map((attachment, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between p-2 rounded-lg group hover:bg-opacity-50 transition-all"
                            style={{ 
                              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            }}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-lg" title={attachment.type}>
                                {getAttachmentIcon(attachment.type)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{attachment.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{attachment.url}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <a
                                href={attachment.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                title="Open in new tab"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                type="button"
                                onClick={() => {
                                  setAttachments(attachments.filter((_, i) => i !== index));
                                  toast.success('Attachment removed');
                                }}
                                className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove attachment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        No attachments added. Click "Add Link" to attach files via URL.
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Tab 2: Preview */}
              {createModalTab === 'preview' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-lg font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                      Document Preview
                    </h3>
                    <div className="flex items-center gap-2">
                      {previewPdfUrl && (
                        <>
                          <button
                            onClick={handleOpenPreviewInNewTab}
                            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Open in New Tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPreviewPdf()}
                            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={handleGeneratePreview}
                        disabled={!selectedTemplate || isGeneratingPreview}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        style={{
                          background: DESIGN_TOKENS.colors.brand.orange,
                          color: '#fff',
                        }}
                      >
                        {isGeneratingPreview ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        <span>{isGeneratingPreview ? 'Generating...' : previewPdfUrl ? 'Regenerate' : 'Generate'}</span>
                      </button>
                    </div>
                  </div>
                  
                  {previewPdfUrl ? (
                    <div className="flex flex-col gap-2">
                      {/* Pagination controls for multiple recipients - ABOVE the iframe */}
                      {previewPdfList.length > 1 && (
                        <div 
                          className="flex items-center justify-center gap-3 px-4 py-2 rounded-lg"
                          style={{
                            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                            border: "1px solid " + (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"),
                          }}
                        >
                          <button
                            onClick={() => setCurrentPreviewIndex(prev => Math.max(0, prev - 1))}
                            disabled={currentPreviewIndex === 0}
                            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Previous recipient"
                          >
                            <ChevronLeft className="w-5 h-5" />
                          </button>
                          <div className="text-sm font-medium min-w-[180px] text-center">
                            <span className="text-muted-foreground">Recipient {currentPreviewIndex + 1} of {previewPdfList.length}:</span>
                            <span className="ml-1.5 font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                              {previewPdfList[currentPreviewIndex]?.recipientName}
                            </span>
                          </div>
                          <button
                            onClick={() => setCurrentPreviewIndex(prev => Math.min(previewPdfList.length - 1, prev + 1))}
                            disabled={currentPreviewIndex === previewPdfList.length - 1}
                            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Next recipient"
                          >
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                      <div
                        className="rounded-xl border overflow-hidden relative"
                        style={{
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          height: previewPdfList.length > 1 ? 'calc(60vh - 50px)' : '60vh',
                        }}
                      >
                        <iframe
                          src={previewPdfList.length > 1 ? previewPdfList[currentPreviewIndex]?.pdfUrl : previewPdfUrl}
                          className="w-full h-full"
                          title="PDF Preview"
                        />
                        {/* Fallback for browsers that can't display PDFs */}
                        <div 
                          className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none opacity-0 target:opacity-100"
                          style={{ background: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)' }}
                        >
                          <FileText className="w-16 h-16 text-[#f6421f]" />
                          <p className="text-center px-4">
                            If the PDF doesn't display, use the buttons above to open in a new tab or download.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center rounded-xl border"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        height: '60vh',
                        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <FileText className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-muted-foreground text-center px-4 mb-4">
                        PDF preview would be shown here
                      </p>
                      <button
                        onClick={handleGeneratePreview}
                        disabled={!selectedTemplate || isGeneratingPreview}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 hover:scale-105"
                        style={{
                          background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)`,
                          color: '#fff',
                          boxShadow: '0 4px 12px rgba(246, 66, 31, 0.3)',
                        }}
                      >
                        {isGeneratingPreview ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                        <span>{isGeneratingPreview ? 'Generating Preview...' : 'Generate Preview'}</span>
                      </button>
                      <p className="text-xs text-muted-foreground mt-4 text-center px-4">
                        Make sure you've selected a template and filled in field values
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Tab 3: Template Settings */}
              {createModalTab === 'templates' && (
                <div className="space-y-6">
                  {/* Custom Template URL */}
                  <div>
                    <label className="block text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                      Custom Template URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={customTemplateUrl}
                      onChange={(e) => setCustomTemplateUrl(e.target.value)}
                      placeholder="https://docs.google.com/document/d/..."
                      className="w-full p-3 rounded-xl border-2 transition-all focus:outline-none focus:border-[#f6421f]"
                      style={{
                        background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        color: isDark ? '#fff' : '#000',
                      }}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty to use the default template from settings
                    </p>
                  </div>
                  
                  {/* Create New Template */}
                  <div className="border-t pt-6" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold" style={{ color: isDark ? '#fff' : '#000' }}>
                        Create New Template
                      </h3>
                      <Button
                        variant={showTemplateForm ? 'secondary' : 'primary'}
                        size="sm"
                        onClick={() => setShowTemplateForm(!showTemplateForm)}
                        icon={showTemplateForm ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                      >
                        <span className="hidden sm:inline">{showTemplateForm ? 'Cancel' : 'New'}</span>
                        <span className="sm:hidden">{showTemplateForm ? '' : ''}</span>
                      </Button>
                    </div>
                    
                    {showTemplateForm && (
                      <div className="space-y-4 p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                        <div>
                          <label className="block text-sm font-medium mb-1">Template Name *</label>
                          <input
                            type="text"
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            placeholder="e.g., Event Certificate 2025"
                            className="w-full p-3 rounded-xl border transition-all focus:outline-none focus:border-[#f6421f]"
                            style={{
                              background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              color: isDark ? '#fff' : '#000',
                            }}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Template Type</label>
                          <CustomDropdown
                            value={newTemplateType}
                            onChange={(val) => setNewTemplateType(val)}
                            options={[
                              { value: 'Digital Certificate', label: 'Digital Certificate' },
                              { value: 'Meeting Notice', label: 'Meeting Notice' },
                              { value: 'Notice', label: 'Notice' },
                              { value: 'Letter', label: 'Letter' },
                              { value: 'Memo', label: 'Memo' },
                              { value: 'Custom', label: 'Custom' },
                            ]}
                            isDark={isDark}
                            size="md"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Google Docs URL *</label>
                          <input
                            type="url"
                            value={newTemplateDocsUrl}
                            onChange={(e) => setNewTemplateDocsUrl(e.target.value)}
                            placeholder="https://docs.google.com/document/d/..."
                            className="w-full p-3 rounded-xl border transition-all focus:outline-none focus:border-[#f6421f]"
                            style={{
                              background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              color: isDark ? '#fff' : '#000',
                            }}
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium mb-1">Field Placeholders</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {newTemplateFields.map((field) => (
                              <span
                                key={field}
                                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-mono"
                                style={{
                                  background: isDark ? 'rgba(246, 66, 31, 0.2)' : 'rgba(246, 66, 31, 0.1)',
                                  color: DESIGN_TOKENS.colors.brand.orange,
                                }}
                              >
                                {field}
                                <button
                                  onClick={() => setNewTemplateFields(prev => prev.filter(f => f !== field))}
                                  className="p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
                                >
                                  <X className="w-3 h-3 text-red-500" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={newFieldInput}
                              onChange={(e) => setNewFieldInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddFieldPlaceholder();
                                }
                              }}
                              placeholder="Add field (e.g., EVENT)"
                              className="flex-1 p-2 rounded-lg border transition-all focus:outline-none focus:border-[#f6421f]"
                              style={{
                                background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                color: isDark ? '#fff' : '#000',
                              }}
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={handleAddFieldPlaceholder}
                              icon={<Plus className="w-4 h-4" />}
                            >
                              Add
                            </Button>
                          </div>
                        </div>
                        
                        <Button
                          variant="primary"
                          onClick={handleCreateTemplate}
                          fullWidth
                        >
                          Create Template
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Database Maintenance - Hidden for non-admins or show only to Auditor */}
                  {userRole === 'Auditor' && (
                    <div className="border-t pt-6" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                      <h3 className="text-lg font-semibold mb-2" style={{ color: isDark ? '#fff' : '#000' }}>
                        Database Maintenance
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        If issuances display incorrectly (showing raw JSON), run this migration to fix column alignment.
                      </p>
                      <button
                        onClick={handleMigrateColumns}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                        style={{
                          background: isDark ? 'rgba(246, 66, 31, 0.2)' : 'rgba(246, 66, 31, 0.1)',
                          color: DESIGN_TOKENS.colors.brand.orange,
                          border: `1px solid ${DESIGN_TOKENS.colors.brand.orange}40`,
                        }}
                      >
                        <RefreshCw className="w-4 h-4" />
                        Run Column Migration
                      </button>
                    </div>
                  )}
                  
                  {/* Existing Templates List */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: isDark ? '#fff' : '#000' }}>
                      Available Templates
                    </h3>
                    <div className="space-y-3">
                      {templates.map((template) => (
                        <div
                          key={template.TemplateID}
                          className="rounded-xl border overflow-hidden"
                          style={{
                            borderColor: editingTemplateId === template.TemplateID 
                              ? DESIGN_TOKENS.colors.brand.orange 
                              : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                          }}
                        >
                          {/* Template header - always visible */}
                          <div className="p-4 flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                                {template.Name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {template.Type} - {template.FieldsParsed?.length || 0} fields
                              </p>
                            </div>
                            <div className="flex items-center gap-2 ml-2">
                              {template.DocsUrl ? (
                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
                              )}
                              {template.DocsUrl && (
                                <a
                                  href={template.DocsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                                  title="Open template"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              )}
                              {editingTemplateId === template.TemplateID ? (
                                <button
                                  onClick={handleCancelEditTemplate}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                                  title="Cancel editing"
                                >
                                  <X className="w-4 h-4 text-gray-500" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStartEditTemplate(template)}
                                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                                  title="Edit template"
                                >
                                  <Edit2 className="w-4 h-4 text-gray-500 hover:text-[#f6421f]" />
                                </button>
                              )}
                            </div>
                          </div>
                          
                          {/* Edit form - shown when editing this template */}
                          {editingTemplateId === template.TemplateID && (
                            <div 
                              className="p-4 border-t space-y-4"
                              style={{ 
                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.01)',
                              }}
                            >
                              <div>
                                <label className="block text-sm font-medium mb-1">Template Name *</label>
                                <input
                                  type="text"
                                  value={editTemplateName}
                                  onChange={(e) => setEditTemplateName(e.target.value)}
                                  placeholder="e.g., Event Certificate 2025"
                                  className="w-full p-3 rounded-xl border transition-all focus:outline-none focus:border-[#f6421f]"
                                  style={{
                                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                    color: isDark ? '#fff' : '#000',
                                  }}
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-1">Template Type</label>
                                <CustomDropdown
                                  value={editTemplateType}
                                  onChange={(val) => setEditTemplateType(val)}
                                  options={[
                                    { value: 'Digital Certificate', label: 'Digital Certificate' },
                                    { value: 'Meeting Notice', label: 'Meeting Notice' },
                                    { value: 'Notice', label: 'Notice' },
                                    { value: 'Letter', label: 'Letter' },
                                    { value: 'Memo', label: 'Memo' },
                                    { value: 'Custom', label: 'Custom' },
                                  ]}
                                  isDark={isDark}
                                  size="md"
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-1">Google Docs URL *</label>
                                <input
                                  type="url"
                                  value={editTemplateDocsUrl}
                                  onChange={(e) => setEditTemplateDocsUrl(e.target.value)}
                                  placeholder="https://docs.google.com/document/d/..."
                                  className="w-full p-3 rounded-xl border transition-all focus:outline-none focus:border-[#f6421f]"
                                  style={{
                                    background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                    color: isDark ? '#fff' : '#000',
                                  }}
                                />
                              </div>
                              
                              <div>
                                <label className="block text-sm font-medium mb-1">Field Placeholders</label>
                                <div className="flex flex-wrap gap-2 mb-2">
                                  {editTemplateFields.map((field) => (
                                    <span
                                      key={field}
                                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-mono"
                                      style={{
                                        background: isDark ? 'rgba(246, 66, 31, 0.2)' : 'rgba(246, 66, 31, 0.1)',
                                        color: DESIGN_TOKENS.colors.brand.orange,
                                      }}
                                    >
                                      {field}
                                      <button
                                        onClick={() => setEditTemplateFields(prev => prev.filter(f => f !== field))}
                                        className="p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30"
                                      >
                                        <X className="w-3 h-3 text-red-500" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={editFieldInput}
                                    onChange={(e) => setEditFieldInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddEditFieldPlaceholder();
                                      }
                                    }}
                                    placeholder="Add field (e.g., EVENT)"
                                    className="flex-1 p-2 rounded-lg border transition-all focus:outline-none focus:border-[#f6421f]"
                                    style={{
                                      background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                                      borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                      color: isDark ? '#fff' : '#000',
                                    }}
                                  />
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleAddEditFieldPlaceholder}
                                    icon={<Plus className="w-4 h-4" />}
                                  >
                                    Add
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="flex gap-2 pt-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={handleCancelEditTemplate}
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={handleSaveTemplate}
                                  disabled={isSavingTemplate}
                                  icon={isSavingTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                  className="flex-1"
                                >
                                  {isSavingTemplate ? 'Saving...' : 'Save Changes'}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2 p-3 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              <button
                onClick={() => { 
                  cleanupPreviewUrl(); 
                  // Reset all form inputs
                  setSelectedTemplate(null);
                  setSelectedRecipients([]);
                  setFieldInputs([]);
                  setEmailTitle("");
                  setEmailMessage("");
                  setCustomTemplateUrl("");
                  setIssuanceTitle("");
                  setSendToEmail(true);
                  setCreateModalTab('recipients');
                  setPreviewPdfUrl("");
                  setPreviewImageUrl("");
                  setPreviewPdfList([]);
                  setCurrentPreviewIndex(0);
                  setActiveCommand(null);
                  setCommandSearchQuery('');
                  setRecipientSearchQuery('');
                  setShowRecipientDropdown(false);
                  setExternalName('');
                  setExternalEmail('');
                  setShowAddFieldInput(false);
                  setDynamicFieldInput('');
                  setIsEditMode(false);
                  setEditingIssuanceId(null);
                  setShowCreateModal(false); 
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                }}
              >
                Cancel
              </button>
              
              {/* Sending Progress */}
              {isSending && sendProgress && (
                <div className="flex-1 mx-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f6421f]" />
                    <span>
                      Sending: {sendProgress.sent}/{sendProgress.total}
                    </span>
                    {sendProgress.failed > 0 && (
                      <span className="text-red-500">({sendProgress.failed} failed)</span>
                    )}
                  </div>
                </div>
              )}
              
              <button
                onClick={handleCreateIssuance}
                disabled={isSending || !issuanceTitle || !selectedTemplate || selectedRecipients.length === 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                style={{
                  background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)`,
                  color: '#fff',
                  boxShadow: '0 2px 8px rgba(246, 66, 31, 0.25)',
                }}
              >
                {isEditMode ? <Edit2 className="w-3.5 h-3.5" /> : (sendToEmail ? <Send className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />)}
                <span>{isEditMode ? 'Update Draft' : 'Create'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============= DETAIL MODAL ============= */}
      {showDetailModal && selectedIssuance && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          style={{ zIndex: 9999993 }}
        >
          {/* MEMBER VIEW - Simplified Modal */}
          {isMemberView ? (
            <MemberIssuanceModal
              issuance={selectedIssuance}
              isDark={isDark}
              glassStyle={glassStyle}
              userEmail={userEmail}
              username={username}
              profilePicture={userProfilePicture}
              members={members}
              onClose={() => setShowDetailModal(false)}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
            />
          ) : (
          /* ADMIN/AUDITOR VIEW - Full Modal */
          <div
            className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border-2 flex flex-col"
            style={{
              ...glassStyle,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 p-4 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              <h2 className="text-lg sm:text-xl font-bold line-clamp-2 break-words flex-1 min-w-0" style={{ color: isDark ? '#fff' : '#000' }} title={selectedIssuance.Title}>
                {selectedIssuance.Title}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              {[
                { id: 'info', label: 'Information', icon: FileText },
                { id: 'preview', label: 'Preview', icon: Eye },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDetailModalTab(tab.id as DetailModalTab)}
                  className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
                    detailModalTab === tab.id
                      ? 'text-[#f6421f] border-b-2 border-[#f6421f]'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              ))}
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {detailModalTab === 'info' && (
                <div className="space-y-6">
                  {/* Status */}
                  <div className="flex items-center gap-3">
                    <StatusChip
                      status={selectedIssuance.Status.toLowerCase() as 'draft' | 'sent'}
                      label={selectedIssuance.Status}
                      customColor={getIssuanceStatusColor(selectedIssuance.Status)}
                    />
                    <span className="text-sm text-muted-foreground">
                      Created {formatIssuanceDate(selectedIssuance.CreatedAt)}
                    </span>
                  </div>
                  
                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                      <p className="text-sm text-muted-foreground mb-1">Template</p>
                      <p className="font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
                        {selectedIssuance.TemplateName}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                      <p className="text-sm text-muted-foreground mb-1">Delivery Method</p>
                      <div className="flex items-center gap-2">
                        {selectedIssuance.DeliveryMethod === 'DownloadOnly' ? (
                          <>
                            <Download className="w-4 h-4" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
                            <span className="font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
                              Download Only
                            </span>
                          </>
                        ) : (
                          <>
                            <Mail className="w-4 h-4" style={{ color: '#3b82f6' }} />
                            <span className="font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
                              Email Delivery
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                      <p className="text-sm text-muted-foreground mb-1">Created By</p>
                      <p className="font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
                        {selectedIssuance.CreatedBy}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                      <p className="text-sm text-muted-foreground mb-1">Recipient Type</p>
                      <p className="font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
                        {getRecipientTypeLabel(selectedIssuance.RecipientType)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                      <p className="text-sm text-muted-foreground mb-1">Recipients</p>
                      <p className="font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
                        {selectedIssuance.TotalRecipients} total
                        {selectedIssuance.SentCount > 0 && (
                          <span className="text-green-500 ml-2">
                            ({selectedIssuance.SentCount} sent)
                          </span>
                        )}
                        {(selectedIssuance.ResentCount || 0) > 0 && (
                          <span className="text-blue-500 ml-2">
                            ({selectedIssuance.ResentCount} resent)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  
                  {/* Field Values */}
                  {selectedIssuance.FieldInputs && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                        Field Values
                      </h4>
                      <div className="space-y-2">
                        {Object.entries(parseFieldInputs(selectedIssuance.FieldInputs)).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-2 text-sm">
                            <span className="font-mono px-2 py-0.5 rounded" style={{ background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
                              {key}
                            </span>
                            
                            <span style={{ color: isDark ? '#fff' : '#000' }}>{value || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Recipients List - Table View */}
                  {selectedIssuance.Recipients && selectedIssuance.Recipients.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                          Recipients ({selectedIssuance.Recipients.length})
                        </h4>
                        {/* Status summary */}
                        <div className="flex items-center gap-3 text-xs flex-wrap justify-end">
                          {selectedIssuance.DeliveryMethod === 'DownloadOnly' ? (
                            <>
                              <span className="flex items-center gap-1">
                                <Download className="w-3 h-3 text-blue-500" />
                                {selectedIssuance.Recipients.filter(r => r.DownloadedAt).length} downloaded
                              </span>
                              {selectedIssuance.Recipients.filter(r => !r.DownloadedAt).length > 0 && (
                                <span className="flex items-center gap-1 text-amber-500">
                                  <Clock className="w-3 h-3" />
                                  {selectedIssuance.Recipients.filter(r => !r.DownloadedAt).length} awaiting
                                </span>
                              )}
                            </>
                          ) : (
                            <>
                              {selectedIssuance.SentCount > 0 && (
                                <span className="flex items-center gap-1 text-green-500">
                                  <CheckCircle className="w-3 h-3" />
                                  {selectedIssuance.SentCount} sent
                                </span>
                              )}
                              {(selectedIssuance.ResentCount || 0) > 0 && (
                                <span className="flex items-center gap-1 text-blue-500">
                                  <RefreshCw className="w-3 h-3" />
                                  {selectedIssuance.ResentCount} resent
                                </span>
                              )}
                              {selectedIssuance.Recipients.filter(r => r.Status === 'Pending').length > 0 && (
                                <span className="flex items-center gap-1 text-amber-500">
                                  <Clock className="w-3 h-3" />
                                  {selectedIssuance.Recipients.filter(r => r.Status === 'Pending').length} pending
                                </span>
                              )}
                              {selectedIssuance.FailedCount > 0 && (
                                <span className="flex items-center gap-1 text-red-500">
                                  <XCircle className="w-3 h-3" />
                                  {selectedIssuance.FailedCount} failed
                                </span>
                              )}
                              {selectedIssuance.Recipients.filter(r => r.DownloadedAt).length > 0 && (
                                <span className="flex items-center gap-1 text-blue-500">
                                  <Download className="w-3 h-3" />
                                  {selectedIssuance.Recipients.filter(r => r.DownloadedAt).length} downloaded
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      {/* Scrollable Table Container */}
                      {(() => {
                        // Check if custom name field was used (has a value in FieldInputs for {NAME})
                        const fieldValues = parseFieldInputs(selectedIssuance.FieldInputs);
                        const hasCustomNameField = fieldValues['{NAME}'] && fieldValues['{NAME}'].trim() !== '';
                        
                        return (
                      <div 
                        className="rounded-lg border overflow-hidden"
                        style={{ 
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
                        }}
                      >
                        <div className="overflow-x-auto max-h-60 overflow-y-auto">
                          <table className={`w-full ${hasCustomNameField ? 'min-w-[800px]' : 'min-w-[700px]'}`}>
                            <thead>
                              <tr 
                                className="border-b text-left text-xs font-semibold sticky top-0"
                                style={{ 
                                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                                  background: isDark ? 'rgba(30,30,30,0.98)' : 'rgba(250,250,250,0.98)'
                                }}
                              >
                                <th className="px-2 py-2 text-muted-foreground text-center" style={{ width: '44px', minWidth: '44px' }}></th>
                                <th className="px-2 py-2 text-muted-foreground whitespace-nowrap">Recipient Name</th>
                                {hasCustomNameField && (
                                  <th className="px-2 py-2 text-muted-foreground whitespace-nowrap">Custom Name</th>
                                )}
                                <th className="px-2 py-2 text-muted-foreground whitespace-nowrap">Email</th>
                                <th className="px-2 py-2 text-muted-foreground whitespace-nowrap">Control No.</th>
                                <th className="px-2 py-2 text-muted-foreground whitespace-nowrap">Status</th>
                                <th className="px-2 py-2 text-muted-foreground whitespace-nowrap text-center">Downloaded</th>
                                <th className="px-2 py-2 text-muted-foreground whitespace-nowrap text-center">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedIssuance.Recipients.map((recipient, index) => {
                                const recipientProfilePic = findProfilePicture(recipient.RecipientEmail, recipient.RecipientName);
                                const isDownloadOnly = selectedIssuance.DeliveryMethod === 'DownloadOnly';
                                const isResending = resendingRecipientId === recipient.RecordID;
                                
                                // Try to get the real registered name from members list by email
                                const realNameFromMembers = findMemberName(recipient.RecipientEmail);
                                
                                // Determine the display name
                                const displayName = realNameFromMembers || recipient.RecipientName;
                                
                                // Custom name is the value from the {NAME} field input
                                const customNameValue = fieldValues['{NAME}'] || null;
                                
                                // Calculate time since issuance was created for pending status
                                const issuanceCreatedAt = new Date(selectedIssuance.CreatedAt);
                                const now = new Date();
                                const minutesSinceCreated = Math.floor((now.getTime() - issuanceCreatedAt.getTime()) / (1000 * 60));
                                const isPendingTooLong = recipient.Status === 'Pending' && minutesSinceCreated > 5;
                                
                                // Determine display status
                                const getStatusDisplay = () => {
                                  if (isDownloadOnly) {
                                    if (recipient.DownloadedAt) {
                                      return { icon: <CheckCircle className="w-4 h-4 text-green-500" />, text: 'Downloaded', color: 'text-green-500' };
                                    }
                                    return { icon: <Clock className="w-4 h-4 text-amber-500" />, text: 'Awaiting', color: 'text-amber-500' };
                                  }
                                  switch (recipient.Status) {
                                    case 'Sent':
                                      return { icon: <CheckCircle className="w-4 h-4 text-green-500" />, text: 'Sent', color: 'text-green-500' };
                                    case 'Failed':
                                      return { icon: <XCircle className="w-4 h-4 text-red-500" />, text: 'Failed', color: 'text-red-500' };
                                    case 'Downloaded':
                                      return { icon: <Download className="w-4 h-4 text-blue-500" />, text: 'Downloaded', color: 'text-blue-500' };
                                    default:
                                      if (isPendingTooLong) {
                                        return { icon: <AlertTriangle className="w-4 h-4 text-amber-600" />, text: `Pending (${minutesSinceCreated}m)`, color: 'text-amber-600' };
                                      }
                                      return { icon: <Clock className="w-4 h-4 text-amber-500" />, text: 'Pending', color: 'text-amber-500' };
                                  }
                                };
                                
                                const statusDisplay = getStatusDisplay();
                                // Show action button for Pending (Send), Failed (Resend), and Sent (Resend)
                                const showActionButton = !isDownloadOnly && (recipient.Status === 'Failed' || recipient.Status === 'Pending' || recipient.Status === 'Sent');
                                const isResendAction = recipient.Status === 'Failed' || recipient.Status === 'Sent';
                                
                                return (
                                  <tr 
                                    key={recipient.RecordID}
                                    className="border-b last:border-b-0 hover:bg-opacity-50 transition-colors"
                                    style={{ 
                                      borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                      background: index % 2 === 0 
                                        ? 'transparent' 
                                        : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)')
                                    }}
                                  >
                                    {/* Profile Picture Column */}
                                    <td className="px-2 py-2" style={{ width: '44px', minWidth: '44px' }}>
                                      <div className="flex justify-center items-center" style={{ width: '28px', height: '28px', margin: '0 auto' }}>
                                        {recipientProfilePic ? (
                                          <img
                                            src={recipientProfilePic}
                                            alt={recipient.RecipientName}
                                            className="rounded-full object-cover"
                                            style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              target.style.display = 'none';
                                              target.nextElementSibling?.classList.remove('hidden');
                                            }}
                                          />
                                        ) : null}
                                        <div
                                          className={`rounded-full flex items-center justify-center text-white text-[10px] font-bold ${recipientProfilePic ? 'hidden' : ''}`}
                                          style={{ 
                                            background: 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)',
                                            width: '28px', 
                                            height: '28px',
                                            minWidth: '28px',
                                            minHeight: '28px'
                                          }}
                                        >
                                          {getInitials(displayName)}
                                        </div>
                                      </div>
                                    </td>
                                    
                                    {/* Recipient Name Column */}
                                    <td className="px-2 py-2">
                                      <p 
                                        className="text-sm font-medium truncate max-w-[160px]" 
                                        style={{ color: isDark ? '#fff' : '#000' }}
                                        title={displayName}
                                      >
                                        {displayName}
                                      </p>
                                    </td>
                                    
                                    {/* Custom Name Column - only shown if custom name field was used */}
                                    {hasCustomNameField && (
                                      <td className="px-2 py-2">
                                        <p 
                                          className="text-sm truncate max-w-[140px]" 
                                          style={{ color: isDark ? '#fff' : '#000' }}
                                          title={customNameValue || ''}
                                        >
                                          {customNameValue}
                                        </p>
                                      </td>
                                    )}
                                    
                                    {/* Email Column */}
                                    <td className="px-2 py-2">
                                      <p 
                                        className="text-xs text-muted-foreground truncate max-w-[180px]" 
                                        title={recipient.RecipientEmail}
                                      >
                                        {recipient.RecipientEmail}
                                      </p>
                                    </td>
                                    
                                    {/* Control Number Column */}
                                    <td className="px-2 py-2">
                                      {recipient.ControlNumber ? (
                                        <span 
                                          className="text-xs font-mono px-1.5 py-0.5 rounded"
                                          style={{ 
                                            background: isDark ? 'rgba(238, 135, 36, 0.2)' : 'rgba(238, 135, 36, 0.1)',
                                            color: DESIGN_TOKENS.colors.brand.orange
                                          }}
                                          title={recipient.ControlNumber}
                                        >
                                          {recipient.ControlNumber}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </td>
                                    
                                    {/* Status Column */}
                                    <td className="px-2 py-2">
                                      <div 
                                        className="flex items-center gap-1.5 whitespace-nowrap" 
                                        title={recipient.FailedReason || statusDisplay.text}
                                      >
                                        {statusDisplay.icon}
                                        <span className={`text-xs ${statusDisplay.color}`}>{statusDisplay.text}</span>
                                      </div>
                                    </td>
                                    
                                    {/* Downloaded Column */}
                                    <td className="px-2 py-2 text-center">
                                      {recipient.DownloadedAt ? (
                                        <div 
                                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                                          style={{ background: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)' }}
                                          title={`Downloaded on ${formatIssuanceDate(recipient.DownloadedAt)}`}
                                        >
                                          <Download className="w-3 h-3 text-blue-500" />
                                          <span className="text-blue-500">Yes</span>
                                        </div>
                                      ) : (
                                        <span className="text-xs text-muted-foreground">-</span>
                                      )}
                                    </td>
                                    
                                    {/* Actions Column */}
                                    <td className="px-2 py-2">
                                      <div className="flex items-center gap-2 justify-center">
                                        {showActionButton ? (
                                          <button
                                            onClick={() => handleResendToRecipient(selectedIssuance.IssuanceID, recipient.RecordID, recipient.RecipientName)}
                                            disabled={isResending}
                                            className="px-2 py-1 rounded-md text-xs font-medium transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                                            style={{
                                              background: isResendAction 
                                                ? 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)'
                                                : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                              color: '#fff',
                                            }}
                                            title={recipient.Status === 'Failed' 
                                              ? (recipient.FailedReason ? `Failed: ${recipient.FailedReason}` : 'Resend email')
                                              : (recipient.Status === 'Sent' ? 'Resend email to this recipient' : 'Send email now')
                                            }
                                          >
                                            {isResending ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : isResendAction ? (
                                              <RefreshCw className="w-3 h-3" />
                                            ) : (
                                              <Send className="w-3 h-3" />
                                            )}
                                            <span>{isResending ? '...' : (isResendAction ? 'Resend' : 'Send')}</span>
                                          </button>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">-</span>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                        );
                      })()}
                    </div>
                  )}
                  
                  {/* Email Details */}
                  {selectedIssuance.EmailTitle && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                        Email Details
                      </h4>
                      <div className="p-4 rounded-xl space-y-2" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}>
                        <p className="text-sm">
                          <span className="text-muted-foreground">Subject: </span>
                          <span style={{ color: isDark ? '#fff' : '#000' }}>{selectedIssuance.EmailTitle}</span>
                        </p>
                        {selectedIssuance.EmailMessage && (
                          <div className="text-sm">
                            <span className="text-muted-foreground">Message: </span>
                            <div style={{ color: isDark ? '#fff' : '#000', marginTop: '4px' }}>
                              <FormattedText text={selectedIssuance.EmailMessage} />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Attachments Display */}
                  {(() => {
                    let attachmentsList: IssuanceAttachment[] = [];
                    try {
                      attachmentsList = JSON.parse(selectedIssuance.Attachments || '[]');
                    } catch {
                      attachmentsList = [];
                    }
                    if (attachmentsList.length === 0) return null;
                    
                    return (
                      <div>
                        <h4 className="text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                          <span className="flex items-center gap-2">
                            <Paperclip className="w-4 h-4" />
                            Attachments ({attachmentsList.length})
                          </span>
                        </h4>
                        <div 
                          className="p-4 rounded-xl space-y-2"
                          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                        >
                          {attachmentsList.map((attachment, index) => (
                            <a
                              key={index}
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 rounded-lg transition-all hover:scale-[1.01]"
                              style={{ 
                                background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)",
                                border: "1px solid " + (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"),
                              }}
                            >
                              <span className="text-xl">
                                {getAttachmentIcon(attachment.type)}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{attachment.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{attachment.url}</p>
                              </div>
                              <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {detailModalTab === 'preview' && (
                <div className="h-full">
                  {/* Show image preview for member view (faster local rendering), PDF for admin */}
                  {previewImageUrl && isMemberView ? (
                    // Member view: Show PNG image for faster local preview
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Image className="w-3 h-3" />
                          Image Preview (optimized for local viewing)
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDownloadPreviewPdf(selectedIssuance?.Title, selectedIssuance?.Recipients?.[0]?.RecipientName)}
                            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
                            title="Download PDF"
                          >
                            <Download className="w-4 h-4" />
                            <span className="text-xs">PDF</span>
                          </button>
                        </div>
                      </div>
                      <div
                        className="rounded-xl border overflow-auto flex items-center justify-center"
                        style={{
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          height: 'calc(60vh - 50px)',
                          background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)',
                        }}
                      >
                        <img
                          src={previewImageUrl}
                          alt="Certificate Preview"
                          className="max-w-full max-h-full object-contain shadow-lg rounded"
                          style={{ background: '#fff' }}
                        />
                      </div>
                    </div>
                  ) : previewPdfUrl ? (
                    // Admin view or fallback: Show PDF in iframe
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-end gap-2 mb-2">
                        <button
                          onClick={handleOpenPreviewInNewTab}
                          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          title="Open in New Tab"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPreviewPdf(selectedIssuance?.Title, selectedIssuance?.Recipients?.[0]?.RecipientName)}
                          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          title="Download PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                      <div
                        className="rounded-xl border overflow-hidden"
                        style={{
                          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                          height: 'calc(60vh - 50px)',
                        }}
                      >
                        <iframe
                          src={previewPdfUrl}
                          className="w-full h-full"
                          title="PDF Preview"
                        />
                      </div>
                    </div>
                  ) : selectedIssuance.CustomTemplateUrl || selectedIssuance.TemplateID ? (
                    <div
                      className="rounded-xl border overflow-hidden flex items-center justify-center"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        height: '60vh',
                        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <div className="text-center">
                        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <p className="text-muted-foreground mb-4">
                          {isMemberView ? 'View your certificate' : 'PDF preview would be shown here'}
                        </p>
                        <button
                          onClick={async () => {
                            const toastId = `detail-preview-${Date.now()}`;
                            
                            addUploadToast({
                              id: toastId,
                              title: 'Generating Preview',
                              message: isMemberView ? 'Loading your certificate...' : 'Loading document...',
                              status: 'loading',
                              progress: 20
                            });
                            
                            // Generate preview for the first recipient (or current user's certificate)
                            if (selectedIssuance.Recipients && selectedIssuance.Recipients.length > 0) {
                              try {
                                // For member view, find their own certificate
                                const recipientForPreview = isMemberView && userEmail
                                  ? selectedIssuance.Recipients.find(r => r.RecipientEmail.toLowerCase() === userEmail.toLowerCase()) 
                                    || selectedIssuance.Recipients[0]
                                  : selectedIssuance.Recipients[0];
                                
                                const fieldValues = parseFieldInputs(selectedIssuance.FieldInputs);
                                // Only use recipient name as fallback if no custom {NAME} value was set
                                if (!fieldValues['{NAME}'] || fieldValues['{NAME}'].trim() === '') {
                                  fieldValues['{NAME}'] = recipientForPreview.RecipientName;
                                }
                                
                                updateUploadToast(toastId, { progress: 50, message: 'Fetching template...' });
                                
                                const templateUrl = selectedIssuance.CustomTemplateUrl || 
                                  (await getTemplateById(selectedIssuance.TemplateID)).DocsUrl;
                                
                                if (templateUrl) {
                                  updateUploadToast(toastId, { progress: 70, message: 'Generating PDF...' });
                                  
                                  const result = await generatePdfPreview(
                                    templateUrl,
                                    fieldValues,
                                    recipientForPreview.RecipientName
                                  );
                                  setPreviewPdfUrl(result.pdfUrl);
                                  
                                  // For member view, convert PDF to PNG for faster local rendering
                                  if (isMemberView && result.pdfUrl) {
                                    updateUploadToast(toastId, { progress: 85, message: 'Optimizing for local view...' });
                                    try {
                                      const imageDataUrl = await convertPdfToImagePreview(result.pdfUrl, 2.5);
                                      setPreviewImageUrl(imageDataUrl);
                                      
                                      updateUploadToast(toastId, {
                                        status: 'success',
                                        title: 'Certificate Ready',
                                        message: 'Your certificate is ready to view and download',
                                        progress: 100
                                      });
                                    } catch (imgError) {
                                      console.warn('PNG conversion failed, using PDF fallback:', imgError);
                                      // Fallback to PDF if PNG conversion fails
                                      updateUploadToast(toastId, {
                                        status: 'success',
                                        title: 'Preview Ready',
                                        message: 'Document generated (using PDF view)',
                                        progress: 100
                                      });
                                    }
                                  } else {
                                    updateUploadToast(toastId, {
                                      status: 'success',
                                      title: 'Preview Ready',
                                      message: 'Document generated successfully',
                                      progress: 100
                                    });
                                  }
                                  
                                  setTimeout(() => removeUploadToast(toastId), 3000);
                                } else {
                                  throw new Error('No template URL found');
                                }
                              } catch (error) {
                                console.error('Preview error:', error);
                                updateUploadToast(toastId, {
                                  status: 'error',
                                  title: 'Preview Failed',
                                  message: error instanceof Error ? error.message : 'Failed to generate preview'
                                });
                                setTimeout(() => removeUploadToast(toastId), 5000);
                              }
                            } else {
                              updateUploadToast(toastId, {
                                status: 'error',
                                title: 'No Recipients',
                                message: 'No recipients found for this issuance'
                              });
                              setTimeout(() => removeUploadToast(toastId), 4000);
                            }
                          }}
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                          style={{
                            background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)`,
                            color: '#fff',
                            boxShadow: '0 4px 12px rgba(246, 66, 31, 0.3)',
                          }}
                        >
                          <Eye className="w-5 h-5" />
                          <span>{isMemberView ? 'View Certificate' : 'Generate Preview'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center rounded-xl border"
                      style={{
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        height: '60vh',
                      }}
                    >
                      <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
                      <p className="text-muted-foreground">No template configured for preview</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2 p-3 border-t flex-wrap sm:flex-nowrap" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              {/* Left side: Send button or Stop button */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Send button for Draft email issuances */}
                {canCreate && selectedIssuance && selectedIssuance.Status === 'Draft' && selectedIssuance.DeliveryMethod === 'Email' && !isSending && (() => {
                  // Calculate pending recipients count (only Pending status, not Sent or Failed)
                  const pendingCount = selectedIssuance.Recipients 
                    ? selectedIssuance.Recipients.filter(r => r.Status === 'Pending').length
                    : selectedIssuance.TotalRecipients - (selectedIssuance.SentCount || 0);
                  
                  // Don't show send button if no pending recipients
                  if (pendingCount <= 0) return null;
                  
                  return (
                    <button
                      onClick={handleSendFromDetail}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] whitespace-nowrap"
                      style={{
                        background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)`,
                        color: '#fff',
                        boxShadow: '0 2px 8px rgba(246, 66, 31, 0.25)',
                      }}
                      title={`Send emails to ${pendingCount} pending recipient${pendingCount > 1 ? 's' : ''} (excludes already sent)`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Send ({pendingCount})</span>
                    </button>
                  );
                })()}
                {/* Publish button for Draft Download-Only issuances */}
                {canCreate && selectedIssuance && selectedIssuance.Status === 'Draft' && selectedIssuance.DeliveryMethod === 'DownloadOnly' && !isSending && (
                  <button
                    onClick={handlePublishFromDetail}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] whitespace-nowrap"
                    style={{
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: '#fff',
                      boxShadow: '0 2px 8px rgba(34, 197, 94, 0.25)',
                    }}
                    title={`Publish to ${selectedIssuance.TotalRecipients} recipient${selectedIssuance.TotalRecipients > 1 ? 's' : ''} (no email will be sent)`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Publish ({selectedIssuance.TotalRecipients})</span>
                  </button>
                )}
                {/* Stop button - shows when sending */}
                {isSending && (
                  <button
                    onClick={handleStopSending}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all hover:scale-[1.02] whitespace-nowrap"
                    style={{
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      color: '#fff',
                      boxShadow: '0 2px 8px rgba(239, 68, 68, 0.25)',
                    }}
                    title="Stop sending"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Stop ({sendProgress?.sent || 0}/{sendProgress?.total || selectedIssuance?.TotalRecipients || 0})</span>
                  </button>
                )}
                {/* Sending progress indicator */}
                {isSending && sendProgress && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#f6421f]" />
                    <span>Sending {sendProgress.sent}/{sendProgress.total}...</span>
                  </div>
                )}
              </div>
              
              {/* Member View Preview Toggle - Only for Admin/Auditor when issuance is sent/downloaded */}
              {canCreate && selectedIssuance && (selectedIssuance.Status === 'Sent' || selectedIssuance.Status === 'Downloaded') && (
                <button
                  onClick={() => setShowMemberPreviewMode(!showMemberPreviewMode)}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                  style={{
                    background: showMemberPreviewMode 
                      ? DESIGN_TOKENS.colors.brand.orange + '20'
                      : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'),
                    color: showMemberPreviewMode 
                      ? DESIGN_TOKENS.colors.brand.orange
                      : (isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'),
                  }}
                  title="Preview how members see this issuance"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{showMemberPreviewMode ? 'Exit Preview' : 'Member View'}</span>
                </button>
              )}
              
              {/* Share Link Button - Copy member-accessible link */}
              {canCreate && selectedIssuance && (selectedIssuance.Status === 'Sent' || selectedIssuance.Status === 'Downloaded') && buildShareableUrl && (
                <button
                  onClick={() => {
                    // Generate member-accessible URL (not admin/auditor)
                    const memberUrl = buildShareableUrl('IssuanceCenter', { id: selectedIssuance.id }).replace(/\/(admin|auditor)\?/, '/member?');
                    navigator.clipboard.writeText(memberUrl).then(() => {
                      toast.success('Link copied!', {
                        description: 'Members can use this link to view their issuance',
                      });
                    }).catch(() => {
                      toast.error('Failed to copy link');
                    });
                  }}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                  style={{
                    background: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                  }}
                  title="Copy shareable link for members"
                >
                  <Link className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Share Link</span>
                </button>
              )}
              
              <div className="flex-1 min-w-0" />
              
              {/* Right side: Edit button (for drafts) and Close button */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Edit button for Draft issuances - icon only, beside Close */}
                {canCreate && selectedIssuance && selectedIssuance.Status === 'Draft' && !isSending && (
                  <button
                    onClick={() => handleEditDraftIssuance(selectedIssuance)}
                    className="p-1.5 rounded-lg transition-all hover:scale-[1.02]"
                    style={{
                      background: isDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
                      color: '#22c55e',
                      border: '1px solid rgba(34, 197, 94, 0.3)',
                    }}
                    title="Edit Draft"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                    color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
      
      {/* ============= DELETE CONFIRMATION MODAL ============= */}
      {showDeleteConfirmModal && issuanceToDelete && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          style={{ zIndex: 9999998 }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border-2"
            style={{
              ...glassStyle,
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
            }}
          >
            {/* Modal Header */}
            <div 
              className="p-5 border-b flex items-center gap-4"
              style={{ 
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)'
              }}
            >
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239, 68, 68, 0.2)' }}
              >
                <AlertTriangle className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
                  Delete Issuance Permanently?
                </h3>
                <p className="text-sm text-muted-foreground">
                  This action cannot be undone
                </p>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <div 
                className="p-4 rounded-xl"
                style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }}
              >
                <p className="text-sm font-medium mb-1" style={{ color: isDark ? '#fff' : '#000' }}>
                  {issuanceToDelete.Title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {issuanceToDelete.TemplateName} - {issuanceToDelete.TotalRecipients} recipients
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Created: {formatIssuanceDate(issuanceToDelete.CreatedAt)}
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-600 dark:text-red-400">
                  <strong>Warning:</strong> This will permanently delete the issuance, all recipient records, 
                  and send logs. Recipients will no longer be able to access or download their certificates.
                </p>
              </div>
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t flex justify-end gap-3" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              <Button
                variant="secondary"
                onClick={() => { setShowDeleteConfirmModal(false); setIssuanceToDelete(null); }}
              >
                Cancel
              </Button>
              <button
                onClick={handlePermanentDelete}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all hover:scale-105"
                style={{
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: '#fff',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)',
                }}
              >
                <Trash2 className="w-4 h-4 inline mr-2" />
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ============= MEMBER PREVIEW MODAL (for Admin/Auditor to see member view) ============= */}
      {showMemberPreviewMode && selectedIssuance && canCreate && (
        <div 
          className="fixed inset-0 flex items-center justify-center p-4 py-8 bg-black/60 backdrop-blur-sm"
          style={{ zIndex: 9999997 }}
        >
          <div className="relative w-full max-w-3xl mx-auto max-h-[calc(100vh-4rem)]">
            {/* Preview Badge - More visible */}
            <div className="mb-3 text-center">
              <span 
                className="px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2 justify-center w-fit mx-auto shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                  color: '#fff',
                  border: '2px solid rgba(255,255,255,0.2)'
                }}
              >
                <Eye className="w-4 h-4" />
                Member View Preview
              </span>
            </div>
            <MemberIssuanceModal
              issuance={selectedIssuance}
              isDark={isDark}
              glassStyle={glassStyle}
              userEmail={selectedIssuance.Recipients?.[0]?.RecipientEmail || ''}
              username={selectedIssuance.Recipients?.[0]?.RecipientName || 'Member'}
              profilePicture={findProfilePicture(
                selectedIssuance.Recipients?.[0]?.RecipientEmail,
                selectedIssuance.Recipients?.[0]?.RecipientName
              )}
              members={members}
              onClose={() => setShowMemberPreviewMode(false)}
              addUploadToast={addUploadToast}
              updateUploadToast={updateUploadToast}
              removeUploadToast={removeUploadToast}
            />
          </div>
        </div>
      )}
      
      {/* Upload Toast Container for debug/progress notifications */}
      <UploadToastContainer 
        messages={uploadToastMessages} 
        onDismiss={removeUploadToast}
        isDark={isDark}
      />
    </PageLayout>
  );
}
