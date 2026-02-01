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
  RefreshCw, Settings, Copy, ExternalLink, FileCheck, Clock, Image
} from "lucide-react";
import { PageLayout, Button, SearchInput, StatusChip, DESIGN_TOKENS, getGlassStyle } from "./design-system";
import CustomDropdown from "./CustomDropdown";
import { UploadToastContainer, type UploadToastMessage } from "./UploadToast";
import {
  getIssuances,
  getIssuancesByRecipient,
  getIssuanceById,
  createIssuance,
  deleteIssuance,
  getTemplates,
  createTemplate,
  sendIssuance,
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
  type Issuance,
  type IssuanceTemplate,
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
}

interface FieldInput {
  placeholder: string;
  value: string;
  enabled: boolean;
}

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
      fieldValues['{NAME}'] = userRecipient.RecipientName;

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
      className="w-full max-w-md mx-auto overflow-hidden rounded-2xl border-2 flex flex-col"
      style={{
        ...glassStyle,
        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        background: isDark ? 'rgba(17, 24, 39, 0.98)' : 'rgba(255, 255, 255, 0.98)',
        maxHeight: 'calc(100vh - 2rem)',
      }}
    >
      {/* Modal Header - Compact */}
      <div 
        className="px-4 py-3 border-b relative flex-shrink-0"
        style={{ 
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange}15 0%, rgba(246, 66, 31, 0.1) 100%)`
        }}
      >
        {/* Close Button - Fixed top right */}
        <button
          onClick={onClose}
          className="absolute right-2 top-2 p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors z-10"
          style={{ lineHeight: 0 }}
        >
          <X className="w-4 h-4" />
        </button>
        
        {/* Centered Content */}
        <div className="text-center">
          {/* Certificate Icon - Smaller */}
          <div 
            className="w-10 h-10 mx-auto mb-1.5 rounded-full flex items-center justify-center"
            style={{ 
              background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)`,
              boxShadow: '0 3px 12px rgba(246, 66, 31, 0.25)'
            }}
          >
            <FileCheck className="w-5 h-5 text-white" />
          </div>
          
          <h2 className="text-base sm:text-lg font-bold mb-0 px-6" style={{ color: isDark ? '#fff' : '#000' }}>
            {issuance.Title}
          </h2>
          <p className="text-xs text-muted-foreground">
            Certificate issued to you
          </p>
        </div>
      </div>
      
      {/* Modal Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 sm:space-y-4">
        {/* Recipient Name */}
        <div 
          className="p-3 sm:p-4 rounded-xl"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5">
            <User className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Recipient Name</span>
          </div>
          <p className="text-base sm:text-lg font-semibold pl-6 sm:pl-8" style={{ color: isDark ? '#fff' : '#000' }}>
            {userRecipient?.RecipientName || username || 'N/A'}
          </p>
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
                <p 
                  className="text-xs sm:text-sm leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap" 
                  style={{ 
                    color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
                    textAlign: 'justify',
                    wordBreak: 'break-word',
                    hyphens: 'auto'
                  }}
                >
                  {issuance.EmailMessage}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Status Info */}
        <div 
          className="p-3 sm:p-4 rounded-xl"
          style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
        >
          <div className="flex items-center gap-2 sm:gap-3 mb-1.5">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: DESIGN_TOKENS.colors.brand.orange }} />
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Issued On</span>
          </div>
          <p className="text-sm pl-6 sm:pl-8" style={{ color: isDark ? '#fff' : '#000' }}>
            {formatIssuanceDate(issuance.SentAt || issuance.CreatedAt)}
          </p>
        </div>
      </div>
      
      {/* Modal Footer - Download Button */}
      <div 
        className="p-4 sm:p-5 border-t flex-shrink-0"
        style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}
      >
        <button
          onClick={handleDownloadCertificate}
          disabled={isDownloading || !userRecipient}
          className="w-full py-3 sm:py-3.5 px-4 sm:px-6 rounded-xl text-sm sm:text-base font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3"
          style={{
            background: `linear-gradient(135deg, ${DESIGN_TOKENS.colors.brand.orange} 0%, #f6421f 100%)`,
            color: '#fff',
            boxShadow: '0 4px 16px rgba(246, 66, 31, 0.3)',
          }}
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              <span>Preparing...</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Download Certificate</span>
            </>
          )}
        </button>
        
        <button
          onClick={onClose}
          className="w-full mt-2 py-2 sm:py-2.5 px-4 rounded-xl text-xs sm:text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)' }}
        >
          Close
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
}: IssuanceCenterPageProps) {
  const glassStyle = getGlassStyle(isDark);
  
  // Check if user can create issuances (Admin or Auditor only)
  const roleLower = userRole.toLowerCase();
  const canCreate = roleLower === 'admin' || roleLower === 'auditor';
  const isMemberView = !canCreate;
  
  // ============= STATE =============
  // List state
  const [issuances, setIssuances] = useState<Issuance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedIssuance, setSelectedIssuance] = useState<Issuance | null>(null);
  const [createModalTab, setCreateModalTab] = useState<CreateModalTab>('recipients');
  const [detailModalTab, setDetailModalTab] = useState<DetailModalTab>('info');
  
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
  
  // Universal search command state
  type SearchCommand = '@Person' | '@Event' | '@Committee' | '@All' | '@External' | null;
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
  
  // Sending state
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<SendResult | null>(null);
  
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
  
  // ============= DATA LOADERS (with localStorage caching) =============
  
  const loadIssuances = async () => {
    setIsLoading(true);
    try {
      // If member view (heads, members, and roles below auditor/admin), 
      // only load issuances where they are a recipient (matched by email or name)
      const data = isMemberView && (userEmail || username)
        ? await getIssuancesByRecipient(userEmail || '', username)
        : await getIssuances();
      setIssuances(data);
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
          console.log(`[Issuance] Loaded ${cached.length} members from cache`);
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
        console.log(`[Issuance] Fetched ${uniqueMembers.length} members from Directory service`);
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
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(i =>
        i.Title.toLowerCase().includes(query) ||
        i.TemplateName.toLowerCase().includes(query) ||
        i.CreatedBy.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [issuances, typeFilter, searchQuery, templates]);
  
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
    
    setSelectedIssuance(issuance);
    setDetailModalTab('info');
    setShowDetailModal(true);
    
    // Load full issuance data with recipients
    try {
      const fullData = await getIssuanceById(issuance.IssuanceID);
      setSelectedIssuance(fullData);
      
      // Debug log to check if Recipients are loaded
      console.log('[Issuance Debug] Full data loaded:', {
        issuanceId: fullData.IssuanceID,
        title: fullData.Title,
        recipientsCount: fullData.Recipients?.length || 0,
        recipients: fullData.Recipients
      });
    } catch (error) {
      console.error("Error loading issuance details:", error);
    }
  };
  
  const handleDeleteIssuance = async (id: string) => {
    if (!confirm("Are you sure you want to archive this issuance?")) return;
    
    try {
      await deleteIssuance(id);
      toast.success("Issuance archived");
      logDelete(username, "Issuance", id);
      loadIssuances();
    } catch (error) {
      toast.error("Failed to archive issuance");
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
      enabled: true
    })));
    
    // Set default email title
    setEmailTitle(`Your ${template.Name}`);
    
    // Check for default template URL from settings
    const templateKey = `Default${template.Type.replace(/\s+/g, '')}Template`;
    if (settings[templateKey]?.value) {
      setCustomTemplateUrl("");
    }
  };
  
  const handleAddRecipient = (recipient: SelectedRecipient) => {
    // Use id or email+name as unique identifier (for recipients without email)
    const recipientKey = recipient.email || `${recipient.id}-${recipient.name}`;
    if (selectedRecipients.find(r => (r.email || `${r.id}-${r.name}`) === recipientKey)) {
      toast.error("Recipient already added");
      return;
    }
    setSelectedRecipients(prev => [...prev, recipient]);
    setRecipientSearchQuery("");
    setCommandSearchQuery("");
    setShowRecipientDropdown(false);
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
            hasEmail: a.hasEmail !== undefined ? a.hasEmail : !!a.email
          }));
          
          setSelectedRecipients(prev => {
            // Use id+name as key for recipients without email
            const existing = new Set(prev.map(r => r.email || `${r.id}-${r.name}`));
            const toAdd = newRecipients.filter(r => !existing.has(r.email || `${r.id}-${r.name}`));
            return [...prev, ...toAdd];
          });
          
          // Show detailed toast with email status
          const withEmail = newRecipients.filter(r => r.hasEmail).length;
          const withoutEmail = newRecipients.length - withEmail;
          if (withoutEmail > 0) {
            toast.success(`Added ${newRecipients.length} attendees from ${event.Title} (${withoutEmail} without email - shown in red)`);
          } else {
            toast.success(`Added ${newRecipients.length} attendees from ${event.Title}`);
          }
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
          const committeeMembers = members.filter(m => 
            m.committee?.toLowerCase().includes(committee.name.toLowerCase())
          );
          const newRecipients: SelectedRecipient[] = committeeMembers.map(m => ({
            id: m.id,
            name: m.name,
            email: m.email || '',
            type: 'Member' as const,
            source: committee.name
          })).filter(r => r.email);
          setSelectedRecipients(prev => {
            const existing = new Set(prev.map(r => r.email));
            const toAdd = newRecipients.filter(r => !existing.has(r.email));
            return [...prev, ...toAdd];
          });
          toast.success(`Added ${newRecipients.length} members from ${committee.name}`);
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
    
    handleAddRecipient({
      id: `ext-${Date.now()}`,
      name: externalName.trim(),
      email: externalEmail.trim(),
      type: 'External',
      source: 'External'
    });
    
    setExternalName("");
    setExternalEmail("");
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
      
      setSelectedRecipients(newRecipients);
      toast.success(`Added ${newRecipients.length} members from directory`);
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
    
    // Add debug toast
    addUploadToast({
      id: toastId,
      title: 'Generating Preview',
      message: 'Preparing document preview...',
      status: 'loading',
      progress: 10,
      progressLabel: 'Initializing...'
    });
    
    try {
      // Cleanup previous preview URLs
      cleanupPreviewUrl();
      
      updateUploadToast(toastId, { progress: 30, progressLabel: 'Processing template...' });
      
      const fieldValues: Record<string, string> = {};
      fieldInputs.forEach(f => {
        if (f.enabled) {
          fieldValues[f.placeholder] = f.value || `[${f.placeholder}]`;
        }
      });
      
      // Auto-fill {NAME} with first recipient's name for preview
      const previewName = selectedRecipients.length > 0 
        ? selectedRecipients[0].name 
        : "Sample Recipient Name";
      
      // Override {NAME} if it exists in fields (for preview purposes)
      if (fieldValues['{NAME}'] === '' || fieldValues['{NAME}'] === '[{NAME}]') {
        fieldValues['{NAME}'] = previewName;
      }
      
      updateUploadToast(toastId, { progress: 50, progressLabel: 'Generating PDF...' });
      
      // Pass all recipients for combined multi-page preview
      // Each recipient will get their own page in the preview PDF
      const recipientsForPreview = selectedRecipients.length > 0 
        ? selectedRecipients 
        : undefined;
      
      const result = await generatePdfPreview(templateUrl, fieldValues, previewName, recipientsForPreview);
      
      updateUploadToast(toastId, { progress: 90, progressLabel: 'Finalizing...' });
      
      setPreviewPdfUrl(result.pdfUrl);
      setCreateModalTab('preview');
      
      // Store the preview list for pagination if multiple recipients
      if (result.pdfPreviews && result.pdfPreviews.length > 1) {
        setPreviewPdfList(result.pdfPreviews);
        setCurrentPreviewIndex(0);
        
        updateUploadToast(toastId, {
          status: 'success',
          title: 'Preview Generated',
          message: `${result.pdfPreviews.length} certificates ready. Use arrows to navigate.`,
          progress: 100
        });
      } else {
        setPreviewPdfList([]);
        setCurrentPreviewIndex(0);
        
        updateUploadToast(toastId, {
          status: 'success',
          title: 'Preview Generated',
          message: 'Document preview is ready.',
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
    
    // Add debug toast
    addUploadToast({
      id: toastId,
      title: sendToEmail ? 'Sending Issuance' : 'Creating Issuance',
      message: 'Preparing issuance...',
      status: 'loading',
      progress: 5,
      progressLabel: 'Initializing...'
    });
    
    try {
      // Prepare field inputs
      const fieldValues: Record<string, string> = {};
      fieldInputs.forEach(f => {
        if (f.enabled) {
          fieldValues[f.placeholder] = f.value;
        }
      });
      
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
      
      updateUploadToast(toastId, { progress: 15, progressLabel: 'Creating issuance record...' });
      
      const issuanceData: CreateIssuanceData = {
        title: issuanceTitle,
        templateId: selectedTemplate.TemplateID,
        templateName: selectedTemplate.Name,
        createdBy: username,
        recipientType: determineRecipientType(),
        recipientDetails: selectedRecipients.map(r => ({
          name: r.name,
          email: r.email,
          source: r.source
        })),
        totalRecipients: selectedRecipients.length,
        fieldInputs: fieldValues,
        emailTitle: sendToEmail ? emailTitle : undefined,
        emailMessage: sendToEmail ? emailMessage : undefined,
        customTemplateUrl: customTemplateUrl || undefined,
        recipients: selectedRecipients.map(r => ({
          name: r.name,
          email: r.email,
          type: r.type
        }))
      };
      
      const issuanceId = await createIssuance(issuanceData);
      
      updateUploadToast(toastId, { progress: 30, progressLabel: 'Issuance created...' });
      
      logCreate(username, "Issuance", issuanceTitle);
      
      // If sending to email, trigger send immediately
      if (sendToEmail) {
        setIsSending(true);
        
        updateUploadToast(toastId, { 
          progress: 35, 
          progressLabel: `Sending to ${selectedRecipients.length} recipients...`,
          message: `Sending emails to ${selectedRecipients.length} recipients...`
        });
        
        try {
          const result = await sendIssuance(issuanceId, username, (progress) => {
            setSendProgress(progress);
            const percent = Math.round(35 + (progress.sent / progress.total) * 60);
            updateUploadToast(toastId, { 
              progress: percent, 
              progressLabel: `Sent ${progress.sent}/${progress.total}...`,
              message: `Sent ${progress.sent} of ${progress.total} emails${progress.failed > 0 ? ` (${progress.failed} failed)` : ''}`
            });
          });
          
          setSendProgress(result);
          
          // Final result
          if (result.failed > 0) {
            // Show which recipients failed
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
        } catch (error) {
          updateUploadToast(toastId, {
            status: 'error',
            title: 'Sending Failed',
            message: error instanceof Error ? error.message : 'Failed to send emails'
          });
          setTimeout(() => removeUploadToast(toastId), 6000);
        } finally {
          setIsSending(false);
        }
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
      
      // Refresh list and close modal
      loadIssuances();
      setShowCreateModal(false);
      
    } catch (error) {
      console.error('Create issuance error:', error);
      updateUploadToast(toastId, {
        status: 'error',
        title: 'Creation Failed',
        message: error instanceof Error ? error.message : 'Failed to create issuance'
      });
      setTimeout(() => removeUploadToast(toastId), 5000);
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
  
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
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
            placeholder="Search issuances..."
            isDark={isDark}
          />
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
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-base mb-1 truncate" style={{ color: isDark ? '#fff' : '#000' }}>
                    {issuance.Title}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {issuance.TemplateName}
                  </p>
                </div>
                <StatusChip
                  status={issuance.Status.toLowerCase() as 'draft' | 'sent'}
                  label={issuance.Status}
                  customColor={getIssuanceStatusColor(issuance.Status)}
                />
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
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteIssuance(issuance.IssuanceID); }}
                    className="py-2 px-3 rounded-lg text-sm font-medium transition-all bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
                  <td className="p-4">
                    <span className="font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
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
                  </td>
                  <td className="p-4">
                    <StatusChip
                      status={issuance.Status.toLowerCase() as 'draft' | 'sent'}
                      label={issuance.Status}
                      customColor={getIssuanceStatusColor(issuance.Status)}
                    />
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
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteIssuance(issuance.IssuanceID); }}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-red-600 dark:text-red-400 transition-colors"
                          title="Archive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <h2 className="text-xl font-bold" style={{ color: isDark ? '#fff' : '#000' }}>
                Create New Issuance
              </h2>
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
                          <span className="text-green-500">• Template configured</span>
                        ) : (
                          <span className="text-amber-500">• No template URL set</span>
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
                                        {event.Status} • {event.StartDate}
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
                          </div>
                        )}
                      </div>
                    </div>
                    
                  </div>
                  
                  {/* Field Inputs */}
                  {selectedTemplate && fieldInputs.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                        Template Fields
                      </label>
                      <div className="space-y-3">
                        {fieldInputs.map((field, index) => {
                          const isNameField = field.placeholder === '{NAME}';
                          return (
                            <div key={field.placeholder} className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={field.enabled}
                                onChange={(e) => {
                                  const updated = [...fieldInputs];
                                  updated[index].enabled = e.target.checked;
                                  setFieldInputs(updated);
                                }}
                                className="w-5 h-5 rounded border-2 accent-[#f6421f]"
                                disabled={isNameField}
                              />
                              <span className="w-28 text-sm font-mono" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                                {field.placeholder}
                              </span>
                              {isNameField ? (
                                <div 
                                  className="flex-1 p-2 rounded-lg border text-sm"
                                  style={{
                                    background: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
                                    borderColor: 'rgba(34, 197, 94, 0.3)',
                                    color: isDark ? 'rgba(134, 239, 172, 1)' : 'rgba(22, 163, 74, 1)',
                                  }}
                                >
                                  ✓ Auto-filled from recipients ({selectedRecipients.length > 0 ? selectedRecipients[0].name : 'Add recipients first'})
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
                        💡 {'{NAME}'} is automatically replaced with each recipient's name when sending
                      </p>
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
                      </div>
                    </div>
                  )}
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
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
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
                        {showTemplateForm ? 'Cancel' : 'New Template'}
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
                          <select
                            value={newTemplateType}
                            onChange={(e) => setNewTemplateType(e.target.value)}
                            className="w-full p-3 rounded-xl border transition-all focus:outline-none focus:border-[#f6421f]"
                            style={{
                              background: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                              color: isDark ? '#fff' : '#000',
                            }}
                          >
                            <option value="Digital Certificate">Digital Certificate</option>
                            <option value="Meeting Notice">Meeting Notice</option>
                            <option value="Notice">Notice</option>
                            <option value="Letter">Letter</option>
                            <option value="Memo">Memo</option>
                            <option value="Custom">Custom</option>
                          </select>
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
                  
                  {/* Existing Templates List */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4" style={{ color: isDark ? '#fff' : '#000' }}>
                      Available Templates
                    </h3>
                    <div className="space-y-2">
                      {templates.map((template) => (
                        <div
                          key={template.TemplateID}
                          className="p-4 rounded-xl border flex items-center justify-between"
                          style={{
                            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                          }}
                        >
                          <div>
                            <p className="font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
                              {template.Name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {template.Type} • {template.FieldsParsed?.length || 0} fields
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {template.DocsUrl ? (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                              <AlertCircle className="w-5 h-5 text-amber-500" />
                            )}
                            {template.DocsUrl && (
                              <a
                                href={template.DocsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              <Button
                variant="secondary"
                onClick={() => { cleanupPreviewUrl(); setShowCreateModal(false); }}
              >
                Cancel
              </Button>
              
              {/* Sending Progress */}
              {isSending && sendProgress && (
                <div className="flex-1 mx-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-[#f6421f]" />
                    <span>
                      Sending: {sendProgress.sent}/{sendProgress.total}
                    </span>
                    {sendProgress.failed > 0 && (
                      <span className="text-red-500">({sendProgress.failed} failed)</span>
                    )}
                  </div>
                </div>
              )}
              
              <Button
                variant="primary"
                onClick={handleCreateIssuance}
                disabled={isSending || !issuanceTitle || !selectedTemplate || selectedRecipients.length === 0}
                icon={sendToEmail ? <Send className="w-4 h-4" /> : <Download className="w-4 h-4" />}
              >
                {sendToEmail ? 'Create & Send' : 'Create Issuance'}
              </Button>
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
            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              <h2 className="text-xl font-bold truncate pr-4" style={{ color: isDark ? '#fff' : '#000' }}>
                {selectedIssuance.Title}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
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
                            <span className="text-muted-foreground">→</span>
                            <span style={{ color: isDark ? '#fff' : '#000' }}>{value || '(empty)'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Recipients List */}
                  {selectedIssuance.Recipients && selectedIssuance.Recipients.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2" style={{ color: DESIGN_TOKENS.colors.brand.orange }}>
                        Recipients ({selectedIssuance.Recipients.length})
                      </h4>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selectedIssuance.Recipients.map((recipient) => (
                          <div
                            key={recipient.RecordID}
                            className="flex items-center justify-between p-3 rounded-lg"
                            style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)' }}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                                style={{ background: 'linear-gradient(135deg, #ee8724 0%, #f6421f 100%)' }}
                              >
                                {getInitials(recipient.RecipientName)}
                              </div>
                              <div>
                                <p className="text-sm font-medium" style={{ color: isDark ? '#fff' : '#000' }}>
                                  {recipient.RecipientName}
                                </p>
                                <p className="text-xs text-muted-foreground">{recipient.RecipientEmail}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {recipient.Status === 'Sent' && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                              {recipient.Status === 'Failed' && (
                                <XCircle className="w-4 h-4 text-red-500" />
                              )}
                              {recipient.Status === 'Pending' && (
                                <Clock className="w-4 h-4 text-amber-500" />
                              )}
                              <span className="text-xs text-muted-foreground">{recipient.Status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
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
                          <p className="text-sm">
                            <span className="text-muted-foreground">Message: </span>
                            <span style={{ color: isDark ? '#fff' : '#000' }}>{selectedIssuance.EmailMessage}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  )}
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
                                fieldValues['{NAME}'] = recipientForPreview.RecipientName;
                                
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
            <div className="flex items-center justify-end gap-2 p-4 border-t" style={{ borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }}>
              <Button
                variant="secondary"
                onClick={() => setShowDetailModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
          )}
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
